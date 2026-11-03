// Große statische Dateien (models/, textures/, data/airports, data/incidents, data/games) können aus einem eigenen
// Bucket kommen (VITE_ASSETS_BASE, z. B. https://assets.<domain>). Ohne Angabe – auch bei lokalem `pnpm dev` –
// bleibt es bei den Dateien aus public/ relativ zur Seite.
// Mit Bucket und Manifest (scripts/assets-manifest.mjs, beim Build erzeugt) werden die Pfade auf inhaltsgehashte,
// unveränderliche Schlüssel abgebildet (models/iss.<hash>.glb). Unbekannte Pfade bleiben beim Klartext-Pfad.

const ASSETS_BASE = String(import.meta.env?.VITE_ASSETS_BASE || '').replace(/\/+$/, '');

// optional (gitignored, generated): import.meta.glob yields {} when the file does not exist
const found = import.meta.glob<Record<string, string>>('./generated/assets-manifest.json', { eager: true, import: 'default' });
const MANIFEST: Record<string, string> = Object.values(found)[0] ?? {};

const warned = new Set<string>();

/** Pure mapping (testable): hashed path for a logical path, or the plain path when unknown. */
export function resolveAssetPath(path: string, manifest: Record<string, string>, warn?: (p: string) => void): string {
  const p = path.replace(/^\.?\//, '');
  const hashed = manifest[p];
  if (hashed) return hashed;
  if (Object.keys(manifest).length && warn && !warned.has(p)) {
    warned.add(p);
    warn(p);
  }
  return p;
}

/** URL einer Datei unter public/, z. B. assetUrl('textures/moonmap2k.jpg') */
export function assetUrl(path: string): string {
  if (!ASSETS_BASE) return `${import.meta.env?.BASE_URL ?? './'}${path.replace(/^\.?\//, '')}`;
  const p = resolveAssetPath(path, MANIFEST, import.meta.env?.DEV ? (x) => console.warn(`assetUrl: "${x}" not in assets manifest, using plain path`) : undefined);
  return `${ASSETS_BASE}/${p}`;
}
