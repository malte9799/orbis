// Baut die Wahlergebnis-Snapshots für den Layer „Wahlen" (public/data/wahlen/):
//   node scripts/wahlen-data.mjs [--ab-jahr 1990]
// Quellen (einmalig geladen; historische Wahlen ändern sich nicht mehr):
// - GERDA – German Election Database (Heddesheimer, Hilbig, Sichart & Wiedemann 2025,
//   german-elections.com, CC BY 4.0): Bundestagswahlen aus den Kreis-Reihen,
//   Landtagswahlen aus den Wahlkreis-Reihen → je auf die 16 Bundesländer aggregiert.
// - Bundesländer-Umrisse: isellsoap/deutschlandGeoJSON (aus GeoBasis-DE / BKG).
// Partei-Anteile werden (gerda-Note) mit their denominator zu absoluten Stimmen
// aufsummiert; SONST ergibt sich als Differenz zu den gültigen Stimmen.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TODAY = new Date().toISOString().slice(0, 10);
const CACHE = new URL('../node_modules/.cache/wahlen/', import.meta.url).pathname;
const OUT = new URL('../public/data/wahlen/', import.meta.url).pathname;
const argv = process.argv.slice(2);
const MIN_YEAR = Number(argv[argv.indexOf('--ab-jahr') + 1] ?? 1990);

const URLS = {
  federal:
    'https://github.com/awiedem/german_election_data/raw/refs/heads/main/data/federal_elections/county_level/final/federal_cty_unharm.csv',
  ltw: 'https://github.com/awiedem/german_election_data/raw/refs/heads/main/data/state_elections/final/ltw_wkr_unharm.csv',
  geo: 'https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main/2_bundeslaender/3_mittel.geo.json',
};

async function fetchCached(name, url) {
  const file = join(CACHE, name);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  console.log('lade', name);
  const res = await fetch(url, { headers: { 'user-agent': 'orbis-wahlen-data build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  const text = Buffer.from(await res.arrayBuffer()).toString('utf8');
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, text);
  return text;
}

/** robustes CSV (Anführungszeichen, Kommas in Feldern) */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));

// ---- Parteien-Buckets (Reihenfolge = Legende; muss zu src/api/wahlen.ts passen) ---------------
const BUCKETS = [
  ['CDU', ['cdu']],
  ['CSU', ['csu']],
  ['SPD', ['spd']],
  ['GRUENE', ['gruene', 'buendnis_90']],
  ['FDP', ['fdp']],
  ['LINKE', ['linke_pds', 'wasg']],
  ['AFD', ['afd']],
  ['BSW', ['bsw']],
  ['SSW', ['ssw']],
  ['FW', ['freie_waehler', 'fwd', 'fw_sh', 'fw_sachsen']],
];
const BUCKET_COL = new Map();
for (const [id, cols] of BUCKETS) for (const col of cols) BUCKET_COL.set(col, id);

// ---- Bundesländer: gerda-Gebietsnummer (AGS, 2-stellig) → ISO → k in der Geo-Datei -----------
const AGS = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW', '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
const iso = (k) => `DE-${AGS[k]}`;

const KEEP_REG = /^(ags|year|election_date|state|state_name|eligible_voters|number_voters|valid_votes|invalid_votes|turnout|stimme|election_year|wkr_nr|wkr_name)$/;

/** flache Rotationsliste aller relevanten Spalten je Datei-Kopfinformation (Anteile) */
function shareCols(head) {
  return head.map((n, i) => [n, i]).filter(([n]) => BUCKET_COL.has(n));
}

// ===================== Bundestagswahlen ======================================================
function readFederal(text) {
  const rows = parseCsv(text);
  const ix = Object.fromEntries(rows[0].map((n, i) => [n, i]));
  const cols = shareCols(rows[0]);
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const year = num(row[ix.year]);
    const region = row[ix.state];
    const eligible = num(row[ix.eligible_voters]);
    const voters = num(row[ix.number_voters]);
    const valid = num(row[ix.valid_votes]);
    if (year < MIN_YEAR || !AGS[region] || !Number.isFinite(eligible) || !Number.isFinite(voters) || valid <= 0) continue;
    out.push({ region, date: row[ix.election_date], eligible, voters, valid, shares: cols.map(([n, i]) => [BUCKET_COL.get(n), num(row[i])]).filter(([, s]) => s > 0) });
  }
  return out;
}

// ===================== Landtagswahlen ========================================================
function readLtw(text) {
  const rows = parseCsv(text);
  const ix = Object.fromEntries(rows[0].map((n, i) => [n, i]));
  const cols = shareCols(rows[0]);
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const year = num(row[ix.election_year]);
    const region = row[ix.state];
    const eligible = num(row[ix.eligible_voters]);
    const voters = num(row[ix.number_voters]);
    const valid = num(row[ix.valid_votes]);
    if (year < MIN_YEAR || !AGS[region] || !Number.isFinite(eligible) || !Number.isFinite(voters) || valid <= 0) continue;
    out.push({ region, date: row[ix.election_date], eligible, voters, valid, stimme: row[ix.stimme], shares: cols.map(([n, i]) => [BUCKET_COL.get(n), num(row[i])]).filter(([, s]) => s > 0) });
  }
  return out;
}

/** grouped aggregation: key → { region, date, children:[rows] } */
function group(rows, key) {
  const by = new Map();
  for (const r of rows) {
    const k = key(r);
    let g = by.get(k);
    if (!g) by.set(k, (g = { region: r.region, date: r.date, rows: [] }));
    g.rows.push(r);
  }
  return by;
}

