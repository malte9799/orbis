import type { ExtraDef, ExtraId, SectionId } from './types';

export type { CatId, ExtraDef, ExtraId, SectionId } from './types';

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'europe', title: 'Europa & Messwerte' },
  { id: 'earth', title: 'Erde & Umwelt' },
  { id: 'ocean', title: 'Meer & Radar' },
  { id: 'air', title: 'Luftraum & Weltraum' },
  { id: 'infra', title: 'Verkehr & Infrastruktur' },
  { id: 'networks', title: 'Verkehrsnetze' },
  { id: 'cams', title: 'Kameras & Radio' },
];

// every file in ./defs is a layer (default export = defineExtra({...}))
const modules = import.meta.glob<{ default: ExtraDef }>('./defs/*.ts', { eager: true });

export const EXTRAS: ExtraDef[] = Object.entries(modules)
  .map(([path, m]) => {
    const def = m.default;
    const file = path.slice(path.lastIndexOf('/') + 1, -3);
    if (def.id !== file) throw new Error(`layers/defs/${file}.ts defines '${def.id}' – file name and id must match`);
    return def;
  })
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/** map layers per extra (mutable: layers added at runtime, e.g. the ALPR tile layers, are pushed on) */
export const LAYERS: Record<ExtraId, string[]> = Object.fromEntries(EXTRAS.map((d) => [d.id, [...d.layers]]));

/** Interactive layers the extras answer clicks for. */
export const EXTRA_CLICK_LAYERS: string[] = [...new Set(EXTRAS.flatMap((d) => d.clickLayers ?? []))];
