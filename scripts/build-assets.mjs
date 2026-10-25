// Katalogisiert alle Grafik-Assets im Repo und schreibt public/data/assets.json.
// Die statische Seite /assets/ liest diese Datei und zeigt jede Grafik als Vorschau.
// Aufruf: npm run assets (läuft auch automatisch im build).
//
// Erfasst wird zweierlei:
//  a) SVG-Dateien im Repo (unter public/ ausgeliefert, sonst nur im Repo)
//  b) Inline-SVGs, die direkt im Quellcode stehen: `<svg …>`-Literale in *.ts/*.html
//     sowie SVG-Pfad-Definitions-Maps (`name: 'M12 3 …'`), aus denen Icons erzeugt werden.
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'data', 'assets.json');
const SKIP = new Set(['.git', 'node_modules', '.github', 'dist']);
const EXTS = ['.svg'];
const SRC_EXTS = ['.ts', '.html']; // Quellen für Inline-SVGs

const GROUP_LABELS = {
  public: 'App-Symbole',
  'data/games/flags': 'Flaggen (Spiele)',
  'data/games/previews/regions': 'Regionen-Vorschauen (Spiele)',
  'data/games/previews': 'Karten-Vorschauen (Spiele)',
  docs: 'Banner & Dokumentation (nicht ausgeliefert)',
};

/** viewBox/width/height aus einem SVG-String lesen */
function svgInfo(source) {
  const open = source.slice(0, source.indexOf('>') + 1);
  const pick = (name) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`).exec(open);
    return m ? m[1] : undefined;
  };
  const viewBox = pick('viewBox');
  let w = pick('width');
  let h = pick('height');
  if (viewBox && (!w || !h)) {
    const p = viewBox.trim().split(/[\s,]+/);
    w ??= p[2];
    h ??= p[3];
  }
  return { viewBox, width: w ? Math.round(parseFloat(w)) : undefined, height: h ? Math.round(parseFloat(h)) : undefined };
}

/**
 * Macht ein Inline-SVG mit Template-Interpolationen (`${…}`) als statische Vorschau darstellbar:
 * Dimensionen bekommen Platzhalterwerte, alles andere wird Leerstring.
 */
function previewSvg(svg, dynamic) {
  if (!dynamic) return svg;
  return svg
    .replace(/(viewBox=")[^"]*\$\{[^"]*"/g, '$10 0 24 24"')
    .replace(/\b(width|height)="[^"]*\$\{[^"]*"/g, '$1="64"')
    .replace(/\bstroke-width="[^"]*\$\{[^"]*"/g, 'stroke-width="2"')
    .replace(/\$\{[^}]*\}/g, '');
}

/** Inline-SVGs ( Literale ) in einer Quelldatei finden. Liefert Assets mit `svg`-Markup. */
function scanInlineSvgs(file, text) {
  const out = [];
  const re = /<svg(?=[\s>])|<\/svg>/g; // balanciert über verschachtelte <svg> hinweg zählen
  let start = -1;
  let depth = 0;
  const line = (index) => text.slice(0, index).split('\n').length;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (start === -1) {
      start = m.index;
      depth = 1;
    } else {
      depth += m[0] === '</svg>' ? -1 : 1;
      if (depth > 0) continue;
      const seg = text.slice(start, m.index + m[0].length);
      const isDynamic = /\$\{/.test(seg);
      // Name ableiten: aria-label > <title> > title="…" > vorheriger const/Klassenname
      const label = /aria-label="([^"]+)"/.exec(seg)?.[1] ?? /<title>([^<]*)<\/title>/.exec(seg)?.[1] ?? /[\s"\[]title="([^"]+)"/.exec(seg)?.[1];
      const before = text.slice(Math.max(0, start - 600), start);
      const decl = [...before.matchAll(/(?:const|let|function|class)\s+([\w$]+)/g)].at(-1)?.[1];
      const cls = [...before.matchAll(/[\s"]class="([^"]+)"/g)].at(-1)?.[1];
      const name = (label ?? decl ?? cls ?? '').replace(/\$\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim() || `${file} · Zeile ${line(start)}`;
      const { viewBox, width, height } = svgInfo(seg);
      out.push({
        path: file, quelle: file, zeile: line(start), name,
        group: `inline:${file}`, url: null, bytes: seg.length,
        dynamic: isDynamic, svg: previewSvg(seg, isDynamic), viewBox, width, height,
      });
      start = -1;
    }
  }
  return out;
}

/** Einträge wie `drop: 'M12 3s6 …'` (SVG-Pfad-Daten mit Namen) finden → synthetische Icon-SVGs. */
function scanIconPaths(file, text) {
  const out = [];
  const re = /(?:^|[,{(\n]\s*)([\w$]+)\s*:\s*(?:'([^'\n]{6,2000})'|"([^"\n]{6,2000})")/g;
  for (const m of text.matchAll(re)) {
    const [, key, sv, dq] = m;
    const value = sv ?? dq;
    if (key === 'd' || !/^[MLHVCSQTA][\s\d.,]/.test(value)) continue; // nur echte Pfad-Daten, benannte Keys
    const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${value}"/></svg>`;
    out.push({
      path: file, quelle: file, zeile: text.slice(0, m.index).split('\n').length, name: key,
      group: `inline:${file}`, url: null, bytes: value.length, dynamic: false, svg,
    });
  }
  return out;
}

