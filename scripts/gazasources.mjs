// Pre-builds the "Quellen" dataset for the Zeitzeugen-Karte (sources of the Archive Genocide
// footage). The archive lists its collectors on one static page; we lift the structured cards
// (archive sources + websites/databases) into a small JSON that the menu reads from the app
// itself – instead of scraping the page at runtime.
//
// Output: public/data/gazasources.json
//
// Usage: node scripts/gazasources.mjs    (Node >= 18)
//
// Data: © archivegenocide.com (Quellenliste der Archive)

import { writeFileSync, mkdirSync } from 'node:fs';

const PAGE = 'https://archivegenocide.com/sources.html';
const OUT = 'public/data/gazasources.json';
const HEADERS = { 'User-Agent': 'Orbis-sources-builder/1.0 (https://github.com/malte9799/orbis)' };

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

const main = async () => {
  const html = await (await fetch(PAGE, { headers: HEADERS })).text();

  const sources = [];
  for (const m of html.matchAll(/<(a|div)[^>]*class="arch-card[^"]*"(?:\s+href="([^"]+)")?[^>]*>/g)) {
    const close = m[1] === 'a' ? '</a>' : '</div>';
    const stop = html.indexOf(close, m.index + m[0].length);
    const b = html.slice(m.index + m[0].length, stop < 0 ? undefined : stop);
    if (!b.trim()) continue;
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
    // the card ends where the next card section continues; the link row sits at its very end
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
  mkdirSync('public/data', { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'archivegenocide.com/sources.html', sources, websites }, null, 1)}\n`);
  console.log(`✓ ${OUT}: ${sources.length} Archivquellen, ${websites.length} Webquellen`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
