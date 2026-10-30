// Builds public/data/geldfluesse.json for the "Geldflüsse" layer.
//
// Source: "The Entire Network", Who Funded Genocide (https://whofundedgenocide.com/map/),
// research in collaboration with Wallface, CC BY 4.0. Every row there cites the public register it comes from.
//
// Only what the tables state is drawn: an arc exists where a register itemises money (or a chapter of a
// parent body) between two countries. Money is never added across currencies, and where a register names no destination
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

const sources = (ls) => [...new Set(ls.flatMap((l) => l.source_ids.split(/\s+/)).filter(Boolean))];
const arcs = [];
// per currency, never across currencies
const totals = (ls) => {
  const t = new Map();
  for (const l of ls) t.set(l.currency, (t.get(l.currency) ?? 0) + (Number(l.amount) || 0));
  return [...t].map(([currency, amount]) => ({ currency, amount: Math.round(amount) }));
};

// Canada -> Israel: the Canadian charity returns state money sent to recipients in Israel (sector -> recipient lines)
const canada = links.filter((l) => l.board === 'charity' && l.from_entity_id.startsWith('sec-') && l.currency === 'CAD' && l.measure === 'received');
arcs.push({
  from: 'Canada', to: 'Israel', cls: 'money', amounts: totals(canada), lines: canada.length,
  label: 'Money sent, as the return states it',
  text: 'Gifts from Canadian registered charities to recipients in Israel, as filed in their annual returns.',
  sources: sources(canada),
});

// Israeli principals (and Havas Media Germany, the hub of the dollar contracts) -> US foreign-agent registrants (FARA).
// Grouped by the board's own line class; the three classes are never added together, nor are currencies.
const CLS = { 'Money the record says moved': 'money', 'Ordered or contracted': 'ordered', 'An approved ceiling — a maximum': 'ceiling' };
const groups = new Map();
for (const l of links) {
  if (l.board !== 'chain' || !CLS[l.what_the_line_says] || !l.currency) continue;
  const from = byId.get(`chain/${l.from_entity_id}`);
  const to = byId.get(`chain/${l.to_entity_id}`);
  if (!['State body', 'Agency'].includes(from.kind) || to.kind !== 'FARA registrant') continue;
  const origin = from.name.startsWith('Havas Media Germany') ? 'Germany' : 'Israel';
  const key = [origin, CLS[l.what_the_line_says]].join('|');
  (groups.get(key) ?? groups.set(key, []).get(key)).push(l);
}
for (const [key, ls] of groups) {
  const [from, cls] = key.split('|');
  const targets = [...new Set(ls.map((l) => l.to_name))];
  arcs.push({
    from, to: 'United States', cls, amounts: totals(ls), lines: ls.length,
    label: ls[0].what_the_line_says,
    text: `${targets.length} US foreign-agent registrants named in the filings, e.g. ${targets.slice(0, 3).join(', ')}.`,
    sources: sources(ls),
  });
}

// Parent bodies -> their national chapters (no money, a record that names them together)
const HQ = { Jerusalem: 'Israel', 'Tel Aviv': 'Israel', Haifa: 'Israel', Rehovot: 'Israel', 'Beer Sheva': 'Israel', 'Washington DC': 'United States', 'Los Angeles': 'United States', 'San Antonio': 'United States' };
const struct = new Map();
for (const l of links) {
  if (l.board !== 'orgs' || l.what_the_line_says !== 'A national chapter of the parent body') continue;
  const parent = byId.get(`orgs/${l.from_entity_id}`);
  const home = HQ[parent.subtitle.split(' · ')[0]];
  const cl = links.find((k) => k.board === 'orgs' && k.from_entity_id === l.to_entity_id && k.what_the_line_says === 'Registered in this country');
  const country = cl && byId.get(`orgs/${cl.to_entity_id}`).name;
  if (!home || !country || country === home || !countries.has(country)) continue;
  const key = `${home}|${country}`;
  const g = struct.get(key) ?? struct.set(key, { parents: new Set(), n: 0, src: [] }).get(key);
  g.parents.add(parent.name);
  g.n++;
  g.src.push(l, cl);
}
for (const [key, g] of struct) {
  const [from, to] = key.split('|');
  arcs.push({
    from, to, cls: 'structure', lines: g.n, label: 'A national chapter of the parent body',
    text: `${g.n} national chapters of ${[...g.parents].slice(0, 4).join('; ')}${g.parents.size > 4 ? ` and ${g.parents.size - 4} more` : ''}.`,
    sources: sources(g.src),
  });
}
for (const a of arcs) if (!countries.has(a.from) || !countries.has(a.to)) throw new Error(`no coordinates for ${a.from} / ${a.to}`);

const out = {
  credit: '"The Entire Network." Who Funded Genocide. https://whofundedgenocide.com/map/ Licensed CC BY 4.0. Research in collaboration with Wallface.',
  countries: [...countries.values()],
  arcs,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`${out.countries.length} countries, ${arcs.length} arcs`);
for (const a of arcs) console.log(`  ${a.cls.padEnd(9)} ${a.from} -> ${a.to} ${(a.amounts ?? []).map((m) => m.currency + ' ' + m.amount).join(', ')} (${a.lines})`);