async function walk(dir, out = [], srcs = []) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (full === OUT) continue;
    if (entry.isDirectory()) await walk(full, out, srcs);
    else if (EXTS.some((ext) => entry.name.toLowerCase().endsWith(ext))) out.push(full);
    else if (SRC_EXTS.some((ext) => entry.name.endsWith(ext))) srcs.push(full);
  }
  return { files: out, srcs };
}

const { files, srcs } = await walk(ROOT);

const fileAssets = await Promise.all(
  files.map(async (full) => {
    const path = relative(ROOT, full).split(sep).join('/');
    const [source, info] = await Promise.all([readFile(full, 'utf8'), stat(full)]);
    const servedPath = path.startsWith('public/') ? path.slice('public/'.length) : null;
    const dirKey = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const groupKey = Object.keys(GROUP_LABELS).find((k) => dirKey === k || dirKey === `public/${k}`) ?? dirKey;
    return {
      path,
      // URL-Pfad (relativ zum Base-Path der App); null = liegt im Repo, wird aber nicht ausgeliefert
      url: servedPath,
      name: path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, ''),
      group: groupKey,
      bytes: info.size,
      ...svgInfo(source),
    };
  }),
);

const srcRoots = [...srcs.filter((f) => f.endsWith('index.html')), ...srcs.filter((f) => relative(ROOT, f).startsWith('src'))];
const inlineAssets = (
  await Promise.all(
    srcRoots.map(async (full) => {
      const file = relative(ROOT, full).split(sep).join('/');
      const text = await readFile(full, 'utf8');
      return [...scanInlineSvgs(file, text), ...scanIconPaths(file, text)];
    }),
  )
).flat().sort((a, b) => a.path.localeCompare(b.path) || a.zeile - b.zeile || String(a.name).localeCompare(String(b.name)));

const allAssets = [...fileAssets, ...inlineAssets];

const byGroup = new Map();
for (const a of allAssets) {
  const list = byGroup.get(a.group) ?? [];
  list.push(a);
  byGroup.set(a.group, list);
}

const groups = [...byGroup.entries()]
  .map(([key, list]) => ({
    id: key.replace(/[^\w/-]+/g, '-') ?? key,
    label: key.startsWith('inline:') ? (key === 'inline:index.html' ? 'Inline · index.html' : `Inline · ${key.slice(7)}`) : GROUP_LABELS[key] ?? key.replace(/^public\//, ''),
    kind: key.startsWith('inline:') ? 'inline' : 'file',
    served: list.every((a) => a.url !== null),
    count: list.length,
    bytes: list.reduce((sum, a) => sum + a.bytes, 0),
    files: list.sort((a, b) => a.path.localeCompare(b.path)),
  }))
  .sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === 'file' ? -1 : 1));

const doc = {
  generated: new Date().toISOString(),
  total: allAssets.length,
  bytes: fileAssets.reduce((sum, a) => sum + a.bytes, 0),
  groups,
};

await writeFile(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`assets.json: ${allAssets.length} Einträge in ${groups.length} Gruppen (${fileAssets.length} Dateien, ${inlineAssets.length} Inline-SVGs) → ${relative(ROOT, OUT)}`);
