"""Sharper Moon textures from the NASA SVS CGI Moon Kit (public domain), run by the deploy workflow.

  python3 scripts/moon-textures.py public/textures/moon

Writes lroc-4k.jpg / lroc-8k.jpg (LRO LROC colour mosaic) and normal-4k.jpg (tangent-space
normal map from the LOLA elevation model). The app falls back to the bundled 2k map if they
are missing, so a failed download never breaks the site. Needs numpy and Pillow.
"""

import os
import shutil
import sys
import tempfile
import urllib.request

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
KIT = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/'
MOON_R = 1737.4e3  # m


def fetch(name: str, tmp: str) -> str:
    path = os.path.join(tmp, name)
    print('download', KIT + name, flush=True)
    req = urllib.request.Request(KIT + name, headers={'User-Agent': 'orbis-build'})
    with urllib.request.urlopen(req, timeout=600) as r, open(path, 'wb') as f:
        shutil.copyfileobj(r, f)
    return path


def colour(tmp: str, out: str) -> None:
    img = Image.open(fetch('lroc_color_poles_8k.tif', tmp)).convert('RGB')
    img.resize((8192, 4096), Image.LANCZOS).save(os.path.join(out, 'lroc-8k.jpg'), quality=86, optimize=True, progressive=True)
    img.resize((4096, 2048), Image.LANCZOS).save(os.path.join(out, 'lroc-4k.jpg'), quality=88, optimize=True, progressive=True)


def heights(tmp: str) -> np.ndarray:
    """Elevation in metres, equirectangular, north up."""
    try:
        # unsigned 16 bit, half metres above a reference 20 km below the mean radius
        return np.asarray(Image.open(fetch('ldem_16_uint.tif', tmp)), dtype=np.float32) * 0.5
    except Exception as e:  # noqa: BLE001
        print('ldem_16_uint.tif failed, trying float version:', e, flush=True)
        return np.asarray(Image.open(fetch('ldem_16.tif', tmp)), dtype=np.float32) * 1000.0  # km


def normals(tmp: str, out: str, exaggerate: float = 2.5) -> None:
    h = heights(tmp)
    rows, cols = h.shape
    dy = np.pi * MOON_R / rows  # metres per pixel north–south
    lat = (0.5 - (np.arange(rows) + 0.5) / rows) * np.pi
    dx = (2 * np.pi * MOON_R / cols) * np.maximum(np.cos(lat), 0.02)[:, None]
    # east: wraps around in longitude; north: image rows run southwards
    gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / (2 * dx)
    up = np.vstack([h[:1], h[:-1]])
    down = np.vstack([h[1:], h[-1:]])
    gy = (up - down) / (2 * dy)
    n = np.stack([-exaggerate * gx, -exaggerate * gy, np.ones_like(h)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgb = ((n * 0.5 + 0.5) * 255 + 0.5).clip(0, 255).astype(np.uint8)
    Image.fromarray(rgb, 'RGB').resize((4096, 2048), Image.LANCZOS).save(os.path.join(out, 'normal-4k.jpg'), quality=92, optimize=True)


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/textures/moon'
    with tempfile.TemporaryDirectory() as tmp:
        stage = os.path.join(tmp, 'out')
        os.makedirs(stage)
        colour(tmp, stage)
        normals(tmp, stage)
        # only publish a complete set
        if os.path.exists(out):
            shutil.rmtree(out)
        shutil.copytree(stage, out)
    for f in sorted(os.listdir(out)):
        print(f, os.path.getsize(os.path.join(out, f)) // 1024, 'KiB')


if __name__ == '__main__':
    main()
