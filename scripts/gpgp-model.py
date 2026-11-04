#!/usr/bin/env python3
"""EXPERIMENTELLES Modell: Umriss des Great Pacific Garbage Patch (GPGP) pro Jahr, 1950-2022.

Aufruf:  .cache/plastik/venv/bin/python -I scripts/gpgp-model.py [--reuse] [--source rivers|mix] [--tau 15] [--dt 2] [--per-year 6000]
Braucht numpy, scipy, scikit-image (scripts/plastik-requirements.txt). Rohdaten (OWID-CSV) nach .cache/gpgpmodel/raw/,
Zwischenergebnis nach .cache/gpgpmodel/density.npz (--reuse rechnet nur die Kalibrierung/Konturen neu), Ausgabe nach
public/data/plastik/gpgp-model-outlines.geojson und gpgp-model-meta.json.

ES GIBT KEINE GEMESSENEN HISTORISCHEN UMRISSE. Das hier ist eine einfache Modellrechnung, die auf EIN Jahr (2015, Lebreton et al.
2018) kalibriert ist. Sie taugt für "wie könnte sich der Patch mit dem Plastikeintrag entwickelt haben", nicht als Messung.

Modell (dieselben Annahmen wie src/globe/layers/shared/treibmodell.ts, dort nachzulesen):
  - Strömung: public/data/currents/mean.bin (NOAA/AOML-Drifter-Klimatologie, Laurindo et al. 2017, zeitlich konstant), bilineare
    Interpolation (Längen periodisch, Landzellen fallen aus der Gewichtung), RK2-Mittelpunkt in Grad.
  - Diffusion: Random Walk mit K = 1.000 m²/s (sigma = sqrt(2 K dt) je Komponente, Box-Muller), wie DIFFUSIVITY in treibmodell.ts.
  - Stranden: landet ein Partikel in einer Landzelle (nächste Zelle ohne Wert), bleibt es dort stehen und zählt nicht mehr.
  - Zeitschritt: standardmäßig 2 Tage (treibmodell.ts rechnet 1 Tag). Mit 1 Tag dauert der Lauf doppelt so lang; die Verschiebung je Schritt
    (Median 0,1 m/s = 17 km, Kuroshio bis 1,5 m/s = 260 km) bleibt bei RK2 und 0,5°-Feld (55 km) vertretbar, die Diffusion ist über sigma =
    sqrt(2 K dt) zeitschrittunabhängig. Kein Wind-Slip, keine Stokes-Drift, kein Jahresgang, keine Wirbel (außer als Diffusion).
  - Quellen: (a) Flussmündungen aus public/data/plastik/rivers.geojson (Meijer et al. 2021, `t` t/Jahr), nur Pazifik-Anrainer:
    Längen 100° O ... 70° W, Breiten -10 ... 65° N. Begründung: westlich von 100° O münden Flüsse in den Indischen Ozean (Bengalen,
    Malakka-Straße), südlich von 10° S in den Südpazifik-Wirbel, der den Nordpazifik mit der mittleren Strömung nicht erreicht.
    Gezogen wird mit Wahrscheinlichkeit proportional zu `t`; Startpunkt = nächste Meereszelle (Mitte) plus zufälliger Versatz innerhalb
    der Zelle. (b) Optionales Experiment "Fischerei": gleichmäßig (flächengewichtet) über das offene Meer 20-50° N, 140° O ... 120° W
    (Lebreton 2022: 75-86 % der GPGP-Masse sind Fischereiabfall). Seine Stärke relativ zu (a) wird so gesetzt, dass Fischerei 2015 80 %
    der Masse in der Patch-Fläche ausmacht (das ist eine Annahme, keine Messung).
  - Eintragsmenge je Jahr proportional zur weltweiten Plastikproduktion (Our World in Data "global-plastics-production", Geyer et al.
    2017, CC BY): 1950-2019 aus der Reihe, danach linear fortgeschrieben (Ausgleichsgerade der Jahre 2015-2019). Hinweis: Geyer 2017
    endet 2015; die OWID-Werte ab 2016 sind exakt +5 %/Jahr, also selbst schon fortgeschrieben.
  - Abbau: Masse jedes Partikels fällt mit exp(-Alter/tau) (Absinken, Zerfall zu Mikroplastik unterhalb der Netzgrenze). tau ist eine
    Annahme (Standard 15 Jahre; getestet 10 / 15 / 20), keine Messung.
  - Dichte: Jahresmittel (Stichprobe alle 4 Tage) der Partikelmasse je km² auf einem 0,5°-Gitter, 120° O ... 100° W, 0 ... 60° N,
    mit Gauß (sigma 1 Zelle) geglättet.
  - Kalibrierung: EINE feste Schwelle für alle Jahre, so, dass die zusammenhängende Fläche über der Schwelle, die den Dichtekern in der
    Nähe der Lebreton-Mitte (-141,6° / 32,2°, Suchradius 2.500 km) enthält, 2015 genau 1,6 Mio. km² groß ist.
  - Eintrag vor 1950 und Eintrag der Jahre 2023ff. fehlen; das Modell startet 1950 leer (kaum Plastik vorher).
"""
import argparse
import json
import math
import os
import struct
import time
import urllib.request

