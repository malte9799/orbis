import type { TrafficCat, WxFamily, WxMenuItem } from './types';

export type { TrafficCat, WxFamily, WxMenuItem } from './types';

const collect = <T extends { id: string; order: number }>(mods: Record<string, { default: T }>, dir: string): T[] =>
  Object.entries(mods)
    .map(([path, m]) => {
      const file = path.slice(path.lastIndexOf('/') + 1, -3);
      if (m.default.id !== file) throw new Error(`menus/${dir}/${file}.ts defines '${m.default.id}' – file name and id must match`);
      return m.default;
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const WX_FAMILIES: WxFamily[] = collect(import.meta.glob<{ default: WxFamily & { order: number } }>('./wxfamilies/*.ts', { eager: true }), 'wxfamilies');
export const WX_MENU: WxMenuItem[] = collect(import.meta.glob<{ default: WxMenuItem & { order: number } }>('./wxmenu/*.ts', { eager: true }), 'wxmenu');
export const TRAFFIC_MENU: TrafficCat[] = collect(import.meta.glob<{ default: TrafficCat & { order: number } }>('./traffic/*.ts', { eager: true }), 'traffic');
export const INFRA_MENU: TrafficCat[] = collect(import.meta.glob<{ default: TrafficCat & { order: number } }>('./infra/*.ts', { eager: true }), 'infra');
