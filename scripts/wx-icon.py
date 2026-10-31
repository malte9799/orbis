#!/usr/bin/env python3
"""
Wetterkarten-Felder aus DWD ICON global (GRIB2) für Orbis.

Lädt einen ICON-Lauf von opendata.dwd.de, remappt das icosaedrische Gitter auf ein regelmäßiges
Lat/Lon-Gitter (0,125°), quantisiert und schreibt Kacheln im OWX-Format (docs/WETTERDATEN-FORMAT.md):

  <out>/v1/<lauf>/<variable>/o.owx          Überblick 0,5° (ganze Erde)
  <out>/v1/<lauf>/<variable>/t<col>_<row>.owx  Kachel 45° × 45° mit 0,125°
  <out>/v1/latest.json                      Metadaten des neuesten vollständigen Laufs

Aufruf (Workflow .github/workflows/wx.yml):
  python scripts/wx-icon.py --out ../wx-out [--run latest|YYYYMMDDHH] [--vars t_2m] [--wait 40]
                            [--published ../wx-prev/latest.json] [--work ../wx-work]

Daten: Deutscher Wetterdienst (DWD), ICON, CC BY 4.0 – hier verändert (Gitter, Einheiten, Quantisierung).
Abhängigkeiten: numpy, scipy, eccodes (pip).
"""

import argparse
import bz2
import concurrent.futures as cf
import datetime as dt
import gzip
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
import zlib

import numpy as np

BASE = 'https://opendata.dwd.de/weather/nwp/icon/grib'
UA = 'orbis-wx/1 (+https://github.com/malte9799/orbis)'
ATTRIBUTION = 'Deutscher Wetterdienst (DWD), ICON, CC BY 4.0 – verändert (Gitter, Einheiten, Quantisierung)'

HOURS = 72  # Vorhersagehorizont
STEP = 3  # Stunden zwischen den Zeitschritten
RES = 0.125  # Kachelauflösung [°]
OVERVIEW_RES = 0.5
TILE_DEG = 45
NODATA = -32768
FORMAT_VERSION = 1

# Variablen: Schlüssel = Orbis-Name (ModelVar in src/api/model.ts), `icon` = Verzeichnis/Kürzel beim DWD
VARS = {
    'temperature_2m': dict(icon='t_2m', convert=lambda v: v - 273.15, scale=0.1, offset=0.0, unit='°C'),
    'dew_point_2m': dict(icon='td_2m', convert=lambda v: v - 273.15, scale=0.1, offset=0.0, unit='°C'),
    # Windkomponenten 10 m (erdbezogen), Böen in km/h wie bei Open-Meteo
    'u': dict(icon='u_10m', convert=lambda v: v, scale=0.1, offset=0.0, unit='m/s'),
    'v': dict(icon='v_10m', convert=lambda v: v, scale=0.1, offset=0.0, unit='m/s'),
    # VMAX_10M ist das Maximum seit dem vorigen Ausgabeschritt (stündlich) → Maximum der letzten 3 Stunden
    'wind_gusts_10m': dict(icon='vmax_10m', kind='max3', convert=lambda v: v * 3.6, scale=0.1, offset=0.0, unit='km/h'),
    # TOT_PREC ist seit Laufstart aufsummiert → Rate [mm/h] aus den Differenzen der 3-h-Schritte
    'precipitation': dict(icon='tot_prec', kind='rate', convert=lambda v: v, scale=0.01, offset=0.0, unit='mm/h'),
    'cloud_cover': dict(icon='clct', convert=lambda v: v, scale=1.0, offset=0.0, unit='%'),
    'pressure_msl': dict(icon='pmsl', convert=lambda v: v / 100, scale=0.1, offset=0.0, unit='hPa'),
    'snow_depth': dict(icon='h_snow', fill=0.0, convert=lambda v: v, scale=0.001, offset=0.0, unit='m'),
    'cape': dict(icon='cape_ml', convert=lambda v: v, scale=1.0, offset=0.0, unit='J/kg'),
    # Höhe der Modelloberfläche (zeitinvariant): Grundlage der Geländekorrektur der Temperatur im Client
    'hsurf': dict(icon='hsurf', static=True, convert=lambda v: v, scale=1.0, offset=0.0, unit='m'),
}