import numpy as np
from scipy import ndimage
from skimage.measure import approximate_polygon, find_contours, points_in_poly

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, '.cache', 'gpgpmodel', 'raw')
CACHE = os.path.join(ROOT, '.cache', 'gpgpmodel', 'density.npz')
OUT = os.path.join(ROOT, 'public', 'data', 'plastik')
OWID_URL = 'https://ourworldindata.org/grapher/global-plastics-production.csv'
UA = 'orbis-build/1.0 (https://github.com/malte9799/orbis; gpgp model)'

R_EARTH = 6371000.0
DEG = math.pi / 180
DIFFUSIVITY = 1000.0  # wie treibmodell.ts
YEAR0, YEAR1 = 1950, 2022
YEAR_DAYS = 365
SAMPLE_DAYS = 4
TAUS = [10.0, 15.0, 20.0]
# Quellen
BOX_RIVERS = dict(lon_e=100.0, lon_w=-70.0, lat0=-10.0, lat1=65.0)  # lon >= lon_e oder lon <= lon_w
BOX_FISH = dict(lon0=140.0, lon1=240.0, lat0=20.0, lat1=50.0)  # 0..360
FISH_SHARE_2015 = 0.8  # Anteil Fischerei an der Masse in der Patch-Fläche 2015 (Lebreton 2022: 0,75-0,86)
# Dichtegitter
G_LON0, G_LON1, G_LAT0, G_LAT1, G_STEP = 120.0, 260.0, 0.0, 60.0, 0.5
GNX = int(round((G_LON1 - G_LON0) / G_STEP))
GNY = int(round((G_LAT1 - G_LAT0) / G_STEP))
# Kalibrierung
CENTER = (-141.6 % 360, 32.2)  # Lebreton 2018
SEARCH_KM = 2500.0
TARGET_KM2 = 1.6e6
MIN_RING_KM2 = 2000.0
GAUSS = 1.0
RASTER = (200.0, 240.2, 20.0, 45.2)  # Ausschnitt des Lebreton-Rasters (lon0, lon1, lat0, lat1)


