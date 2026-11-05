#!/usr/bin/env python3
"""Mittleres Oberflächenströmungsfeld für die Ebene `treibmodell` aufbereiten (NOAA/AOML Drifter-Klimatologie).

Aufruf:  .cache/plastik/venv/bin/python -I scripts/currents-build.py [--refresh]
Braucht numpy und scipy (scripts/plastik-requirements.txt). Rohdaten nach .cache/currents/raw/ (gitignored), Ausgabe nach
public/data/currents/ (mean.bin + meta.json).

Quelle: ERDDAP-Datensatz `drifter_annualmeans` ("Global Drifter Program - Climatology - Annual Means", Version 3.10, Daten bis
28.02.2023), Laurindo, Mariano & Lumpkin 2017, Deep-Sea Res. I, doi:10.1016/j.dsr.2017.04.009, NOAA/AOML & Univ. Miami.
Lizenz laut Metadaten: CC BY 4.0 ("This study used data collected and made freely available by the NOAA Global Drifter Program").
  https://erddap.aoml.noaa.gov/gdp/erddap/griddap/drifter_annualmeans.html
Die Klimatologie enthält die gesamte Nahoberflächenströmung der Drifter (geostrophisch + Ekman, Schirm in 15 m Tiefe), nach
Entfernen von Wind-Slip und Tide; nur damit konvergiert Treibgut in den subtropischen Wirbeln.

Datenweg: ein einziger griddap-Request (U,V als CSV, 1440 x 632 Zellen à 0,25°, ~38 MB). Kein Auszug nötig, die Datei ist klein.

Verarbeitung:
  1. 0,25° -> 0,5°: Mittel der gültigen Werte je 2 x 2 Zellen (>= 1 gültig = Meer).
  2. Kleine Lücken im Meer (zusammenhängende fehlende Gebiete < GAP_CELLS Zellen, Längen periodisch) per Nachbarmittel
     gefüllt; große fehlende Gebiete (Land, Meereis, Pole) bleiben Land.
  3. Zeilen am Nord-/Südrand ohne Meer abgeschnitten.

Ausgabe:
  mean.bin  (Little-Endian)  Int16 u[ny][nx], dann Int16 v[ny][nx]; Zeile 0 = südlichste Breite; Spalte 0 = West (-180 + step/2)
            Wert * 0,001 = m/s, -32768 = Land / kein Wert
  meta.json Gitter, Skala, Credit, Lizenz, DOI
"""
import argparse
import json
import os
import urllib.request
from datetime import date

import numpy as np
from scipy import ndimage

URL = 'https://erddap.aoml.noaa.gov/gdp/erddap/griddap/drifter_annualmeans.csv?U,V'
UA = 'orbis-build/1.0 (https://github.com/malte9799/orbis; currents extract)'
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, '.cache', 'currents', 'raw')
OUT = os.path.join(ROOT, 'public', 'data', 'currents')
SCALE = 1000
NODATA = -32768
GAP_CELLS = 150  # 0,5°-Zellen: kleiner = Lücke im Meer, größer = Land / Eis


