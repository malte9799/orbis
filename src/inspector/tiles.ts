import type { Map as MlMap } from 'maplibre-gl';
import { currentRoute, emitChange, getCaptures, onCaptures, type Capture } from './capture';

// Mockup: map tiles are requested inside MapLibre (workers), so they never pass through fetch().
// Every map passes `tileRecorder` as `transformRequest`; the tile coordinates are recovered by matching the
// request URL against the tile templates of the map's sources.

export type TileKind = 'raster' | 'dem' | 'vector' | 'custom';

export interface TileRec {
  z: number;
  x: number;
  y: number;
  url: string;
  t: number;
}

export interface TileGroup {
  key: string;
  sourceId: string;
  template: string;
  host: string;
  kind: TileKind;
  routes: Set<string>;
  tiles: Map<string, TileRec>;
}

const MAX_TILES = 800;
const groups = new Map<string, TileGroup>();
/** every recorded tile URL, so the same request is not listed a second time as a plain fetch */
export const tileUrls = new Set<string>();

/** a.tiles.x.org, b.tiles.x.org, {s}.tiles.x.org … are mirrors of one source: one group, template with `{s}` */
export function canonTemplate(template: string): string {
  return template.replace(/^(https?:\/\/)(?:[a-d]|[0-3]|\{[a-z](?:-[a-z])?\})\.(?=[^/]*\.)/i, '$1{s}.');
}

/** Removes the recorded tiles (of one route, or all); the groups stay known so new tiles are still recognised. */
export function clearTiles(route?: string) {
  for (const g of groups.values()) {
    if (route && !g.routes.has(route)) continue;
    g.tiles.forEach((t) => tileUrls.delete(t.url));
    g.tiles.clear();
    g.routes.clear();
  }
  emitChange();
}

export function getTileGroups(): TileGroup[] {
  return [...groups.values()];
}

interface Matcher {
  re: RegExp;
  order: string[];
  group: TileGroup;
}

const MERC = 20037508.342789244;

function compile(template: string): { re: RegExp; order: string[] } | null {
  const order: string[] = [];
  const parts = template.split(/(\{[^}]+\})/).map((part) => {
    const m = /^\{(.+)\}$/.exec(part);
    if (!m) return part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    const name = m[1];
    if (name === 'z' || name === 'x' || name === 'y') {
      order.push(name);
      return '(\\d+)';
    }
    if (name === 'quadkey') {
      order.push('q');
      return '([0-3]+)';
    }
    if (name.startsWith('bbox')) {
      order.push('bbox');
      return '([^&/]+)';
    }
    return '[^/?&]*';
  });
  try {
    return { re: new RegExp(`^${parts.join('')}$`), order };
  } catch {
    return null;
  }
}

function coords(m: Matcher, hit: RegExpExecArray): { z: number; x: number; y: number } | null {
  const v: Record<string, string> = {};
  m.order.forEach((n, i) => (v[n] = hit[i + 1]));
  if (v.z != null && v.x != null && v.y != null) return { z: +v.z, x: +v.x, y: +v.y };
  if (v.q) {
    let x = 0;
    let y = 0;
    for (let i = 0; i < v.q.length; i++) {
      const d = +v.q[i];
      x = (x << 1) | (d & 1);
      y = (y << 1) | (d >> 1);
    }
    return { z: v.q.length, x, y };
  }
  if (v.bbox) {
    const b = decodeURIComponent(v.bbox).split(',').map(Number);
    if (b.length === 4 && b.every(Number.isFinite)) {
      const size = b[2] - b[0];
      const z = Math.round(Math.log2((2 * MERC) / size));
      return { z, x: Math.round((b[0] + MERC) / size), y: Math.round((MERC - b[3]) / size) };
    }
  }
  return null;
}

