#!/usr/bin/env python3
"""EXPERIMENTELLES Modell: Umriss aller fünf subtropischen Plastikwirbel (und des Mittelmeers) pro Jahr, 1950-2022, in EINER globalen Simulation.

Aufruf:  .cache/plastik/venv/bin/python -I scripts/gyre-model.py [--reuse] [--tau 15] [--dt 2] [--per-year 6000]
Braucht numpy, scipy, scikit-image, rasterio (scripts/plastik-requirements.txt). Zwischenergebnis (Dichtewürfel) nach .cache/gyremodel/density.npz
(--reuse rechnet nur Konturen/Plausibilität neu). Ausgabe: public/data/plastik/gyre-model-outlines.geojson und gyre-model-meta.json.

ES GIBT KEINE GEMESSENEN HISTORISCHEN UMRISSE. Gleiche Annahmen wie scripts/gpgp-model.py (dort nachlesen: Strömung NOAA/AOML-Klimatologie,
Diffusion K = 1000 m²/s, Stranden, Abbau tau, Eintrag proportional zur Plastikproduktion OWID/Geyer), aber:
  - Quellen: ALLE Flussmündungen weltweit (Meijer et al. 2021), nicht nur Pazifik-Anrainer. Die Partikelmasse wird so gewählt, dass die
    pazifischen Mündungen (Box wie in gpgp-model.py) exakt dieselbe Masse je Einheit haben wie dort; die anderen tragen im Verhältnis ihrer
    Menge t/Jahr bei. Dadurch gilt die Schwelle aus gpgp-model.py (Kalibrierung GPGP 2015 = 1,6 Mio. km²) absolut auch für die anderen Wirbel.
  - Dichtegitter global, 0,5°, Länge 0..360, Breite -70..70, Gauß sigma 1 Zelle (Längen periodisch).
  - Je Wirbel: zusammenhängende Fläche über der Schwelle innerhalb einer Box, die den Dichtekern nahe der Wirbelmitte enthält. Außerhalb der Box
    ist NaN: Linien enden dort offen, laufen nicht am Rand entlang.
  - Keine Anpassung je Wirbel an Eriksen: der Vergleich mit der Eriksen-Isolinie (Mitte, 3*10^4 Teile/km², Stand ~2013) ist nur eine Plausibilitätsprüfung.
"""
import argparse
import importlib.util
import json
import math
import os
import sys
import time

import numpy as np
from scipy import ndimage
from skimage.measure import approximate_polygon, find_contours

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, fname):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, fname))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


gm = _load('gpgp_model', 'gpgp-model.py')  # keine Nebenwirkungen beim Import (main-Guard)
ek = _load('eriksen_contours', 'eriksen-contours-build.py')
wrap, step_particles, hav_km = gm.wrap, gm.step_particles, gm.hav_km

ROOT = gm.ROOT
OUT = gm.OUT
RAW = os.path.join(ROOT, '.cache', 'gyremodel', 'raw')
CACHE = os.path.join(ROOT, '.cache', 'gyremodel', 'density.npz')
YEAR0, YEAR1, YEAR_DAYS, SAMPLE_DAYS = gm.YEAR0, gm.YEAR1, gm.YEAR_DAYS, gm.SAMPLE_DAYS
DEG = gm.DEG
G_STEP = 0.5
G_LON0, G_LON1, G_LAT0, G_LAT1 = 0.0, 360.0, -70.0, 70.0
GNX = int(round((G_LON1 - G_LON0) / G_STEP))
GNY = int(round((G_LAT1 - G_LAT0) / G_STEP))
GAUSS = 1.0
MIN_RING_KM2 = 2000.0
MIN_LINE_KM = 150.0
DP_TOL = 0.08
# Wirbel: id -> (Box lon0, lon1, lat0, lat1 im Ausgaberahmen, Mitte (lon, lat), Suchradius km, Ausschluss oder None, Pazifik-Rahmen 0..360?)
GYRES = {
    'gpgp': (120.0, 260.0, 0.0, 60.0, (gm.CENTER[0], gm.CENTER[1]), 2500.0, None, True),
    'suedpazifik': (140.0, 290.0, -60.0, 0.0, (255.0, -28.0), 2500.0, None, True),
    'nordatlantik': (-100.0, 20.0, 0.0, 60.0, (-45.0, 30.0), 2500.0, None, False),
    'suedatlantik': (-60.0, 20.0, -60.0, 0.0, (-15.0, -28.0), 2500.0, None, False),
    'indik': (20.0, 130.0, -60.0, 0.0, (80.0, -28.0), 2500.0, None, False),
    'mittelmeer': (-6.0, 36.5, 30.0, 46.0, (16.0, 37.0), 1500.0, (26.5, 42.0, 40.2, 47.0), False),
}
EK_GYRES = ek.GYRES  # gleiche ids
PLAUS_YEARS = (2013, 2014)


