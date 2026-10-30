// Builds public/data/geldfluesse.json for the "Geldflüsse" layer.
//
// Source: "The Entire Network", Who Funded Genocide (https://whofundedgenocide.com/map/),
// research in collaboration with Wallface, CC BY 4.0. Every row there cites the public register it comes from.
//
// Only what the tables state is drawn: an arc exists where a register itemises money from one country
// to another. Money is never added across currencies, and where a register names no destination
// (Australian "grants outside Australia") there is a country point but no arc.
//
// Usage: node scripts/geldfluesse.mjs
// Requires Node >= 18 (global fetch).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://whofundedgenocide.com/map/data/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'geldfluesse.json');

/** Minimal CSV parser (quoted fields, doubled quotes, any delimiter). */
function parseCsv(text, delim = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) (row.push(field), (field = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) (row.push(field), rows.push(row));
  const head = rows.shift().map((h) => h.replace(/^﻿/, '').trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const get = async (name) => {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${name}`);
  return res.text();
};

// country centroids (lat, lon) for the countries the tables name
const COORD = {
  Canada: [56.1, -106.3], Australia: [-25.3, 133.8], 'United Kingdom': [54.0, -2.5], 'New Zealand': [-41.0, 174.0],
  Israel: [31.4, 35.0], 'United States': [39.8, -98.6], 'European Union': [50.1, 9.0], Germany: [51.2, 10.4],
  France: [46.6, 2.3], Argentina: [-34.6, -64.0], Brazil: [-10.8, -52.9], Colombia: [4.6, -74.1],
};

const entities = parseCsv(await get('the-entire-network-entities.csv'));
const links = parseCsv(await get('the-entire-network-links.csv'));

const byId = new Map(entities.map((e) => [`${e.board}/${e.entity_id}`, e]));
const countries = new Map();
for (const e of entities) {
  if (e.kind !== 'Country' || !COORD[e.name]) continue;
  const c = countries.get(e.name) ?? { name: e.name, lat: COORD[e.name][0], lon: COORD[e.name][1], notes: [] };
  c.notes.push(`${e.board_title}: ${e.subtitle || e.what_the_record_says.slice(0, 120)}`.trim());
  countries.set(e.name, c);
}

// Canada -> Israel: the Canadian charity returns state money sent to recipients in Israel (sector -> recipient lines)
const canada = links.filter((l) => l.board === 'charity' && l.from_entity_id.startsWith('sec-') && l.currency === 'CAD' && l.measure === 'received');
const sum = canada.reduce((s, l) => s + (Number(l.amount) || 0), 0);
const arcs = [
  {
    from: 'Canada',
    to: 'Israel',
    currency: 'CAD',
    amount: Math.round(sum),
    lines: canada.length,
    measure: 'Money sent, as the return states it',
    text: 'Gifts from Canadian registered charities to recipients in Israel, as filed in their annual returns.',
    sources: [...new Set(canada.flatMap((l) => l.source_ids.split(/\s+/)).filter(Boolean))],
  },
];
for (const a of arcs) if (!countries.has(a.from) || !countries.has(a.to)) throw new Error(`no coordinates for ${a.from} / ${a.to}`);

const out = {
  credit: '"The Entire Network." Who Funded Genocide. https://whofundedgenocide.com/map/ Licensed CC BY 4.0. Research in collaboration with Wallface.',
  countries: [...countries.values()],
  arcs,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`${out.countries.length} countries, ${arcs.length} arc(s); Canada -> Israel = C$${sum.toLocaleString('en')} over ${canada.length} lines`);