# ---------------------------------------------------------------- Strömung
class Field:
    def __init__(self):
        d = os.path.join(ROOT, 'public', 'data', 'currents')
        self.meta = json.load(open(os.path.join(d, 'meta.json')))
        m = self.meta
        self.nx, self.ny, self.step, self.lon0, self.lat0 = m['nx'], m['ny'], m['step'], m['lon0'], m['lat0']
        raw = np.fromfile(os.path.join(d, 'mean.bin'), dtype='<i2')
        n = self.nx * self.ny
        assert raw.size == 2 * n
        u, v = raw[:n], raw[n:]
        self.valid = (u != m['nodata'])
        self.U = np.where(self.valid, u / m['scale'], 0.0)
        self.V = np.where(self.valid, v / m['scale'], 0.0)
        self.M = self.valid.astype(np.float64)
        self.lat_min = self.lat0
        self.lat_max = self.lat0 + (self.ny - 1) * self.step

    def is_sea(self, lon, lat):
        j = np.clip(np.rint((lat - self.lat0) / self.step), 0, self.ny - 1).astype(np.int64)
        i = np.rint((wrap(lon) - self.lon0) / self.step).astype(np.int64) % self.nx
        return self.valid[j * self.nx + i]

    def velocity(self, lon, lat):
        """bilinear wie velocityAt() in treibmodell.ts; (u, v, ok)"""
        y = np.clip((lat - self.lat0) / self.step, 0, self.ny - 1.000001)
        x = (wrap(lon) - self.lon0) / self.step
        j0 = np.floor(y).astype(np.int64)
        i0f = np.floor(x)
        fy = y - j0
        fx = x - i0f
        i0 = i0f.astype(np.int64) % self.nx
        i1 = (i0 + 1) % self.nx
        su = sv = sw = 0.0
        for c in range(4):
            i = i1 if c & 1 else i0
            j = j0 + (c >> 1)
            idx = j * self.nx + i
            w = (fx if c & 1 else 1 - fx) * (fy if c >> 1 else 1 - fy) * self.M[idx]
            su = su + w * self.U[idx]
            sv = sv + w * self.V[idx]
            sw = sw + w
        ok = sw > 0
        sw = np.where(ok, sw, 1.0)
        return su / sw, sv / sw, ok


def wrap(lon):
    return ((lon + 180.0) % 360.0) - 180.0


def step_particles(f, rng, lon, lat, dt, kdiff=DIFFUSIVITY):
    """ein Zeitschritt für alle Partikel (RK2 + Random Walk); gibt neue Positionen und die Maske 'gestrandet' zurück"""
    sigma = math.sqrt(2 * kdiff * dt)
    u1, v1, ok = f.velocity(lon, lat)
    cos_lat = np.maximum(0.05, np.cos(lat * DEG))
    half = 0.5 * dt
    mlon = lon + u1 * half / (R_EARTH * cos_lat * DEG)
    mlat = np.clip(lat + v1 * half / (R_EARTH * DEG), f.lat_min, f.lat_max)
    u2, v2, ok2 = f.velocity(mlon, mlat)
    u2 = np.where(ok2, u2, u1)
    v2 = np.where(ok2, v2, v1)
    n = lon.size
    r = sigma * np.sqrt(-2 * np.log(1 - rng.random(n)))
    a = 2 * math.pi * rng.random(n)
    dx = u2 * dt + r * np.cos(a)
    dy = v2 * dt + r * np.sin(a)
    nlon = wrap(lon + dx / (R_EARTH * cos_lat * DEG))
    nlat = np.clip(lat + dy / (R_EARTH * DEG), f.lat_min, f.lat_max)
    stranded = ~ok | ~f.is_sea(nlon, nlat)
    nlon = np.where(stranded, lon, nlon)
    nlat = np.where(stranded, lat, nlat)
    return nlon, nlat, stranded


# ---------------------------------------------------------------- Produktion
def production():
    """Weltweite Plastikproduktion in t/Jahr, 1950..YEAR1 (OWID/Geyer 2017); danach linear fortgeschrieben"""
    os.makedirs(RAW, exist_ok=True)
    p = os.path.join(RAW, 'owid.csv')
    if not os.path.exists(p):
        req = urllib.request.Request(OWID_URL, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=60) as r, open(p, 'wb') as fh:
            fh.write(r.read())
    rows = {}
    with open(p, encoding='utf-8') as fh:
        next(fh)
        for line in fh:
            ent, code, year, val = line.strip().split(',')
            if ent == 'World':
                rows[int(year)] = float(val)
    last = max(rows)
    ys = np.arange(last - 4, last + 1)
    slope, icpt = np.polyfit(ys, [rows[y] for y in ys], 1)
    out = {}
    for y in range(YEAR0, YEAR1 + 1):
        out[y] = rows[y] if y in rows else max(0.0, slope * y + icpt)
    return out, last, slope


