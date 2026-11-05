#!/usr/bin/env python3
"""Isolinien der modellierten Plastikdichte (Eriksen et al. 2014, "Stand ~2013") für alle subtropischen Wirbel.

Aufruf:  .cache/plastik/venv/bin/python -I scripts/eriksen-contours-build.py
Braucht numpy, scipy, scikit-image, rasterio (scripts/plastik-requirements.txt). Liest die Rohdaten aus dem Download-Cache von
plastik-build.py (.cache/plastik/raw/14390873/count_density_size1..4.tif, weight_density_size1..4.tif; nur Daten, nichts wird ausgeführt).
Schreibt public/data/plastik/gyre-contours.geojson und gyre-contours.json.

Quelle: Eriksen et al. 2014, PLoS ONE 9:e111913, doi:10.1371/journal.pone.0111913, Daten doi:10.6084/m9.figshare.14390873 (CC BY 4.0).
Globales Modellraster 0,2° (Länge 0..360), je Größenklasse log10 (Teile/km² bzw. g/km²); hier summiert.

Pegel: ZÄHLUNG (Teile/km²) 10^4 / 3*10^4 / 10^5 = outer / mid / core. Begründung: Die Massenraster geben bei den GPGP-Pegeln 1 / 10 / 100 kg/km²
keine vergleichbare Struktur (Eriksen-Masse: Maximum im Nordpazifik 241 kg/km², Südpazifik 28 kg/km², Südatlantik 20 kg/km²; 100 kg/km²
wird nirgends außer im Nordpazifik/Nordatlantik erreicht, 10 kg/km² nur im GPGP und Mittelmeer). Zählung 10^4 umreißt jeden Wirbel (Hintergrund ~5),
3*10^4 ist der Innenbereich, 10^5 der Kern (fehlt im Süd-Pazifik/Süd-Atlantik, weil dort das Modell nirgends so hoch kommt).

Verarbeitung je Wirbel: Ausschnitt (Box) um den Wirbel, log10(Summe) leicht geglättet (Gauß 2 Zellen = 0,4°), zusammenhängende Fläche >= Pegel
(8er-Nachbarschaft), die den Dichtekern in der Nähe der Wirbelmitte enthält. Isolinien nur dieser Fläche. Außerhalb der Box ist das Raster
NaN: Linien enden dort offen und laufen nicht am Rand entlang. Längen: Pazifik (gpgp, suedpazifik) 0..360 wie die GPGP-Dateien, übrige -180..180.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import rasterio
from scipy import ndimage
from skimage.measure import approximate_polygon, find_contours, points_in_poly

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.cache' / 'plastik' / 'raw' / '14390873'
OUT = ROOT / 'public' / 'data' / 'plastik'
STEP = 0.2
R_KM = 6371.0088
LEVELS = [(10000.0, 'outer'), (30000.0, 'mid'), (100000.0, 'core')]
GAUSS = 2.0
MIN_RING_KM2 = 2000.0
MIN_LINE_KM = 150.0
DP_TOL = 0.04
SEARCH_DEG = 20.0
# id: (lon0, lon1, lat0, lat1, Mitte (lon, lat) im Ausgaberahmen, Ausschlussrechteck (lon0, lon1, lat0, lat1) oder None)
GYRES = {
    'gpgp': (130.0, 250.0, 12.0, 52.0, (218.4, 32.2), None),
    'suedpazifik': (150.0, 290.0, -48.0, -5.0, (255.0, -28.0), None),
    'nordatlantik': (-95.0, -8.0, 12.0, 48.0, (-45.0, 30.0), None),
    'suedatlantik': (-55.0, 18.0, -42.0, -5.0, (-15.0, -28.0), None),
    'indik': (38.0, 122.0, -48.0, -5.0, (80.0, -28.0), None),
    'mittelmeer': (-6.0, 36.5, 30.0, 46.0, (16.0, 37.0), (26.5, 42.0, 40.2, 47.0)),  # ohne Schwarzes Meer / Marmara
}


def load_total(kind):
    tot = 0
    for i in range(1, 5):
        with rasterio.open(RAW / f'{kind}_density_size{i}.tif') as ds:
            assert str(ds.crs) == 'EPSG:4326' and ds.bounds.left == 0 and ds.bounds.right == 360 and ds.bounds.top == 90
            tot = tot + 10 ** ds.read(1).astype('float64')
    return tot


def hav_km(lon1, lat1, lon2, lat2):
    d = math.pi / 180
    a = np.sin((lat2 - lat1) * d / 2) ** 2 + np.cos(lat1 * d) * np.cos(lat2 * d) * np.sin((lon2 - lon1) * d / 2) ** 2
    return 2 * R_KM * np.arcsin(np.sqrt(a))


def crop(g, box):
    """Ausschnitt (Zeilen nach Breite, Spalten mit Längen-Umbruch); gibt Teilraster plus Zellmitten im Ausgaberahmen zurück"""
    H, W = g.shape
    l0, l1, a0, a1 = box[:4]
    c0 = int(round(l0 / STEP))
    cols = (c0 + np.arange(int(round((l1 - l0) / STEP)))) % W
    rows = np.where((90 - (np.arange(H) + 0.5) * STEP >= a0) & (90 - (np.arange(H) + 0.5) * STEP <= a1))[0]
    lon = l0 + (np.arange(cols.size) + 0.5) * STEP
    lat = 90 - (rows + 0.5) * STEP
    return g[np.ix_(rows, cols)], lon, lat


def poly_area_km2(lon, lat):
    x = (lon - lon.mean()) * 111.195 * math.cos(math.radians(lat.mean()))
    y = (lat - lat.mean()) * 111.195
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def keep_line(p):
    if np.allclose(p[0], p[-1]):
        return poly_area_km2(p[:, 0], p[:, 1]) >= MIN_RING_KM2
    kx = 111.195 * math.cos(math.radians(p[:, 1].mean()))
    return float(np.hypot(np.diff(p[:, 0] * kx), np.diff(p[:, 1] * 111.195)).sum()) >= MIN_LINE_KM


def gyre_component(logv, lon, lat, lvl, centre):
    """größte zusammenhängende Fläche >= lvl, die Zellen nahe der Mitte berührt (bool-Maske) oder None"""
    ok = np.isfinite(logv)
    lab, _ = ndimage.label(ok & (logv >= math.log10(lvl)), structure=np.ones((3, 3)))
    LON, LAT = np.meshgrid(lon, lat)
    near = (hav_km(LON, LAT, centre[0], centre[1]) <= SEARCH_DEG * 111.195) & (lab > 0)
    if not near.any():
        return None
    area = (R_KM ** 2 * math.radians(STEP) ** 2 * np.cos(np.radians(lat)))[:, None] * np.ones((1, lon.size))
    ids = np.unique(lab[near])
    best = max(ids, key=lambda i: area[lab == i].sum())
    return lab == best


def contour_lines(logv, comp, lon, lat, lvl):
    """Isolinien der Komponente; Zellen außerhalb der (erweiterten) Komponente bekommen einen Wert unter dem Pegel, außerhalb der Box ist NaN"""
    grid = np.where(ndimage.binary_dilation(comp, iterations=3), logv, -9.0)
    grid = np.where(np.isfinite(logv), grid, np.nan)
    pad = np.pad(grid, 1, constant_values=np.nan)
    keepmask = ndimage.binary_dilation(comp, iterations=1)
    lines, border = [], 0
    for c in find_contours(pad, math.log10(lvl)):
        c = c - 1
        lo = lon[0] + c[:, 1] * STEP  # Zellmitte der ersten Spalte = lon[0]
        la = lat[0] - c[:, 0] * STEP
        pts = np.c_[lo, la]
        ri = np.clip(np.rint(c[:, 0]).astype(int), 0, comp.shape[0] - 1)
        ci = np.clip(np.rint(c[:, 1]).astype(int), 0, comp.shape[1] - 1)
        if keepmask[ri, ci].mean() < 0.5:
            continue
        if not keep_line(pts):
            continue
        s = approximate_polygon(pts, DP_TOL)
        if len(s) < 2:
            continue
        if not np.allclose(s[0], s[-1]):
            border += 1
        lines.append([[round(float(x), 3), round(float(y), 3)] for x, y in s])
    return lines, border


def lebreton_ring():
    gj = json.load(open(OUT / 'gpgp-contours.geojson'))
    b = next(x for x in gj['features'] if x['properties'].get('boundary'))
    return np.array(max((l for l in b['geometry']['coordinates'] if l[0] == l[-1]), key=len))


def main():
    if not RAW.is_dir():
        sys.exit(f'Rohdaten fehlen: {RAW} (erst scripts/plastik-build.py ausführen)')
    C = load_total('count')
    M = load_total('weight')
    logC = ndimage.gaussian_filter(np.log10(C), GAUSS, mode=('nearest', 'wrap'))
    logM = ndimage.gaussian_filter(np.log10(M), GAUSS, mode=('nearest', 'wrap'))
    print(f'Eriksen-Raster {C.shape}, Zählung min {C.min():.1f} max {C.max():.3g}; Masse max {M.max() / 1000:.0f} kg/km²')
    feats = []
    meta_g = {}
    for gid, (l0, l1, a0, a1, centre, excl) in GYRES.items():
        box = (l0, l1, a0, a1)
        sub, lon, lat = crop(logC, box)
        if excl:
            LON, LAT = np.meshgrid(lon, lat)
            sub = np.where((LON >= excl[0]) & (LON <= excl[1]) & (LAT >= excl[2]) & (LAT <= excl[3]), np.nan, sub)
        area = (R_KM ** 2 * math.radians(STEP) ** 2 * np.cos(np.radians(lat)))[:, None] * np.ones((1, lon.size))
        info = {}
        for lvl, rank in LEVELS:
            comp = gyre_component(sub, lon, lat, lvl, centre)
            if comp is None:
                info[rank] = dict(level=lvl, area_km2=0, n_lines=0)
                print(f'  {gid:13s} {rank:5s} {lvl:8g}: keine Fläche')
                continue
            lines, nborder = contour_lines(sub, comp, lon, lat, lvl)
            a = float(area[comp].sum())
            LON, LAT = np.meshgrid(lon, lat)
            w = area * comp
            cen = (float((LON * w).sum() / w.sum()), float((LAT * w).sum() / w.sum()))
            # liegt die Fläche am Rand der Box? (dann ist sie dort abgeschnitten)
            edge = bool(comp[0].any() or comp[-1].any() or comp[:, 0].any() or comp[:, -1].any())
            info[rank] = dict(level=lvl, area_km2=round(a, -3), n_lines=len(lines), n_open=nborder, centroid=[round(cen[0], 2), round(cen[1], 2)], touches_box=edge)
            print(f'  {gid:13s} {rank:5s} {lvl:8g}: {a / 1e6:6.2f} Mio. km², {len(lines)} Linien ({nborder} offen), Schwerpunkt {cen[0]:.1f}/{cen[1]:.1f}, Boxrand berührt: {edge}')
            if lines:
                feats.append({'type': 'Feature', 'properties': {'gyre': gid, 'level': lvl, 'unit': 'Teile/km²', 'rank': rank},
                               'geometry': {'type': 'MultiLineString', 'coordinates': lines}})
            if rank == 'mid':
                info['_comp_mid'] = (comp, lon, lat, area)
        meta_g[gid] = info
    gj = {'type': 'FeatureCollection', 'credit': 'Eriksen et al. 2014 (CC BY 4.0), Modellraster der Plastikdichte (Teile/km²), Stand ~2013',
          'note': 'Isolinien des modellierten Zählwerts (Summe der vier Größenklassen) für 10^4 / 3*10^4 / 10^5 Teile/km² (rank outer/mid/core), je Wirbel; modellbasiert, keine Messung',
          'features': feats}
    p = OUT / 'gyre-contours.geojson'
    p.write_text(json.dumps(gj, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')
    print(f'\n{p}: {p.stat().st_size / 1024:.0f} KB, {len(feats)} Features, {sum(len(f["geometry"]["coordinates"]) for f in feats)} Linien, '
          f'{sum(len(l) for f in feats for l in f["geometry"]["coordinates"])} Punkte')

    # Vergleich GPGP: Eriksen-Fläche vs. Lebreton-10-kg/km²-Fläche (im Raster-Ausschnitt von Lebreton 2018)
    ring = lebreton_ring()
    cmp_ = {}
    for kind, G, lvls in (('count', logC, [1e4, 3e4, 1e5]), ('mass', logM, [3000.0, 10000.0])):
        sub, lon, lat = crop(G, GYRES['gpgp'][:4])
        LON, LAT = np.meshgrid(lon, lat)
        area = (R_KM ** 2 * math.radians(STEP) ** 2 * np.cos(np.radians(lat)))[:, None] * np.ones((1, lon.size))
        ref = points_in_poly(np.c_[LON.ravel(), LAT.ravel()], ring).reshape(LON.shape)
        ref_c = (float((LON * area * ref).sum() / (area * ref).sum()), float((LAT * area * ref).sum() / (area * ref).sum()))
        box = (LON >= 200.0) & (LON <= 240.2) & (LAT >= 20.0) & (LAT <= 45.2)
        for lvl in lvls:
            comp = gyre_component(sub, lon, lat, lvl, GYRES['gpgp'][4])
            if comp is None:
                continue
            m = comp & box
            inter = float(area[m & ref].sum())
            union = float(area[m | ref].sum())
            cen = (float((LON * area * m).sum() / (area * m).sum()), float((LAT * area * m).sum() / (area * m).sum()))
            r = dict(kind=kind, level=lvl, area_in_raster_km2=round(float(area[m].sum()), -3), iou=round(inter / union, 3),
                     centre=[round(cen[0], 1), round(cen[1], 1)], centre_dist_km=round(float(hav_km(cen[0], cen[1], ref_c[0], ref_c[1]))))
            cmp_[f'{kind}_{lvl:g}'] = r
            print(f'  GPGP Eriksen {kind} {lvl:g} vs Lebreton 10 kg (Fläche {area[ref].sum() / 1e6:.2f} Mio. km², Mitte {ref_c[0]:.1f}/{ref_c[1]:.1f}): '
                  f'Fläche {r["area_in_raster_km2"] / 1e6:.2f}, IoU {r["iou"]}, Mittenabstand {r["centre_dist_km"]} km')
    meta = {
        'version': 1,
        'unit': 'Teile/km²', 'quantity': 'Zählung, Summe der vier Größenklassen',
        'levels': [{'level': l, 'rank': r} for l, r in LEVELS],
        'level_reason': 'Zählung statt Masse: die Eriksen-Massenraster erreichen 100 kg/km² nur im Nordpazifik/Nordatlantik und 10 kg/km² nur im GPGP und im Mittelmeer; 10^4 / 3*10^4 / 10^5 Teile/km² geben für alle Wirbel Umriss/Innenbereich, ein Kern fehlt im Süd-Pazifik und Süd-Atlantik, weil das Modell dort nirgends so hoch kommt',
        'year_approx': 2013,
        'smoothing_cells': GAUSS, 'grid_deg': STEP,
        'credit': 'Eriksen et al. 2014 (CC BY 4.0), Modellraster der Plastikdichte, Stand ~2013; Isolinien eigene Ableitung',
        'licence': 'CC BY 4.0', 'doi': '10.1371/journal.pone.0111913', 'dataDoi': '10.6084/m9.figshare.14390873',
        'gyres': {gid: {k: v for k, v in i.items() if not k.startswith('_')} for gid, i in meta_g.items()},
        'mid_area_km2': {gid: i['mid']['area_km2'] for gid, i in meta_g.items()},
        'gpgp_vs_lebreton': cmp_,
    }
    (OUT / 'gyre-contours.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    # Fläche der mittleren Komponente als npz für gyre-model.py (Plausibilität) wird dort selbst neu berechnet
    print('Mid-Flächen (Mio. km²):', {g: round(a / 1e6, 2) for g, a in meta['mid_area_km2'].items()})


if __name__ == '__main__':
    main()
