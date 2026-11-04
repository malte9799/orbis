#!/usr/bin/env python
# Baut die statischen Meeresplastik-Daten (public/data/plastik/*) aus den figshare-Rohdaten:
#   .cache/plastik/venv/bin/python -I scripts/plastik-build.py --inspect   # Rohdateien laden und beschreiben
#   .cache/plastik/venv/bin/python -I scripts/plastik-build.py             # Ausgabedateien erzeugen
# Einrichtung: python3 -m venv .cache/plastik/venv && .cache/plastik/venv/bin/pip install -r scripts/plastik-requirements.txt
# Downloads landen in .cache/plastik/raw/<figshare-id>/ (gitignored, je Artikel ein eigener Ordner). Die Dateilisten kommen
# von https://api.figshare.com/v2/articles/<id>; das Skript bricht ab, wenn die Lizenz eines Artikels nicht CC BY 4.0 / CC0 ist.
# Heruntergeladene Dateien werden nur gelesen (Daten), nie ausgeführt.
# Quellen (alle CC BY 4.0 laut figshare-API):
# - Lebreton et al. 2018, Sci. Rep. 8:4666, doi:10.1038/s41598-018-22939-w (figshare 5873142)
# - Lebreton et al. 2024, Sci. Rep., "Seven years into the North Pacific garbage patch" (figshare 25674120)
# - Lebreton et al. 2022, "Industrialised fishing nations largely contribute to floating plastic pollution in the North Pacific
#   subtropical gyre", Sci. Rep. 12:12666, doi:10.1038/s41598-022-16529-0 (figshare 20202131)
# - Meijer et al. 2021, Sci. Adv. 7:eaaz5803, doi:10.1126/sciadv.aaz5803 (figshare 14515590)
# - Eriksen et al. 2014, PLoS ONE 9:e111913, doi:10.1371/journal.pone.0111913 (figshare 14390873 Raster, 1015289 Stationen)
# Ausgaben (public/data/plastik/): gpgp-density.png/.json, gpgp-contours.geojson, gpgp-history.json, gpgp-origin.json,
#   rivers.geojson, global-density.png/.json, stations.geojson, patches.json, gpgp-tows.geojson

import argparse
import json
import shutil
import sys
import urllib.request
import warnings
import zipfile
from pathlib import Path

warnings.filterwarnings('ignore')
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.cache' / 'plastik' / 'raw'
OUT = ROOT / 'public' / 'data' / 'plastik'
ARTICLES = {
    5873142: ['MassConcentrationAllSizes.tif', 'GPGP_contours.zip', 'Lebreton2018_HistoricalDataset.xls'],
    25674120: None,
    20202131: None,
    14515590: None,
    14390873: None,
    1015289: None,
}
MAX_BYTES = 500 * 1024 * 1024
OK_LICENSES = ('CC BY 4.0', 'CC0')


