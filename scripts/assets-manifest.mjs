// Content-hashed names for the big static assets (see src/assets.ts, deploy.yml "Upload assets to R2").
// Writes src/generated/assets-manifest.json: logical path ("models/iss.glb") -> hashed path ("models/iss.<hash>.glb").
// Only active with VITE_ASSETS_BASE (env or .env*): without it the manifest is {} and all paths stay plain (local dev).
// Run before `vite build` (package.json "build"); `--force` writes the full manifest regardless of the variable.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// same list as the "Upload assets to R2" step in .github/workflows/deploy.yml
export const ASSET_DIRS = ['models', 'textures', 'data/airports', 'data/incidents', 'data/games', 'data/plastik', 'data/drifters', 'data/currents'];
const HASH_LEN = 12;
const OUT = join(root, 'src/generated/assets-manifest.json');

function walk(dir, rel, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = join(dir, e.name);
    const r = posix.join(rel, e.name);
    if (e.isDirectory()) walk(abs, r, out);
    else if (e.isFile()) out.push(r);
  }
}

function hashFile(abs) {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    createReadStream(abs)
      .on('data', (c) => h.update(c))
      .on('end', () => res(h.digest('hex').slice(0, HASH_LEN)))
      .on('error', rej);
  });
}

export function hashedName(path, hash) {
  const ext = extname(path);
  return `${path.slice(0, path.length - ext.length)}.${hash}${ext}`;
}

function assetsBaseConfigured() {
  if (process.env.VITE_ASSETS_BASE) return true;
  for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const p = join(root, f);
    if (existsSync(p) && /^\s*VITE_ASSETS_BASE\s*=\s*\S/m.test(readFileSync(p, 'utf8'))) return true;
  }
  return false;
}

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });
  if (!process.argv.includes('--force') && !assetsBaseConfigured()) {
    writeFileSync(OUT, '{}\n');
    console.log('assets-manifest: VITE_ASSETS_BASE not set -> empty manifest (plain asset paths)');
    return;
  }
  const files = [];
  for (const d of ASSET_DIRS) {
    const abs = join(root, 'public', d);
    if (existsSync(abs)) walk(abs, d, files);
  }
  files.sort();
  const manifest = {};
  for (const f of files) manifest[f] = hashedName(f, await hashFile(join(root, 'public', f)));
  writeFileSync(OUT, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`assets-manifest: ${files.length} files hashed`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