const sumBuckets = (rows, denomOf) => {
  const sums = new Map();
  let denom = 0;
  let eligible = 0;
  let voters = 0;
  let valid = 0;
  for (const r of rows) {
    const d = denomOf(r);
    denom += d;
    eligible += r.eligible;
    voters += r.voters;
    valid += r.valid;
    for (const [id, s] of r.shares) sums.set(id, (sums.get(id) ?? 0) + s * d);
  }
  return { sums, denom, eligible, voters, valid };
};

/** bucket-Stimmen + SONST, plus Beteiligung; `p` =[[Partei,Stimmen],…] */
const resultOf = (sums, valid) => {
  const parts = BUCKETS.map(([id]) => [id, sums.get(id) ?? 0]).filter(([, v]) => v >= 0.5);
  let other = valid - parts.reduce((s, [, v]) => s + v, 0);
  if (other < 0) other = 0;
  if (other >= 0.5) parts.push(['SONST', Math.round(other)]);
  return parts.map(([id, v]) => [id, Math.round(v)]);
};

const turnoutOf = (eligible, voters) => (eligible > 0 ? Math.round((voters / eligible) * 1000) / 10 : null);

// =============================================================================================
mkdirSync(OUT, { recursive: true });

// Gebiete
const geoRaw = JSON.parse(await fetchCached('de-laender.geojson', URLS.geo));
const geoOut = {
  type: 'FeatureCollection',
  source: 'GeoBasis-DE / BKG, via <a href="https://github.com/isellsoap/deutschlandGeoJSON">deutschlandGeoJSON</a> (CC BY 4.0)',
  features: geoRaw.features.map((f) => ({
    type: 'Feature',
    properties: { k: f.properties.id, n: f.properties.name },
    geometry: f.geometry,
  })),
};
writeFileSync(join(OUT, 'de-geo.json'), JSON.stringify(geoOut));

// Bundestagswahlen (Anteile × gültige Stimmen; die Anteile sind gerda-Note auf die gültigen bezogen)
const fedRows = readFederal(await fetchCached('federal_cty_unharm.csv', URLS.federal));
const btw = [];
for (const g of [...group(fedRows, (r) => r.region + r.date).values()].sort((a, b) => (a.date < b.date ? -1 : a.date === b.date ? (a.region < b.region ? -1 : 1) : 1))) {
  const { sums, eligible, voters, valid } = sumBuckets(g.rows, (r) => r.valid);
  const doc = btw.find((e) => e.d === g.date) ?? btw[btw.push({ d: g.date, g: {} }) - 1];
  doc.g[iso(g.region)] = { p: resultOf(sums, valid), b: turnoutOf(eligible, voters) };
}

// Diagnose-Nenner: Summe der Anteile je Kreis-Reihe ⇒ zeigt, ob die Anteile auf Wahlbeteiligte oder Gültige bezogen sind
{
  const demo = fedRows.find((r) => r.date === '2025-02-23' && r.region === '09');
  const sumShares = demo.shares.reduce((s, [, v]) => s + v, 0);
  console.log('Diagnose Bayern BTW2025: ΣAnteile', sumShares.toFixed(4), '· gültige/Wahlbeteilgte', (demo.valid / demo.voters).toFixed(4));
}

// Landtagswahlen: zweitstimme > erststimme > einzelstimme je (region, Datum); Anteile × gültige Stimmen
const ltwRows = readLtw(await fetchCached('ltw_wkr_unharm.csv', URLS.ltw));
const ltwAgg = [];
for (const g of [...group(ltwRows, (r) => r.region + r.date).values()]) {
  const per = {};
  for (const r of g.rows) (per[r.stimme] ??= []).push(r);
  const pick = per.zweitstimme ? 'zweitstimme' : per.erststimme ? 'erststimme' : 'einzelstimme';
  const { sums, eligible, voters, valid } = sumBuckets(per[pick], (r) => r.valid);
  ltwAgg.push({
    d: g.date,
    r: iso(g.region),
    p: resultOf(sums, valid),
    b: turnoutOf(eligible, voters),
  });
}
ltwAgg.sort((a, b) => (a.d === b.d ? (a.r < b.r ? -1 : 1) : a.d < b.d ? -1 : 1));

const regions = {};
for (const f of geoOut.features) regions[f.properties.k] = f.properties.n;
const doc = {
  schema: 1,
  built: TODAY,
  source: 'GERDA – German Election Database (Heddesheimer, Hilbig, Sichart & Wiedemann 2025), CC BY 4.0',
  regions,
  btw,
  ltw: ltwAgg,
};
writeFileSync(join(OUT, 'de.json'), JSON.stringify(doc));

// ---- Plausibilitäts-Checks ------------------------------------------------------------------
const pctList = (g, n = 4) => g.p.slice(0, n).map(([id, v]) => `${id} ${((v / g.p.reduce((s, [, v2]) => s + v2, 0)) * 100).toFixed(1)} %`).join(', ');
const check = (label, txt) => console.log(`${label}: ${txt}`);
const last = btw[btw.length - 1];
check(`BTW ${last.d} Bayern`, pctList(last.g['DE-BY']));
check(`BTW ${last.d} Thüringen`, pctList(last.g['DE-TH']));
check('BTW 2021 Hessen', pctList(btw.find((e) => e.d.startsWith('2021')).g['DE-HE']));
const lBy13 = ltwAgg.find((e) => e.r === 'DE-BY' && e.d.startsWith('2013'));
check(`LTW 2013 Bayern (${lBy13.d}, Beteiligung ${lBy13.b} %)`, pctList(lBy13));
check('Anzahl', `${btw.length} Bundestagswahlen, ${ltwAgg.length} Landtagswahlen (ab ${MIN_YEAR})`);
