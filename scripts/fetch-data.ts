// Downloads data sources that browsers cannot query directly (missing CORS headers) and
// writes them as static files for the `data` branch. Run by .github/workflows/data.yml:
//   node fetch-data.mjs <outDir> <previousDataDir>
// Live sources are refreshed on every run (every 15 min), slow-changing ones once a day;
// if a download fails, the previous file is kept.

import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// the app modules expect a browser – provide the bits they touch
const envKeys = { nps: process.env.NPS_API_KEY, windy: process.env.WINDY_KEY, victoria: process.env.VICTORIA_KEY, cta: process.env.CTA_KEY, trafiklab: process.env.TRAFIKLAB_KEY, trafikverket: process.env.TRAFIKVERKET_KEY, utah511: process.env.UTAH_511_API_KEY, arizona511: process.env.ARIZONA_511_API_KEY, idaho511: process.env.IDAHO_511_API_KEY, nevada511: process.env.NEVADA_511_API_KEY, alaska511: process.env.ALASKA_511_API_KEY, georgia511: process.env.GEORGIA_511_API_KEY, louisiana511: process.env.LOUISIANA_511_API_KEY, pennsylvania511: process.env.PENNSYLVANIA_511_API_KEY, ohgo: process.env.OHGO_API_KEY, qldtraffic: process.env.QLDTRAFFIC_KEY, ontario511: process.env.ONTARIO_511_API_KEY, alberta511: process.env.ALBERTA_511_API_KEY };
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (k === 'wg.keys' ? JSON.stringify(envKeys) : null),
  setItem() {},
  removeItem() {},
};

const [OUT, PREV] = process.argv.slice(2);
if (!OUT) throw new Error('usage: fetch-data <outDir> [prevDir]');
const UA = { 'User-Agent': 'Orbis-data/1.0 (+https://github.com/malte9799/orbis)' };
const DAY = 23 * 3600 * 1000;

if (PREV && existsSync(PREV)) cpSync(PREV, OUT, { recursive: true, filter: (src) => !src.includes('/.git') });
mkdirSync(OUT, { recursive: true });

const metaPath = join(OUT, 'meta.json');
const meta: { updated?: string; tasks: Record<string, number>; /** camera feeds the last 'cams' run knew (see below) */ camFeeds?: string[] } = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : { tasks: {} };
meta.tasks ??= {};

function write(path: string, data: unknown) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
}

async function get(url: string, timeoutMs = 60000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}
const json = async <T>(url: string, timeoutMs?: number) => (await get(url, timeoutMs)).json() as Promise<T>;
const text = async (url: string) => (await get(url)).text();

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';

async function task(name: string, everyMs: number, fn: () => Promise<void>) {
  if (!FORCE && everyMs && meta.tasks[name] && Date.now() - meta.tasks[name] < everyMs) return;
  const t0 = Date.now();
  try {
    await fn();
    meta.tasks[name] = Date.now();
    console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    console.warn(`✗ ${name}: ${e instanceof Error ? e.message : e} – keeping previous data`);
  }
}

// ---------------------------------------------------------------------------
// live (every run)

await task('tsunami', 0, async () => {
  for (const f of ['PAAQ', 'PHEB']) write(`tsunami/${f}.xml`, await text(`https://www.tsunami.gov/events/xml/${f}Atom.xml`));
});

await task('safecast', 0, async () => {
  write('safecast.json', await json('https://tt.safecast.org/devices'));
});

await task('radiation', 0, async () => {
  const { fetchBfsRaw, fetchEurdepRaw } = await import('../src/api/earth');
  const [bfs, eurdep] = await Promise.allSettled([fetchBfsRaw(), fetchEurdepRaw()]);
  if (bfs.status === 'fulfilled') write('bfs-odl.json', bfs.value);
  else console.warn(`  BfS ODL: ${bfs.reason} – keeping previous data`);
  if (eurdep.status === 'fulfilled') write('eurdep.json', eurdep.value);
  else console.warn(`  EURDEP: ${eurdep.reason} – keeping previous data`);
  if (bfs.status === 'rejected' && eurdep.status === 'rejected') throw new Error('BfS and EURDEP failed');
});

await task('firms', 0, async () => {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    console.log('  no FIRMS_MAP_KEY secret – skipping');
    return;
  }
  const { loadFirms } = await import('../src/api/events');
  const byId = new Map<string, unknown>();
  for (const sensor of ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT', 'MODIS_NRT']) {
    try {
      // explicit world bounding box (west,south,east,north) – more reliable than the 'world' keyword
      const fc = await loadFirms(key, sensor, 1, '-180,-90,180,90');
      for (const f of fc.features) {
        const [lon, lat] = f.geometry.coordinates;
        f.geometry.coordinates = [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4];
        byId.set(`${f.geometry.coordinates[0]},${f.geometry.coordinates[1]},${f.properties.time}`, f);
      }
      console.log(`  ${sensor}: ${fc.features.length}`);
    } catch (e) {
      console.warn(`  ${sensor}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!byId.size) {
    // diagnose: show what FIRMS actually returned (status + first line)
    try {
      const res = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA20_NRT/-180,-90,180,90/1`);
      const body = await res.text();
      console.warn(`  diagnose: HTTP ${res.status}, ${body.length} bytes, start: ${JSON.stringify(body.slice(0, 160))}`);
    } catch (e) {
      console.warn(`  diagnose failed: ${e instanceof Error ? e.message : e}`);
    }
    throw new Error('no FIRMS data');
  }
  write('firms/world.json', { type: 'FeatureCollection', features: [...byId.values()] });
});

// ---------------------------------------------------------------------------
// dokumentation (Zeugen-Karte): Angemeldete Versammlungen (DE/AT/CH) + US-Proteste

