import type { EventKind, FeedDef, GroupDef } from './types';

export type { EventFeature, EventKind, EventsCtx, FeedDef, FeedId, GroupDef, GroupId } from './types';

const collect = <T extends { id: string; order: number }>(mods: Record<string, { default: T }>, dir: string): T[] =>
  Object.entries(mods)
    .map(([path, m]) => {
      const file = path.slice(path.lastIndexOf('/') + 1, -3);
      if (m.default.id !== file) throw new Error(`events/${dir}/${file}.ts defines '${m.default.id}' – file name and id must match`);
      return m.default;
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const FEEDS = collect(import.meta.glob<{ default: FeedDef<any> }>('./feeds/*.ts', { eager: true }), 'feeds');
export const GROUPS = collect(import.meta.glob<{ default: GroupDef }>('./groups/*.ts', { eager: true }), 'groups');

/** the group an event of this kind belongs to */
export const groupOfKind = (kind: EventKind): string => GROUPS.find((g) => g.kinds?.includes(kind))?.id ?? 'ice';

/** event groups that also switch an extra layer (one entry in the UI instead of two) */
export const LINKED_EXTRA = Object.fromEntries(GROUPS.filter((g) => g.linkedExtra).map((g) => [g.id, g.linkedExtra!])) as Record<string, string | undefined>;
const linkedExtras = GROUPS.flatMap((g) => (g.linkedExtra ? [g.linkedExtra] : []));
export const LINKED_EXTRA_IDS = new Set<string>(linkedExtras);
/** groups that are switched together with another one */
export const LINKED_GROUP: Record<string, string | undefined> = Object.fromEntries(GROUPS.filter((g) => g.linkedGroup).map((g) => [g.id, g.linkedGroup]));
