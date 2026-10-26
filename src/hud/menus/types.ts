// Entries of the Karten menus. Every entry is one file in a folder next to this one; index.ts collects
// them, so adding or changing a menu entry never touches a list that other features edit as well.

export interface WxFamily {
  id: string;
  label: string;
  hint: string;
  icon: string;
  color: string;
  variants: [string, string][];
}

/**
 * The curated weather menu under the Karten bar. Every entry points at a weather layer of a
 * WxFamily (family + variant), so the menu and the editing stack always show the same choice.
 * A single entry without a label switches directly.
 */
export interface WxMenuItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  color: string;
  subs: { label: string; main: string; mainVar: string }[];
}

/**
 * A category of the Verkehr / Infrastruktur menus: one at a time (radio). `defaults` are switched on
 * with the category and always stay on; every row inside switches one more layer (toggle).
 */
export interface TrafficCat {
  id: string;
  label: string;
  icon: string;
  /** switched on when the category is selected ('' for menu purely of toggle rows) */
  defaults?: string[];
  /** a row switches one or more layers together */
  rows: { label: string; layers: string[] }[];
}

type Ordered<T> = T & {
  /** position in the menu; leave gaps so new entries fit in without renumbering */
  order: number;
};

export const defineWxFamily = (d: Ordered<WxFamily>) => d;
export const defineWxMenuItem = (d: Ordered<WxMenuItem>) => d;
export const defineMenuCat = (d: Ordered<TrafficCat>) => d;