# ---------------------------------------------------------------- Simulation
def all_sources(f):
    """alle Mündungen weltweit: (lon, lat, Anteil, Gesamt-t, Pazifik-t); Startpunkt = nächste Meereszelle"""
    gj = json.load(open(os.path.join(OUT, 'rivers.geojson')))
    lon = np.array([x['geometry']['coordinates'][0] for x in gj['features']])
    lat = np.array([x['geometry']['coordinates'][1] for x in gj['features']])
    t = np.array([x['properties']['t'] for x in gj['features']], float)
    b = gm.BOX_RIVERS
    pac = ((lon >= b['lon_e']) | (lon <= b['lon_w'])) & (lat >= b['lat0']) & (lat <= b['lat1'])
    land = ~f.valid.reshape(f.ny, f.nx)
    _, (jj, ii) = ndimage.distance_transform_edt(land, return_indices=True)
    j = np.clip(np.rint((lat - f.lat0) / f.step), 0, f.ny - 1).astype(int)
    i = np.rint((lon - f.lon0) / f.step).astype(int) % f.nx
    slon = wrap(f.lon0 + ii[j, i] * f.step)
    slat = f.lat0 + jj[j, i] * f.step
    return slon, slat, t / t.sum(), float(t.sum()), float(t[pac].sum()), int(len(t)), int(pac.sum())


