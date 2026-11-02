// Pre-builds the "Quellen" dataset for the Zeitzeugen-Karte (sources of the Archive Genocide
// footage). The archive lists its collectors on one static page; we lift the structured cards
// (archive sources + websites/databases) into a small JSON that the app reads directly.
//
// Für die Karten-Marker ("Quellen auf der Karte") werden je Archivquelle zusätzlich ein
// geografischer Schwerpunkt und Kennzahlen aus den Geolocation-Daten berechnet: Die Pins und
// Punkte der Karte liefern id → Lage, die 512 Clip-Buckets (id % 512, ~60 kB je Bucket)
// liefern Herkunft (`a`) und Datum. Quellen ohne verortete Clips bekommen keinen Marker.
//
// Outputs: public/data/gazasources.json
//
// Usage: node scripts/gazasources.mjs    (Node >= 18; ~35 MB Download, einmalig)
//
// Daten: © archivegenocide.com – Quellenliste und Geolocation-Karte des Archivs

import { writeFileSync, mkdirSync } from 'node:fs';

const PAGE = 'https://archivegenocide.com/sources.html';
const OUT = 'public/data/gazasources.json';
const BUCKETS = 512;
const GEO = 'https://archivegenocide.com/geolocation/data/';
const HEADERS = { 'User-Agent': 'Orbis-sources-builder/1.0 (https://github.com/malte9799/orbis)' };
const CONCURRENCY = 8;
const LATEST = 6;
const MIN_PLACE = 3; // darunter ist der geografische Schwerpunkt zu dünn

const unesc = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** inner text of the first element with the class inside the block */
const text = (block, sel) => {
  const m = new RegExp(`class="${sel}"[^>]*>([\\s\\S]*?)<`).exec(block);
  return m ? unesc(m[1]) : '';
};

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Titel einer Caption: der archivseitige Text vor [Original post], erste eigene Zeile */
const titleOf = (c) => {
  const head = String(c ?? '').split('[Original post]')[0];
  const line = head.split('\n').find((x) => x.trim()) ?? head;
  return unesc(line ?? '').slice(0, 80);
};

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await fn(items[idx]);
      } catch { /* ein Bucket darf fehlen */ }
    }
  });
  await Promise.all(workers);
}

const main = async () => {
  console.log('→ Quellenliste (archivegenocide.com/sources.html) …');
  const html = await (await fetch(PAGE, { headers: HEADERS })).text();

  const sources = [];
  const secEnd = (m) => {
    // Ende = der Beginn des nächsten Karten-/Sektions-Stücks (deck auch doppelte </div> ab)
    let end = Math.min(m.index + 1400, html.length);
    for (const pat of ['class="arch-card', 'class="web-card', 'class="src-section', 'id="sec-']) {
      const j = html.indexOf(pat, m.index + 10);
      if (j > 0 && j < end) end = j;
    }
    return end;
  };
  for (const m of html.matchAll(/<(a|div)[^>]*class="arch-card[^"]*"(?:\s+href="([^"]+)")?[^>]*>/g)) {
    const b = html.slice(m.index, secEnd(m));
    if (!text(b, 'arch-name')) continue;
    sources.push({
      name: text(b, 'arch-name'),
      platform: unesc(/class="plat">([\s\S]*?)<\/span>/.exec(b)?.[1] ?? ''),
      count: unesc(/·\s*([\d.,]+\s*items)/.exec(b)?.[1] ?? ''),
      note: text(b, 'arch-note'),
      url: m[2] ?? '',
    });
  }
  const websites = [];
  for (const m of html.matchAll(/<div[^>]*class="web-card[^"]*"[^>]*>/g)) {
    const next = html.indexOf('web-card', m.index + 40);
    const b = next > 0 ? html.slice(m.index, next) : html.slice(m.index, m.index + 900);
    websites.push({
      tag: text(b, 'web-tag'),
      domain: text(b, 'web-domain'),
      desc: text(b, 'web-desc'),
      url: /class="web-link" href="([^"]+)"/.exec(b)?.[1] ?? '',
    });
  }
  if (!sources.length || !websites.length) throw new Error('keine Karten gefunden – Seitenstruktur geändert?');

  // ------------- verortete Clips je Quelle -----------------------------------
  console.log('→ Lage der verorteten Clips (pins.json + dots.json) …');
  const [pins, dots] = await Promise.all(
    ['pins.json', 'dots.json'].map(async (f) => {
      const r = await fetch(GEO + f, { headers: HEADERS });
      if (!r.ok) throw new Error(`HTTP ${r.status} – ${f}`);
      return r.json();
    }),
  );
  /** clip-id → { lon, lat, exact } */
  const placed = new Map();
  for (const p of pins) placed.set(p[0], { lon: p[1], lat: p[2], exact: true });
  for (const d of dots) if (!placed.has(d[0])) placed.set(d[0], { lon: d[1], lat: d[2], exact: false });
  console.log(`  ${placed.size} verortete Clip-ids`);

  const keys = sources.map((s) => ({ key: norm(s.name), name: s.name })).filter((k) => k.key.length >= 3);
  const agg = new Map(sources.map((s) => [s.name, { n: 0, exact: 0, sx: 0, sy: 0, last: '', latest: [] }]));
  let other = 0;
  let matched = 0;

  console.log('→ alle Clip-Buckets scannen (id % 512) …');
  await pool(Array.from({ length: BUCKETS }, (_, i) => i), CONCURRENCY, async (i) => {
    const r = await fetch(`${GEO}clips/${String(i).padStart(2, '0')}.json`, { headers: HEADERS });
    if (!r.ok) throw new Error(`HTTP ${r.status} – Bucket ${i}`);
    const bucket = await r.json();
    for (const name of Object.keys(bucket)) {
      const p = placed.get(Number(name));
      if (!p) continue;
      const clip = bucket[name];
      const a = norm(clip.a);
      const hit = keys.find((k) => a.startsWith(k.key) || k.key.startsWith(a));
      if (!hit) {
        other++;
        continue;
      }
      matched++;
      const st = agg.get(hit.name);
      if (!st) continue;
      st.n++;
      if (p.exact) st.exact++;
      if (Number.isFinite(p.lon) && Number.isFinite(p.lat)) {
        st.sx += p.lon;
        st.sy += p.lat;
      }
      const d = String(clip.d ?? '');
      if (d > st.last) st.last = d;
      if (d) st.latest.push({ d, t: titleOf(clip.c), id: Number(name), cat: String(clip.cat ?? '') });
    }
  });

  const featured = sources.map((s) => {
    const st = agg.get(s.name);
    if (!st || st.n < MIN_PLACE) return null;
    return {
      name: s.name,
      platform: s.platform,
      url: s.url,
      note: s.note,
      items: s.count,
      lon: Math.round((st.sx / st.n) * 1e4) / 1e4,
      lat: Math.round((st.sy / st.n) * 1e4) / 1e4,
      exact: st.exact,
      approx: st.n - st.exact,
      last: st.last,
      latest: st.latest.sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, LATEST),
    };
  });

  const out = {
    built: new Date().toISOString().slice(0, 10),
    source: 'archivegenocide.com/sources.html + geolocation-Daten (Schwerpunkte)',
    sources,
    websites,
    placed: featured.filter(Boolean),
  };
  mkdirSync('public/data', { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, (k, v) => (v === undefined ? '' : v), 1)}\n`);
  console.log(`✓ ${OUT}: ${sources.length} Archivquellen (${out.placed.length} mit Lage), ${websites.length} Webquellen · ${matched} verortete Clips je Quelle zugeordnet, ${other} ohne Treffer`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
