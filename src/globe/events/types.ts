import type { Feature, LineString, MultiPolygon, Polygon } from 'geojson';
import type { Map as MlMap } from 'maplibre-gl';
import type { EventFeature, EventKind } from '../../api/events';
import type { CatId } from '../layers';

// The event layer of the globe (fires, storms, quakes …) is made of feeds (data sources) and groups
// (what the user switches on). Every feed and every group is one file in ./feeds and ./groups;
// index.ts collects them, so adding one never touches a list that other features edit as well.

export type { EventFeature, EventKind };

/** id of a feed / group = file name */
export type FeedId = string;
export type GroupId = string;

export interface FeedState<T = unknown> {
  data: T;
  /** when it was last loaded (0 = never) */
  at: number;
  loading: Promise<void> | null;
  error?: string;
}

/** What feeds and groups can use of the globe. */
export interface EventsCtx {
  map: MlMap | null;
  /** is the group switched on in the active Karte? */
  on(group: GroupId): boolean;
  vis(layer: string, on: boolean): void;
  setData(source: string, features: Feature[]): void;
  feed<T = unknown>(id: FeedId): FeedState<T>;
  /** number of loaded features of an extra layer (undefined while off or not loaded) */
  extrasCount(extra: string): number | undefined;
  /** events of the shared event layer (EONET, GDACS) that belong to these kinds; null while neither is loaded */
  eventCount(kinds: EventKind[]): number | null;
  keys(): { firms?: string };
}

export interface FeedDef<T = unknown> {
  id: FeedId;
  /** position in the lists; leave gaps */
  order: number;
  /** name in the error message */
  name: string;
  /** no toast when it fails (e.g. files without CORS headers on some days) */
  silent?: boolean;
  /** data before the first load */
  initial: T;
  /** loads the feed; the result is kept as the feed's data */
  load(ctx: EventsCtx): Promise<T>;
  /** events this feed adds to the shared event layer */
  points?(data: T): EventFeature[];
  /** fixed group of those events (otherwise by their kind) */
  group?: GroupId;
}

export interface GroupDef {
  id: GroupId;
  order: number;
  label: string;
  hint: string;
  icon: EventKind;
  /** feeds that have to be loaded while the group is on */
  feeds: FeedId[];
  /** event kinds that belong to the group */
  kinds?: EventKind[];
  /** map layers that show the group (draw order, layer list of a Karte) */
  mapLayers: string[];
  /** extra layer that is switched together with the group (one entry in the UI instead of two) */
  linkedExtra?: string;
  /** group that is switched together with this one */
  linkedGroup?: GroupId;
  /** entry in the layer catalog; without it the group is only reachable through the linked one */
  catalog?: { label: string; hint: string; color: string; icon: string; cat: CatId; region?: string };
  /** number shown next to the entry (null: unknown yet); default: loaded events of its kinds */
  count?(ctx: EventsCtx): number | null;
  /** fills the sources that only this group uses */
  sync?(ctx: EventsCtx): void;
  /** visibility of the map layers that only this group uses */
  apply?(ctx: EventsCtx): void;
  /** events that are listed in the HUD although they are not part of the shared event layer */
  listEvents?(ctx: EventsCtx): EventFeature[];
}

export type EonetTracks = Feature<LineString, { kind: EventKind; title: string }>[];
export type NwsPolygons = Feature<Polygon | MultiPolygon, { color: string; event: string }>[];

export const defineFeed = <T>(def: FeedDef<T>): FeedDef<T> => def;
export const defineGroup = (def: GroupDef): GroupDef => def;
