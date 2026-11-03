// Große statische Dateien (models/, textures/, data/airports, data/incidents, data/games) können aus einem eigenen
// Bucket kommen (VITE_ASSETS_BASE, z. B. https://assets.<domain>). Ohne Angabe – auch bei lokalem `pnpm dev` –
// bleibt es bei den Dateien aus public/ relativ zur Seite.

const ASSETS_BASE = String(import.meta.env?.VITE_ASSETS_BASE || '').replace(/\/+$/, '');

/** URL einer Datei unter public/, z. B. assetUrl('textures/moonmap2k.jpg') */
export function assetUrl(path: string): string {
  const p = path.replace(/^\.?\//, '');
  return ASSETS_BASE ? `${ASSETS_BASE}/${p}` : `${import.meta.env?.BASE_URL ?? './'}${p}`;
}
