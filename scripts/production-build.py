#!/usr/bin/env python3
"""Weltweite Plastikproduktion je Jahr -> public/data/plastik/production.json (Gewicht des Eintrags im historischen Treibgut-Modell).

Aufruf:  python3 -I scripts/production-build.py
Quelle:  Our World in Data "Global plastics production" (Geyer, Jambeck & Law 2017, Sci. Adv., CC BY), 1950-2019 aus der Reihe, danach
         linear fortgeschrieben (Ausgleichsgerade der Jahre 2015-2019, wie in scripts/gpgp-model.py). Rohdatei: .cache/gpgpmodel/raw/owid.csv
         (wird von scripts/gpgp-model.py angelegt, sonst hier einmalig geladen). Nur Standardbibliothek.
"""
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '.cache', 'gpgpmodel', 'raw', 'owid.csv')
OUT = os.path.join(ROOT, 'public', 'data', 'plastik', 'production.json')
URL = 'https://ourworldindata.org/grapher/global-plastics-production.csv'
YEAR0, YEAR1 = 1950, 2025

if not os.path.exists(RAW):
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    req = urllib.request.Request(URL, headers={'User-Agent': 'orbis-data-build'})
    with urllib.request.urlopen(req, timeout=60) as r, open(RAW, 'wb') as fh:
        fh.write(r.read())

rows = {}
with open(RAW, encoding='utf-8') as fh:
    next(fh)
    for line in fh:
        ent, _code, year, val = line.strip().split(',')
        if ent == 'World':
            rows[int(year)] = float(val)
last = max(rows)
ys = list(range(last - 4, last + 1))
n = len(ys)
mx = sum(ys) / n
my = sum(rows[y] for y in ys) / n
slope = sum((y - mx) * (rows[y] - my) for y in ys) / sum((y - mx) ** 2 for y in ys)
icpt = my - slope * mx
years = {str(y): round((rows[y] if y in rows else max(0.0, slope * y + icpt)) / 1e6, 3) for y in range(YEAR0, YEAR1 + 1)}
doc = {
    'version': 1,
    'credit': 'Our World in Data, Global plastics production (Geyer, Jambeck & Law 2017, Sci. Adv.)',
    'doi': 'https://doi.org/10.1126/sciadv.1700782',
    'license': 'CC BY',
    'source': URL,
    'unit': 'Mt/Jahr',
    'owid_last': last,
    'note': f'Ab {last + 1} linear fortgeschrieben (Ausgleichsgerade {last - 4}-{last}); Geyer 2017 endet 2015, die OWID-Werte ab 2016 sind selbst +5 %/Jahr fortgeschrieben.',
    'years': years,
}
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(doc, fh, ensure_ascii=False, indent=1)
    fh.write('\n')
print(f'{OUT}: {YEAR0}..{YEAR1}, 2020 = {years["2020"]} Mt')