# ---------------------------------------------------------------- Simulation
def sources(f, rng):
    """Mündungen im Pazifik: (lon, lat, Gewicht); Startpunkt = nächste Meereszelle"""
    gj = json.load(open(os.path.join(OUT, 'rivers.geojson')))
    lon = np.array([x['geometry']['coordinates'][0] for x in gj['features']])
    lat = np.array([x['geometry']['coordinates'][1] for x in gj['features']])
    t = np.array([x['properties']['t'] for x in gj['features']], float)
    b = BOX_RIVERS
    keep = ((lon >= b['lon_e']) | (lon <= b['lon_w'])) & (lat >= b['lat0']) & (lat <= b['lat1'])
    lon, lat, t = lon[keep], lat[keep], t[keep]
    # nächste Meereszelle (Mitte) per Distanztransformation auf dem Gitter
    land = ~f.valid.reshape(f.ny, f.nx)
    _, (jj, ii) = ndimage.distance_transform_edt(land, return_indices=True)
    j = np.clip(np.rint((lat - f.lat0) / f.step), 0, f.ny - 1).astype(int)
    i = np.rint((lon - f.lon0) / f.step).astype(int) % f.nx
    sj, si = jj[j, i], ii[j, i]
    slon = wrap(f.lon0 + si * f.step)
    slat = f.lat0 + sj * f.step
    return slon, slat, t / t.sum(), keep.sum(), t.sum()


def fishing_cells(f):
    b = BOX_FISH
    j, i = np.mgrid[0:f.ny, 0:f.nx]
    lat = f.lat0 + j * f.step
    lon = (f.lon0 + i * f.step) % 360
    m = f.valid.reshape(f.ny, f.nx) & (lat >= b['lat0']) & (lat <= b['lat1']) & (lon >= b['lon0']) & (lon <= b['lon1'])
    w = np.cos(lat * DEG) * m
    return lon[m], lat[m], (w[m] / w[m].sum())