// Angemeldete Versammlungen aus der öffentliche API von demonstrations.org (Demos Berlin e.V.)
// – CC BY-SA 4.0, keine Registrierung. Die API sortiert nach Startzeit absteigend; wir blättern,
// bis ein Start älter als 24 h ist. Jeder Treffpunkt wird zu einem eigenen Eintrag; das Detail-
// Panel bekommt zusätzlich Kurz-/Beschreibung, alle Treffpunkte und die Route (falls gemeldet).
await task('demos', 0, async () => {
  type Src = {
    id: number; name: string; slug: string; is_llm_parsed: boolean;
    short_description?: string | null; description?: string | null;
    start_time: string; end_time: string; timezone?: string;
    route_geography?: { type: 'LineString'; coordinates: number[][] } | null;
    raw_location?: string | null; raw_estimated_participants?: string | null; raw_organiser?: string | null;
    is_march?: boolean;
    locations?: {
      street?: string | null; city?: string | null; country?: string | null; role?: string | null;
      geography?: { coordinates: [number, number] } | null;
    }[];
    topics?: { id: number; names: Record<string, string> }[];
    url?: string | null;
  };
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, '2026-01-01T00:00:00'.length); // UTC-Vergleich reicht
  /** Route glätten (max 240 Punkte) und identische Strecken nur einmal speichern: Index in `routes` */
  const route = (g: Src['route_geography']): number | undefined => {
    const pts = g?.coordinates?.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) ?? [];
    if (pts.length < 2) return undefined;
    const stride = Math.max(1, Math.ceil(pts.length / 240));
    const out: number[][] = [];
    for (let i = 0; i < pts.length; i += stride) out.push([Math.round(pts[i][0] * 1e5) / 1e5, Math.round(pts[i][1] * 1e5) / 1e5]);
    const last = pts[pts.length - 1];
    if (out[out.length - 1][0] !== last[0] || out[out.length - 1][1] !== last[1]) out.push([Math.round(last[0] * 1e5) / 1e5, Math.round(last[1] * 1e5) / 1e5]);
    const key = out.map((p) => `${p[0]},${p[1]}`).join('|');
    let idx = routeIdx.get(key);
    if (idx === undefined) {
      idx = routes.length;
      routes.push(out);
      routeIdx.set(key, idx);
    }
    return idx;
  };
  const events: {
    n: string; s: string; e?: string; c: string; city: string; place?: string;
    lon: number; lat: number; r?: string; topics?: string[]; org?: string; est?: string;
    march?: boolean; src?: string; u: string;
    sd?: string; ds?: string; lc?: { a?: string; y?: string; r?: string }[]; /** Index in `routes`, -1/kex fehlt = keine */
    ri?: number;
  }[] = [];
  const routes: number[][][] = [];
  const routeIdx = new Map<string, number>();
  const clamp = (v: string | null | undefined, n: number) => {
    const s = (v ?? '').trim();
    return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s || undefined;
  };
  let offset = 0;
  for (;;) {
    const res = await fetch('https://api.demonstrations.org/v1/event/all', {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sorting_key: 'start_time', sorting_direction: 'desc', offset, limit: 200 }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} – api.demonstrations.org`);
    const body = (await res.json()) as { events: Src[]; total_event_count: number };
    const list = body.events;
    if (!list?.length) break;
    let exhausted = false;
    for (const ev of list) {
      if (ev.start_time < cutoff) { exhausted = true; break; }
      const locs = ev.locations?.filter((l) => l.geography?.coordinates?.length === 2) ?? [];
      if (!locs.length) continue;
      const topicNames = ev.topics?.map((t) => t.names.de || Object.values(t.names)[0]).filter(Boolean) as string[] | undefined;
      const sd = clamp(ev.short_description, 200);
      const rawDs = clamp(ev.description, 2500);
      // die Behörden wiederholen oft nur den Namen als Beschreibung: dann weglassen
      const ds = rawDs && rawDs.trim().toLowerCase() !== ev.name.trim().toLowerCase() ? rawDs : undefined;
      const lc = ev.locations?.map((l) => ({ a: l.street || undefined, y: l.city || undefined, r: l.role || undefined })).slice(0, 12);
      const ri = route(ev.route_geography);
      for (const l of locs) {
        events.push({
          n: ev.name.slice(0, 160),
          s: ev.start_time,
          e: ev.end_time || undefined,
          c: l.country ?? '',
          city: l.city ?? '',
          place: (l.street ?? undefined) || undefined,
          lon: Math.round(l.geography!.coordinates[0] * 1e5) / 1e5,
          lat: Math.round(l.geography!.coordinates[1] * 1e5) / 1e5,
          r: l.role ?? undefined,
          topics: topicNames?.length ? topicNames.slice(0, 4) : undefined,
          org: ev.raw_organiser || undefined,
          est: ev.raw_estimated_participants || undefined,
          march: ev.is_march || undefined,
          src: ev.url ? new URL(ev.url, 'https://demonstrations.org/').toString() : undefined,
          u: `https://demonstrations.org/de/events/${ev.slug}`,
          sd,
          ds,
          lc: lc && lc.length > 1 ? lc : undefined,
          ri,
        });
      }
    }
    if (exhausted || events.length > 6000 || offset + list.length >= body.total_event_count) break;
    offset += list.length;
  }
  if (!events.length) throw new Error('demonstrations.org: keine künftigen Versammlungen gefunden');
  write('demos.json', {
    built: new Date().toISOString(),
    source: 'demonstrations.org (Demos Berlin e.V.) – spiegelt Versammlungslisten der Behörden',
    lic: 'CC BY-SA 4.0',
    events,
    routes,
  });
});

