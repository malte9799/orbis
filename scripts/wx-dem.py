#!/usr/bin/env python3
"""
Geländehöhen für die Temperaturkorrektur der Wetterkarten (einmalig, ändert sich nicht).

Lädt die Terrarium-Kacheln (Mapzen/AWS Open Data) der Zoomstufe 5, rechnet sie von Web-Mercator auf ein
Lat/Lon-Gitter mit 0,0439° (≈ 4,9 km) um und schreibt sie im OWX-Format (docs/WETTERDATEN-FORMAT.md):

  <out>/v1/static/dem/t<col>_<row>.owx    45° × 45°, 1025 × 1025 Punkte, ein Zeitschritt, Meter

Das Meer zählt als 0 m; jenseits von ±85,05° (Mercator-Grenze) fehlt der Wert (Korrektur 0).
Aufruf (.github/workflows/wx-dem.yml):  python scripts/wx-dem.py --out ../wx-out

Höhen: Mapzen Terrain Tiles (AWS Open Data) – u. a. SRTM, GMTED2010, ETOPO1, ArcticDEM u. a., siehe
https://github.com/tilezen/joerd/blob/master/docs/attribution.md
Abhängigkeiten: numpy, scipy, pillow.
"""

import argparse
import concurrent.futures as cf
import importlib.util
import io
import os
import sys
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('wxicon', os.path.join(HERE, 'wx-icon.py'))
wx = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wx)

Z = 5
TILES = 2**Z
PX = 256
M = TILES * PX  # 8192 Pixel um die Welt
STEP_DEG = 360 / M  # 0,0439°
TILE_DEG = 45
CELLS = round(TILE_DEG / STEP_DEG)  # 1024
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
MERCATOR_LAT = 85.0511287798


def get_tile(x, y):
    from PIL import Image

    for i in range(4):
        try:
            req = urllib.request.Request(URL.format(z=Z, x=x, y=y), headers={'User-Agent': wx.UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                img = np.asarray(Image.open(io.BytesIO(r.read())).convert('RGB'), dtype=np.float32)
            return x, y, img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768
        except Exception as e:  # noqa: BLE001
            if i == 3:
                raise RuntimeError(f'Kachel {Z}/{x}/{y}: {e}')
    return None


def main():
    from scipy.ndimage import map_coordinates

    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    merc = np.zeros((M, M), np.float32)
    with cf.ThreadPoolExecutor(16) as ex:
        for x, y, h in ex.map(lambda a: get_tile(*a), [(x, y) for x in range(TILES) for y in range(TILES)]):
            merc[y * PX : (y + 1) * PX, x * PX : (x + 1) * PX] = h
    # Meer = 0 m – vor dem Interpolieren, sonst ziehen die Tiefenwerte der Meeresböden die Küstenpixel unter 0
    np.maximum(merc, 0, out=merc)
    print('Kacheln geladen', flush=True)

    ny, nx = round(180 / STEP_DEG) + 1, M + 1
    lats = 90 - np.arange(ny) * STEP_DEG
    lons = -180 + np.arange(nx) * STEP_DEG
    fx = (lons + 180) / 360 * M - 0.5
    dem = np.full((ny, nx), wx.NODATA, np.int16)
    ok = np.abs(lats) < MERCATOR_LAT
    la = np.radians(lats[ok])
    fy = (1 - np.arcsinh(np.tan(la)) / np.pi) / 2 * M - 0.5
    rows = np.flatnonzero(ok)
    for a in range(0, len(rows), 256):
        sel = slice(a, a + 256)
        yy, xx = np.meshgrid(fy[sel], fx, indexing='ij')
        h = map_coordinates(merc, [yy, xx], order=1, mode='nearest')
        dem[rows[sel]] = np.clip(np.round(h), 0, 32000).astype(np.int16)

    out = os.path.join(args.out, 'v1', 'static', 'dem')
    os.makedirs(out, exist_ok=True)
    total = 0
    for r in range(180 // TILE_DEG):
        for c in range(360 // TILE_DEG):
            tile = np.ascontiguousarray(dem[r * CELLS : r * CELLS + CELLS + 1, c * CELLS : c * CELLS + CELLS + 1])[None]
            header = dict(var='dem', scale=1.0, offset=0.0, nodata=wx.NODATA, pred='plane-time',
                          lat0=90 - r * TILE_DEG, lon0=-180 + c * TILE_DEG, dx=STEP_DEG, dy=STEP_DEG, wrap=False)
            blob = wx.encode(tile, header)
            with open(os.path.join(out, f't{c}_{r}.owx'), 'wb') as f:
                f.write(blob)
            total += len(blob)
    print(f'{(180 // TILE_DEG) * (360 // TILE_DEG)} Dateien, {total / 1e6:.1f} MB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