def simulate(args):
    f = Field()
    rng = np.random.default_rng(7)
    prod, last_owid, slope = production()
    p15 = prod[2015]
    slon, slat, sw, n_src, t_src = sources(f, rng)
    flon, flat, fw = fishing_cells(f)
    print(f'Quellen: {n_src} Mündungen ({t_src:,.0f} t/Jahr von 990.490 t), Fischerei-Zellen {flon.size}')
    dt = args.dt * 86400.0
    steps_per_year = int(round(YEAR_DAYS / args.dt))
    nsteps = (YEAR1 - YEAR0 + 1) * steps_per_year
    # Freisetzung: 12 Stapel je Jahr
    batch_every = YEAR_DAYS / 12.0
    per_batch = max(1, int(round(args.per_year / 12)))
    sample_every = max(1, int(round(SAMPLE_DAYS / args.dt)))
    ny_ = YEAR1 - YEAR0 + 1
    dens = np.zeros((ny_, 2, len(TAUS), GNY * GNX))
    nsamp = np.zeros(ny_)
    plon = np.empty(0)
    plat = np.empty(0)
    pcls = np.empty(0, np.int8)
    pt0 = np.empty(0)
    pm0 = np.empty(0)
    next_batch = 0
    t_start = time.time()
    tot_strand = 0
    tot_rel = 0
    for k in range(nsteps):
        t_days = k * args.dt
        year = YEAR0 + int(t_days // YEAR_DAYS)
        yi = year - YEAR0
        if t_days >= next_batch * batch_every:
            next_batch += 1
            m0 = prod[year] / p15 / (per_batch * 12)  # eine Einheit = Produktion 2015 je Jahr
            k_r = rng.choice(sw.size, per_batch, p=sw)
            r_lon = wrap(slon[k_r] + (rng.random(per_batch) - 0.5) * f.step)
            r_lat = slat[k_r] + (rng.random(per_batch) - 0.5) * f.step
            k_f = rng.choice(fw.size, per_batch, p=fw)
            f_lon = wrap(flon[k_f] + (rng.random(per_batch) - 0.5) * f.step)
            f_lat = flat[k_f] + (rng.random(per_batch) - 0.5) * f.step
            plon = np.concatenate([plon, r_lon, f_lon])
            plat = np.concatenate([plat, r_lat, f_lat])
            pcls = np.concatenate([pcls, np.zeros(per_batch, np.int8), np.ones(per_batch, np.int8)])
            pt0 = np.concatenate([pt0, np.full(2 * per_batch, t_days)])
            pm0 = np.concatenate([pm0, np.full(2 * per_batch, m0)])
            tot_rel += 2 * per_batch
        plon, plat, stranded = step_particles(f, rng, plon, plat, dt)
        if stranded.any():
            # gestrandete Partikel blenden aus (wie in treibmodell.ts) und zählen nicht mehr
            tot_strand += int(stranded.sum())
            keep = ~stranded
            plon, plat, pcls, pt0, pm0 = plon[keep], plat[keep], pcls[keep], pt0[keep], pm0[keep]
        if (k + 1) % sample_every == 0:
            lon360 = plon % 360
            gi = np.floor((lon360 - G_LON0) / G_STEP).astype(np.int64)
            gj = np.floor((plat - G_LAT0) / G_STEP).astype(np.int64)
            inside = (gi >= 0) & (gi < GNX) & (gj >= 0) & (gj < GNY)
            idx = (gj * GNX + gi)[inside]
            age_y = (t_days - pt0[inside]) / YEAR_DAYS
            base = pm0[inside]
            cls = pcls[inside].astype(np.int64)
            for ti, tau in enumerate(TAUS):
                w = base * np.exp(-age_y / tau)
                dens[yi, :, ti, :] += np.bincount(idx + cls * (GNX * GNY), weights=w, minlength=2 * GNX * GNY).reshape(2, -1)
            nsamp[yi] += 1
        if (k + 1) % (steps_per_year * 5) == 0:
            print(f'  {year}: {plon.size:,} Partikel, {time.time() - t_start:.0f} s', flush=True)
    dens /= np.maximum(1, nsamp)[:, None, None, None]
    # Masse je Zelle -> je km²
    lat_c = G_LAT0 + (np.arange(GNY) + 0.5) * G_STEP
    cell_km2 = (G_STEP * 111.195) ** 2 * np.cos(lat_c * DEG)
    dens = dens.reshape(ny_, 2, len(TAUS), GNY, GNX) / cell_km2[None, None, None, :, None]
    print(f'Laufzeit {time.time() - t_start:.0f} s, {tot_rel:,} Partikel freigesetzt')
    np.savez_compressed(CACHE, dens=dens.astype(np.float32), run=json.dumps(dict(
        dt=args.dt, per_year=args.per_year, runtime_s=round(time.time() - t_start), released=tot_rel, n_src=int(n_src), t_src=float(t_src),
        last_owid=last_owid, slope=float(slope), prod={str(k): v for k, v in prod.items()})))
    return dens, prod


# ---------------------------------------------------------------- Auswertung
def cell_geometry():
    lat_c = G_LAT0 + (np.arange(GNY) + 0.5) * G_STEP
    lon_c = G_LON0 + (np.arange(GNX) + 0.5) * G_STEP
    cell_km2 = (G_STEP * 111.195) ** 2 * np.cos(lat_c * DEG)
    return lon_c, lat_c, np.repeat(cell_km2[:, None], GNX, axis=1)


def hav_km(lon1, lat1, lon2, lat2):
    a = np.sin((lat2 - lat1) * DEG / 2) ** 2 + np.cos(lat1 * DEG) * np.cos(lat2 * DEG) * np.sin((lon2 - lon1) * DEG / 2) ** 2
    return 2 * R_EARTH / 1000 * np.arcsin(np.sqrt(a))


def patch_component(d, thr, geo):
    """Maske der zusammenhängenden Fläche über thr, die den Dichtekern nahe der Lebreton-Mitte enthält (oder None)"""
    lon_c, lat_c, _ = geo
    LON, LAT = np.meshgrid(lon_c, lat_c)
    near = hav_km(LON, LAT, CENTER[0], CENTER[1]) <= SEARCH_KM
    if not near.any():
        return None, None
    dn = np.where(near, d, -1)
    sj, si = np.unravel_index(np.argmax(dn), d.shape)
    if d[sj, si] <= thr:
        return None, (sj, si)
    lab, _ = ndimage.label(d > thr, structure=np.ones((3, 3)))
    return lab == lab[sj, si], (sj, si)


def calibrate(d2015, geo):
    """Schwelle, bei der die Patch-Fläche 2015 = TARGET_KM2 ist (Bisektion, Fläche fällt monoton mit der Schwelle)"""
    area = geo[2]
    lo, hi = d2015.max() * 1e-6, d2015.max()
    for _ in range(60):
        mid = math.sqrt(lo * hi)
        comp, _ = patch_component(d2015, mid, geo)
        a = area[comp].sum() if comp is not None else 0.0
        if a > TARGET_KM2:
            lo = mid
        else:
            hi = mid
    return math.sqrt(lo * hi)


def ref_mask(geo):
    """Zellen innerhalb der 10-kg/km²-Grenze von Lebreton 2018 (Raster-Ausschnitt), auf dem Modellgitter"""
    gj = json.load(open(os.path.join(OUT, 'gpgp-contours.geojson')))
    b = next(x for x in gj['features'] if x['properties'].get('boundary'))
    ring = max((l for l in b['geometry']['coordinates'] if l[0] == l[-1]), key=len)
    lon_c, lat_c, area = geo
    LON, LAT = np.meshgrid(lon_c, lat_c)
    m = points_in_poly(np.c_[LON.ravel(), LAT.ravel()], np.array(ring)).reshape(LON.shape)
    return m, ring


def outline_rings(comp, d, thr, geo):
    """Umriss der Fläche als Liste von Ringen [[lon, lat], ...] (0..360), kleine Ringe weg, vereinfacht"""
    lon_c, lat_c, _ = geo
    padded = np.pad(np.where(comp, d, 0.0), 1)
    rings = []
    for c in find_contours(padded, thr):
        c = c - 1
        lon = G_LON0 + (c[:, 1] + 0.5) * G_STEP
        lat = G_LAT0 + (c[:, 0] + 0.5) * G_STEP
        # Fläche des Rings (Shoelace, km)
        x = (lon - lon.mean()) * 111.195 * math.cos(lat.mean() * DEG)
        y = (lat - lat.mean()) * 111.195
        a = 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
        if a < MIN_RING_KM2:
            continue
        pts = approximate_polygon(np.c_[lon, lat], 0.06)
        rings.append((a, [[round(float(p[0]), 3), round(float(p[1]), 3)] for p in pts]))
    return rings


def evaluate(dens, prod, source, ti, geo, write=None, quiet=False):
    """Kalibrierung + Kennzahlen für eine Variante. source: 'rivers' oder 'mix' (Fischerei mit festem Anteil 2015)"""
    lon_c, lat_c, area = geo
    riv = dens[:, 0, ti]
    fish = dens[:, 1, ti]
    i15 = 2015 - YEAR0
    phi = 0.0
    if source == 'mix':
        # Fischerei so skalieren, dass sie 2015 FISH_SHARE_2015 der Masse in der Patch-Fläche ausmacht (zweimal iterieren, weil die
        # Fläche vom Mix abhängt)
        phi = 1.0
        for _ in range(6):
            d = ndimage.gaussian_filter(riv[i15] + phi * fish[i15], GAUSS)
            thr = calibrate(d, geo)
            comp, _ = patch_component(d, thr, geo)
            mr = (riv[i15] * area)[comp].sum()
            mf = (fish[i15] * area)[comp].sum()
            phi = FISH_SHARE_2015 / (1 - FISH_SHARE_2015) * mr / mf
    dd = riv + phi * fish
    sm = np.stack([ndimage.gaussian_filter(dd[i], GAUSS) for i in range(dd.shape[0])])
    thr = calibrate(sm[i15], geo)
    res = []
    for yi in range(sm.shape[0]):
        comp, seed = patch_component(sm[yi], thr, geo)
        a = float(area[comp].sum()) if comp is not None else 0.0
        res.append((YEAR0 + yi, comp, a))
    # Kennzahlen
    comp15 = res[i15][1]
    lon_g, lat_g = np.meshgrid(lon_c, lat_c)
    wgt = area * comp15
    clon = float((lon_g * wgt).sum() / wgt.sum())
    clat = float((lat_g * wgt).sum() / wgt.sum())
    dist = float(hav_km(clon, clat, CENTER[0], CENTER[1]))
    rm, ring = ref_mask(geo)
    box = (lon_g >= RASTER[0]) & (lon_g <= RASTER[1]) & (lat_g >= RASTER[2]) & (lat_g <= RASTER[3])
    mod_box = comp15 & box
    inter = float(area[mod_box & rm].sum())
    union = float(area[(mod_box | rm)].sum())
    iou = inter / union
    ref_a = float(area[rm].sum())
    recall = inter / ref_a
    precision = inter / max(1.0, float(area[mod_box].sum()))
    w_share = float(area[comp15 & (lon_g < RASTER[0])].sum() / area[comp15].sum())
    first = next((y for y, c, a in res if a > 0), None)
    dec = {}
    for y, c, a in res:
        dec.setdefault(y // 10 * 10, []).append(a)
    fishshare = None
    if source == 'mix':
        fishshare = {y: float((phi * fish[y - YEAR0] * area)[c].sum() / (dd[y - YEAR0] * area)[c].sum()) if c is not None else None for y, c, a in res}
    info = dict(source=source, tau=TAUS[ti], thr=float(thr), phi=phi, area2015=res[i15][2], centroid=(clon, clat), dist_km=dist, iou=iou,
                recall=recall, precision=precision, west_share=w_share, ref_area_km2=ref_a, first_year=first,
                decade_mean={k: float(np.mean(v)) for k, v in dec.items()}, area={y: a for y, c, a in res}, fishshare=fishshare)
    if not quiet:
        print(f'\n== Quelle {source}, tau {TAUS[ti]:.0f} a ==')
        print(f'  Schwelle {thr:.4g} (relativ), phi {phi:.3g}, Fläche 2015 {res[i15][2] / 1e6:.3f} Mio. km²')
        print(f'  Schwerpunkt 2015 {clon:.1f}E / {clat:.1f}N ({clon - 360:.1f}° / {clat:.1f}°), Abstand zur Lebreton-Mitte {dist:.0f} km')
        print(f'  IoU 2015 im Raster-Ausschnitt {iou:.3f} (Referenz {ref_a / 1e6:.2f} Mio. km², Überdeckung der Referenz {recall:.2f}, Modellanteil in der Referenz {precision:.2f}); Modellfläche westlich 200°E: {w_share:.0%}')
        print(f'  erste Fläche ab {first}')
        print('  Fläche je Jahrzehnt (Mittel, Mio. km²): ' + ', '.join(f'{k}er {v / 1e6:.2f}' for k, v in info['decade_mean'].items()))
        print('  Stützjahre: ' + ', '.join(f'{y} {info["area"][y] / 1e6:.2f}' for y in (1950, 1960, 1970, 1980, 1990, 2000, 2010, 2015, 2020, 2022)))
        if fishshare:
            print(f'  Fischereianteil in der Fläche 2015 {fishshare[2015]:.2f}, 1970 {fishshare.get(1970)}, 1990 {fishshare.get(1990)}')
    if write:
        feats = []
        n_pts = 0
        for y, comp, a in res:
            rings = outline_rings(comp, sm[y - YEAR0], thr, geo) if comp is not None else []
            coords = [r for _, r in rings]
            n_pts += sum(len(r) for r in coords)
            feats.append({'type': 'Feature', 'properties': {'y': y, 'a': int(round(a, -3))}, 'geometry': {'type': 'MultiLineString', 'coordinates': coords}})
        info['feats'] = feats
        info['n_pts'] = n_pts
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reuse', action='store_true', help='Zwischenergebnis aus .cache/gpgpmodel/density.npz nehmen')
    ap.add_argument('--dt', type=float, default=2.0, help='Zeitschritt in Tagen')
    ap.add_argument('--per-year', type=int, default=6000, help='Partikel je Jahr und Quelle')
    ap.add_argument('--source', choices=['rivers', 'mix'], default='rivers')
    ap.add_argument('--tau', type=float, default=15.0)
    args = ap.parse_args()
    if args.reuse and os.path.exists(CACHE):
        z = np.load(CACHE)
        dens = z['dens'].astype(np.float64)
        run = json.loads(str(z['run']))
        prod = {int(k): v for k, v in run['prod'].items()}
    else:
        dens, prod = simulate(args)
        run = json.loads(str(np.load(CACHE)['run']))
    geo = cell_geometry()
    for src in ('rivers', 'mix'):
        for ti in range(len(TAUS)):
            evaluate(dens, prod, src, ti, geo)
    ti = TAUS.index(args.tau)
    best = evaluate(dens, prod, args.source, ti, geo, write=True, quiet=True)
    gj = {'type': 'FeatureCollection', 'credit': 'Eigene Modellrechnung (experimentell, keine Messung); Strömung NOAA/AOML (CC BY 4.0), Mündungen Meijer et al. 2021, Produktion Geyer et al. 2017 via Our World in Data (CC BY)',
          'note': 'Modellierter Umriss des Great Pacific Garbage Patch pro Jahr, kalibriert auf die 10-kg/km²-Fläche von Lebreton et al. 2018 (2015). Es gibt keine gemessenen historischen Umrisse.',
          'features': best['feats']}
    p = os.path.join(OUT, 'gpgp-model-outlines.geojson')
    with open(p, 'w', encoding='utf-8') as fh:
        json.dump(gj, fh, separators=(',', ':'), ensure_ascii=False)
    meta = {
        'version': 1,
        'experimental': True,
        'hinweis': 'Experimentelles Modell, keine Messung: Es gibt keine gemessenen historischen Umrisse des Great Pacific Garbage Patch. Der Umriss ist auf die Fläche von Lebreton et al. 2018 im Jahr 2015 kalibriert.',
        'source': args.source,
        'years': [YEAR0, YEAR1],
        'tau_years': args.tau,
        'tau_tested': TAUS,
        'diffusivity': DIFFUSIVITY,
        'dt_days': run['dt'],
        'particles_per_year_per_source': run['per_year'],
        'released': run['released'],
        'sources': {
            'rivers': f'Meijer et al. 2021 (Flussmündungen, {run["n_src"]} Mündungen im Pazifik: 100° O bis 70° W, 10° S bis 65° N), gewichtet nach Menge t/Jahr',
            'fishing': 'nicht modelliert' if args.source == 'rivers' else 'gleichmäßig über das offene Meer 20 bis 50° N, 140° O bis 120° W; Anteil 80 % der Masse im Patch 2015 (Annahme)',
        },
        'production': 'Our World in Data, Global plastics production (Geyer et al. 2017, CC BY); nach 2019 linear fortgeschrieben (Ausgleichsgerade 2015 bis 2019)',
        'current': 'NOAA/AOML Global Drifter Program, mittleres Feld (Laurindo et al. 2017, CC BY 4.0), siehe public/data/currents/meta.json',
        'calibration': {
            'year': 2015, 'target_km2': TARGET_KM2, 'centre': [round(CENTER[0] - 360, 1), CENTER[1]], 'threshold_relative': best['thr'],
            'gauss_cells': GAUSS, 'grid_deg': G_STEP, 'rule': 'feste Dichteschwelle für alle Jahre',
        },
        'plausibility': {
            'centroid_2015': [round(best['centroid'][0], 1), round(best['centroid'][1], 1)], 'distance_km': round(best['dist_km']),
            'iou_2015': round(best['iou'], 3), 'first_year': best['first_year'],
        },
    }
    with open(os.path.join(OUT, 'gpgp-model-meta.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    print(f'\nGeschrieben: {p} ({os.path.getsize(p) / 1024:.0f} KB, {best["n_pts"]} Punkte)')


if __name__ == '__main__':
    main()
