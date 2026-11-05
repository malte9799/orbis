#!/usr/bin/env python3
"""Treibbojen-Bahnen für die Ebene `treibbojen` aufbereiten (NOAA Global Drifter Program, AOML).

Aufruf:  .cache/plastik/venv/bin/python -I scripts/drifters-build.py [--target 3000] [--refresh]
Nur Standardbibliothek. Rohdaten kommen nach .cache/drifters/raw/ (gitignored), Ausgabe nach public/data/drifters/.

Quelle: ERDDAP-Datensatz `drifter_6hour_qc` (6-stündlich interpolierte, qualitätsgeprüfte Positionen, DOI 10.25921/7ntx-z961,
Lumpkin & Centurioni 2019, Lizenz CC BY 4.0 laut Metadaten des Datensatzes – nicht gemeinfrei).
  https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.html

Datenweg: tabledap statt der NetCDF-Dateien unter /files/drifter_6hour_qc/. Dort liegt eine Datei je Boje (~29.000 Dateien,
je ~300 KB, mit allen Variablen). tabledap liefert nur ID, time, latitude, longitude und dünnt mit
`orderByClosest("ID,time/5days")` serverseitig auf einen Punkt je 5 Tage aus (statt 4 pro Tag): ~4 KB je Boje. Ein Request
enthält BLOCK Bojen (ID-Regex), die Anfragen laufen nacheinander mit Pause, jeder Block wird gecacht (Wiederaufnahme möglich).
Parameter in der URL müssen kodiert sein (`"` → %22, `|` → %7C, `>=` → %3E=), sonst antwortet Tomcat mit HTTP 400 ohne Text.
Längen kommen als −180…180.

Auswahl: Start 1979 oder später, Laufzeit ≥ 60 Tage; je Startzelle (10° × 10°, Aussetzort) wird gleich viel gezogen
(Wasserfüllen: jede Zelle höchstens q Bojen, q so, dass ~TARGET herauskommen), innerhalb der Zelle gleichmäßig über das Startdatum.
Eine Bahn endet vor der ersten Lücke > 30 Tage (danach würde sie mitten im Lauf neu beginnen) und nach 5 Jahren (MAX_DAYS).
Bahnen < 60 Tage nach dem Kürzen entfallen.

Ausgabe:
  tracks.bin  (Little-Endian)
    u32  N                        Anzahl Bahnen
    N x  { u16 start, u16 count }  start: Schritt des ersten Punkts (Tage seit 1970-01-01 / STEP_DAYS), count: Punkte
    dann alle Punkte hintereinander, je Bahn `count` x { u16 lon, u16 lat }
      lon = round((lon + 180) * SCALE), lat = round((lat + 90) * SCALE)   SCALE = 180 (1 Einheit = 0,0056° ≈ 600 m)
    Zeit des k-ten Punkts einer Bahn: (start + k) * STEP_DAYS Tage seit 1970-01-01 (feste 5-Tage-Schritte, lückenlos).
  meta.json   Version, Credit, Lizenz, DOI, Zeitspanne, Schritt, Skalierung, Anzahl, `ids` (Boje i = Bahn i)
"""
import argparse
import csv
import io
import json
import math
import os
import random
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc'
UA = 'orbis-build/1.0 (https://github.com/malte9799/orbis; drifter extract)'
STEP_DAYS = 5
SCALE = 180
MIN_DAYS = 60
MAX_DAYS = 5 * 365
GAP_STEPS = 30 // STEP_DAYS  # Lücke > 30 Tage = mehr als 6 Schritte fehlen
BLOCK = 40
PAUSE = 2.0
CELL = 10
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RAW = os.path.join(ROOT, '.cache', 'drifters', 'raw')
OUT = os.path.join(ROOT, 'public', 'data', 'drifters')


def get(query, fmt='csv', tries=4):
    url = f'{BASE}.{fmt}?' + urllib.parse.quote(query, safe=',&=()/~')
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=180) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'replace')[:300]
            if e.code == 404:  # ERDDAP: "no data"
                return ''
            print(f'  HTTP {e.code}: {body}', file=sys.stderr)
            if e.code < 500 and e.code != 429:
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f'  {e}', file=sys.stderr)
        time.sleep(10 * (i + 1))
    raise RuntimeError('ERDDAP nicht erreichbar: ' + url)


