/** Key-parity check for the Orbis i18n catalogs (see src/i18n/README.md).
 *  Fails when `en` is missing a key of `de` (the source of truth), when `en`
 *  has stale keys, or when `{param}` placeholders diverge between the catalogs.
 *  Wired into `pnpm typecheck` and `pnpm build`. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(ROOT, 'src', 'i18n', 'locales');
const PLACEHOLDER = /\{(\w+)\}/g;

/** de/<feature>.json + en/<feature>.json are merged per language, mirroring src/i18n/index.ts */
function loadCatalog(lang) {
  const dir = path.join(LOCALES, lang);
  const catalog = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const slice = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    for (const [ns, obj] of Object.entries(slice)) {
      if (ns in catalog) throw new Error(`[${lang}/${file}] namespace "${ns}" already exists in another file`);
      if (typeof obj !== 'object' || obj === null) throw new Error(`[${lang}/${file}] namespace "${ns}" must be an object`);
      catalog[ns] = obj;
    }
  }
  return catalog;
}

/** flat list of leaf messages; a plural entry counts as one leaf with N texts */
function leaves(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      out.push(...leaves(v, key));
    } else if (typeof v === 'string') {
      out.push({ key, value: v });
    } else {
      throw new Error(`invalid leaf at "${key}": ${JSON.stringify(v)} (use a string)`);
    }
  }
  return out;
}

const de = loadCatalog('de');
const en = loadCatalog('en');
const deMap = new Map(leaves(de).map((l) => [l.key, l.value]));
const enMap = new Map(leaves(en).map((l) => [l.key, l.value]));
const placeholders = (s) => [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort().join(',');

const errors = [];
let empty = 0;

for (const [key, value] of deMap) {
  if (!value) {
    empty += 1;
    continue; // empty de text allowed as a work-in-progress marker
  }
  const enValue = enMap.get(key);
  if (enValue == null) {
    errors.push(`missing in en: ${key} ("${value}")`);
    continue;
  }
  if (placeholders(value) !== placeholders(enValue)) {
    errors.push(`placeholders differ for ${key}: de={${placeholders(value)}} en={${placeholders(enValue)}}`);
  }
}
for (const key of enMap.keys()) if (!deMap.has(key)) errors.push(`stale in en (not in de): ${key}`);

// sanity: keys stay dotted identifiers, so the generate MessageKey type always works
for (const key of deMap.keys()) {
  if (!/^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/.test(key)) errors.push(`invalid key "${key}" (use [a-z0-9] segments, dots between)`);
}

if (empty) console.warn(`⚠  i18n: ${empty} empty de text(s) (work in progress)`);
if (errors.length) {
  console.error(`✗  i18n: ${errors.length} catalog problem(s):\n${errors.map((e) => `   - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`✓  i18n: ${deMap.size} messages, de/en in sync`);