def fetch_json(url):
    req = urllib.request.Request(url, headers={'user-agent': 'orbis-plastik-build'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def download_all():
    """Lädt die benötigten Dateien (idempotent) und gibt {id: Ordner} zurück."""
    dirs = {}
    for aid, wanted in ARTICLES.items():
        meta = fetch_json(f'https://api.figshare.com/v2/articles/{aid}')
        lic = (meta.get('license') or {}).get('name')
        print(f'[{aid}] {meta.get("title")[:70]} | Lizenz: {lic} | DOI {meta.get("doi")}')
        if lic not in OK_LICENSES:
            sys.exit(f'ABBRUCH: Lizenz von Artikel {aid} ist {lic!r}, erwartet {OK_LICENSES}')
        d = RAW / str(aid)
        d.mkdir(parents=True, exist_ok=True)
        for f in meta['files']:
            if wanted and f['name'] not in wanted:
                continue
            if f['size'] > MAX_BYTES:
                sys.exit(f'ABBRUCH: {f["name"]} ist {f["size"]} Bytes (> 500 MB), bitte Rückmeldung einholen')
            target = d / f['name']
            if target.exists() and target.stat().st_size == f['size']:
                continue
            print(f'  lade {f["name"]} ({f["size"]} B)')
            req = urllib.request.Request(f['download_url'], headers={'user-agent': 'orbis-plastik-build'})
            with urllib.request.urlopen(req, timeout=300) as r, open(target, 'wb') as w:
                shutil.copyfileobj(r, w)
            if target.suffix == '.zip':
                with zipfile.ZipFile(target) as z:
                    for n in z.namelist():  # nur flache, sichere Namen entpacken
                        p = (d / n).resolve()
                        if d.resolve() not in p.parents and p != d.resolve():
                            sys.exit(f'ABBRUCH: unsicherer Pfad im Archiv {n}')
                    z.extractall(d)
        dirs[aid] = d
    return dirs


CREDIT_GPGP = 'Lebreton et al. 2018 (CC BY 4.0)'
GPGP_RANGE = (3.0, 5.2)  # log10 g/km² der Farbskala (auch für die Netzfänge-Punkte)
GPGP_FADE = (2.6, 3.2)
# abgeleitete Isolinien (g/km²); 10.000 = Patch-Grenze
CONTOUR_LEVELS = (1000, 10000, 100000)
MIN_RING_KM2 = 2000.0  # kleinere geschlossene Ringe fallen weg
MIN_LINE_KM = 150.0  # kürzere offene Linien fallen weg
CREDIT_EGLOBAL = 'Eriksen et al. 2014 (CC BY 4.0)'

# Farbverlauf (log10-Wert -> Farbe), inferno-ähnlich, von dunkel (wenig) nach hell (viel)
PALETTE = ['#2a0b4f', '#6a176e', '#a52c60', '#dd513a', '#f98e09', '#f9d742', '#fcffa4']


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def colorize(v, vmin, vmax, fade_from, fade_to):
    """v (log10-Array) -> RGBA uint8. Alpha 0 bis fade_from, linear bis 1 bei fade_to."""
    import numpy as np
    stops = np.array([hex_rgb(c) for c in PALETTE], dtype=float)
    pos = np.linspace(0, 1, len(stops))
    t = np.clip((v - vmin) / (vmax - vmin), 0, 1)
    rgba = np.zeros(v.shape + (4,), dtype=np.uint8)
    for ch in range(3):
        rgba[..., ch] = np.interp(t, pos, stops[:, ch]).round().astype(np.uint8)
    alpha = np.clip((v - fade_from) / (fade_to - fade_from), 0, 1)
    rgba[..., 3] = (alpha * 255).round().astype(np.uint8)
    return rgba


def palette_stops(vmin, vmax):
    n = len(PALETTE)
    return [[round(vmin + (vmax - vmin) * i / (n - 1), 3), c] for i, c in enumerate(PALETTE)]


def merc_y(lat):
    import numpy as np
    return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def inv_merc_y(y):
    import numpy as np
    return np.degrees(2 * np.arctan(np.exp(y)) - np.pi / 2)


def bilinear(src, rows, cols):
    """src (H,W), rows/cols: Float-Arrays gleicher Form mit Quellkoordinaten (Pixelmitte = ganze Zahl), außen geklemmt."""
    import numpy as np
    H, W = src.shape
    rows = np.clip(rows, 0, H - 1)
    cols = np.clip(cols, 0, W - 1)
    r0 = np.floor(rows).astype(int); c0 = np.floor(cols).astype(int)
    r1 = np.minimum(r0 + 1, H - 1); c1 = np.minimum(c0 + 1, W - 1)
    fr = rows - r0; fc = cols - c0
    return (src[r0, c0] * (1 - fr) * (1 - fc) + src[r0, c1] * (1 - fr) * fc
            + src[r1, c0] * fr * (1 - fc) + src[r1, c1] * fr * fc)


def reproject_mercator(src, lon0, lon1, lat_top, lat_bottom, out_w):
    """Regelmäßiges lon/lat-Raster (Zeilen von Nord nach Süd, Kanten lon0..lon1, lat_top..lat_bottom) -> Web-Mercator-Raster.
    Gibt (Array, Höhe) zurück; das Bild passt mit linearer Verzerrung zwischen den 4 Ecken auf die Mercator-Karte."""
    import numpy as np
    H, W = src.shape
    y_top, y_bot = merc_y(lat_top), merc_y(lat_bottom)
    x_span = np.radians(lon1 - lon0)
    out_h = int(round(out_w * (y_top - y_bot) / x_span))
    ys = y_top - (np.arange(out_h) + 0.5) / out_h * (y_top - y_bot)
    lats = inv_merc_y(ys)
    lons = lon0 + (np.arange(out_w) + 0.5) / out_w * (lon1 - lon0)
    rows = (lat_top - lats) / (lat_top - lat_bottom) * H - 0.5
    cols = (lons - lon0) / (lon1 - lon0) * W - 0.5
    rr, cc = np.meshgrid(rows, cols, indexing='ij')
    return bilinear(src, rr, cc), out_h


def save_png(rgba, path, limit=900_000):
    """Speichert RGBA als PNG; wird die Datei zu groß, auf 256 Farben (mit Alpha) quantisieren."""
    from PIL import Image
    im = Image.fromarray(rgba, 'RGBA')
    im.save(path, optimize=True)
    if path.stat().st_size > limit:
        im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
        print(f'  {path.name}: auf 256 Farben quantisiert')


def write_json(path, obj, **kw):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':'), **kw), encoding='utf-8')


def read_excel(path, **kw):
    import pandas as pd
    return pd.read_excel(path, **kw)