def parse_day(s):
    return (datetime.fromisoformat(s.replace('Z', '+00:00')) - EPOCH).total_seconds() / 86400


def fnum(s):
    try:
        v = float(s)
        return v if math.isfinite(v) else None
    except ValueError:
        return None


def load_meta(refresh):
    path = os.path.join(RAW, 'meta.csv')
    if refresh or not os.path.exists(path):
        print('Metadaten aller Bojen (distinct) …')
        with open(path, 'w') as f:
            f.write(get('ID,start_date,end_date,start_lon,start_lat,deploy_lon,deploy_lat&distinct()'))
    rows = list(csv.reader(open(path)))[2:]
    out = []
    for r in rows:
        if len(r) < 7 or not r[0]:
            continue
        try:
            s, e = parse_day(r[1]), parse_day(r[2])
        except ValueError:
            continue
        lon = fnum(r[3]) if fnum(r[3]) is not None else fnum(r[5])
        lat = fnum(r[4]) if fnum(r[4]) is not None else fnum(r[6])
        if lon is None or lat is None:
            continue
        out.append({'id': r[0], 'start': s, 'end': e, 'lon': lon, 'lat': lat})
    return out


def select(buoys, target, seed=1979):
    first = (datetime(1979, 1, 1, tzinfo=timezone.utc) - EPOCH).days
    ok = [b for b in buoys if b['start'] >= first and b['end'] - b['start'] >= MIN_DAYS]
    cells = {}
    for b in ok:
        cells.setdefault((math.floor(b['lon'] / CELL), math.floor(b['lat'] / CELL)), []).append(b)
    lo, hi = 1, max(len(v) for v in cells.values())
    while lo < hi:  # größtes q mit Summe ≤ target
        mid = (lo + hi + 1) // 2
        if sum(min(len(v), mid) for v in cells.values()) <= target:
            lo = mid
        else:
            hi = mid - 1
    q = lo
    rnd = random.Random(seed)
    picked = []
    for key in sorted(cells):
        members = sorted(cells[key], key=lambda b: (b['start'], b['id']))
        if len(members) <= q:
            picked += members
        else:  # gleichmäßig über die Startzeit, Versatz zufällig
            off = rnd.random()
            picked += [members[min(len(members) - 1, int((i + off) * len(members) / q))] for i in range(q)]
    # Rest bis zum Ziel: aus Zellen mit noch freien Bojen
    seen = {b['id'] for b in picked}
    spare = [b for v in cells.values() for b in v if b['id'] not in seen]
    rnd.shuffle(spare)
    picked += spare[: max(0, target - len(picked))]
    return picked, len(ok), len(cells), q


def fetch_tracks(ids):
    os.makedirs(os.path.join(RAW, 'blocks'), exist_ok=True)
    tracks = {}
    blocks = [ids[i : i + BLOCK] for i in range(0, len(ids), BLOCK)]
    for n, block in enumerate(blocks):
        path = os.path.join(RAW, 'blocks', f'{n:03d}-{block[0]}-{block[-1]}.csv')
        if not os.path.exists(path):
            q = 'ID,time,latitude,longitude&ID=~"(' + '|'.join(block) + ')"&orderByClosest("ID,time/5days")'
            text = get(q)
            with open(path + '.part', 'w') as f:
                f.write(text)
            os.replace(path + '.part', path)
            print(f'Block {n + 1}/{len(blocks)} geladen ({len(text) // 1024} KB)')
            time.sleep(PAUSE)
        for r in list(csv.reader(open(path)))[2:]:
            if len(r) < 4:
                continue
            lat, lon = fnum(r[2]), fnum(r[3])
            if lat is None or lon is None:
                continue
            tracks.setdefault(r[0], []).append((parse_day(r[1]), lon, lat))
    return tracks


def to_steps(rows):
    """Zeilen → {Schritt: (lon, lat)}; Zeit auf das 5-Tage-Raster gerundet. Gibt auch die Abweichung vom Raster zurück."""
    by = {}
    off = 0
    for d, lon, lat in rows:
        k = round(d / STEP_DAYS)
        off = max(off, abs(d - k * STEP_DAYS))
        by.setdefault(k, (lon, lat))
    return by, off