// US-Protest-Events des Crowd Counting Consortium (Harvard/UConn) – CC0 1.0. Die Dataverse-Datei
// ist eine 47-MB-CSV; wir reduzieren auf die Felder, die die Karte zeigt (wöchentlich frisch).
await task('ccc-us', 7 * DAY, async () => {
  const FILE_ID = 14226873; // ccc-phase3-public.csv, DOI 10.7910/DVN/RI9JFU
  const res = await get(`https://dataverse.harvard.edu/api/access/datafile/${FILE_ID}`, 480000);
  if (!res.ok) throw new Error(`HTTP ${res.status} – Dataverse`);
  const csv = await res.text();
  // kleiner quoted-CSV-Reader: Feldern mit "…" inklusive Kommas und Newlines
  const parse = (line: string): string[] => {
    const out: string[] = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  // Zeilen: CSV kann Zeilenumbrüche in Anführung enthalten → zäh Anführungszeichen
  const rows: string[][] = [];
  let buf = '';
  let qn = 0;
  for (const line of csv.split('\n')) {
    buf += (buf ? '\n' : '') + line;
    qn += line.split('"').length - 1;
    if (qn % 2 === 0) { rows.push(parse(buf.replace(/\r$/, ''))); buf = ''; qn = 0; }
  }
  if (buf) rows.push(parse(buf));
  const head = rows[0];
  const col = (n: string) => head.indexOf(n);
  const WANTED = ['date', 'locality', 'state', 'lat', 'lon', 'title', 'event_type', 'size_mean', 'size_text', 'issues', 'arrests', 'source1', 'source2', 'size_low', 'size_high', 'claims_summary', 'police_measures', 'property_damage', 'participant_injuries', 'police_injuries', 'participant_deaths', 'police_deaths'];
  const idx: Record<string, number> = {};
  for (const w of WANTED) idx[w] = col(w);
  const num = (v: string | undefined) => { const x = Number(v); return Number.isFinite(x) && x !== 0 ? x : undefined; };
  const nz = (v: string, cap = 160) => { const s = (v || '').trim(); return s && s !== 'NA' ? s.slice(0, cap) : undefined; };
  const events = rows.slice(1).flatMap((r) => {
    const lat = Number(r[idx.lat]); const lon = Number(r[idx.lon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const ar = num(r[idx.arrests]);
    const ev = {
      d: (r[idx.date] || '').slice(0, 10),
      t: nz(r[idx.title], 140),
      ty: nz(r[idx.event_type], 60),
      city: nz(r[idx.locality], 60),
      st: nz(r[idx.state], 20),
      lon: Math.round(lon * 1e4) / 1e4,
      lat: Math.round(lat * 1e4) / 1e4,
      s: num(r[idx.size_mean]),
      sb: nz(r[idx.size_text], 60),
      is: nz(r[idx.issues]),
      ar,
      so: nz(r[idx.source1], 240),
      // für das Detail-Panel: Reichweite der Schätzung, Anliegen, Polizei, Schaden, Verletzte, zweite Quelle
      slo: num(r[idx.size_low]),
      shi: num(r[idx.size_high]),
      cl: nz(r[idx.claims_summary], 240),
      pl: nz(r[idx.police_measures], 100),
      dmg: nz(r[idx.property_damage], 60),
      pi: nz(r[idx.participant_injuries], 30),
      poi: nz(r[idx.police_injuries], 30),
      pd: nz(r[idx.participant_deaths], 30),
      pod: nz(r[idx.police_deaths], 30),
      so2: (() => { const a = nz(r[idx.source1], 80); const b = nz(r[idx.source2], 80); return b && b !== a ? b : undefined; })(),
    };
    return [ev];
  });
  if (events.length < 1000) throw new Error(`CCC: nur ${events.length} geortete Events – Download unvollständig?`);
  write('ccc-us.json', {
    built: new Date().toISOString(),
    source: 'Crowd Counting Consortium (Harvard Kennedy School / UConn) – Phase 3, Dataverse DOI 10.7910/DVN/RI9JFU',
    lic: 'CC0 1.0',
    events,
  });
});

// Zivile Schäden in der Ukraine (Bellingcat „Civilian Harm in Ukraine“, TimeMap): öffentliche
// Rohdaten der Karte als JSON (Vorfälle mit Ort, Datum, Auswirkung, Waffensystem und Beleg-Links).
// Lizenz nicht ausdrücklich angegeben – Attribution und Verlinkung zum Original, keine Medien kopiert.
await task('ukraine-harm', DAY, async () => {
  type Row = { id?: string; date?: string; location?: string; latitude?: number; longitude?: number; description?: string; impact?: string[]; weapon_system?: string[]; sources?: string[]; graphic?: boolean };
  const rows = await json<Row[]>('https://bellingcat-embeds.ams3.cdn.digitaloceanspaces.com/production/ukr/timemap/api.json', 120000);
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  const events = rows
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && Math.abs(r.latitude!) <= 90)
    .map((r) => ({
      id: r.id ?? '',
      d: r.date ?? '',
      l: r.location ?? '',
      lat: r5(r.latitude!),
      lon: r5(r.longitude!),
      t: (r.description ?? '').slice(0, 600),
      i: r.impact?.length ? r.impact : undefined,
      w: r.weapon_system?.length ? r.weapon_system : undefined,
      s: (r.sources ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, 8),
      g: r.graphic ? 1 : undefined,
    }));
  if (events.length < 500) throw new Error(`Bellingcat: nur ${events.length} Vorfälle – Datei unvollständig?`);
  write('ukraine-harm.json', {
    built: new Date().toISOString(),
    source: 'Bellingcat – Civilian Harm in Ukraine (ukraine.bellingcat.com)',
    events,
  });
});

// Kiel Ukraine Support Tracker (Institut für Weltwirtschaft): Hilfszusagen/-leistungen je Geberland
// aus der XLSX-Veröffentlichung (Release-Nummer wechselt, daher Link von der Seite lesen). Aus dem Blatt
// „Country Summary (€)“ nehmen wir die zugewiesenen Beträge (allocations, Mrd. €) nach Finanz-,
// humanitärer und militärischer Hilfe. Lizenz nicht ausdrücklich angegeben – Attribution und Link.
await task('ukraine-support', 7 * DAY, async () => {
  const page = await text('https://www.ifw-kiel.de/topics/war-against-ukraine/ukraine-support-tracker/');
  const href = /href="([^"]*Ukraine_Support_Tracker[^"]*\.xlsx)"/.exec(page)?.[1];
  if (!href) throw new Error('Kiel Tracker: kein XLSX-Link auf der Seite');
  const url = new URL(href, 'https://www.ifw-kiel.de/').toString();
  const tmp = join(tmpdir(), 'ukraine-support.xlsx');
  writeFileSync(tmp, Buffer.from(await (await get(url, 240000)).arrayBuffer()));
  const unz = (name: string) => execFileSync('unzip', ['-p', tmp, name], { maxBuffer: 512 * 1024 * 1024 }).toString('utf8');
  try {
    const wb = unz('xl/workbook.xml');
    const rels = unz('xl/_rels/workbook.xml.rels');
    const rid = /<sheet [^>]*name="Country Summary \(€\)"[^>]*r:id="([^"]+)"/.exec(wb)?.[1];
    const target = rid && new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*Target="([^"]+)"|<Relationship [^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels);
    const sheetPath = target && (target[1] ?? target[2]);
    if (!sheetPath) throw new Error('Kiel Tracker: Blatt „Country Summary (€)“ nicht gefunden');
    const strings = [...unz('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    const sheet = unz(`xl/${sheetPath.replace(/^\/?(xl\/)?/, '')}`);
    const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : 0);
    const rows: Record<string, string>[] = [];
    for (const r of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
      const row: Record<string, string> = {};
      for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1];
        if (v === undefined) continue;
        row[c[1]] = c[2].includes('t="s"') ? strings[Number(v)] : v;
      }
      rows.push(row);
    }
    const head = rows.findIndex((r) => r.B === 'Country' && /allocations/i.test(r.E ?? ''));
    if (head < 0) throw new Error('Kiel Tracker: Tabellenkopf nicht gefunden');
    const asOf = /between ([A-Z][a-z]+ \d+, \d{4}) and ([A-Z][a-z]+ \d+, \d{4})/.exec(rows.map((r) => r.B ?? r.A ?? '').join('\n'))?.[2] ?? '';
    // Geber-Positionen: Mittelpunkt des größten Polygons der Landesgrenze (Overrides für Gebiete mit Übersee-Teilen)
    const geo = JSON.parse(readFileSync('public/data/games/countries.json', 'utf8')) as { features: { properties: { en: string }; geometry: { type: string; coordinates: any } }[] };
    const OVERRIDE: Record<string, [number, number]> = {
      'United States of America': [39.8, -98.6], France: [46.6, 2.4], Netherlands: [52.2, 5.3], Norway: [61.0, 9.0], Denmark: [56.0, 10.0],
      'EU (Commission and Council)': [50.85, 4.35], 'European Investment Bank': [49.61, 6.13],
    };
    const ALIAS: Record<string, string> = { 'United States': 'United States of America', Czechia: 'Czech Republic', Turkiye: 'Turkey', China: "People's Republic of China", Korea: 'South Korea' };
    const centre = (name: string): [number, number] | null => {
      const key = ALIAS[name] ?? name;
      if (OVERRIDE[key]) return OVERRIDE[key];
      const f = geo.features.find((x) => x.properties.en === key);
      if (!f) return null;
      const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      let best: [number, number] | null = null, area = -1;
      for (const p of polys) {
        const ring = p[0];
        const xs = ring.map((c) => c[0]), ys = ring.map((c) => c[1]);
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        if (w * h > area) { area = w * h; best = [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2]; }
      }
      return best;
    };
    const countries: { n: string; lat: number; lon: number; fin: number; hum: number; mil: number; tot: number }[] = [];
    const missing: string[] = [];
    for (const r of rows.slice(head + 2)) {
      const n = (r.B ?? '').trim();
      if (!n || !r.E || n === 'Total') continue;
      const tot = num(r.H);
      if (tot <= 0) continue;
      const c = centre(n);
      if (!c) { missing.push(n); continue; }
      countries.push({ n, lat: Math.round(c[0] * 100) / 100, lon: Math.round(c[1] * 100) / 100, fin: num(r.E), hum: num(r.F), mil: num(r.G), tot });
    }
    if (missing.length) console.warn(`  Kiel Tracker: ohne Position: ${missing.join(', ')}`);
    if (countries.length < 20) throw new Error(`Kiel Tracker: nur ${countries.length} Geberländer`);
    write('ukraine-support.json', {
      built: new Date().toISOString(),
      source: 'Kiel Institute for the World Economy – Ukraine Support Tracker',
      xlsx: url,
      asOf,
      countries: countries.sort((a, b) => b.tot - a.tot),
    });
  } finally {
    rmSync(tmp, { force: true });
  }
});