def fetch(refresh):
    path = os.path.join(RAW, 'annual_UV.csv')
    if refresh or not os.path.exists(path):
        os.makedirs(RAW, exist_ok=True)
        print('Lade', URL)
        req = urllib.request.Request(URL, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    return path


def load(path):
    a = np.genfromtxt(path, delimiter=',', skip_header=2, dtype=np.float64)  # lon, lat, U, V; NaN bleibt NaN
    lon = np.unique(a[:, 0])
    lat = np.unique(a[:, 1])
    assert a.shape[0] == lon.size * lat.size
    # sortiert nach lon, dann lat -> [lon][lat]
    u = a[:, 2].reshape(lon.size, lat.size).T
    v = a[:, 3].reshape(lon.size, lat.size).T
    return lon, lat, u, v


def block2(a):
    ny, nx = a.shape
    b = a[: ny - ny % 2, : nx - nx % 2].reshape(ny // 2, 2, nx // 2, 2)
    with np.errstate(all='ignore'):
        out = np.nanmean(b, axis=(1, 3))
    return out


def fill_gaps(u, v):
    missing = np.isnan(u) | np.isnan(v)
    # Längen periodisch: links und rechts je eine Spalte anhängen, damit Komponenten über ±180° zusammenhängen
    padded = np.concatenate([missing[:, -1:], missing, missing[:, :1]], axis=1)
    lab, n = ndimage.label(padded)
    sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    small = np.isin(lab, np.nonzero(sizes < GAP_CELLS)[0] + 1)[:, 1:-1]
    filled = 0
    todo = small & missing
    while todo.any():
        ok = ~(np.isnan(u) | np.isnan(v))
        # Mittel der 8 Nachbarn (Länge periodisch)
        cu = np.where(ok, u, 0.0)
        cv = np.where(ok, v, 0.0)
        cn = ok.astype(float)
        su = sv = sn = 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                def sh(x):
                    r = np.roll(x, dx, axis=1)
                    r = np.roll(r, dy, axis=0)
                    if dy == 1:
                        r[0] = 0
                    elif dy == -1:
                        r[-1] = 0
                    return r
                su = su + sh(cu)
                sv = sv + sh(cv)
                sn = sn + sh(cn)
        take = todo & (sn > 0)
        if not take.any():
            break
        u[take] = su[take] / sn[take]
        v[take] = sv[take] / sn[take]
        filled += int(take.sum())
        todo = todo & ~take
    return filled


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--refresh', action='store_true')
    args = ap.parse_args()
    lon, lat, u, v = load(fetch(args.refresh))
    print(f'Roh: {lon.size} x {lat.size} Zellen, lon {lon[0]}…{lon[-1]}, lat {lat[0]}…{lat[-1]}')
    # 632 Zeilen -> gerade, 1440 Spalten -> gerade
    u2, v2 = block2(u), block2(v)
    lat2 = lat[: lat.size - lat.size % 2].reshape(-1, 2).mean(axis=1)
    both = ~(np.isnan(u2) | np.isnan(v2))
    u2[~both] = np.nan
    v2[~both] = np.nan
    filled = fill_gaps(u2, v2)
    sea = ~(np.isnan(u2) | np.isnan(v2))
    rows = np.nonzero(sea.any(axis=1))[0]
    r0, r1 = rows[0], rows[-1] + 1
    u2, v2, lat2, sea = u2[r0:r1], v2[r0:r1], lat2[r0:r1], sea[r0:r1]
    ny, nx = u2.shape
    iu = np.where(sea, np.clip(np.rint(u2 * SCALE), -32767, 32767), NODATA).astype('<i2')
    iv = np.where(sea, np.clip(np.rint(v2 * SCALE), -32767, 32767), NODATA).astype('<i2')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'mean.bin'), 'wb') as f:
        f.write(iu.tobytes())
        f.write(iv.tobytes())
    step = 0.5
    meta = {
        'version': 1,
        'dataset': 'drifter_annualmeans',
        'source': 'https://erddap.aoml.noaa.gov/gdp/erddap/griddap/drifter_annualmeans.html',
        'credit': 'NOAA Global Drifter Program (AOML) & Univ. Miami, Laurindo, Mariano & Lumpkin 2017, Klimatologie v3.10 (Daten bis 2023-02-28)',
        'doi': '10.1016/j.dsr.2017.04.009',
        'license': 'CC BY 4.0',
        'built': date.today().isoformat(),
        'nx': nx,
        'ny': ny,
        'step': step,
        'lon0': -180 + step / 2,
        'lat0': round(float(lat2[0]), 4),
        'scale': SCALE,
        'nodata': NODATA,
        'units': 'm/s',
    }
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    speed = np.hypot(u2, v2)[sea]
    size = os.path.getsize(os.path.join(OUT, 'mean.bin'))
    print(f'Gitter {nx} x {ny} à {step}°, lat {lat2[0]}…{lat2[-1]}, Lücken gefüllt: {filled}')
    print(f'Meer: {sea.mean() * 100:.1f} % der Zellen; Geschwindigkeit mittel {speed.mean():.3f} m/s, max {speed.max():.2f} m/s')
    print(f'mean.bin {size / 1024:.0f} KB')


if __name__ == '__main__':
    main()