def simplify_dp(pts, tol):
    """Douglas-Peucker für eine Linie [(x,y),...] (iterativ)."""
    import numpy as np
    pts = np.asarray(pts, dtype=float)
    keep = np.zeros(len(pts), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        p, q = pts[a], pts[b]
        d = q - p
        seg = pts[a + 1:b] - p
        L = np.hypot(*d)
        dist = np.hypot(*seg.T) if L == 0 else np.abs(d[0] * seg[:, 1] - d[1] * seg[:, 0]) / L
        i = int(np.argmax(dist))
        if dist[i] > tol:
            m = a + 1 + i
            keep[m] = True
            stack += [(a, m), (m, b)]
    return pts[keep]


def sig3(x):
    return float(f'{x:.3g}')


# ---------------------------------------------------------------- Lebreton 2018: Dichte, Konturen, Messreihe

def build_gpgp_density(d):
    import numpy as np
    import rasterio
    with rasterio.open(d / 'MassConcentrationAllSizes.tif') as ds:
        a = ds.read(1).astype(float)
        b = ds.bounds
        crs = str(ds.crs)
    assert crs == 'EPSG:4326'
    a[~np.isfinite(a)] = -9  # -inf = keine Konzentration
    a[a == -9999.0] = -9
    # Längen durchgehend (-160..-119.8 -> 200..240.2); keine Teilung an der Datumsgrenze nötig
    lon0, lon1 = b.left + 360, b.right + 360
    # Skala: ab 1 kg/km² (log10 = 3) bis zum Rastermaximum (5,23); Werteverteilung im Ausschnitt (log10 g/km²):
    # Median 2,7, 75 % 3,8, 90 % 4,5, 99 % 5,0. Darunter sanfter Fade (2,6 bis 3,2), damit der Kern des Patches klar heraustritt.
    vmin, vmax = GPGP_RANGE
    fade = GPGP_FADE
    fin = a[a > -9]
    print('  Raster-Werteverteilung (log10 g/km², Zellen mit Wert): ' + ', '.join(f'p{q}={np.percentile(fin, q):.2f}' for q in (10, 25, 50, 75, 90, 99)) + f', max={fin.max():.2f}; '
          f'Anteil >= {10 ** vmin:g} g/km²: {(a >= vmin).sum() / a.size:.0%}')
    img, h = reproject_mercator(np.maximum(a, fade[0] - 1), lon0, lon1, b.top, b.bottom, out_w=a.shape[1] * 6)
    rgba = colorize(img, vmin, vmax, fade_from=fade[0], fade_to=fade[1])
    save_png(rgba, OUT / 'gpgp-density.png')
    write_json(OUT / 'gpgp-density.json', {
        'coordinates': [[lon0, b.top], [lon1, b.top], [lon1, b.bottom], [lon0, b.bottom]],
        'projection': 'EPSG:3857 (Bild nach Web-Mercator umprojiziert, Ecken in lon/lat)',
        'unit': 'log10 g/km²', 'min': vmin, 'max': vmax, 'fade': list(fade),
        'stops': palette_stops(vmin, vmax),
        'size': [rgba.shape[1], rgba.shape[0]],
        'credit': CREDIT_GPGP,
        'source': 'doi:10.1038/s41598-018-22939-w, Daten doi:10.6084/m9.figshare.5873142',
    })
    # Fläche und Schwerpunkt der Zellen >= 1 kg/km² (entspricht der 1000-g/km²-Kontur) für Kennzahlen und patches.json
    R = 6371.0088
    lats = b.top - (np.arange(a.shape[0]) + 0.5) * 0.2
    lons = lon0 + (np.arange(a.shape[1]) + 0.5) * 0.2
    area = (R ** 2 * np.radians(0.2) ** 2 * np.cos(np.radians(lats)))[:, None] * np.ones((1, a.shape[1]))
    stats = {}
    for lvl in (3, 4):
        m = a >= lvl
        w = area * m
        stats[lvl] = (float(w.sum() / 1e6),
                      float((w.sum(axis=0) * lons).sum() / w.sum()), float((w.sum(axis=1) * lats).sum() / w.sum()))
        print(f'  Raster >= {10 ** lvl:g} g/km²: {stats[lvl][0]:.2f} Mio km², Schwerpunkt lon {stats[lvl][1]:.2f} lat {stats[lvl][2]:.2f}')
    # Isolinien aus dem Raster ableiten (die mitgelieferte GPGP_contours.zip hat keine runden Pegel, siehe analyze_shipped_contours)
    from skimage.measure import find_contours
    # Rand mit NaN auffüllen: find_contours überspringt NaN-Zellen, die Linien enden offen an der letzten Datenzelle,
    # statt am Rasterrand entlangzulaufen und dort künstlich zu schließen (kein Pad mit Fantasiewerten).
    pad = np.pad(a, 1, constant_values=np.nan)
    by = {}
    for lvl in CONTOUR_LEVELS:
        raw = []
        for c in find_contours(pad, float(np.log10(lvl))):
            raw.append([(lon0 + (cc - 1 + 0.5) * 0.2, b.top - (rr - 1 + 0.5) * 0.2) for rr, cc in c])
        lines = []
        for ln in raw:
            if not keep_line(ln):
                continue
            s_ = simplify_dp(ln, 0.03)
            if len(s_) >= 2:
                lines.append([[round(float(x), 3), round(float(y), 3)] for x, y in s_])
        by[lvl] = lines
        print(f'  Kontur {lvl} g/km²: {len(raw)} Linien -> {len(lines)} nach Filter (Ringe < {MIN_RING_KM2:g} km², offene Linien < {MIN_LINE_KM:g} km)')
    area4, clon4, clat4 = stats[4]
    print(f'  10-kg/km²-Kontur: Fläche im Raster {area4:.2f} Mio km² (Studie ~1,6 Mio km², Abweichung {area4 / 1.6 - 1:+.0%}); '
          f'Mitte lon {clon4:.2f} lat {clat4:.2f}')
    return stats[4], by


def keep_line(pts):
    """Verwirft kleine geschlossene Ringe (Fläche) und kurze offene Linien (Länge), sphärisch genähert."""
    import numpy as np
    p = np.asarray(pts, dtype=float)
    kx = 111.195 * np.cos(np.radians(p[:, 1].mean()))
    x, y = p[:, 0] * kx, p[:, 1] * 111.195
    if np.allclose(p[0], p[-1]):
        return abs(0.5 * np.sum(x[:-1] * y[1:] - x[1:] * y[:-1])) >= MIN_RING_KM2
    return float(np.hypot(np.diff(x), np.diff(y)).sum()) >= MIN_LINE_KM


def analyze_shipped_contours(d):
    """Gibt die Attribute der mitgelieferten Konturen und den am Raster gemessenen Wert je Pegel aus (Median, IQR).
    Ergebnis: ELEV 1/2/3 liegen bei ~10^2,18 / 10^3,18 / 10^4,18 g/km² (150 / 1.500 / 15.000), also nicht bei den
    beschrifteten 10/100/1000 g/km² und nicht bei runden Pegeln; die Konturen werden deshalb nicht übernommen."""
    import numpy as np
    import rasterio
    import shapefile
    r = shapefile.Reader(str(d / 'GPGP_contours.shp'))
    print('  Shapefile-Felder:', [(f[0], f[1], f[2], f[3]) for f in r.fields[1:]], '| erste Datensätze:', [list(x) for x in list(r.iterRecords())[:3]])
    with rasterio.open(d / 'MassConcentrationAllSizes.tif') as ds:
        a = ds.read(1).astype(float)
        b = ds.bounds
    vals, cnt = {}, {}
    for sr in r.iterShapeRecords():
        el = float(sr.record['ELEV'])
        cnt[el] = cnt.get(el, 0) + 1
        pts = sr.shape.points
        for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
            for t in (0, 0.5):
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                c, rw = int((x - b.left) / 0.2), int((b.top - y) / 0.2)
                if 0 <= rw < a.shape[0] and 0 <= c < a.shape[1] and np.isfinite(a[rw, c]) and a[rw, c] > -100:
                    vals.setdefault(el, []).append(a[rw, c])
    print('  ELEV | Linien | Stützpunkte | Raster-Median log10 g/km² (Q1..Q3) | Median g/km²')
    for el, v in sorted(vals.items()):
        q1, q2, q3 = np.percentile(v, [25, 50, 75])
        print(f'  {el:g} | {cnt[el]} | {len(v)} | {q2:.2f} ({q1:.2f}..{q3:.2f}) | {10 ** q2:,.0f}')


def build_gpgp_contours(d, by):
    feats = [{'type': 'Feature', 'properties': {'level': lv, 'unit': 'g/km²', **({'boundary': True} if lv == 10000 else {})},
              'geometry': {'type': 'MultiLineString', 'coordinates': lines}} for lv, lines in sorted(by.items()) if lines]
    write_json(OUT / 'gpgp-contours.geojson', {
        'type': 'FeatureCollection', 'credit': CREDIT_GPGP,
        'note': 'Isolinien aus dem Raster MassConcentrationAllSizes.tif abgeleitet (Level in g/km²); die mitgelieferten GPGP_contours.shp-Pegel stimmen nicht mit den Rasterwerten überein',
        'features': feats})
    print('  Konturen:', {lv: len(v) for lv, v in sorted(by.items())}, 'Linien')


def yearly(df, valcol, group_col, min_n=3):
    out = {}
    for flag, g in df.groupby(group_col):
        pts = []
        for yr, gg in g.groupby('year'):
            v = gg[valcol].dropna()
            if len(v) >= min_n:
                pts.append({'year': int(yr), 'value': sig3(v.mean()), 'median': sig3(v.median()), 'n': int(len(v))})
        out[int(flag)] = pts
    return out


def build_history(d18, d24):
    h = read_excel(d18 / 'Lebreton2018_HistoricalDataset.xls')
    h.columns = ['n', 'origin', 'ref', 'year', 'month', 'lon', 'lat', 'type', 'mesh', 'depth', 'num', 'mass', 'inside']
    series = []
    note18 = 'Netzfänge (Manta/Neuston, Maschenweite 0,3 bis 0,5 mm; je Jahr Mittelwert und Median aller Fänge, Jahre mit n < 3 weggelassen)'
    for col, label, unit, key in (('mass', 'Masse', 'g/km²', 'mass'), ('num', 'Anzahl', 'Teile/km²', 'num')):
        res = yearly(h, col, 'inside')
        for inside, name in ((1, 'innerhalb des Patches'), (0, 'außerhalb des Patches')):
            series.append({'id': f'l18-{key}-{"in" if inside else "out"}', 'label': f'{label} {name} (Mikroplastik, Netz)', 'unit': unit,
                           'source': 'Lebreton et al. 2018, Historical Dataset (1972 bis 2015)', 'method': 'Neuston-Netz, historische Studien (Lebreton 2018)', 'note': note18, 'points': res[inside]})
    sheets = read_excel(d24 / 'Lebreton2024_concentration_data.xlsx', sheet_name=None)
    m = sheets['Manta trawl'].rename(columns={'Year': 'year', 'In NPGP': 'inside'})
    m['mass'] = m[[f'WD{i}' for i in range(1, 7)]].sum(axis=1, min_count=1)
    m['num'] = m[[f'CD{i}' for i in range(1, 7)]].sum(axis=1, min_count=1)
    note24 = 'Manta-Netz, Teile 0,5 bis 500 mm, Summe der Größenklassen 1 bis 6'
    for col, label, unit, key in (('mass', 'Masse', 'g/km²', 'mass'), ('num', 'Anzahl', 'Teile/km²', 'num')):
        res = yearly(m, col, 'inside')
        for inside, name in ((1, 'innerhalb des Patches'), (0, 'außerhalb des Patches')):
            series.append({'id': f'l24-manta-{key}-{"in" if inside else "out"}', 'label': f'{label} {name} (Fragmente 0,5 bis 500 mm)', 'unit': unit,
                           'source': 'Lebreton et al. 2024, Manta trawl (2015 bis 2022)', 'method': 'Manta-Trawl, Lebreton 2024', 'note': note24, 'points': res[inside]})
    a = sheets['Aerial survey'].rename(columns={'Year': 'year', 'In NPGP': 'inside'})
    res = yearly(a, 'WD7', 'inside', min_n=3)
    series.append({'id': 'l24-aerial-mass-in', 'label': 'Masse innerhalb des Patches (Megaplastik > 500 mm, Luftbild)', 'unit': 'g/km²',
                   'source': 'Lebreton et al. 2024, Aerial survey', 'method': 'Luftbild-Survey, Lebreton 2024', 'note': 'Luftbild-Survey, Objekte > 500 mm', 'points': res.get(1, [])})
    c = sheets['Cleanup system'].rename(columns={'Year': 'year', 'In NPGP': 'inside'})
    res = yearly(c, 'WD567', 'inside', min_n=3)
    series.append({'id': 'l24-cleanup-mass-in', 'label': 'Masse innerhalb des Patches (Makro- und Megaplastik > 50 mm, Cleanup-System)', 'unit': 'g/km²',
                   'source': 'Lebreton et al. 2024, Cleanup system', 'method': 'Cleanup-System, Lebreton 2024', 'note': 'Fänge des Cleanup-Systems, Objekte > 50 mm', 'points': res.get(1, [])})
    series = [s for s in series if s['points']]
    write_json(OUT / 'gpgp-history.json', {
        'credit': 'Lebreton et al. 2018 und 2024 (CC BY 4.0)',
        'note': 'Mittelwerte je Jahr; Methoden und Größenbereiche unterscheiden sich zwischen 2018- und 2024-Reihen (2024: 0,5 bis 500 mm, Korrektur für vertikale Durchmischung, '
                'Werte daher nicht direkt mit den 2018-Reihen vergleichbar). Einheiten werden nicht gemischt.',
        'series': series})
    for s in series:
        ps = s['points']
        print(f'  {s["id"]}: {len(ps)} Jahre {ps[0]["year"]}..{ps[-1]["year"]}, Wert {ps[0]["value"]} -> {ps[-1]["value"]} {s["unit"]}')
    print(f'  2018: {len(h)} Fänge, Jahre {h.year.min()}..{h.year.max()}')


# ---------------------------------------------------------------- Netzfänge (Zeitregler)

TOW_TYPES = {'neuston': 'N', 'manta': 'M', 'ovoid plankton': 'O', 'seston': 'O', 'ring net': 'O'}


def build_tows(d18, d24):
    """Einzelne Netzfänge mit Position und Jahr: Lebreton 2018 (Historical Dataset, 1972 bis 2015) und Lebreton 2024 (Manta trawl, 2015 bis 2022).
    Properties: y Jahr, m g/km² (Masse), n Teile/km² (Anzahl), s Methode: N Neuston-Netz, M Manta-Netz, O anderes Netz (Ovoid, Seston, Ringnetz),
    U Netz ohne Typangabe (alle Lebreton 2018, Maschenweite 150 bis 505 µm, Rohwerte), T Manta-Trawl 2015 bis 2022 (Lebreton 2024, 0,5 bis 500 mm, Summe Klassen 1 bis 6)."""
    import pandas as pd
    h = read_excel(d18 / 'Lebreton2018_HistoricalDataset.xls')
    h.columns = ['n', 'origin', 'ref', 'year', 'month', 'lon', 'lat', 'type', 'mesh', 'depth', 'num', 'mass', 'inside']
    m = read_excel(d24 / 'Lebreton2024_concentration_data.xlsx', sheet_name='Manta trawl')
    m['mass'] = m[[f'WD{i}' for i in range(1, 7)]].sum(axis=1, min_count=1)
    m['num'] = m[[f'CD{i}' for i in range(1, 7)]].sum(axis=1, min_count=1)
    rows = []
    for _, r in h.iterrows():
        t = str(r['type']).strip().lower()
        rows.append((int(r['year']), r['lon'], r['lat'], r['mass'], r['num'], TOW_TYPES.get(t, 'U')))
    for _, r in m.iterrows():
        rows.append((int(r['Year']), r['Lon'], r['Lat'], r['mass'], r['num'], 'T'))
    feats = []
    for y, lon, lat, mass, num, src in rows:
        if pd.isna(lon) or pd.isna(lat) or pd.isna(mass) and pd.isna(num):
            continue
        lon = float(lon)
        lon = lon - 360 if lon > 180 else lon
        props = {'y': y}
        if not pd.isna(mass):
            props['m'] = sig3(float(mass))
        if not pd.isna(num):
            props['n'] = int(round(float(num)))
        props['s'] = src
        feats.append({'type': 'Feature', 'properties': props, 'geometry': {'type': 'Point', 'coordinates': [round(lon, 3), round(float(lat), 3)]}})
    feats.sort(key=lambda f: f['properties']['y'])
    write_json(OUT / 'gpgp-tows.geojson', {
        'type': 'FeatureCollection', 'credit': 'Lebreton et al. 2018 und 2024 (CC BY 4.0)',
        'unit': {'y': 'Jahr', 'm': 'g/km²', 'n': 'Teile/km²'},
        'methods': {'N': 'Neuston-Netz (Lebreton 2018, historisch)', 'M': 'Manta-Netz (Lebreton 2018, historisch)', 'O': 'anderes Netz (Ovoid-Plankton, Seston, Ringnetz; Lebreton 2018)',
                    'U': 'Netz ohne Typangabe (Lebreton 2018)', 'T': 'Manta-Trawl 2015 bis 2022 (Lebreton 2024, 0,5 bis 500 mm, vertikal korrigiert)'},
        'note': 'Werte der Datensätze von 2018 (Rohwerte, Maschenweite 150 bis 505 µm) und 2024 (anderer Größenbereich, Korrektur für Durchmischung) sind nicht direkt vergleichbar.',
        'features': feats})
    ys = sorted({f['properties']['y'] for f in feats})
    by = {}
    for f in feats:
        by[f['properties']['s']] = by.get(f['properties']['s'], 0) + 1
    zero = sum(1 for f in feats if f['properties'].get('m') == 0)
    print(f'  Netzfänge: {len(feats)} (Methoden {by}), {len(ys)} Jahre {ys[0]}..{ys[-1]}, davon mit Masse 0: {zero}')
    print('  Fänge je Jahr:', {y: sum(1 for f in feats if f["properties"]["y"] == y) for y in ys})


# ---------------------------------------------------------------- Lebreton 2022: Herkunft

COUNTRY = {'Japan': ('JP', 'Japan'), 'China': ('CN', 'China'), 'Korea': ('KR', 'Südkorea'), 'USA': ('US', 'USA'), 'Taiwan': ('TW', 'Taiwan'),
           'Canada': ('CA', 'Kanada'), 'France': ('FR', 'Frankreich'), 'Vietnam': ('VN', 'Vietnam'), 'Mexico': ('MX', 'Mexiko'),
           'Indonesia': ('ID', 'Indonesien'), 'Russia': ('RU', 'Russland'), 'Belgium': ('BE', 'Belgien'), 'Philippines': ('PH', 'Philippinen'),
           'UK': ('GB', 'Großbritannien'), 'Colombia': ('CO', 'Kolumbien'), 'Thailand': ('TH', 'Thailand'), 'Germany': ('DE', 'Deutschland'),
           'Netherlands': ('NL', 'Niederlande')}
def build_origin(d):
    import numpy as np
    m = read_excel(next(d.glob('*.xlsx')))
    m.columns = ['n', 'ospar', 'obj', 'logo', 'lang', 'origin', 'year']
    total = len(m)
    known = m[m.origin.notna()]
    kn = len(known)
    counts = known.origin.value_counts()
    countries = [{'code': COUNTRY[c][0], 'name': COUNTRY[c][1], 'n': int(n), 'share': round(n / kn, 4)} for c, n in counts.items()]
    dated = m[m.year.notna()].copy()
    yrs = dated.year.astype(int)
    decades = yrs // 10 * 10
    age = [{'decade': int(dc), 'n': int((decades == dc).sum())} for dc in sorted(decades.unique())]
    top5 = [c['share'] for c in countries[:5]]
    write_json(OUT / 'gpgp-origin.json', {
        'credit': 'Lebreton et al. 2022 (CC BY 4.0)',
        'source': 'doi:10.1038/s41598-022-16529-0, Daten doi:10.6084/m9.figshare.20202131',
        'collected': 2019,
        'objects': total, 'withOrigin': kn,
        'countries': countries,
        'other': round(1 - sum(top5), 4),
        'fishing': {'share': [0.75, 0.86], 'basis': 'Masse', 'source': 'Lebreton et al. 2022, Abstract', 'verified': False},
        'age': {'dated': int(len(dated)), 'oldest': int(yrs.min()), 'newest': int(yrs.max()), 'median': int(np.median(yrs)), 'byDecade': age},
    })
    print(f'  Objekte {total}, mit Herkunft {kn}, datiert {len(dated)}, ältestes {yrs.min()}')
    print('  Länderanteile:', [(c['code'], f'{c["share"] * 100:.1f}%') for c in countries[:8]])
    print('  Altersverteilung:', age)


# ---------------------------------------------------------------- Meijer 2021: Flussmündungen

RIVER_MIN_T = 3.0  # 1 t/Jahr ergäbe 17.328 Punkte und 1,96 MB; ab 3 t/Jahr bleiben ~98 % der Gesamtmenge bei < 1,5 MB


def build_rivers(d):
    import shapefile
    r = shapefile.Reader(str(d / 'Meijer2021_midpoint_emissions.shp'))
    pts = []
    tot = 0.0
    for sr in r.iterShapeRecords():
        t = float(sr.record[0])
        tot += t
        if t >= RIVER_MIN_T:
            x, y = sr.shape.points[0]
            pts.append((t, x, y))
    pts.sort(key=lambda p: -p[0])
    feats = [{'type': 'Feature', 'properties': {'t': sig3(t), 'r': i + 1},
              'geometry': {'type': 'Point', 'coordinates': [round(x, 4), round(y, 4)]}} for i, (t, x, y) in enumerate(pts)]
    kept = sum(p[0] for p in pts)
    write_json(OUT / 'rivers.geojson', {
        'type': 'FeatureCollection',
        'credit': 'Meijer et al. 2021 (CC BY 4.0)',
        'unit': 't/Jahr', 'scenario': 'midpoint', 'totalAll': round(tot), 'minT': RIVER_MIN_T,
        'features': feats})
    print(f'  Flüsse: {len(r)} gesamt, {len(pts)} mit >= {RIVER_MIN_T:g} t/Jahr; Summe alle {tot:,.0f} t, behalten {kept:,.0f} t ({kept / tot:.1%}); größte {pts[0][0]:,.0f} t/Jahr')


# ---------------------------------------------------------------- Eriksen 2014: Raster und Stationen

def build_global(d):
    import numpy as np
    import rasterio
    tot = 0
    for i in range(1, 5):
        with rasterio.open(d / f'count_density_size{i}.tif') as ds:
            tot = tot + 10 ** ds.read(1)
            assert str(ds.crs) == 'EPSG:4326' and ds.bounds.left == 0 and ds.bounds.right == 360
            lat_top, lat_bot = ds.bounds.top, ds.bounds.bottom
    v = np.log10(tot)  # log10 Teile/km², Summe der vier Größenklassen
    H, W = v.shape
    # Längen 0..360 -> -180..180 (Spalten ab 180° nach vorn)
    split = int(np.ceil(180 / (360 / W)))
    v = np.concatenate([v[:, split:], v[:, :split]], axis=1)
    # auf +-85 Breite begrenzen (Zeilenmitte lat = 90 - (r+0.5)*dlat)
    dlat = 180 / H
    r0 = int(np.floor((90 - 85) / dlat)); r1 = int(np.ceil((90 + 85) / dlat))
    sub = v[r0:r1]
    top = 90 - r0 * dlat; bot = 90 - r1 * dlat
    vmin, vmax = 1.0, 5.5  # log10 Teile/km² (10 .. ~300.000)
    floor = float(v.min())
    img, h = reproject_mercator(sub, -180, 180, top, bot, out_w=1800)
    rgba = colorize(img, vmin, vmax, fade_from=floor + 0.05, fade_to=1.3)
    save_png(rgba, OUT / 'global-density.png')
    area_note = f'Hintergrundwert des Modells ist {10 ** floor:.1f} Teile/km² und wird transparent dargestellt'
    write_json(OUT / 'global-density.json', {
        'coordinates': [[-180, 85], [180, 85], [180, -85], [-180, -85]],
        'actualLat': [round(float(top), 3), round(float(bot), 3)],
        'projection': 'EPSG:3857 (Bild nach Web-Mercator umprojiziert, Ecken in lon/lat)',
        'unit': 'log10 Teile/km²', 'min': vmin, 'max': vmax, 'fade': [round(floor + 0.05, 3), 1.3], 'floor': round(floor, 3),
        'stops': palette_stops(vmin, vmax), 'size': [rgba.shape[1], rgba.shape[0]],
        'classes': 'Summe der vier Größenklassen (0,33 bis 1; 1 bis 4,75; 4,75 bis 200; > 200 mm)',
        'note': area_note, 'credit': CREDIT_EGLOBAL,
        'source': 'doi:10.1371/journal.pone.0111913, Daten doi:10.6084/m9.figshare.14390873'})
    print(f'  global-density: Bild {rgba.shape[1]}x{rgba.shape[0]}, log10-Spanne {v.min():.2f}..{v.max():.2f}, Gesamtzahl (Kontrolle) '
          f'{(tot * (6371.0088 ** 2 * np.radians(180 / (H - 1)) * np.radians(360 / (W - 1)) * np.cos(np.radians(np.linspace(90, -90, H)))[:, None])).sum() / 1e12:.2f} Billionen')


def build_stations(d):
    import pandas as pd
    df = read_excel(next(d.glob('*.xlsx')), header=None, skiprows=2)
    df = df.iloc[:, :14]
    df.columns = ['date', 'lat', 'lon', 'c1', 'c2', 'c3', 'c4', 'w1', 'w2', 'w3', 'w4', 'sea', 'source', 'info']
    df = df.dropna(subset=['lat', 'lon'])
    feats = []
    for _, r in df.iterrows():
        n = r[['c1', 'c2', 'c3', 'c4']].astype(float).sum(min_count=1)
        w = r[['w1', 'w2', 'w3', 'w4']].astype(float).sum(min_count=1)
        dt = pd.to_datetime(r['date'], errors='coerce')
        props = {}
        if not pd.isna(dt):
            props['d'] = dt.strftime('%Y-%m')
        if not pd.isna(n):
            props['n'] = int(round(n))
        if not pd.isna(w):
            props['w'] = sig3(w)
        feats.append({'type': 'Feature', 'properties': props, 'geometry': {'type': 'Point', 'coordinates': [round(float(r['lon']), 3), round(float(r['lat']), 3)]}})
    write_json(OUT / 'stations.geojson', {
        'type': 'FeatureCollection', 'credit': CREDIT_EGLOBAL, 'unit': {'n': 'Teile/km²', 'w': 'g/km²', 'd': 'Jahr-Monat'}, 'features': feats})
    print(f'  Stationen: {len(feats)}')


# ---------------------------------------------------------------- Strudel (statisch)

def build_patches(gpgp_center):
    lon, lat = gpgp_center
    lon = lon - 360 if lon > 180 else lon
    P = [
        ('gpgp', 'Nordpazifik (Great Pacific Garbage Patch)', round(lon, 2), round(lat, 2), '~1,6 Mio. km², ~79.000 t schwimmendes Plastik',
         'Lebreton et al. 2018', '10.1038/s41598-018-22939-w', 'https://doi.org/10.6084/m9.figshare.5873142'),
        ('nordatlantik', 'Nordatlantik', -45, 30, 'Ø > 20.000 Teile/km², max. 580.000 Teile/km²', 'Law et al. 2010', '10.1126/science.1192321',
         'https://doi.org/10.1594/IEDA/100014'),
        ('suedpazifik', 'Südpazifik', -105, -28, 'Ø 26.898 Teile/km²', 'Eriksen et al. 2013', '10.1016/j.marpolbul.2012.12.021', None),
        ('indik', 'Indischer Ozean', 80, -28, '75,2 Teile/km² (Südwestzone)', 'Connan et al. 2021', '10.1016/j.marpolbul.2021.112559', None),
        ('suedatlantik', 'Südatlantik', -15, -28, '6,2 Teile/km² (ozeanisch)', 'Ryan 2014', '10.1016/j.marpolbul.2013.12.010', None),
        ('arktis', 'Arktis', 0, 82, 'Im Meereis bis 1,2 × 10⁷ Teile/m³', 'Peeken et al. 2018', '10.1038/s41467-018-03825-5',
         'https://doi.org/10.1594/PANGAEA.886593'),
        ('mittelmeer', 'Mittelmeer', 16, 37, 'Ø 260.000 Teile/km²', 'Cózar et al. 2015', '10.1371/journal.pone.0121762',
         'https://doi.org/10.1594/PANGAEA.842054'),
        ('greatlakes', 'Große Seen', -83, 44, 'Ø 43.157 Teile/km², max. 466.305 Teile/km² (Eriesee)', 'Eriksen et al. 2013', '10.1016/j.marpolbul.2013.10.007', None),
    ]
    items = [{'id': i, 'name': n, 'lon': lo, 'lat': la, 'metric': mt, 'study': st, 'doi': doi, 'doiUrl': f'https://doi.org/{doi}', 'dataUrl': du}
             for i, n, lo, la, mt, st, doi, du in P]
    write_json(OUT / 'patches.json', {
        'note': 'Kennzahlen aus den genannten Studien, Mitte ungefähr (GPGP: Flächenschwerpunkt des Rasterbereichs >= 10 kg/km², der Patch-Definition bei Lebreton 2018). Längen -180..180.',
        'patches': items})


def build(dirs):
    OUT.mkdir(parents=True, exist_ok=True)
    print('Lebreton 2018: Dichte'); (area, clon, clat), lines4 = build_gpgp_density(dirs[5873142])
    print('Lebreton 2018: mitgelieferte Konturen (nur Analyse)'); analyze_shipped_contours(dirs[5873142])
    print('Lebreton 2018: Konturen'); build_gpgp_contours(dirs[5873142], lines4)
    print('Netzfänge'); build_tows(dirs[5873142], dirs[25674120])
    print('Messreihe'); build_history(dirs[5873142], dirs[25674120])
    print('Herkunft'); build_origin(dirs[20202131])
    print('Flüsse'); build_rivers(dirs[14515590])
    print('Eriksen: Raster'); build_global(dirs[14390873])
    print('Eriksen: Stationen'); build_stations(dirs[1015289])
    build_patches((clon, clat))
    print('Fertig:', OUT)


# ---------------------------------------------------------------- inspect

def inspect_tif(path):
    import numpy as np
    import rasterio
    with rasterio.open(path) as ds:
        a = ds.read(1, masked=True)
        print(f'  GeoTIFF {path.name}: {ds.width}x{ds.height}, Bänder {ds.count}, dtype {ds.dtypes[0]}, CRS {ds.crs}')
        print(f'    Bounds {tuple(round(x, 4) for x in ds.bounds)}, Auflösung {ds.res}, NoData {ds.nodata}')
        if a.count():
            print(f'    Werte min {a.min():.6g} max {a.max():.6g} Mittel {a.mean():.6g}, gültig {a.count()}/{a.size}')
            print(f'    Perzentile 50/90/99: {[float(np.percentile(a.compressed(), q)) for q in (50, 90, 99)]}')
        print(f'    Tags {ds.tags()}')


def inspect_shp(path):
    import shapefile
    r = shapefile.Reader(str(path))
    print(f'  Shapefile {path.name}: {len(r)} Objekte, Typ {r.shapeTypeName}, bbox {r.bbox}')
    print(f'    Felder {[(f[0], f[1], f[2], f[3]) for f in r.fields[1:]]}')
    prj = path.with_suffix('.prj')
    if prj.exists():
        print(f'    PRJ {prj.read_text()[:160]}')
    for rec in list(r.iterRecords())[:3]:
        print('    ', list(rec))


def inspect_xls(path):
    import pandas as pd
    xl = pd.ExcelFile(path)
    print(f'  Excel {path.name}: Blätter {xl.sheet_names}')
    for sh in xl.sheet_names:
        df = xl.parse(sh, header=None, nrows=8)
        full = xl.parse(sh, header=None)
        print(f'   Blatt {sh!r}: {full.shape[0]} Zeilen x {full.shape[1]} Spalten, erste Zeilen:')
        with pd.option_context('display.width', 250, 'display.max_columns', 40, 'display.max_colwidth', 40):
            print(df.to_string(max_cols=40))


def inspect_all(dirs):
    for aid, d in dirs.items():
        print(f'\n=== Artikel {aid} ===')
        for f in sorted(d.iterdir()):
            if f.suffix == '.tif':
                inspect_tif(f)
            elif f.suffix == '.shp':
                inspect_shp(f)
            elif f.suffix in ('.xls', '.xlsx'):
                inspect_xls(f)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--inspect', action='store_true', help='Rohdateien laden und beschreiben (Spalten, Raster-Metadaten)')
    args = ap.parse_args()
    dirs = download_all()
    if args.inspect:
        inspect_all(dirs)
        sys.exit(0)
    build(dirs)