def build_track(rows):
    by, off = to_steps(rows)
    steps = sorted(by)
    if not steps:
        return None, off, False
    keep = [steps[0]]
    gap = False
    for k in steps[1:]:
        if k - keep[-1] > GAP_STEPS:
            gap = True
            break
        keep.append(k)
    # lückenlos auffüllen (bis 6 Schritte = 30 Tage) durch lineare Interpolation, Längensprung über ±180 beachten
    pts = []
    for i, k in enumerate(keep):
        if i:
            p = keep[i - 1]
            a, b = by[p], by[k]
            dl = ((b[0] - a[0] + 180) % 360) - 180
            for j in range(p + 1, k):
                f = (j - p) / (k - p)
                lon = a[0] + dl * f
                lon = (lon + 180) % 360 - 180
                pts.append((j, lon, a[1] + (b[1] - a[1]) * f))
        pts.append((k, by[k][0], by[k][1]))
    pts = [p for p in pts if p[0] - pts[0][0] < MAX_DAYS / STEP_DAYS]
    return pts, off, gap


def quant(lon, lat):
    return min(65535, max(0, round((lon + 180) * SCALE))), min(65535, max(0, round((lat + 90) * SCALE)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--target', type=int, default=3000)
    ap.add_argument('--refresh', action='store_true', help='Metadaten neu laden')
    ap.add_argument('--select-only', action='store_true', help='nur auswählen und zählen, nichts laden')
    a = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    buoys = load_meta(a.refresh)
    picked, eligible, ncells, q = select(buoys, a.target)
    print(f'Bojen gesamt {len(buoys)}, geeignet (ab 1979, ≥ {MIN_DAYS} Tage) {eligible}, Startzellen {ncells}, max. je Zelle {q}, ausgewählt {len(picked)}')
    if a.select_only:
        return
    ids = [b['id'] for b in sorted(picked, key=lambda b: int(b['id']))]
    raw = fetch_tracks(ids)

    tracks, maxoff, gaps, short, missing = [], 0, 0, 0, 0
    for i in ids:
        if i not in raw:
            missing += 1
            continue
        pts, off, gap = build_track(raw[i])
        maxoff = max(maxoff, off)
        gaps += gap
        if not pts or len(pts) < MIN_DAYS / STEP_DAYS:
            short += 1
            continue
        tracks.append((i, pts))
    tracks.sort(key=lambda t: (t[1][0][0], int(t[0])))

    heads = b''.join(struct.pack('<HH', t[1][0][0], len(t[1])) for t in tracks)
    body = bytearray()
    for _, pts in tracks:
        for _, lon, lat in pts:
            body += struct.pack('<HH', *quant(lon, lat))
    blob = struct.pack('<I', len(tracks)) + heads + bytes(body)
    with open(os.path.join(OUT, 'tracks.bin'), 'wb') as f:
        f.write(blob)

    first = min(t[1][0][0] for t in tracks) * STEP_DAYS
    last = max(t[1][-1][0] for t in tracks) * STEP_DAYS
    iso = lambda d: (EPOCH.fromordinal(EPOCH.toordinal() + int(d))).strftime('%Y-%m-%d')
    meta = {
        'version': 1,
        'dataset': 'drifter_6hour_qc',
        'source': 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.html',
        'credit': 'NOAA Global Drifter Program (AOML), Lumpkin & Centurioni 2019, NOAA NCEI',
        'doi': '10.25921/7ntx-z961',
        'license': 'CC BY 4.0',
        'built': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'epoch': '1970-01-01',
        'stepDays': STEP_DAYS,
        'scale': SCALE,
        'first': iso(first),
        'last': iso(last),
        'count': len(tracks),
        'points': sum(len(t[1]) for t in tracks),
        'ids': [int(t[0]) for t in tracks],
    }
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    print(f'Bahnen {len(tracks)} (ohne Daten {missing}, zu kurz nach Kürzen {short}, mit Lücke > 30 Tage gekürzt {gaps}), Punkte {meta["points"]}')
    print(f'Zeitspanne {meta["first"]} bis {meta["last"]}, größte Abweichung vom 5-Tage-Raster {maxoff:.2f} Tage')
    print(f'tracks.bin {len(blob) / 1024:.0f} KB, meta.json {os.path.getsize(os.path.join(OUT, "meta.json")) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