// Hunger im Gazastreifen (IPC Acute Food Insecurity, HDX): Gebiete der aktuellen Analyse als GeoJSON
// plus die Phasenanteile aller Analyse-Zeiträume je Governorate. CC0 / Public Domain. Die HDX-
// Dateien haben nur CORS für data.humdata.org, deshalb als Snapshot.
await task('ipc-gaza', DAY, async () => {
  const base = 'https://data.humdata.org/dataset/a7f087b6-13f9-4426-b8bc-f107397eb073/resource/';
  const geo = await json<{ features: { geometry: unknown; properties: Record<string, string | number | null> }[] }>(`${base}45732a0a-5022-468a-9323-dbb52b6c0953/download/ipc_pse.geojson`);
  const csv = await text(`${base}5c6c32d0-8a39-4d8f-bfef-45b46b17caea/download/ipc_pse_area_long.csv`);
  const lines = csv.trim().split(/\r?\n/);
  const cells = (l: string) => l.split(',');
  const head = cells(lines[0]);
  const col = (n: string) => head.indexOf(n);
  const [cA, cV, cF, cT, cP, cPct, cN, cD] = ['Area', 'Validity period', 'From', 'To', 'Phase', 'Percentage', 'Number', 'Date of analysis'].map(col);
  if ([cA, cV, cF, cT, cP, cPct].some((i) => i < 0)) throw new Error('IPC: unerwartete Spalten');
  type Per = { from: string; to: string; kind: string; analysis: string; p: Record<string, number>; n: Record<string, number> };
  const hist = new Map<string, Map<string, Per>>();
  for (const l of lines.slice(1)) {
    const c = cells(l);
    const area = c[cA];
    if (!area) continue;
    const key = `${c[cF]}|${c[cT]}|${c[cV]}`;
    const m = hist.get(area) ?? new Map<string, Per>();
    const per = m.get(key) ?? { from: c[cF], to: c[cT], kind: c[cV], analysis: c[cD], p: {}, n: {} };
    per.p[c[cP]] = Number(c[cPct]) || 0;
    per.n[c[cP]] = Number(c[cN]) || 0;
    m.set(key, per);
    hist.set(area, m);
  }
  const areas = geo.features.map((f) => {
    const name = String(f.properties.title ?? '');
    const pr = f.properties;
    return {
      name,
      geometry: f.geometry,
      phase: Number(pr.overall_phase) || 0,
      period: String(pr.ipc_period ?? ''),
      pop: Number(pr.estimated_population) || 0,
      shares: [1, 2, 3, 4, 5].map((i) => Number(pr[`phase${i}_percent`]) || 0),
      people: [1, 2, 3, 4, 5].map((i) => Number(pr[`phase${i}_population`]) || 0),
      history: [...(hist.get(name)?.values() ?? [])].sort((a, b) => a.from.localeCompare(b.from)),
    };
  });
  if (areas.length < 3) throw new Error(`IPC: nur ${areas.length} Gebiete`);
  write('ipc-gaza.json', {
    built: new Date().toISOString(),
    source: 'IPC – Integrated Food Security Phase Classification, State of Palestine (via HDX, CC0)',
    areas,
  });
});