# ---------------------------------------------------------------------------
# Download

def http(url, method='GET', timeout=60):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=timeout)


def exists(url):
    try:
        with http(url, 'HEAD', 20):
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise
    except urllib.error.URLError:
        return False


def grib_url(run, hour, v):
    icon = v['icon']
    if v.get('static'):
        return invariant_url(run, icon)
    return f'{BASE}/{run[8:]}/{icon}/icon_global_icosahedral_single-level_{run}_{hour:03d}_{icon.upper()}.grib2.bz2'


def invariant_url(run, name):
    return f'{BASE}/{run[8:]}/{name}/icon_global_icosahedral_time-invariant_{run}_{name.upper()}.grib2.bz2'


def fetch(url, dest, tries=4):
    """lädt und entpackt eine .bz2-Datei nach dest (atomar)"""
    if os.path.exists(dest):
        return dest
    for i in range(tries):
        try:
            with http(url, timeout=120) as r:
                raw = r.read()
            data = bz2.decompress(raw)
            tmp = dest + '.part'
            with open(tmp, 'wb') as f:
                f.write(data)
            os.replace(tmp, dest)
            return dest
        except (urllib.error.URLError, OSError, EOFError, ValueError) as e:
            if i == tries - 1:
                raise RuntimeError(f'Download fehlgeschlagen: {url}: {e}')
            time.sleep(3 * (i + 1))


def hours(v=None):
    """Ausgabeschritte (Stunden nach Laufstart)"""
    if v and v.get('static'):
        return [0]
    return list(range(0, HOURS + 1, STEP))


def source_hours(v, h):
    """Stunden der Quelldateien, aus denen der Ausgabeschritt h entsteht"""
    kind = v.get('kind')
    if kind == 'rate':
        return [x for x in (h - STEP, h, h + STEP) if 0 <= x <= HOURS]
    if kind == 'max3':
        return list(range(max(1, h - STEP + 1), max(1, h) + 1))
    return [h]


def download_hours(v):
    """alle Dateien, die geladen werden müssen (die Niederschlagssumme bei Stunde 0 ist per Definition 0)"""
    hs = sorted({x for h in hours(v) for x in source_hours(v, h)})
    return [x for x in hs if not (v.get('kind') == 'rate' and x == 0)]


def candidate_runs(now):
    """Laufzeiten (00/06/12/18 UTC) vom jüngsten rückwärts"""
    base = now.replace(minute=0, second=0, microsecond=0)
    base -= dt.timedelta(hours=base.hour % 6)
    return [(base - dt.timedelta(hours=6 * k)).strftime('%Y%m%d%H') for k in range(4)]


def run_ready(run, names):
    # Dateien erscheinen in Stundenreihenfolge → die letzte Datei zeigt, dass alles da ist
    return all(exists(grib_url(run, download_hours(VARS[n])[-1], VARS[n])) for n in names)


def pick_run(args, names):
    published = None
    if args.published and os.path.exists(args.published):
        with open(args.published) as f:
            published = json.load(f).get('run')
    if args.run != 'latest':
        return args.run, published
    deadline = time.time() + args.wait * 60
    while True:
        cands = candidate_runs(dt.datetime.now(dt.timezone.utc))
        ready = next((c for c in cands if run_ready(c, names)), None)
        if ready == cands[0] or time.time() >= deadline:
            return ready, published
        print(f'Lauf {cands[0]} noch nicht vollständig, warte …', flush=True)
        time.sleep(180)


# ---------------------------------------------------------------------------
# Remapping (icosaedrisch → regelmäßig)

