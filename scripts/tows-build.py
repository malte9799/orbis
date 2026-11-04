#!/usr/bin/env python
# Builds public/data/plastik/tows-global.geojson: surface net tows from open datasets, all oceans (Meeresplastik timeline).
#   .cache/plastik/venv/bin/python -I scripts/tows-build.py            # download (idempotent) + build
#   .cache/plastik/venv/bin/python -I scripts/tows-build.py --offline  # build from the files in .cache/tows/raw only
# Downloads land in .cache/tows/raw/<source>/ (gitignored, one folder per source). They are untrusted data: only parsed, never
# executed. The licence of every source is checked at download time; the script aborts when it is not on the allow list.
#
# Sources (licence checked on the official landing page):
# - NOAA NCEI Global Marine Microplastics Data Collection (1972-present), Nyadjro et al. 2018, CC0 1.0 (archive metadata,
#   https://www.ncei.noaa.gov/archive/accession/NCEI-Marine-Microplastics). Official ArcGIS feature service "Ocean Surface
#   Microplastics (PS)" (professional science, surface water). Unit: pieces/m3 only.
# - Cozar et al. 2015, PANGAEA 10.1594/PANGAEA.842054 (Mediterranean MedSeA-2013, g/km2), CC BY 3.0
# - Pedrotti et al. 2016, PANGAEA 10.1594/PANGAEA.863844 (NW Mediterranean 2013, pieces/km2), CC BY 3.0
# - Leistenschneider 2023, PANGAEA 10.1594/PANGAEA.941076 (Weddell Sea manta trawls 2018/19, pieces/km2), CC BY 4.0
# Not used (see docs/DATENQUELLEN.md): SEA North Atlantic via IEDA (CC BY-NC-SA 3.0), Isobe et al. 2021 (CC BY 4.0 article, data only
# as Springer supplement behind a bot challenge), Cozar et al. 2014 (no open data repository found).
#
# Per tow: y year, d ISO date, n pieces/km2, m g/km2, c pieces/m3 (NCEI only: the unit of the source, no area conversion exists),
# src source code, meth method code, r index into "refs" (NCEI: the original study).
# Duplicates: the primary datasets win over NCEI; GPGP tows (gpgp-tows.geojson) win over NCEI. A NCEI record is a duplicate when
# a primary record is within 0.05 deg, same date +-1 day (GPGP: same year only) and, where both give a count, the value order fits
# (the implied tow depth n/c lies between 1 cm and 3 m).

import argparse
import datetime as dt
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.cache' / 'tows' / 'raw'
OUT = ROOT / 'public' / 'data' / 'plastik' / 'tows-global.geojson'
GPGP = ROOT / 'public' / 'data' / 'plastik' / 'gpgp-tows.geojson'

NCEI_ACCESSION = 'https://www.ncei.noaa.gov/archive/accession/NCEI-Marine-Microplastics'
NCEI_SERVICE = 'https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/Ocean_Surface_Microplastics_(PS)/FeatureServer/0/query'
PANGAEA = {
    'pangaea-842054': ('CC-BY-3.0', 842054),
    'pangaea-863844': ('CC-BY-3.0', 863844),
    'pangaea-941076': ('CC-BY-4.0', 941076),
}
# surface nets only (towed through the top layer); bottles, buckets, pumps, vertical plankton nets and bongo nets are dropped
NCEI_METHODS = {'Neuston net': 'N', 'Manta net': 'M', 'AVANI net': 'A'}
# Law et al. 2010/2014 (SEA Education Association) are in NCEI under CC0, but the primary repository (IEDA, doi:10.1594/IEDA/100014)
# publishes the same data as CC BY-NC-SA 3.0. Unclear / restrictive: held back until the licence question is settled.
HOLD_REFS = {'Law et al. 2010', 'Law et al. 2014'}
DEPTH_OK = (0.01, 3.0)  # m, plausible n/c for a surface tow
POS_TOL = 0.05  # deg
METHODS = {
    'N': 'Neuston-Netz',
    'M': 'Manta-Netz',
    'A': 'AVANI-Netz (Oberflächennetz)',
}
SOURCES = {
    'NCEI': {
        'name': 'NOAA NCEI Marine Microplastics Database (Oberflächenwasser, Netzfänge)',
        'license': 'CC0 1.0',
        'cite': 'Nyadjro et al. (2018), The NOAA NCEI Global Marine Microplastics Data Collection (1972-present), NOAA NCEI',
        'url': NCEI_ACCESSION,
    },
    'CO15': {
        'name': 'Cózar et al. 2015, Mittelmeer (MedSeA 2013)',
        'license': 'CC BY 3.0',
        'cite': 'Cózar Cabañas et al. (2015), PANGAEA',
        'url': 'https://doi.org/10.1594/PANGAEA.842054',
    },
    'PE16': {
        'name': 'Pedrotti et al. 2016, nordwestliches Mittelmeer (Expedition MED 2013)',
        'license': 'CC BY 3.0',
        'cite': 'Pedrotti et al. (2016), PANGAEA',
        'url': 'https://doi.org/10.1594/PANGAEA.863844',
    },
    'LE23': {
        'name': 'Leistenschneider 2023, Weddellmeer (Polarstern PS111/PS117)',
        'license': 'CC BY 4.0',
        'cite': 'Leistenschneider (2023), PANGAEA',
        'url': 'https://doi.org/10.1594/PANGAEA.941076',
    },
}