/** `transformRequest` for a MapLibre map; `getMap` returns the map once it exists. */
export function tileRecorder(getMap: () => MlMap | null) {
  let matchers: Matcher[] = [];
  let builtAt = -1e9;

  const build = (map: MlMap) => {
    builtAt = performance.now();
    try {
      const next: Matcher[] = [];
      for (const [id, spec] of Object.entries(map.getStyle().sources)) {
        const live = map.getSource(id) as unknown as { tiles?: string[] } | undefined;
        const tiles = live?.tiles ?? (spec as { tiles?: string[] }).tiles;
        if (!tiles) continue;
        const type = (spec as { type: string }).type;
        for (const template of tiles) {
          const c = compile(template);
          if (!c) continue;
          const canon = canonTemplate(template);
          let group = groups.get(canon);
          if (!group) {
            let host = '';
            try {
              host = new URL(canon.replace('{s}.', '').replace(/\{[^}]*\}/g, '0')).host;
            } catch {
              /* custom protocol */
            }
            const web = /^https?:/.test(template);
            group = { key: canon, sourceId: id, template: canon, host, kind: !web ? 'custom' : type === 'vector' ? 'vector' : type === 'raster-dem' ? 'dem' : 'raster', routes: new Set(), tiles: new Map() };
            groups.set(canon, group);
          }
          next.push({ ...c, group });
        }
      }
      matchers = next;
    } catch {
      /* style not ready yet */
    }
  };

  return (url: string, type?: string): undefined => {
    if (type !== 'Tile') return undefined;
    const map = getMap();
    if (!map) return undefined;
    const find = () => {
      for (const m of matchers) {
        const hit = m.re.exec(url);
        if (hit) return { m, hit };
      }
      return null;
    };
    let found = find();
    if (!found && performance.now() - builtAt > 400) {
      build(map);
      found = find();
    }
    if (!found) return undefined;
    const c = coords(found.m, found.hit);
    if (!c) return undefined;
    const g = found.m.group;
    const id = `${c.z}/${c.x}/${c.y}`;
    g.routes.add(currentRoute());
    if (!g.tiles.has(id)) {
      g.tiles.set(id, { ...c, url, t: Date.now() });
      tileUrls.add(url);
      if (g.tiles.size > MAX_TILES) g.tiles.delete(g.tiles.keys().next().value!);
      emitChange();
    }
    return undefined;
  };
}

// ----- tiles that are not requested by MapLibre (custom layers fetch them themselves, e.g. the radar) -----
// Recognised by their URL: three consecutive numbers z/x/y in the path, with x and y inside the grid of zoom z.

const GENERIC = new Set(['tile', 'tiles', 'wmts', 'best', 'default', 'rest', 'services']);
const TILE_FILE = /\.(pbf|mvt|png|jpe?g|webp|avif)$/i;

function guess(c: Capture): void {
  if (c.kind !== 'image' && !TILE_FILE.test(new URL(c.url).pathname)) return;
  const u = new URL(c.url);
  const segs = u.pathname.split('/');
  for (let i = 0; i + 2 < segs.length; i++) {
    const [a, b, d] = [segs[i], segs[i + 1], segs[i + 2].replace(/\.\w+$/, '')];
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b) || !/^\d+$/.test(d)) continue;
    const z = +a;
    if (z > 24) continue;
    // ArcGIS and WMTS servers list the row before the column (z/y/x)
    const rowFirst = /MapServer\/tile|\/1\.0\.0\/|wmts/i.test(u.pathname);
    const [x, y] = rowFirst ? [+d, +b] : [+b, +d];
    // planetary servers use a 2:1 grid (twice as many columns as rows)
    if (x >= 2 ** (z + 1) || y >= 2 ** z) continue;
    const ext = segs[i + 2].slice(d.length);
    // long hex ids (radar frames) differ per time step: they must not split one map into many
    const norm = (list: string[]) => list.map((s) => (/^[0-9a-f]{10,}$/i.test(s) ? '{id}' : s));
    const cell = rowFirst ? ['{z}', '{y}', `{x}${ext}`] : ['{z}', '{x}', `{y}${ext}`];
    const template = canonTemplate(`${u.origin}${[...norm(segs.slice(0, i)), ...cell, ...norm(segs.slice(i + 3))].join('/')}`);
    let g = groups.get(template);
    if (!g) {
      const name = segs.slice(0, i).filter((s) => /^[a-z][a-z_-]{3,}$/i.test(s) && !GENERIC.has(s.toLowerCase())).pop() ?? u.host;
      g = { key: template, sourceId: name, template, host: u.host.replace(/^(?:[a-d]|[0-3])\.(?=[^.]+\.)/i, ''), kind: /\.(pbf|mvt)$/i.test(u.pathname) ? 'vector' : 'raster', routes: new Set(), tiles: new Map() };
      groups.set(template, g);
    }
    g.routes.add(c.route);
    const id = `${z}/${x}/${y}`;
    if (!g.tiles.has(id)) {
      g.tiles.set(id, { z, x, y, url: c.url, t: c.t });
      if (g.tiles.size > MAX_TILES) g.tiles.delete(g.tiles.keys().next().value!);
    }
    tileUrls.add(c.url);
    return;
  }
}

onCaptures(() => {
  for (const c of getCaptures()) {
    if (c.tileChecked || !c.status) continue;
    c.tileChecked = true;
    if (!c.ok || tileUrls.has(c.url)) continue;
    try {
      guess(c);
    } catch {
      /* odd URL */
    }
  }
});
