// Baut die lokalen Wahlen-Snapshots (public/data/wahlen/de.json + de-geo.json; Fallback ohne VITE_DATA_BASE):
//   node scripts/wahlen-data.mjs [--ab-jahr 1990]
// Die Logik steckt in scripts/wahlen-build.mjs (identisch mit collectors/wahlen.mjs in orbis-data, Task `wahlen`,
// Gruppe `manual` – dort entstehen die ausgelieferten Dateien).
// Quellen:
// - GERDA – German Election Database (Heddesheimer, Hilbig, Sichart & Wiedemann 2025, german-elections.com):
//   Bundestagswahlen (Kreis-Reihen) unter CC BY 4.0; Landtagswahlen (Wahlkreis-Reihen) stammen aus der Regionaldatenbank
//   Deutschland (© Statistische Ämter des Bundes und der Länder, dl-de/by-2-0).
// - Bundesländer-Umrisse: BKG VG2500 (WFS sgx.geodatenzentrum.de/wfs_vg2500), © GeoBasis-DE / BKG, dl-de/by-2-0.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWahlen } from './wahlen-build.mjs';

const OUT = new URL('../public/data/wahlen/', import.meta.url).pathname;
const argv = process.argv.slice(2);
const MIN_YEAR = Number(argv[argv.indexOf('--ab-jahr') + 1] ?? 1990);

const URLS = {
  federal: 'https://github.com/awiedem/german_election_data/raw/refs/heads/main/data/federal_elections/county_level/final/federal_cty_unharm.csv',
  ltw: 'https://github.com/awiedem/german_election_data/raw/refs/heads/main/data/state_elections/final/ltw_wkr_unharm.csv',
  geo: 'https://sgx.geodatenzentrum.de/wfs_vg2500?service=WFS&version=2.0.0&request=GetFeature&typeNames=vg2500:vg2500_lan&outputFormat=application/json&srsName=EPSG:4326',
};
const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'orbis-wahlen-data build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return res.text();
};

const [federalText, ltwText, geoText] = await Promise.all([get(URLS.federal), get(URLS.ltw), get(URLS.geo)]);
const { doc, geo } = buildWahlen({ federalText, ltwText, geoRaw: JSON.parse(geoText), minYear: MIN_YEAR });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'de-geo.json'), JSON.stringify(geo));
writeFileSync(join(OUT, 'de.json'), JSON.stringify(doc));
console.log(`${geo.features.length} Länder, ${doc.btw.length} Bundestagswahlen, ${doc.ltw.length} Landtagswahlen (ab ${MIN_YEAR})`);