// Gaza/Westjordanland aus HDX: Vertreibungs-Ereignisse (IDMC Internal Displacement Updates, CC BY-IGO)
// und Gesundheitseinrichtungen (Healthsites/OpenStreetMap, ODbL). Beide Dateien haben nur CORS für
// data.humdata.org, deshalb als Snapshot (Einrichtungen als Punkt statt Umriss).
await task('gaza-hdx', DAY, async () => {
  const hdx = 'https://data.humdata.org/dataset/';
  // quoted-CSV (Felder mit "…", Kommas und Zeilenumbrüchen)
  const csvRows = (src: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [], cur = '', q = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || row[0]) rows.push(row);
        row = [];
      } else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };
  const csv = csvRows((await text(`${hdx}a641dda7-9b19-4103-b811-76a3963d29d2/resource/e6e48083-1276-4dce-a827-a12b21f3dbac/download/pse_idmc_idu_events.csv`)).replace(/^﻿/, ''));
  const head = csv[0];
  const ix = (n: string) => head.indexOf(n);
  const [iLat, iLon, iFig, iDate, iName, iType, iSub, iSrc, iDesc, iLoc, iKind] = ['latitude', 'longitude', 'figure', 'displacement_date', 'event_name', 'type', 'subtype', 'sources', 'description', 'locations_name', 'displacement_type'].map(ix);
  if ([iLat, iLon, iFig, iDate].some((i) => i < 0)) throw new Error('IDMC: unerwartete Spalten');
  const displacement = csv.slice(1)
    .filter((c) => Number.isFinite(Number(c[iLat])) && Number.isFinite(Number(c[iLon])) && c[iLat] !== '')
    .map((c) => ({
      d: c[iDate], lat: Number(c[iLat]), lon: Number(c[iLon]), f: Number(c[iFig]) || 0,
      l: c[iLoc], t: [c[iType], c[iSub]].filter(Boolean).join(' · '), k: c[iKind], e: c[iName], s: c[iSrc], x: (c[iDesc] ?? '').slice(0, 500),
    }));
  if (displacement.length < 50) throw new Error(`IDMC: nur ${displacement.length} Ereignisse`);
  write('gaza-displacement.json', {
    built: new Date().toISOString(),
    source: 'IDMC Internal Displacement Updates, State of Palestine (via HDX, CC BY-IGO)',
    events: displacement,
  });

  const hs = await json<{ features: { geometry: { type: string; coordinates: any }; properties: Record<string, string | number | null> }[] }>(`${hdx}b73187f1-79c6-4d05-83a3-467a5ffe9a32/resource/e456e100-ed75-4970-87a8-a6a0e086efa0/download/palestinian-territories.geojson`);
  const mid = (g: { type: string; coordinates: any }): [number, number] | null => {
    const pts: number[][] = g.type === 'Point' ? [g.coordinates] : g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : [];
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.round(((Math.min(...xs) + Math.max(...xs)) / 2) * 1e5) / 1e5, Math.round(((Math.min(...ys) + Math.max(...ys)) / 2) * 1e5) / 1e5];
  };
  const places = hs.features.flatMap((f) => {
    const c = mid(f.geometry);
    if (!c) return [];
    const pr = f.properties;
    return [{ lon: c[0], lat: c[1], a: String(pr.amenity || pr.healthcare || ''), n: String(pr.name || pr['name:en'] || ''), o: String(pr.operator || ''), u: pr.osm_type && pr.osm_id ? `https://www.openstreetmap.org/${pr.osm_type}/${pr.osm_id}` : '' }];
  });
  if (places.length < 100) throw new Error(`Healthsites: nur ${places.length} Einrichtungen`);
  write('healthsites-pse.json', {
    built: new Date().toISOString(),
    source: 'Healthsites.io / OpenStreetMap-Mitwirkende (ODbL), via HDX',
    places,
  });
});

