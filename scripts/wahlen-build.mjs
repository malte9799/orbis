// Election results of the "Wahlen" layer (src/api/wahlen.ts): pure build logic, shared by the collector task `wahlen`
// (orbis-data, collectors/wahlen.mjs) and scripts/wahlen-build.mjs of malte9799/orbis (same file, local fallback files).
//
// Inputs (downloaded by the caller):
//   - federal: GERDA federal_cty_unharm.csv (Bundestagswahlen, county level) – GERDA, CC BY 4.0
//   - ltw: GERDA ltw_wkr_unharm.csv (Landtagswahlen, Wahlkreis level) – numbers originate from the Regionaldatenbank
//     Deutschland (Statistische Aemter des Bundes und der Laender), Datenlizenz Deutschland - Namensnennung - 2.0
//   - geo: BKG VG2500 Laender (WFS vg2500:vg2500_lan as GeoJSON, EPSG:4326), Datenlizenz Deutschland - Namensnennung - 2.0
// Both election series are aggregated to the 16 Bundeslaender (changed data!). Shares are multiplied by the valid votes
// (GERDA note) to get absolute votes; SONST is the difference to the valid votes.

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

/** flache Rotationsliste aller relevanten Spalten je Datei-Kopfinformation (Anteile) */
function shareCols(head) {
  return head.map((n, i) => [n, i]).filter(([n]) => BUCKET_COL.has(n));
}

// ===================== Bundestagswahlen ======================================================
function readFederal(text, MIN_YEAR) {
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
function readLtw(text, MIN_YEAR) {
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


const AGS_ISO = AGS;

/** VG2500 Laender (WFS GeoJSON) -> one feature per Land {k:'DE-xx', n}, only gf=9 (land; gf=8 = water/Bodensee), simplified */
export function buildGeo(raw, tolerance = 0.0015) {
  const sq = (a, b, c) => {
    // squared distance of point a to segment b-c
    const dx = c[0] - b[0], dy = c[1] - b[1];
    const l = dx * dx + dy * dy;
    let t = l ? ((a[0] - b[0]) * dx + (a[1] - b[1]) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    const px = b[0] + t * dx - a[0], py = b[1] + t * dy - a[1];
    return px * px + py * py;
  };
  const dp = (pts, tol2) => {
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      let m = -1, mi = 0;
      for (let i = s + 1; i < e; i++) {
        const d = sq(pts[i], pts[s], pts[e]);
        if (d > m) (m = d), (mi = i);
      }
      if (m > tol2) {
        keep[mi] = 1;
        stack.push([s, mi], [mi, e]);
      }
    }
    return pts.filter((_, i) => keep[i]);
  };
  const r = (n) => Math.round(n * 1e4) / 1e4;
  const ring = (pts) => {
    // closed ring: simplify the open part, keep it closed with >= 4 points
    const out = dp(pts.slice(0, -1), tolerance * tolerance).map(([x, y]) => [r(x), r(y)]);
    if (out.length < 3) return null;
    return [...out, out[0]];
  };
  const features = [];
  for (const f of raw.features) {
    if (f.properties.gf !== 9 || !AGS_ISO[f.properties.ags]) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const outPolys = [];
    for (const p of polys) {
      const rings = p.map(ring).filter(Boolean);
      if (rings.length && p[0] && ring(p[0])) outPolys.push(rings);
    }
    features.push({ type: 'Feature', properties: { k: iso(f.properties.ags), n: f.properties.gen }, geometry: { type: 'MultiPolygon', coordinates: outPolys } });
  }
  features.sort((a, b) => (a.properties.k < b.properties.k ? -1 : 1));
  return features;
}

/** Builds { doc (de.json), geo (de-geo.json) } */
export function buildWahlen({ federalText, ltwText, geoRaw, minYear = 1990, today = new Date().toISOString().slice(0, 10), includeLtw = true }) {
  const features = buildGeo(geoRaw);
  const geo = {
    type: 'FeatureCollection',
    source: '© GeoBasis-DE / BKG (' + today.slice(0, 4) + ') <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>, Verwaltungsgebiete 1:2 500 000 (VG2500), vereinfacht',
    features,
  };

  const fedRows = readFederal(federalText, minYear);
  const btw = [];
  for (const g of [...group(fedRows, (r) => r.region + r.date).values()].sort((a, b) => (a.date < b.date ? -1 : a.date === b.date ? (a.region < b.region ? -1 : 1) : 1))) {
    const { sums, eligible, voters, valid } = sumBuckets(g.rows, (r) => r.valid);
    const doc = btw.find((e) => e.d === g.date) ?? btw[btw.push({ d: g.date, g: {} }) - 1];
    doc.g[iso(g.region)] = { p: resultOf(sums, valid), b: turnoutOf(eligible, voters) };
  }

  // Landtagswahlen: zweitstimme > erststimme > einzelstimme per (region, date)
  const ltw = [];
  if (includeLtw) {
    const ltwRows = readLtw(ltwText, minYear);
    for (const g of group(ltwRows, (r) => r.region + r.date).values()) {
      const per = {};
      for (const r of g.rows) (per[r.stimme] ??= []).push(r);
      const pick = per.zweitstimme ? 'zweitstimme' : per.erststimme ? 'erststimme' : 'einzelstimme';
      const { sums, eligible, voters, valid } = sumBuckets(per[pick], (r) => r.valid);
      ltw.push({ d: g.date, r: iso(g.region), p: resultOf(sums, valid), b: turnoutOf(eligible, voters) });
    }
    ltw.sort((a, b) => (a.d === b.d ? (a.r < b.r ? -1 : 1) : a.d < b.d ? -1 : 1));
  }

  const regions = {};
  for (const f of features) regions[f.properties.k] = f.properties.n;
  const doc = {
    schema: 1,
    built: today,
    source:
      'Bundestagswahlen: GERDA – German Election Database (Heddesheimer, Hilbig, Sichart & Wiedemann 2025), CC BY 4.0; ' +
      'Landtagswahlen: © Statistische Ämter des Bundes und der Länder, Regionaldatenbank Deutschland, dl-de/by-2-0 (via GERDA); ' +
      'beide auf Bundesländer aggregiert (verändert)',
    regions,
    btw,
    ltw,
  };
  return { doc, geo };
}
