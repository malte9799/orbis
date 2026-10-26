import type { GlyphId } from '../icons';

// One file per overlay layer lives in ./defs; ./index.ts collects them. A new layer is a new file
// there – no shared list has to be edited, so parallel features do not collide.

/** id of an overlay layer = file name in ./defs (checked when the registry is built) */
export type ExtraId = string;
export type SectionId = 'europe' | 'earth' | 'ocean' | 'air' | 'infra' | 'networks' | 'cams';
export type CatId = 'wetter' | 'gefahr' | 'verkehr' | 'meer' | 'erde' | 'netze' | 'medien';

export interface ExtraDef {
  id: ExtraId;
  /** position in the lists (menu order); leave gaps so new layers fit in without renumbering */
  order: number;
  /** group in the old Ebenen list */
  section: SectionId;
  /** category in the catalog (Karten menu) */
  cat: CatId;
  label: string;
  hint: string;
  glyph: GlyphId;
  /** icon name of the catalog (hud icons) */
  icon: string;
  color: string;
  /** small tag for region-only layers ("DE", "USA" …) */
  region?: string;
  /** map layers switched together with this extra */
  layers: string[];
  /** of those (or other shared ones) the layers that answer clicks */
  clickLayers?: string[];
}

export const defineExtra = (def: ExtraDef): ExtraDef => def;
