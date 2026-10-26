import type { Map as MlMap } from 'maplibre-gl';
import type { Feature } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { kindColor } from '../../api/events';
import { fmt } from '../../util';
import { FEEDS, GROUPS, groupOfKind } from './index';
import type { EventFeature, EventKind, EventsCtx, FeedId, FeedState, GroupId } from './types';

/** an event of the HUD list */
export interface ListedEvent {
  kind: EventKind;
  color: string;
  title: string;
  sub: string;
  when: string;
}

export interface EventsHost {
  map(): MlMap | null;
  /** the style is loaded and the sources exist */
  ready(): boolean;
  /** groups switched on in the active Karte */
  groups(): Partial<Record<GroupId, boolean>>;
  extrasCount(extra: string): number | undefined;
  keys(): { firms?: string };
  toast(msg: string, kind?: 'error'): void;
  /** live numbers changed: refresh the HUD */
  refresh(): void;
  refreshMs: number;
}

/** Loads the feeds of the switched-on groups and feeds the event sources of the map. */
export function createEvents(host: EventsHost) {
  const feeds = new Map<FeedId, FeedState>(FEEDS.map((f) => [f.id, { data: f.initial, at: 0, loading: null }]));

  const setData = (source: string, features: Feature[]) => {
    (host.map()?.getSource(source) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features } as FeatureCollection);
  };
  const ctx: EventsCtx = {
    get map() {
      return host.map();
    },
    on: (g) => !!host.groups()[g],
    vis(layer, on) {
      const m = host.map();
      if (m?.getLayer(layer)) m.setLayoutProperty(layer, 'visibility', on ? 'visible' : 'none');
    },
    setData,
    feed: (id) => feeds.get(id)! as never,
    extrasCount: (e) => host.extrasCount(e),
    eventCount(kinds) {
      const eonet = feeds.get('eonet')!;
      const gdacs = feeds.get('gdacs')!;
      if (!eonet.at && !gdacs.at) return null;
      const all = [...(FEEDS.find((f) => f.id === 'eonet')!.points!(eonet.data) ?? []), ...(FEEDS.find((f) => f.id === 'gdacs')!.points!(gdacs.data) ?? [])];
      return all.filter((f) => kinds.includes(f.properties.kind)).length;
    },
    keys: () => host.keys(),
  };

  /** the events of the shared event layer, tagged with their group */
  const allPoints = () =>
    FEEDS.flatMap((f) => (f.points ? f.points(feeds.get(f.id)!.data).map((e) => ({ ...e, properties: { ...e.properties, group: f.group ?? groupOfKind(e.properties.kind) } })) : []));

  function sync() {
    if (!host.map() || !host.ready()) return;
    setData('events', allPoints());
    for (const g of GROUPS) g.sync?.(ctx);
  }

  /** layer filters and visibility follow the switched-on groups */
  function apply() {
    const m = host.map();
    const on = GROUPS.filter((g) => host.groups()[g.id]).map((g) => g.id);
    const filter = ['in', ['get', 'group'], ['literal', on]] as const;
    m?.setFilter('ev-circle', filter as never);
    m?.setFilter('ev-glyph', filter as never);
    // groups off = events layers visually AND formally hidden, so the attribution control
    // drops the events sources (visibility 'none' is what counts, not empty features)
    for (const id of ['ev-circle', 'ev-glyph']) ctx.vis(id, on.length > 0);
    for (const g of GROUPS) g.apply?.(ctx);
  }

  function ensure(force = false) {
    const needed = new Set<FeedId>();
    for (const g of GROUPS) if (host.groups()[g.id]) g.feeds.forEach((f) => needed.add(f));
    for (const id of needed) {
      const def = FEEDS.find((f) => f.id === id)!;
      const fd = feeds.get(id)!;
      if (fd.loading || (!force && Date.now() - fd.at < host.refreshMs)) continue;
      fd.loading = def
        .load(ctx)
        .then((data) => {
          fd.data = data;
          fd.error = undefined;
        })
        .catch((e) => {
          console.warn(`${def.name} nicht verfügbar`, e);
          fd.error = String(e?.message ?? e);
          if (!def.silent) host.toast(`${def.name} konnte nicht geladen werden.`, 'error');
        })
        .finally(() => {
          fd.at = Date.now();
          fd.loading = null;
          apply();
          sync();
          host.refresh();
        });
    }
    host.refresh();
  }

  /** forget what a feed delivered (e.g. after the API key changed) */
  function reset(id: FeedId) {
    const fd = feeds.get(id)!;
    fd.at = 0;
    fd.data = FEEDS.find((f) => f.id === id)!.initial;
  }

  /** the number next to a group in the layer list (null: unknown yet) */
  function count(id: GroupId): number | null {
    const g = GROUPS.find((x) => x.id === id)!;
    return g.count ? g.count(ctx) : ctx.eventCount(g.kinds ?? []);
  }

  const loading = (id: GroupId) => GROUPS.find((x) => x.id === id)!.feeds.some((f) => !!feeds.get(f)!.loading);

  /** recent events for the HUD: a mix of kinds instead of 6 quakes (at most two per kind) */
  function list(hours: number): ListedEvent[] {
    const cutoff = Date.now() - hours * 3600000;
    const on = host.groups();
    const items = [...allPoints(), ...GROUPS.flatMap((g) => g.listEvents?.(ctx) ?? [])]
      .filter((f: EventFeature) => on[groupOfKind(f.properties.kind)] && f.properties.date && Date.parse(f.properties.date) >= cutoff)
      .sort((a, b) => Date.parse(b.properties.date!) - Date.parse(a.properties.date!));
    const perKind: Partial<Record<EventKind, number>> = {};
    const out: ListedEvent[] = [];
    for (const f of items) {
      const p = f.properties;
      if ((perKind[p.kind] ?? 0) >= 2) continue;
      perKind[p.kind] = (perKind[p.kind] ?? 0) + 1;
      out.push({ kind: p.kind, color: p.color ?? kindColor(p.kind), title: p.title, sub: p.subtitle ?? p.source, when: fmt.relative(p.date!) });
      if (out.length >= 6) break;
    }
    return out;
  }

  return { ensure, sync, apply, reset, count, loading, list, ctx };
}

export type Events = ReturnType<typeof createEvents>;
export type { MlMap };