def simulate(args):
    f = gm.Field()
    rng = np.random.default_rng(7)
    prod, last_owid, slope = gm.production()
    p15 = prod[2015]
    slon, slat, sw, t_all, t_pac, n_all, n_pac = all_sources(f)
    scale = t_all / t_pac  # Masse je Partikel so, dass die Pazifik-Mündungen wie in gpgp-model.py gewichtet sind
    print(f'Quellen: {n_all} Mündungen ({t_all:,.0f} t/Jahr), davon Pazifik-Box {n_pac} ({t_pac:,.0f} t/Jahr = {t_pac / t_all:.1%}); Skalierung {scale:.3f}')
    dt = args.dt * 86400.0
    steps_per_year = int(round(YEAR_DAYS / args.dt))
    nsteps = (YEAR1 - YEAR0 + 1) * steps_per_year
    batch_every = YEAR_DAYS / 12.0
    per_batch_pac = max(1, int(round(args.per_year / 12)))
    per_batch = int(round(per_batch_pac * scale))
    sample_every = max(1, int(round(SAMPLE_DAYS / args.dt)))
    ny_ = YEAR1 - YEAR0 + 1
    tau = args.tau
    dens = np.zeros((ny_, GNY * GNX))
    nsamp = np.zeros(ny_)
    plon = np.empty(0)
    plat = np.empty(0)
    pt0 = np.empty(0)
    pm0 = np.empty(0)
    next_batch = 0
    t_start = time.time()
    tot_rel = tot_strand = 0
    for k in range(nsteps):
        t_days = k * args.dt
        year = YEAR0 + int(t_days // YEAR_DAYS)
        yi = year - YEAR0
        if t_days >= next_batch * batch_every:
            next_batch += 1
            m0 = prod[year] / p15 * scale / (per_batch * 12)
            k_r = rng.choice(sw.size, per_batch, p=sw)
            plon = np.concatenate([plon, wrap(slon[k_r] + (rng.random(per_batch) - 0.5) * f.step)])
            plat = np.concatenate([plat, slat[k_r] + (rng.random(per_batch) - 0.5) * f.step])
            pt0 = np.concatenate([pt0, np.full(per_batch, t_days)])
            pm0 = np.concatenate([pm0, np.full(per_batch, m0)])
            tot_rel += per_batch
        plon, plat, stranded = step_particles(f, rng, plon, plat, dt)
        if stranded.any():
            tot_strand += int(stranded.sum())
            keep = ~stranded
            plon, plat, pt0, pm0 = plon[keep], plat[keep], pt0[keep], pm0[keep]
        if (k + 1) % sample_every == 0:
            gi = np.floor(((plon % 360) - G_LON0) / G_STEP).astype(np.int64)
            gj = np.floor((plat - G_LAT0) / G_STEP).astype(np.int64)
            inside = (gi >= 0) & (gi < GNX) & (gj >= 0) & (gj < GNY)
            w = pm0[inside] * np.exp(-(t_days - pt0[inside]) / YEAR_DAYS / tau)
            dens[yi] += np.bincount((gj * GNX + gi)[inside], weights=w, minlength=GNX * GNY)
            nsamp[yi] += 1
        if (k + 1) % (steps_per_year * 5) == 0:
            print(f'  {year}: {plon.size:,} Partikel, {time.time() - t_start:.0f} s', flush=True)
    dens /= np.maximum(1, nsamp)[:, None]
    lat_c = G_LAT0 + (np.arange(GNY) + 0.5) * G_STEP
    cell_km2 = (G_STEP * 111.195) ** 2 * np.cos(lat_c * DEG)
    dens = dens.reshape(ny_, GNY, GNX) / cell_km2[None, :, None]
    rt = round(time.time() - t_start)
    print(f'Laufzeit {rt} s, {tot_rel:,} Partikel freigesetzt')
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    np.savez_compressed(CACHE, dens=dens.astype(np.float32), run=json.dumps(dict(
        dt=args.dt, per_year=args.per_year, tau=tau, runtime_s=rt, released=tot_rel, n_all=n_all, n_pac=n_pac, t_all=t_all, t_pac=t_pac,
        last_owid=last_owid, slope=float(slope), prod={str(k): v for k, v in prod.items()})))
    return dens


# ---------------------------------------------------------------- Auswertung
def cell_geom():
    lat_c = G_LAT0 + (np.arange(GNY) + 0.5) * G_STEP
    lon_c = G_LON0 + (np.arange(GNX) + 0.5) * G_STEP
    cell = (G_STEP * 111.195) ** 2 * np.cos(lat_c * DEG)
    return lon_c, lat_c, np.repeat(cell[:, None], GNX, axis=1)


def crop_model(g, box):
    """Ausschnitt mit Längen-Umbruch; Zellmitten im Ausgaberahmen (box-Längen können negativ sein)"""
    l0, l1, a0, a1 = box
    cols = (int(round((l0 - G_LON0) / G_STEP)) + np.arange(int(round((l1 - l0) / G_STEP)))) % GNX
    lat_c = G_LAT0 + (np.arange(GNY) + 0.5) * G_STEP
    rows = np.where((lat_c >= a0) & (lat_c <= a1))[0]
    lon = l0 + (np.arange(cols.size) + 0.5) * G_STEP
    return g[np.ix_(rows, cols)], lon, lat_c[rows], rows, cols


def component(d, lon, lat, thr, centre, radius_km, area):
    LON, LAT = np.meshgrid(lon, lat)
    near = hav_km(LON, LAT, centre[0], centre[1]) <= radius_km
    ok = np.isfinite(d)
    dn = np.where(near & ok, d, -1)
    sj, si = np.unravel_index(np.argmax(dn), d.shape)
    if dn[sj, si] <= thr:
        return None
    lab, _ = ndimage.label(ok & (d > thr), structure=np.ones((3, 3)))
    return lab == lab[sj, si]


def outline(comp, d, thr, lon, lat):
    """Umrisslinien der Komponente; offen am Boxrand (NaN), kleine Ringe/Linien weg, vereinfacht"""
    grid = np.where(ndimage.binary_dilation(comp, iterations=2), d, 0.0)
    grid = np.where(np.isfinite(d), grid, np.nan)
    pad = np.pad(grid, 1, constant_values=np.nan)
    keep = ndimage.binary_dilation(comp, iterations=1)
    lines = []
    for c in find_contours(pad, thr):
        c = c - 1
        ri = np.clip(np.rint(c[:, 0]).astype(int), 0, comp.shape[0] - 1)
        ci = np.clip(np.rint(c[:, 1]).astype(int), 0, comp.shape[1] - 1)
        if keep[ri, ci].mean() < 0.5:
            continue
        pts = np.c_[lon[0] + c[:, 1] * G_STEP, lat[0] + c[:, 0] * G_STEP]
        if not ek.keep_line(pts):
            continue
        s = approximate_polygon(pts, DP_TOL)
        if len(s) >= 2:
            lines.append([[round(float(x), 3), round(float(y), 3)] for x, y in s])
    return lines


def to_frame(lines, pacific):
    """Pazifik 0..360 (wie die GPGP-Dateien), sonst -180..180 (Umbruch nur an Boxen ohne Datumsgrenze)"""
    out = []
    for ln in lines:
        out.append([[round(((x % 360) if pacific else (x if -180 <= x <= 180 else ((x + 180) % 360) - 180)), 3), y] for x, y in ln])
    return out


def eriksen_masks(lvl):
    """Eriksen-Fläche >= lvl Teile/km² je Wirbel: (Maske, Länge, Breite, Zellfläche) auf dem 0,2°-Raster"""
    C = ek.load_total('count')
    logC = ndimage.gaussian_filter(np.log10(C), ek.GAUSS, mode=('nearest', 'wrap'))
    res = {}
    for gid, (l0, l1, a0, a1, centre, excl) in ek.GYRES.items():
        sub, lon, lat = ek.crop(logC, (l0, l1, a0, a1))
        if excl:
            LON, LAT = np.meshgrid(lon, lat)
            sub = np.where((LON >= excl[0]) & (LON <= excl[1]) & (LAT >= excl[2]) & (LAT <= excl[3]), np.nan, sub)
        comp = ek.gyre_component(sub, lon, lat, lvl, centre)
        area = (ek.R_KM ** 2 * math.radians(ek.STEP) ** 2 * np.cos(np.radians(lat)))[:, None] * np.ones((1, lon.size))
        res[gid] = (comp, lon, lat, area)
    return res


def mask_at(comp, lon, lat, mlon, mlat):
    """Modell-Maske comp (Gitter lon/lat) an Punkten (mlon (1D), mlat (1D) -> Gitter) per nächster Zelle"""
    j = np.clip(np.rint((mlat - lat[0]) / G_STEP).astype(int), 0, lat.size - 1)
    i = np.clip(np.rint((mlon - lon[0]) / G_STEP).astype(int), 0, lon.size - 1)
    return comp[np.ix_(j, i)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--reuse', action='store_true', help='Dichtewürfel aus .cache/gyremodel/density.npz nehmen')
    ap.add_argument('--dt', type=float, default=2.0)
    ap.add_argument('--per-year', type=int, default=6000, help='Partikel je Jahr aus den Pazifik-Mündungen (global entsprechend mehr)')
    ap.add_argument('--tau', type=float, default=15.0)
    args = ap.parse_args()
    if args.reuse and os.path.exists(CACHE):
        z = np.load(CACHE)
        dens = z['dens'].astype(np.float64)
        run = json.loads(str(z['run']))
    else:
        dens = simulate(args)
        run = json.loads(str(np.load(CACHE)['run']))
    gmeta = json.load(open(os.path.join(OUT, 'gpgp-model-meta.json')))
    thr = float(gmeta['calibration']['threshold_relative'])
    lon_c, lat_c, area_g = cell_geom()
    sm = np.stack([ndimage.gaussian_filter(dens[i], GAUSS, mode=('nearest', 'wrap')) for i in range(dens.shape[0])])
    ny_ = sm.shape[0]
    print(f'Schwelle (aus gpgp-model-meta.json): {thr:.4g}')

    feats = []
    res = {}  # gid -> {year: (comp, lon, lat, area, a)}
    n_pts = 0
    for gid, (l0, l1, a0, a1, centre, radius, excl, pac) in GYRES.items():
        box = (l0, l1, a0, a1)
        sub_all, lon, lat, rows, cols = crop_model(sm, box) if False else (None,) * 5
        areas = {}
        for yi in range(ny_):
            d, lon, lat, rows, cols = crop_model(sm[yi], box)
            if excl:
                LON, LAT = np.meshgrid(lon, lat)
                d = np.where((LON >= excl[0]) & (LON <= excl[1]) & (LAT >= excl[2]) & (LAT <= excl[3]), np.nan, d)
            ar = area_g[np.ix_(rows, cols)]
            comp = component(d, lon, lat, thr, centre, radius, ar)
            a = float(ar[comp].sum()) if comp is not None else 0.0
            lines = outline(comp, d, thr, lon, lat) if comp is not None else []
            lines = to_frame(lines, pac)
            n_pts += sum(len(r) for r in lines)
            y = YEAR0 + yi
            feats.append({'type': 'Feature', 'properties': {'y': y, 'g': gid, 'a': int(round(a, -3))},
                          'geometry': {'type': 'MultiLineString', 'coordinates': lines}})
            res.setdefault(gid, {})[y] = (comp, lon, lat, ar, a)
            areas[y] = a

    # Datei schreiben
    gj = {'type': 'FeatureCollection',
          'credit': 'Eigene Modellrechnung (experimentell, keine Messung); Strömung NOAA/AOML (CC BY 4.0), Mündungen Meijer et al. 2021 (CC BY 4.0), Produktion Geyer et al. 2017 via Our World in Data (CC BY)',
          'note': 'Modellierter Umriss der Plastikwirbel pro Jahr (y), je Wirbel (g), Fläche a in km²; leere Geometrie = unter der Schwelle. Kalibriert allein auf den GPGP 2015 (Lebreton et al. 2018, 10 kg/km²); keine gemessenen historischen Umrisse.',
          'features': feats}
    p = os.path.join(OUT, 'gyre-model-outlines.geojson')
    with open(p, 'w', encoding='utf-8') as fh:
        json.dump(gj, fh, separators=(',', ':'), ensure_ascii=False)
    size_kb = os.path.getsize(p) / 1024
    print(f'\nGeschrieben: {p} ({size_kb:.0f} KB, {len(feats)} Features, {n_pts} Punkte)')

    # Vergleich GPGP mit gpgp-model-outlines.geojson (Fläche je Jahr) und Eigenkalibrierung
    old = json.load(open(os.path.join(OUT, 'gpgp-model-outlines.geojson')))
    old_a = {f_['properties']['y']: f_['properties']['a'] for f_ in old['features']}
    cmp_gpgp = {y: dict(old=old_a[y], new=res['gpgp'][y][4]) for y in (1990, 2000, 2010, 2015, 2022)}
    print('GPGP alt vs. global (Fläche Mio. km²): ' + ', '.join(f'{y} {v["old"] / 1e6:.2f}/{v["new"] / 1e6:.2f}' for y, v in cmp_gpgp.items()))
    # Schwelle, die den GPGP 2015 im globalen Lauf auf 1,6 Mio. km² bringt (nur zur Information)
    d15, lon, lat, rows, cols = crop_model(sm[2015 - YEAR0], GYRES['gpgp'][:4])
    ar = area_g[np.ix_(rows, cols)]
    lo, hi = d15.max() * 1e-6, d15.max()
    for _ in range(60):
        mid = math.sqrt(lo * hi)
        c = component(d15, lon, lat, mid, GYRES['gpgp'][4], 2500.0, ar)
        if (ar[c].sum() if c is not None else 0.0) > gm.TARGET_KM2:
            lo = mid
        else:
            hi = mid
    thr_own = math.sqrt(lo * hi)
    print(f'GPGP-Eigenkalibrierung im globalen Lauf: Schwelle {thr_own:.4g} ({thr_own / thr:.3f} x alte Schwelle)')
    # IoU der GPGP-Ringe alt/global 2015 (Maske alter Lauf nicht vorhanden -> über Fläche und Schwerpunkt)

    # Plausibilität gegen Eriksen
    EKM = {3e4: eriksen_masks(3e4), 1e5: eriksen_masks(1e5)}
    plaus = {}
    for gid in GYRES:
      plaus[gid] = {}
      for rank, lvl in (('mid', 3e4), ('core', 1e5)):
        ecomp, elon, elat, earea = EKM[lvl][gid]
        out = {}
        if ecomp is None:
            plaus[gid][rank] = None
            continue
        for y in PLAUS_YEARS:
            comp, lon, lat, ar, a = res[gid][y]
            if comp is None:
                out[str(y)] = dict(model_area_km2=0, iou=0.0)
                continue
            # Modellmaske auf das Eriksen-Gitter, innerhalb der gemeinsamen Box
            in_box = ((elon >= GYRES[gid][0]) & (elon <= GYRES[gid][1]))[None, :] & ((elat >= GYRES[gid][2]) & (elat <= GYRES[gid][3]))[:, None]
            mm = mask_at(comp, lon, lat, np.clip(elon, lon[0], lon[-1]), np.clip(elat, lat[0], lat[-1]))
            mm = mm & in_box
            em = (ecomp if ecomp is not None else np.zeros_like(mm)) & in_box
            inter = float(earea[mm & em].sum())
            union = float(earea[mm | em].sum())
            def cen(m):
                LON, LAT = np.meshgrid(elon, elat)
                w = earea * m
                return float((LON * w).sum() / w.sum()), float((LAT * w).sum() / w.sum())
            if em.any() and mm.any():
                cm, ce = cen(mm), cen(em)
                dist = float(hav_km(cm[0], cm[1], ce[0], ce[1]))
            else:
                cm = ce = None
                dist = None
            out[str(y)] = dict(model_area_km2=round(float(earea[mm].sum()), -3), eriksen_area_km2=round(float(earea[em].sum()), -3),
                               iou=round(inter / union, 3) if union > 0 else 0.0, centre_model=[round(x, 1) for x in cm] if cm else None,
                               centre_eriksen=[round(x, 1) for x in ce] if ce else None, centre_dist_km=round(dist) if dist is not None else None)
        plaus[gid][rank] = out
        o = out['2013']
        print(f'  Plausibilität {gid:13s} vs Eriksen {rank} 2013: Modell {o["model_area_km2"] / 1e6:.2f} Mio. km² vs Eriksen {o.get("eriksen_area_km2", 0) / 1e6:.2f}, IoU {o["iou"]}, '
              f'Mittenabstand {o.get("centre_dist_km")} km')

    # Kennzahlen je Wirbel
    summary = {}
    for gid in GYRES:
        ar_ = {y: res[gid][y][4] for y in range(YEAR0, YEAR1 + 1)}
        first = next((y for y in sorted(ar_) if ar_[y] > 0), None)
        first01 = next((y for y in sorted(ar_) if ar_[y] >= 1e5), None)
        mx = {y: float(np.nanmax(crop_model(sm[y - YEAR0], GYRES[gid][:4])[0])) / thr for y in (2013, 2022)}
        summary[gid] = dict(max_density_over_threshold_2013=round(mx[2013], 2), max_density_over_threshold_2022=round(mx[2022], 2), first_year=first, first_year_ge_0_1_mio_km2=first01, **{f'area_{y}': round(ar_[y], -3) for y in (1990, 2000, 2010, 2022)})
        print(f'  {gid:13s} erste Fläche {first} (>=0,1 Mio. km²: {first01}); ' + ', '.join(f'{y} {ar_[y] / 1e6:.2f}' for y in (1990, 2000, 2010, 2022)))

    meta = {
        'version': 1, 'experimental': True,
        'hinweis': 'Experimentelles Modell, keine Messung: Es gibt keine gemessenen historischen Umrisse der Plastikwirbel. Der Umriss ist allein auf die Fläche des GPGP von Lebreton et al. 2018 im Jahr 2015 kalibriert; für die anderen Wirbel gilt dieselbe absolute Dichteschwelle ohne Anpassung.',
        'years': [YEAR0, YEAR1], 'gyres': list(GYRES),
        'tau_years': run['tau'], 'diffusivity': gm.DIFFUSIVITY, 'dt_days': run['dt'],
        'particles_per_year_pacific_equivalent': run['per_year'], 'released': run['released'], 'runtime_s': run['runtime_s'],
        'sources': f'Meijer et al. 2021, alle {run["n_all"]} Flussmündungen weltweit ({run["t_all"]:,.0f} t/Jahr), gewichtet nach Menge t/Jahr; Pazifik-Anteil (Box 100° O bis 70° W, 10° S bis 65° N) {run["t_pac"] / run["t_all"]:.1%}; Partikelmasse so skaliert, dass die Pazifik-Mündungen wie in gpgp-model.py wirken',
        'production': 'Our World in Data, Global plastics production (Geyer et al. 2017, CC BY); nach 2019 linear fortgeschrieben (Ausgleichsgerade 2015 bis 2019)',
        'current': 'NOAA/AOML Global Drifter Program, mittleres Feld (Laurindo et al. 2017, CC BY 4.0), siehe public/data/currents/meta.json',
        'credits': ['NOAA/AOML Global Drifter Program, Laurindo et al. 2017 (CC BY 4.0)', 'Meijer et al. 2021 (CC BY 4.0)', 'Our World in Data / Geyer et al. 2017 (CC BY)', 'Eigene experimentelle Modellrechnung'],
        'calibration': {'year': 2015, 'gyre': 'gpgp', 'target_km2': gm.TARGET_KM2, 'centre': [round(gm.CENTER[0] - 360, 1), gm.CENTER[1]],
                        'threshold_relative': thr, 'threshold_source': 'public/data/plastik/gpgp-model-meta.json (gpgp-model.py)',
                        'threshold_own_calibration_global_run': thr_own, 'gauss_cells': GAUSS, 'grid_deg': G_STEP,
                        'rule': 'dieselbe feste Dichteschwelle für alle Jahre und alle Wirbel'},
        'boxes': {gid: dict(lon=[g[0], g[1]], lat=[g[2], g[3]], centre=[round(g[4][0], 1), g[4][1]], search_km=g[5], frame='0..360' if g[7] else '-180..180') for gid, g in GYRES.items()},
        'gpgp_vs_gpgp_model': {str(y): v for y, v in cmp_gpgp.items()},
        'plausibility_vs_eriksen': {'note': 'Eriksen et al. 2014 (CC BY 4.0), Flächen >= 3*10^4 (mid) und >= 10^5 Teile/km² (core), Stand ~2013; Modell = Jahre 2013 und 2014; reine Prüfung, keine Anpassung', 'gyres': plaus},
        'summary': summary,
    }
    with open(os.path.join(OUT, 'gyre-model-meta.json'), 'w', encoding='utf-8') as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