def read_values(path):
    import eccodes as ec

    with open(path, 'rb') as f:
        h = ec.codes_grib_new_from_file(f)
        try:
            return ec.codes_get_values(h), ec.codes_get(h, 'uuidOfHGrid')
        finally:
            ec.codes_release(h)


def unit_vectors(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def build_weights(work, run):
    """Indizes + Gewichte der 3 nächsten Zellen je Zielpunkt; pro Gitter-UUID gecacht"""
    from scipy.spatial import cKDTree

    clat, uuid = read_values(fetch(invariant_url(run, 'clat'), f'{work}/clat_{run}.grib2'))
    os.makedirs(f'{work}/weights', exist_ok=True)
    cache = f'{work}/weights/{uuid}_{RES}.npz'
    if os.path.exists(cache):
        z = np.load(cache)
        return z['idx'], z['w']
    clon, _ = read_values(fetch(invariant_url(run, 'clon'), f'{work}/clon_{run}.grib2'))
    tree = cKDTree(unit_vectors(clat, clon))  # CLAT/CLON liegen in Grad
    n = int(round(90 / RES))
    lats = 90 - RES * np.arange(2 * n + 1)
    lons = -180 + RES * np.arange(4 * n + 1)
    la, lo = np.meshgrid(lats, lons, indexing='ij')
    d, idx = tree.query(unit_vectors(la, lo).reshape(-1, 3), k=3, workers=-1)
    w = 1 / np.maximum(d, 1e-9)
    w = (w / w.sum(1, keepdims=True)).astype(np.float32)
    idx = idx.astype(np.int32)
    np.savez(cache, idx=idx, w=w)
    return idx, w


def remap(values, idx, w):
    n = int(round(90 / RES))
    return (values[idx] * w).sum(1).astype(np.float32).reshape(2 * n + 1, 4 * n + 1)


def overview(field):
    """0,5°-Überblick: Boxfilter über 4×4 Zellen, dann jeder 4. Punkt (ohne doppelte Länge 180°)"""
    from scipy.ndimage import uniform_filter

    k = int(round(OVERVIEW_RES / RES))
    sm = uniform_filter(field[:, :-1], size=k + 1, mode=('nearest', 'wrap'))
    return sm[::k, ::k]


# ---------------------------------------------------------------------------
# OWX-Format

def _wrap16(d):
    return ((d.astype(np.int32) + 32768) & 0xFFFF) - 32768


def _plane_residual(s):
    """Plane-Prädiktor (a + b − c) über die letzten beiden Achsen, mod 2^16"""
    r = s.astype(np.int32).copy()
    r[:, 1:, 1:] = s[:, 1:, 1:] - (s[:, 1:, :-1] + s[:, :-1, 1:] - s[:, :-1, :-1])
    r[:, 0, 1:] = s[:, 0, 1:] - s[:, 0, :-1]
    r[:, 1:, 0] = s[:, 1:, 0] - s[:, :-1, 0]
    return r


def encode(q, header):
    """q: int16 [nt, ny, nx] → OWX-Bytes"""
    s = q.astype(np.int32)
    s[1:] = q[1:].astype(np.int32) - q[:-1].astype(np.int32)  # zeitliche Differenz
    d = _wrap16(_plane_residual(s))
    zz = ((d << 1) ^ (d >> 15)).astype(np.uint16)
    planes = np.concatenate([(zz & 255).astype(np.uint8).ravel(), (zz >> 8).astype(np.uint8).ravel()]).tobytes()
    co = zlib.compressobj(9, zlib.DEFLATED, 31)  # gzip, für DecompressionStream('gzip')
    body = co.compress(planes) + co.flush()
    head = json.dumps({**header, 'nt': q.shape[0], 'ny': q.shape[1], 'nx': q.shape[2]}, separators=(',', ':')).encode()
    return b'OWX1' + struct.pack('<I', len(head)) + head + body


def decode(blob):
    """Gegenstück zu encode() – für den Selbsttest (der Browser-Dekoder folgt in src/api/wxmodel.ts)"""
    assert blob[:4] == b'OWX1'
    hl = struct.unpack('<I', blob[4:8])[0]
    h = json.loads(blob[8 : 8 + hl])
    nt, ny, nx = h['nt'], h['ny'], h['nx']
    planes = np.frombuffer(gzip.decompress(blob[8 + hl :]), np.uint8)
    n = nt * ny * nx
    zz = planes[:n].astype(np.uint16) | (planes[n:].astype(np.uint16) << 8)
    d = ((zz >> 1).astype(np.int32) ^ -(zz & 1).astype(np.int32)).reshape(nt, ny, nx)
    # Plane-Prädiktor rückwärts: Zeile für Zeile, innerhalb der Zeile per cumsum
    s = np.zeros_like(d)
    s[:, 0, :] = _wrap16(np.cumsum(d[:, 0, :], axis=1))
    for y in range(1, ny):
        first = _wrap16(s[:, y - 1, 0] + d[:, y, 0])
        e = d[:, y, 1:] + s[:, y - 1, 1:] - s[:, y - 1, :-1]
        s[:, y, 0] = first
        s[:, y, 1:] = _wrap16(first[:, None] + np.cumsum(e, axis=1))
    q = _wrap16(np.cumsum(s, axis=0))
    return h, q


def quantize(field, v):
    q = np.round((field - v['offset']) / v['scale'])
    out = np.where(np.isfinite(field), np.clip(q, -32767, 32767), NODATA)
    return out.astype(np.int16)


# ---------------------------------------------------------------------------

def main():
    global HOURS
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--work', default=None)
    ap.add_argument('--run', default='latest')
    ap.add_argument('--vars', default=','.join(VARS))
    ap.add_argument('--wait', type=int, default=0, help='Minuten auf den neuesten Lauf warten')
    ap.add_argument('--published', default=None, help='latest.json des veröffentlichten Stands (überspringt gleichen Lauf)')
    ap.add_argument('--hours', type=int, default=HOURS, help='Vorhersagehorizont (zum Testen kürzer)')
    ap.add_argument('--selftest', action='store_true', help='geschriebene Kacheln dekodieren und vergleichen')
    args = ap.parse_args()

    if args.hours < STEP:
        sys.exit(f'--hours muss mindestens {STEP} sein (die Niederschlagsrate braucht zwei Zeitschritte)')
    HOURS = args.hours
    names = [v for v in args.vars.split(',') if v]
    for n in names:
        if n not in VARS:
            sys.exit(f'Unbekannte Variable {n} (bekannt: {", ".join(VARS)})')
    work = args.work or os.path.join(args.out, '..', 'wx-work')
    os.makedirs(work, exist_ok=True)

    run, published = pick_run(args, names)
    if not run:
        print('Kein vollständiger ICON-Lauf gefunden – nichts zu tun.')
        return 0
    if run == published:
        print(f'Lauf {run} ist bereits veröffentlicht – nichts zu tun.')
        return 0
    print(f'Lauf {run}', flush=True)

    idx, w = build_weights(work, run)
    t0 = dt.datetime.strptime(run, '%Y%m%d%H').replace(tzinfo=dt.timezone.utc)
    times = [int((t0 + dt.timedelta(hours=h)).timestamp() * 1000) for h in hours()]
    rundir = os.path.join(args.out, 'v1', run)
    meta_vars = {}

    for name in names:
        v = VARS[name]
        files = {}
        need = download_hours(v)
        with cf.ThreadPoolExecutor(6) as ex:
            futs = {h: ex.submit(fetch, grib_url(run, h, v), f"{work}/{v['icon']}_{run}_{h:03d}.grib2") for h in need}
            for h, f in futs.items():
                files[h] = f.result()

        cache = {}

        def get(h, v=v, files=files, cache=cache):
            """umgerechnetes Feld der Quelldatei zur Stunde h"""
            if h not in cache:
                if v.get('kind') == 'rate' and h == 0:
                    cache[h] = np.zeros((2 * int(round(90 / RES)) + 1, 4 * int(round(90 / RES)) + 1), np.float32)
                else:
                    cache[h] = remap(v['convert'](read_values(files[h])[0]), idx, w)
            return cache[h]

        full, over = [], []
        for h in hours(v):
            src = source_hours(v, h)
            if v.get('kind') == 'max3':
                f = np.maximum.reduce([get(x) for x in src])
            elif v.get('kind') == 'rate':
                rates = []
                if h >= STEP:
                    rates.append((get(h) - get(h - STEP)) / STEP)
                if h + STEP <= HOURS:
                    rates.append((get(h + STEP) - get(h)) / STEP)
                f = np.maximum(np.mean(rates, axis=0), 0).astype(np.float32)
            else:
                f = get(h)
            if 'fill' in v:
                f = np.nan_to_num(f, nan=v['fill'])
            for old in [k for k in cache if k < min(src) - STEP]:
                del cache[old]
            full.append(quantize(f, v))
            over.append(quantize(overview(f), v))
        full = np.stack(full)
        over = np.stack(over)
        os.makedirs(f'{rundir}/{name}', exist_ok=True)

        common = dict(var=name, scale=v['scale'], offset=v['offset'], nodata=NODATA, pred='plane-time')
        blobs = {}
        blobs['o'] = encode(over, dict(common, lat0=90, lon0=-180, dx=OVERVIEW_RES, dy=OVERVIEW_RES, wrap=True))
        cells = int(round(TILE_DEG / RES))
        for r in range(180 // TILE_DEG):
            for c in range(360 // TILE_DEG):
                tile = np.ascontiguousarray(full[:, r * cells : r * cells + cells + 1, c * cells : c * cells + cells + 1])
                blobs[f't{c}_{r}'] = encode(tile, dict(common, lat0=90 - r * TILE_DEG, lon0=-180 + c * TILE_DEG, dx=RES, dy=RES, wrap=False))
        total = 0
        for key, blob in blobs.items():
            with open(f'{rundir}/{name}/{key}.owx', 'wb') as f:
                f.write(blob)
            total += len(blob)
        print(f'{name}: {len(blobs)} Dateien, {total / 1e6:.1f} MB', flush=True)

        if args.selftest:
            for key, src in (('o', over), ('t3_1', full[:, 1 * cells : 1 * cells + cells + 1, 3 * cells : 3 * cells + cells + 1])):
                h, q = decode(blobs[key])
                assert np.array_equal(q.astype(np.int16), src), f'Selbsttest fehlgeschlagen: {name}/{key}'
            print(f'{name}: Selbsttest ok')

        valid = full[full != NODATA].astype(np.float32) * v['scale'] + v['offset']
        meta_vars[name] = dict(
            icon=v['icon'].upper(), scale=v['scale'], offset=v['offset'], unit=v['unit'],
            min=float(valid.min()), max=float(valid.max()), bytes=total, static=bool(v.get('static')),
        )

    latest = dict(
        v=FORMAT_VERSION, model='icon-global', run=run, issued=int(t0.timestamp() * 1000),
        generated=int(time.time() * 1000), times=times, attribution=ATTRIBUTION,
        overview=dict(res=OVERVIEW_RES, nx=int(360 / OVERVIEW_RES), ny=int(180 / OVERVIEW_RES) + 1),
        tiles=dict(res=RES, size=TILE_DEG, cols=360 // TILE_DEG, rows=180 // TILE_DEG, overlap=1),
        vars=meta_vars,
    )
    with open(f'{args.out}/v1/latest.json', 'w') as f:
        json.dump(latest, f, separators=(',', ':'))
    print('fertig')
    return 0


if __name__ == '__main__':
    sys.exit(main())