// Ukraine: Lage nach Oblast. (1) Insecurity Insight „Explosive Weapons Incident Data“ (HDX, CC BY-SA):
// die Koordinaten sind dort gelöscht („censored“), nutzbar ist die Region (Admin 1) – wir zählen Vorfälle
// je Oblast, Jahr, Sektor und Waffe. (2) Offizielle Luftalarme (Vadimkin/ukrainian-air-raid-sirens-dataset,
// MIT): Alarmstunden je Oblast und Monat. (3) WHO SSA (CC BY, HDX): Angriffe aufs Gesundheitswesen je Monat.
await task('ukraine-oblast', DAY, async () => {
  const hdx = 'https://data.humdata.org/dataset/';
  const norm = (s: string) => s.toLowerCase().replace(/\s*(oblast|city|region)$/, '').replace(/[^a-z]/g, '');
  const ALIAS: Record<string, string> = {
    cherkaska: 'cherkasy', chernihivska: 'chernihiv', chernivetska: 'chernivtsi', dnipropetrovska: 'dnipropetrovsk', donetska: 'donetsk',
    ivanofrankivska: 'ivanofrankivsk', kharkivska: 'kharkiv', khersonska: 'kherson', khmelnytska: 'khmelnytskyi', kirovohradska: 'kirovohrad',
    kyivska: 'kyiv', luhanska: 'luhansk', lvivska: 'lviv', mykolaivska: 'mykolaiv', odeska: 'odessa', odesa: 'odessa', poltavska: 'poltava',
    rivnenska: 'rivne', sumska: 'sumy', ternopilska: 'ternopil', vinnytska: 'vinnytsia', volynska: 'volyn', zakarpatska: 'zakarpattia',
    zaporizka: 'zaporizhzhia', zaporizhia: 'zaporizhzhia', zhytomyrska: 'zhytomyr', beryslavraion: 'kherson', khersonraion: 'kherson', henicheskraion: 'kherson',
  };
  const KYIV_CITY = 'kyivcity';
  /** Schlüssel einer Region: 'kyiv' = Gebiet Kiew, 'kyivcity' = Stadt Kiew (Stadtbezirke → Stadt) */
  const regionKey = (raw: string): string | null => {
    const t = raw.trim();
    if (!t || /no information/i.test(t)) return null;
    if (/^kyiv city$/i.test(t) || /(shevchenkivskyi|pecherskyi|solomianskyi|dniprovskyi|desnianskyi|podilskyi|darnytskyi|holosiivskyi|obolonskyi|sviatoshynskyi) district/i.test(t)) return KYIV_CITY;
    if (/^kyiv$/i.test(t)) return KYIV_CITY;
    const k = norm(t);
    return ALIAS[k] ?? ALIAS[k.replace(/raion$/, 'raion')] ?? k;
  };
  type Reg = { ew: number; year: Record<string, number>; sector: Record<string, number>; weapon: Record<string, number>; killed: Record<string, number>; last: string; air: Record<string, number> };
  const regs = new Map<string, Reg>();
  const reg = (k: string) => {
    let r = regs.get(k);
    if (!r) regs.set(k, (r = { ew: 0, year: {}, sector: {}, weapon: {}, killed: {}, last: '', air: {} }));
    return r;
  };
  const inc = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };

  // (1) Insecurity Insight XLSX (einzelnes Blatt)
  const tmp = join(tmpdir(), 'ukraine-ew.xlsx');
  writeFileSync(tmp, Buffer.from(await (await get(`${hdx}f21002e5-4e00-4c95-bff1-ecd698bf9ff4/resource/22b007ec-7996-4ae5-99eb-aace8dda3da1/download/2020-2026-ukr-explosive-weapons-incident-data.xlsx`, 120000)).arrayBuffer()));
  let unresolved = 0;
  try {
    const unz = (name: string) => execFileSync('unzip', ['-p', tmp, name], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
    const strings = [...unz('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    const sheet = unz('xl/worksheets/sheet1.xml');
    const rows = [...sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
      const row: Record<string, string> = {};
      for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1];
        if (v !== undefined) row[c[1]] = c[2].includes('t="s"') ? strings[Number(v)] : v;
      }
      return row;
    });
    const h = rows[0] ?? {};
    const col = (n: string) => Object.keys(h).find((k) => h[k] === n) ?? '';
    const [cD, cA1, cSec, cWp, cAid, cHe, cEd, cSt] = ['Date', 'Admin 1', 'Sector Affected', 'Explosive Weapon Type', 'Aid Workers Killed', 'Health Workers Killed', 'Educators Killed', 'Students Killed'].map(col);
    if (!cD || !cA1) throw new Error('Insecurity Insight: unerwartete Spalten');
    for (const r of rows.slice(1)) {
      const key = regionKey(r[cA1] ?? '');
      if (!key) { unresolved++; continue; }
      const g = reg(key);
      const iso = new Date(Date.UTC(1899, 11, 30) + Number(r[cD]) * 86400000).toISOString().slice(0, 10);
      g.ew++;
      inc(g.year, iso.slice(0, 4));
      for (const sec of (r[cSec] ?? 'unbekannt').split(',')) inc(g.sector, sec.trim());
      inc(g.weapon, r[cWp] || 'unbekannt');
      inc(g.killed, 'aid', Number(r[cAid]) || 0);
      inc(g.killed, 'health', Number(r[cHe]) || 0);
      inc(g.killed, 'educators', Number(r[cEd]) || 0);
      inc(g.killed, 'students', Number(r[cSt]) || 0);
      if (iso > g.last) g.last = iso;
    }
  } finally {
    rmSync(tmp, { force: true });
  }

  // (2) Luftalarme: nur Oblast-Zeilen (Raion/Hromada würden doppelt zählen), Stunden je Startmonat
  const air = (await text('https://raw.githubusercontent.com/Vadimkin/ukrainian-air-raid-sirens-dataset/main/datasets/official_data_en.csv')).split(/\r?\n/);
  const ah = air[0].split(',');
  const [aO, aL, aS, aF] = ['oblast', 'level', 'started_at', 'finished_at'].map((n) => ah.indexOf(n));
  if ([aO, aL, aS, aF].some((i) => i < 0)) throw new Error('Luftalarme: unerwartete Spalten');
  for (const line of air.slice(1)) {
    const c = line.split(',');
    if (c[aL] !== 'oblast') continue;
    const k = regionKey(c[aO] ?? '');
    const t0 = Date.parse(c[aS].replace(' ', 'T')), t1 = Date.parse(c[aF].replace(' ', 'T'));
    if (!k || !Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) continue;
    inc(reg(k).air, c[aS].slice(0, 7), Math.round(((t1 - t0) / 3600000) * 10) / 10);
  }

  // (3) WHO SSA: Angriffe aufs Gesundheitswesen je Monat (ohne Ortsangabe)
  const who = await text('https://docs.google.com/spreadsheets/d/e/2PACX-1vTDw_w3n9b0_frBtvJWtZTJGb5Bn72sZsjJSRXLhIxMa6I1ZECFjb1LTsTZ0PmIHiQOw4SEPCO4uIFv/pub?gid=1932484940&single=true&output=csv');
  const wl = who.trim().split(/\r?\n/);
  const wh = wl[0].split(',');
  const [wT, wI, wD] = ['ATTACKTIMESTAMP', 'VICTIMSTOTALINJURED', 'VICTIMSTOTALDEATH'].map((n) => wh.indexOf(n));
  const months: Record<string, { attacks: number; killed: number; injured: number }> = {};
  for (const line of wl.slice(1)) {
    // Freitext-Felder enthalten Kommas in Anführungszeichen; die Zählfelder stehen hinter ihnen – deshalb ein quoted-Split
    const c: string[] = [];
    let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch;
    }
    c.push(cur);
    const m = (c[wT] ?? '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const e = (months[m] ??= { attacks: 0, killed: 0, injured: 0 });
    e.attacks++;
    e.killed += Number(c[wD]) || 0;
    e.injured += Number(c[wI]) || 0;
  }

  if (regs.size < 15) throw new Error(`Ukraine-Oblast: nur ${regs.size} Regionen`);
  write('ukraine-oblast.json', {
    built: new Date().toISOString(),
    source: 'Insecurity Insight (CC BY-SA), Vadimkin Luftalarm-Datensatz (MIT), WHO SSA (CC BY) – alle über HDX/GitHub',
    unresolved,
    regions: Object.fromEntries(regs),
    who: months,
  });
});

