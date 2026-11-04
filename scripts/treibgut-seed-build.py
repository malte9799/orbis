#!/usr/bin/env python3
"""Startverteilung für den Live-Modus der Ebene `treibmodell`: beobachtetes Plastik an der Meeresoberfläche (Eriksen et al. 2014).

Aufruf:  .cache/plastik/venv/bin/python -I scripts/treibgut-seed-build.py
Braucht numpy und rasterio (scripts/plastik-requirements.txt). Liest die Rohdaten aus dem Download-Cache von plastik-build.py
(.cache/plastik/raw/14390873/count_density_size1..4.tif; zuerst plastik-build.py laufen lassen) und das Strömungsfeld
public/data/currents/ (nur als Land-Meer-Maske). Schreibt public/data/plastik/treibgut-seed.json.

Quelle: Eriksen et al. 2014, PLoS ONE 9:e111913, doi:10.1371/journal.pone.0111913, Daten doi:10.6084/m9.figshare.14390873 (CC BY 4.0):
Teile/km² in vier Größenklassen auf 0,2°, hier summiert (wie global-density.png). Die Rohdateien sind nur Daten, es wird nichts daraus ausgeführt.

Verarbeitung:
  1. Summe der vier Größenklassen (Teile/km²); der Hintergrundwert des Modells (Minimum, ~5 Teile/km²) wird abgezogen, Zellen nicht deutlich
     darüber haben Gewicht 0.
  2. Zellen auf Land (laut Strömungsfeld) fallen weg.
  3. Gewicht = Überschuss (Teile/km²) x Zellfläche (0,2°-Zellen, ~cos Breite), über 1° x 1° summiert -> Teile je 1°-Zelle.
  4. Je 1°-Zelle ein Byte: 0 = kein Gewicht, 1..255 = log10 des Gewichts, linear zwischen lo und hi quantisiert (Schritt ~ 5 %).

Ausgabe treibgut-seed.json:
  step, lon0, lat0, nx, ny  1°-Gitter, Zeile 0 = südlichste Breite, Spalte 0 = West; lon0/lat0 = Mitte der Zelle [0][0]
  lo, hi                    log10 (Teile je 1°-Zelle) für Byte 1 und Byte 255
  data                      Base64 der Bytes, Zeile für Zeile (nx * ny)
  total                     Summe der Teile (Kontrolle), cells = Zahl der Zellen mit Gewicht
"""
import base64
import json
import sys
from pathlib import Path

import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.cache' / 'plastik' / 'raw' / '14390873'
CUR = ROOT / 'public' / 'data' / 'currents'
OUT = ROOT / 'public' / 'data' / 'plastik' / 'treibgut-seed.json'
R_KM = 6371.0088
STEP = 1.0
LAT_MIN, LAT_MAX = -85.0, 85.0
# Zellen, die höchstens so viel über dem Hintergrund liegen, gelten als Hintergrund (wie die Transparenz im Dichtebild)
ABOVE = 10 ** 0.05


def main():
    if not RAW.is_dir():
        sys.exit(f'Rohdaten fehlen: {RAW} (erst scripts/plastik-build.py ausführen)')
    tot = 0
    for i in range(1, 5):
        with rasterio.open(RAW / f'count_density_size{i}.tif') as ds:
            assert str(ds.crs) == 'EPSG:4326' and ds.bounds.left == 0 and ds.bounds.right == 360 and ds.bounds.top == 90
            tot = tot + 10 ** ds.read(1).astype('float64')
    H, W = tot.shape
    floor = float(tot.min())
    excess = np.where(tot > floor * ABOVE, tot - floor, 0.0)

    # Zellmitten (Länge 0..360 -> -180..180) und Fläche je Zelle in km²
    dlat = 180.0 / H
    dlon = 360.0 / W
    lat = 90 - (np.arange(H) + 0.5) * dlat
    lon = (np.arange(W) + 0.5) * dlon
    lon = np.where(lon >= 180, lon - 360, lon)
    area = (R_KM ** 2) * np.radians(dlon) * np.radians(dlat) * np.cos(np.radians(lat))[:, None] * np.ones((1, W))
    pieces = excess * area

    # Land-Meer-Maske aus dem Strömungsfeld (nächste Zelle)
    meta = json.loads((CUR / 'meta.json').read_text(encoding='utf-8'))
    u = np.fromfile(CUR / 'mean.bin', dtype='<i2', count=meta['nx'] * meta['ny']).reshape(meta['ny'], meta['nx'])
    jj = np.clip(np.rint((lat - meta['lat0']) / meta['step']).astype(int), 0, meta['ny'] - 1)
    ii = np.mod(np.rint((lon - meta['lon0']) / meta['step']).astype(int), meta['nx'])
    sea = (u[jj][:, ii] != meta['nodata'])
    inlat = (lat >= meta['lat0']) & (lat <= meta['lat0'] + (meta['ny'] - 1) * meta['step'])
    sea &= inlat[:, None]
    pieces = np.where(sea, pieces, 0.0)

    # in 1°-Zellen summieren
    nx = int(round(360 / STEP))
    ny = int(round((LAT_MAX - LAT_MIN) / STEP))
    lon0 = -180 + STEP / 2
    lat0 = LAT_MIN + STEP / 2
    ci = np.floor((lon + 180) / STEP).astype(int).clip(0, nx - 1)
    cj = np.floor((lat - LAT_MIN) / STEP).astype(int)
    ok = (cj >= 0) & (cj < ny)
    grid = np.zeros((ny, nx))
    flat_idx = (cj[:, None] * nx + ci[None, :])[ok]
    grid.ravel()[:] = np.bincount(flat_idx.ravel(), weights=pieces[ok].ravel(), minlength=ny * nx)

    pos = grid > 0
    lw = np.log10(grid[pos])
    lo, hi = float(lw.min()), float(lw.max())
    q = np.zeros((ny, nx), dtype=np.uint8)
    q[pos] = 1 + np.rint(254 * (lw - lo) / (hi - lo)).astype(np.uint8)
    obj = {
        'version': 1, 'credit': 'Eriksen et al. 2014 (CC BY 4.0)', 'license': 'CC BY 4.0',
        'source': 'doi:10.1371/journal.pone.0111913, Daten doi:10.6084/m9.figshare.14390873',
        'unit': 'Teile je 1°-Zelle über dem Hintergrund (Summe der vier Größenklassen)',
        'step': STEP, 'lon0': lon0, 'lat0': lat0, 'nx': nx, 'ny': ny,
        'lo': round(lo, 4), 'hi': round(hi, 4), 'cells': int(pos.sum()), 'total': float(f'{grid.sum():.4g}'),
        'data': base64.b64encode(q.tobytes()).decode('ascii'),
    }
    OUT.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    top = np.unravel_index(np.argmax(grid), grid.shape)
    print(f'treibgut-seed.json: {OUT.stat().st_size / 1024:.1f} KB, {obj["cells"]} Zellen mit Gewicht, Summe {grid.sum() / 1e12:.2f} Billionen Teile, '
          f'Hintergrund {floor:.2f} Teile/km², log10-Spanne {lo:.2f}..{hi:.2f}, stärkste Zelle bei {lat0 + top[0] * STEP:.1f}N {lon0 + top[1] * STEP:.1f}E')


if __name__ == '__main__':
    main()
