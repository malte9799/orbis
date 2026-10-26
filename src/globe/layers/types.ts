import type { FeatureCollection } from 'geojson';
import type { LayerSpecification, Map as MlMap } from 'maplibre-gl';
import type { GlyphId } from '../icons';
import type { Launch } from '../../api/transport';
import type { ClickResult } from '../extras';

// One file per overlay layer lives in ./defs; ./index.ts collects them. A new layer is a new file
// there – no shared list has to be edited, so parallel features do not collide.

/** id of an overlay layer = file name in ./defs (checked when the registry is built) */
export type ExtraId = string;
export type SectionId = 'europe' | 'earth' | 'ocean' | 'air' | 'infra' | 'networks' | 'cams';
export type CatId = 'wetter' | 'gefahr' | 'verkehr' | 'meer' | 'erde' | 'netze' | 'medien';

/** a raster tile overlay (map layer and source share the id) */
export interface RasterSpec {
  id: string;
  tiles: string[];
  attribution: string;
  maxzoom: number;
  opacity: number;
  minzoom?: number;
  bounds?: [number, number, number, number];
}

export interface ExtraInfo {
  count?: number;
  loading?: boolean;
  note?: string;
  at?: number;
}

/** What a layer module can use of the map and of ExtraLayers. */
export interface ExtraCtx {
  map: MlMap;
  /** layout for layers that start switched off */
  hidden: { visibility: 'none' };
  /** adds the layer unless it exists; with `before` below that layer (when present) */
  add(layer: LayerSpecification, before?: string): void;
  setData(source: string, data: FeatureCollection): void;
  /** per map and layer: state that must not be shared between maps (created by `init` on first use) */
  state<T>(key: ExtraId, init: () => T): T;
  /** view bounds snapped outwards to a grid of 1/`step` degrees */
  viewBounds(step?: number): { west: number; south: number; east: number; north: number };
  /** status line of the layer in the list (count, note, loading) */
  set(id: ExtraId, info: ExtraInfo): void;
  info(id: ExtraId): ExtraInfo | undefined;
  /** is the layer switched on? */
  isOn(id: ExtraId): boolean;
  /** show/hide a map layer */
  vis(layer: string, on: boolean): void;
  /** timer that only fires while the page is visible; one per key */
  every(key: string, ms: number, fn: () => void): void;
  clear(key: string): void;
  toast(msg: string): void;
  /** the style is loaded and the layers exist */
  readonly ready: boolean;
  /** opens the launch panel (set by the page that hosts the map) */
  readonly openLaunch?: (l: Launch, lng: number, lat: number) => void;
  /** load once (or again after `maxAge`), then refresh every `maxAge` while the layer is on */
  loadOnce(id: ExtraId, maxAge: number, fn: () => Promise<{ count?: number; note?: string } | void>): void;
}

/** A clicked feature of one of the layer's `clickLayers`. */
export interface ClickCtx {
  ctx: ExtraCtx;
  layerId: string;
  /** properties of the feature */
  p: Record<string, unknown>;
  /** point of the feature (or the click for lines/areas) */
  pt: number[];
  at: { lng: number; lat: number };
  /** standard popup card from the feature's title/subtitle/… properties */
  html(glyph: GlyphId, color: string, extra?: string): string;
}

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
  /** raster tile overlays of this layer (added below the labels, in this order) */
  rasters?: RasterSpec[];
  /** empty GeoJSON sources this layer owns: id → attribution */
  sources?: Record<string, string>;
  /** adds the map layers (once, after the style has loaded) */
  addLayers?(ctx: ExtraCtx): void;
  /** called when the layer is off (every apply) – hide what only this layer shows, stop timers */
  disable?(ctx: ExtraCtx): void;
  /** called whenever the layer is on and the state is applied – start loading/refreshing here */
  enable?(ctx: ExtraCtx): void;
  /** called after the map stopped moving, while the layer is on */
  onMoveEnd?(ctx: ExtraCtx): void;
  /** answers a click on one of `clickLayers` */
  click?(c: ClickCtx): ClickResult | null;
  /** map layers switched together with this extra */
  layers: string[];
  /** of those (or other shared ones) the layers that answer clicks */
  clickLayers?: string[];
}

export const defineExtra = (def: ExtraDef): ExtraDef => def;