// ---------------------------------------------------------------------------
// daily

// Submarine telecom cables from OpenStreetMap (ODbL). Replaces the former TeleGeography
// snapshot, whose database is not openly licensed – its old files are removed from the branch.
rmSync(join(OUT, 'cables'), { recursive: true, force: true });
delete meta.tasks.cables;

/** Runs a worldwide Overpass query, trying a second public server when the first one fails. */
async function overpassAll<T>(query: string): Promise<T[]> {
  const errors: string[] = [];
  for (const server of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(660000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { elements: T[] }).elements;
    } catch (e) {
      errors.push(`${new URL(server).host}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(`Overpass – ${errors.join(', ')}`);
}

const ODBL = 'Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nhttps://www.openstreetmap.org/copyright\n';

await task('osm-cables', DAY, async () => {
  const query = `[out:json][timeout:600];(
    way["telecom"="line"]["location"~"underwater|submarine"];
    way["communication"="line"]["location"~"underwater|submarine"];
    way["submarine"="yes"]["telecom"="line"];
    way["seamark:type"="cable_submarine"]["seamark:cable_submarine:category"~"^(fibre_optic|fiber_optic|optical|telephone|telegraph|telecommunication|communication)$"];
  );out tags geom;`;
  type OsmWay = { id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };
  const elements = await overpassAll<OsmWay>(query);
  const PALETTE = ['#9c6bff', '#4fc3f7', '#4db6ac', '#f06292', '#ffb74d', '#aed581', '#7986cb', '#ba68c8'];
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const features = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    if (/power/.test(`${t['seamark:cable_submarine:category'] ?? ''} ${t.power ?? ''}`) || !el.geometry || el.geometry.length < 2) continue;
    const coords: number[][] = [];
    for (const g of el.geometry) {
      const c = [r(g.lon), r(g.lat)];
      const last = coords[coords.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) coords.push(c);
    }
    if (coords.length < 2) continue;
    const name = t.name ?? t['seamark:cable_submarine:name'] ?? t['seamark:name'] ?? '';
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {
        id: el.id,
        name,
        operator: t.operator ?? '',
        since: t.start_date ?? '',
        // one colour per cable name so the segments of a cable match
        color: PALETTE[[...(name || String(el.id))].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PALETTE.length],
      },
    });
  }
  if (features.length < 100) throw new Error(`only ${features.length} cables – Overpass answer incomplete?`);
  write('osm-cables/cables.json', { type: 'FeatureCollection', features });
  write('osm-cables/LICENSE.txt', ODBL);
});

// Data centres from OpenStreetMap (ODbL) as points; the app merges them with PeeringDB's facilities.
// Only name and operator are kept (no contact tags).
await task('osm-datacenters', 7 * DAY, async () => {
  type El = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
  const elements = await overpassAll<El>(`[out:json][timeout:600];(nwr["telecom"="data_center"];nwr["building"="data_center"];);out tags center;`);
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  const features = [];
  for (const el of elements) {
    const pos = el.center ?? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : null);
    if (!pos) continue;
    const t = el.tags ?? {};
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r(pos.lon), r(pos.lat)] },
      properties: { osm: `${el.type}/${el.id}`, name: t.name ?? '', operator: t.operator ?? '', city: t['addr:city'] ?? '' },
    });
  }
  if (features.length < 1000) throw new Error(`only ${features.length} data centres – Overpass answer incomplete?`);
  write('osm-datacenters/datacenters.json', { type: 'FeatureCollection', features });
  write('osm-datacenters/LICENSE.txt', ODBL);
});

await task('volcanoes', DAY, async () => {
  write(
    'volcanoes.json',
    await json('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson'),
  );
});

await task('radio', DAY, async () => {
  type St = { stationuuid: string; name: string; url_resolved: string; homepage?: string; favicon?: string; tags?: string; country?: string; state?: string; language?: string; codec?: string; bitrate?: number; hls?: number; geo_lat?: number | null; geo_long?: number | null; clickcount?: number; lastcheckok?: number };
  let list: St[] | null = null;
  for (const host of ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info']) {
    try {
      list = await json<St[]>(`https://${host}/json/stations/search?has_geo_info=true&hidebroken=true&order=clickcount&reverse=true&limit=100000`, 180000);
      break;
    } catch (e) {
      console.warn(`  radio mirror ${host}: ${e}`);
    }
  }
  if (!list) throw new Error('no Radio Browser mirror reachable');
  const slim = list
    .filter((s) => s.geo_lat != null && s.geo_long != null && s.lastcheckok !== 0 && s.url_resolved)
    .map((s) => ({
      stationuuid: s.stationuuid,
      name: s.name,
      url_resolved: s.url_resolved,
      homepage: s.homepage || undefined,
      favicon: s.favicon || undefined,
      tags: s.tags ? s.tags.split(',').slice(0, 4).join(',') : undefined,
      country: s.country || undefined,
      state: s.state || undefined,
      language: s.language || undefined,
      codec: s.codec || undefined,
      bitrate: s.bitrate || undefined,
      hls: s.hls || undefined,
      geo_lat: Math.round(s.geo_lat! * 1e4) / 1e4,
      geo_long: Math.round(s.geo_long! * 1e4) / 1e4,
      clickcount: s.clickcount || undefined,
    }));
  write('radio/top.json', slim.slice(0, 4000));
  const cells = new Map<string, typeof slim>();
  for (const s of slim) {
    const key = `${Math.floor(s.geo_lat / 10) * 10}_${Math.floor(s.geo_long / 10) * 10}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(s);
  }
  for (const [key, l] of cells) write(`radio/cells/${key}.json`, l);
  console.log(`  ${slim.length} stations in ${cells.size} cells`);
});

await task('mars', 6 * 3600 * 1000, async () => {
  // @ts-expect-error plain JS module shared with the local generator
  const { buildMarsTraverse } = await import('./mars-traverse.mjs');
  const data = await buildMarsTraverse();
  write('mars/traverse.json', data);
  console.log(`  Perseverance ${data.m20.km} km, Curiosity ${data.msl.km} km, ${data.heli.flights.length} Ingenuity flights`);
});

// a feed newly added to SNAPSHOT_CAMS: refresh the camera lists (and the heatmap built from them)
// right away instead of waiting for the daily run. Compared with the feeds the last run knew – not
// with the files, since feeds that fail or need a key never get one.
{
  const { SNAPSHOT_CAMS } = await import('../src/api/camfeeds');
  const added = [...SNAPSHOT_CAMS].filter((id) => !(meta.camFeeds ?? []).includes(id));
  if (added.length) {
    console.log(`  new camera feeds: ${added.join(', ')}`);
    delete meta.tasks.cams;
    delete meta.tasks['cams-world'];
  }
}

await task('cams', DAY, async () => {
  const { CAM_FEEDS, SNAPSHOT_CAMS } = await import('../src/api/camfeeds');
  let ok = 0;
  for (const feed of CAM_FEEDS.filter((f) => SNAPSHOT_CAMS.has(f.id))) {
    try {
      const features = await feed.load();
      if (features.length) {
        write(`cams/${feed.id}.json`, features);
        ok++;
      }
      console.log(`  ${feed.id}: ${features.length}`);
    } catch (e) {
      console.warn(`  ${feed.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!ok) throw new Error('no camera feed reachable');
  meta.camFeeds = [...SNAPSHOT_CAMS].sort();
});

