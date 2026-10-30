import type { HudHost } from './hud';
import type { KLayer, KView, Karte, KartenState } from './karten';

// What the action handlers (src/hud/actions) can use of the HUD. The HUD owns the state; the
// handlers change it and the HUD renders again afterwards.

export type ActFn = (id: string, v: string, ev: Event) => void;

/** transient UI state of the HUD */
export interface HudUi {
  edit: boolean;
  add: boolean;
  gallery: boolean;
  save: boolean;
  pick: boolean;
  open: string | null;
  q: string;
  evHours: number;
  search: boolean;
  menu: boolean;
  rename: boolean;
  folded: boolean;
  /** the base-map chooser under the settings button */
  basepick: boolean;
}

export interface HudCore {
  host: HudHost;
  root: HTMLElement;
  /** transient UI state of the HUD (open panels, search …) */
  ui: HudUi;
  /** the saved Karten (own, pinned, drafts) */
  st: KartenState;
  /** id of the active Karte */
  cur: string;
  /** the "save as new Karte" form while it is open */
  form: { name: string; icon: string; color: string; place: boolean; pin: boolean } | null;
  /** Karten that were just added (highlighted once) */
  fresh: Set<string>;
  view(id: string): Karte;
  edit(): Karte;
  dirty(id: string): boolean;
  persist(): void;
  afterEdit(rerender?: boolean): void;
  go(id: string): void;
  setSearch(on: boolean): void;
  closeOverlay(): void;
  captureView(): KView;
  layerOf(id: string): KLayer | undefined;
  mainFam(k: Karte): ReturnType<HudHost['families']>[number] | undefined;
  nameEl(k: Karte): string;
  suggestName(k: Karte): string;
  tmodeOf(k: Karte): string;
  encodeKarte(k: Karte): string;
}