def sig3(x):
    """3 significant digits (short numbers in the file)."""
    x = float(x)
    if x == 0:
        return 0
    from math import floor, log10
    d = 2 - int(floor(log10(abs(x))))
    r = round(x, d)
    return int(r) if d <= 0 else r


def get(url, **q):
    full = url + ('?' + urllib.parse.urlencode(q) if q else '')
    req = urllib.request.Request(full, headers={'user-agent': 'orbis-tows-build'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


# ---------------------------------------------------------------- download
def download_ncei():
    d = RAW / 'ncei'
    d.mkdir(parents=True, exist_ok=True)
    meta = get(NCEI_ACCESSION).decode('utf-8', 'replace')
    if 'https://creativecommons.org/publicdomain/zero/1.0/' not in meta:
        sys.exit('ABORT: NCEI archive metadata does not name CC0 any more, check the licence')
    out = d / 'surface-ps.json'
    if out.exists():
        return
    rows, off = [], 0
    while True:
        j = json.loads(get(NCEI_SERVICE, where='1=1', outFields='*', orderByFields='ObjectId', resultOffset=off, resultRecordCount=1000, f='json'))
        rows += [f['attributes'] for f in j.get('features', [])]
        off += 1000
        if not j.get('exceededTransferLimit'):
            break
    out.write_text(json.dumps(rows))
    print(f'  NCEI: {len(rows)} records downloaded')


def download_pangaea():
    for name, (lic, pid) in PANGAEA.items():
        d = RAW / name
        d.mkdir(parents=True, exist_ok=True)
        out = d / 'data.tab'
        if not out.exists():
            out.write_bytes(get(f'https://doi.pangaea.de/10.1594/PANGAEA.{pid}', format='textfile'))
        if f'License:\tCreative Commons Attribution' not in out.read_text('utf-8') or f'({lic})' not in out.read_text('utf-8'):
            sys.exit(f'ABORT: licence of PANGAEA.{pid} is not {lic}')


# ---------------------------------------------------------------- readers: each returns tows (dicts)
def read_pangaea(path):
    """(header text, list of dict rows) of a PANGAEA tab file."""
    text = path.read_text('utf-8')
    head, body = text.split('\n*/\n', 1)
    lines = [l for l in body.split('\n') if l.strip()]
    cols = lines[0].split('\t')
    return head, [dict(zip(cols, l.split('\t'))) for l in lines[1:]]


def num(s):
    try:
        v = float(s)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def tow(y, d, lon, lat, src, meth, **vals):
    return {'y': y, 'd': d, 'lon': lon, 'lat': lat, 'src': src, 'meth': meth, **vals}


def read_cozar15():
    _, rows = read_pangaea(RAW / 'pangaea-842054' / 'data.tab')
    out = []
    for r in rows:
        lat, lon, m = num(r['Latitude']), num(r['Longitude']), num(r['Plastic conc no wind [g/km**2]'])
        d = r['Date/Time'][:10]
        if lat is None or lon is None or m is None or not d:
            continue
        out.append(tow(int(d[:4]), d, lon, lat, 'CO15', 'N', m=m))
    return out


def read_pedrotti16():
    _, rows = read_pangaea(RAW / 'pangaea-863844' / 'data.tab')
    out = []
    for r in rows:
        lat, lon, n = num(r['Latitude']), num(r['Longitude']), num(r['Plastic [#/km**2]'])
        lat2, lon2 = num(r['Latitude 2']), num(r['Longitude 2'])
        if lat is None or lon is None or n is None:
            continue
        if lat2 is not None and lon2 is not None:  # middle of the tow
            lat, lon = (lat + lat2) / 2, (lon + lon2) / 2
        d = r['Date/Time'][:10]
        out.append(tow(int(d[:4]), d, lon, lat, 'PE16', 'M', n=n))
    return out


def read_leisten23():
    _, rows = read_pangaea(RAW / 'pangaea-941076' / 'data.tab')
    out = []
    for r in rows:
        lat, lon, n = num(r['Latitude']), num(r['Longitude']), num(r['Microplastic [#/km**2]'])
        d = r['Date/Time'][:10]
        if lat is None or lon is None or n is None or not d:
            continue
        out.append(tow(int(d[:4]), d, lon, lat, 'LE23', 'M', n=n))
    return out


def read_ncei():
    rows = json.loads((RAW / 'ncei' / 'surface-ps.json').read_text())
    refs, ref_idx, out = [], {}, []
    stats = {'rows': len(rows), 'not_net': 0, 'held_sea': 0, 'bad': 0}
    for r in rows:
        meth = NCEI_METHODS.get(r['Sampling_Method'])
        if meth is None:
            stats['not_net'] += 1
            continue
        short = (r['Short_Reference'] or 'ohne Angabe').replace('?', '-')
        if short in HOLD_REFS:
            stats['held_sea'] += 1
            continue
        c, ms = r['Microplastics_measurement'], r['Date__MM_DD_YYYY_']
        lat, lon = r['Latitude__degree_'], r['Longitude_degree_']
        if r['Unit'] != 'pieces/m3' or c is None or c < 0 or ms is None or lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
            stats['bad'] += 1
            continue
        day = (dt.datetime(1970, 1, 1) + dt.timedelta(milliseconds=ms)).date()
        key = (short, r['DOI'])
        if key not in ref_idx:
            ref_idx[key] = len(refs)
            refs.append({'t': short, 'doi': (r['DOI'] or '').replace('https://doi.org/', '') or None})
        t = tow(day.year, day.isoformat(), lon, lat, 'NCEI', meth, c=c)
        t['r'] = ref_idx[key]
        t['mesh'] = r['Mesh_size__mm_']
        out.append(t)
    return out, refs, stats


# ---------------------------------------------------------------- duplicates
def cells(items):
    g = {}
    for t in items:
        g.setdefault((int(t['lat'] // 0.1), int(t['lon'] // 0.1)), []).append(t)
    return g


def near(g, t):
    ci, cj = int(t['lat'] // 0.1), int(t['lon'] // 0.1)
    for i in (ci - 1, ci, ci + 1):
        for j in (cj - 1, cj, cj + 1):
            for o in g.get((i, j), ()):
                if abs(o['lat'] - t['lat']) <= POS_TOL and abs(o['lon'] - t['lon']) <= POS_TOL:
                    yield o


def day_of(t):
    return dt.date.fromisoformat(t['d']) if t.get('d') else None


def value_fits(prim, t):
    """Both counts: the implied tow depth n/c must be plausible; a count against zero or mass only: no check."""
    n, c = prim.get('n'), t.get('c')
    if n is None or c is None:
        return True
    if n == 0 or c == 0:
        return n == 0 and c == 0
    return DEPTH_OK[0] <= n / c / 1e6 <= DEPTH_OK[1]


def is_duplicate(g, t, same_year_only=False):
    for o in near(g, t):
        if same_year_only:
            if o['y'] != t['y']:
                continue
        else:
            a, b = day_of(o), day_of(t)
            if a is None or b is None or abs((a - b).days) > 1:
                continue
        if value_fits(o, t):
            return True
    return False


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true')
    args = ap.parse_args()
    if not args.offline:
        download_ncei()
        download_pangaea()
    primaries = read_cozar15() + read_pedrotti16() + read_leisten23()
    ncei, refs, st = read_ncei()
    gpgp = []
    for f in json.loads(GPGP.read_text())['features']:
        p, (lon, lat) = f['properties'], f['geometry']['coordinates']
        gpgp.append({'y': p['y'], 'lon': lon, 'lat': lat, 'n': p.get('n')})
    gp, gg = cells(primaries), cells(gpgp)
    kept, dup_p, dup_g = [], 0, 0
    for t in ncei:
        if is_duplicate(gp, t):
            dup_p += 1
        elif is_duplicate(gg, t, same_year_only=True):
            dup_g += 1
        else:
            kept.append(t)
    tows = primaries + kept
    # primaries also identical to a GPGP tow? (same year, position and count) -> drop from ours
    before = len(tows)
    tows = [t for t in tows if not (t['src'] != 'NCEI' and is_duplicate(gg, t, same_year_only=True) and t.get('n') is not None)]
    dup_pg = before - len(tows)
    # records repeated in the source (same source, date, rounded position and values)
    seen, uniq = set(), []
    for t in tows:
        k = (t['src'], t['d'], round(t['lon'], 2), round(t['lat'], 2), *(sig3(t[q]) if t.get(q) is not None else None for q in ('n', 'm', 'c')))
        if k not in seen:
            seen.add(k)
            uniq.append(t)
    dup_self = len(tows) - len(uniq)
    tows = uniq
    tows.sort(key=lambda t: (t['y'], t['d']))
    feats = []
    for t in tows:
        p = {'y': t['y'], 'd': t['d']}
        for k in ('n', 'm', 'c'):
            if t.get(k) is not None:
                p[k] = sig3(t[k])
        p['src'] = t['src']
        p['meth'] = t['meth']
        if 'r' in t:
            p['r'] = t['r']
        if t.get('mesh'):
            p['mesh'] = t['mesh']
        feats.append({'type': 'Feature', 'properties': p, 'geometry': {'type': 'Point', 'coordinates': [round(t['lon'], 2), round(t['lat'], 2)]}})
    used = sorted({t['r'] for t in kept if 'r' in t})
    OUT.write_text(json.dumps({
        'type': 'FeatureCollection',
        'credit': 'NOAA NCEI (CC0), Cózar et al. 2015, Pedrotti et al. 2016 (CC BY 3.0), Leistenschneider 2023 (CC BY 4.0)',
        'unit': {'y': 'Jahr', 'd': 'Datum', 'n': 'Teile/km²', 'm': 'g/km²', 'c': 'Teile/m³ (Wasser im Netz)', 'mesh': 'Maschenweite mm'},
        'sources': SOURCES,
        'methods': METHODS,
        'refs': refs,
        'note': 'Unterschiedliche Maschenweiten, Größenbereiche und Methoden: Werte verschiedener Studien sind nicht direkt vergleichbar; Teile/m³ (NCEI) lassen sich ohne Eintauchtiefe nicht in Teile/km² umrechnen.',
        'features': feats,
    }, ensure_ascii=False, separators=(',', ':')))
    by_src, by_ocean, years = {}, {}, sorted({f['properties']['y'] for f in feats})
    for f in feats:
        s = f['properties']['src']
        by_src[s] = by_src.get(s, 0) + 1
    print(f'NCEI rows {st["rows"]}: not a surface net {st["not_net"]}, held back (SEA Law 2010/2014) {st["held_sea"]}, invalid {st["bad"]}, net tows {len(ncei)}')
    print(f'duplicates: NCEI vs primary {dup_p}, NCEI vs GPGP {dup_g}, primary vs GPGP {dup_pg}, repeated records {dup_self}')
    print(f'{len(feats)} tows, per source {by_src}, years {years[0]}..{years[-1]} ({len(years)}), {OUT.stat().st_size / 1024:.0f} kB')
    # coarse ocean boxes for the report
    box = {'Nordatlantik': (0, 60, -80, 0), 'Nordpazifik': (0, 60, 120, 180), 'Nordpazifik W': (0, 60, -180, -100), 'Südpazifik': (-60, 0, -180, -70), 'Südatlantik': (-60, 0, -60, 20),
           'Indik': (-60, 25, 20, 120), 'Mittelmeer': (30, 46, -6, 36), 'Südpolarmeer': (-90, -60, -180, 180), 'Arktis': (66, 90, -180, 180)}
    for k, (a, b, c, d) in box.items():
        by_ocean[k] = sum(1 for f in feats if a <= f['geometry']['coordinates'][1] <= b and c <= f['geometry']['coordinates'][0] <= d)
    print('boxes:', by_ocean)


if __name__ == '__main__':
    main()