// One merged position list from all camera snapshot files (plus the Finnish Digitraffic
// cameras, which have no snapshot file) for the closeable webcam heatmap: it shows the complete
// camera distribution worldwide at every zoom level. If individual feeds fail, their previous
// snapshot file remains (see PREV copy at the top) and is used here – the heatmap loses no data.
await task('cams-world', DAY, async () => {
  const { loadDigitrafficCams } = await import('../src/api/cams');
  const pts: [number, number][] = [];
  const push = (lon: number, lat: number) => {
    if (Number.isFinite(lon) && Number.isFinite(lat) && (lon || lat)) pts.push([Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4]);
  };
  try {
    for (const f of (await loadDigitrafficCams()).features) push(f.geometry.coordinates[0], f.geometry.coordinates[1]);
  } catch (e) {
    console.warn(`  Digitraffic: ${e instanceof Error ? e.message : e}`);
  }
  const dir = join(OUT, 'cams');
  for (const file of existsSync(dir) ? readdirSync(dir) : []) {
    if (!/\.json$/.test(file) || file === 'world.json') continue;
    try {
      // the snapshot files contain a plain Feature[] (the camFeeds interface), not a FeatureCollection
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { features?: { geometry?: { type: string; coordinates?: number[] } }[] } | { geometry?: { type: string; coordinates?: number[] } }[];
      const list = Array.isArray(raw) ? raw : (raw.features ?? []);
      for (const f of list) if (f.geometry?.type === 'Point') push(f.geometry.coordinates![0], f.geometry.coordinates![1]);
    } catch (e) {
      console.warn(`  ${file}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (pts.length < 500) throw new Error(`only ${pts.length} camera positions`);
  // exact duplicate positions (e.g. same place from two feeds) stay in – the heatmap counts them;
  // for the dots they are harmless
  write('cams/world.json', pts);
  console.log(`  ${pts.length} Kamerapositionen`);
});

// places with Mapillary 360° photos for the panorama game; the long crawl runs once a month
await task('street-panos', 29 * DAY, async () => {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) {
    console.log('  no MAPILLARY_TOKEN secret – skipping');
    return;
  }
  // @ts-expect-error plain JS module shared with the local generator
  const { buildStreetPanos, landTiles } = await import('./street-panos.mjs');
  // the Action runs from the repository root (this file is bundled to ../fetch-data.mjs)
  const countries = JSON.parse(readFileSync(join(process.cwd(), 'public/data/games/countries.json'), 'utf8'));
  const data = await buildStreetPanos({ token, tiles: landTiles(countries), log: (m: string) => console.log(`  ${m}`) });
  if (data.points.length < 1000) throw new Error(`only ${data.points.length} points – keeping previous data`);
  write('street/panos.json', data);
  console.log(`  ${data.points.length} points`);
});

meta.updated = new Date().toISOString();
write('meta.json', meta);
