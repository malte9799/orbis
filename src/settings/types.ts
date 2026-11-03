// The API keys the user can enter in the settings panel. One file per key in ./keys; index.ts
// collects them, so a new key never touches a list that other features edit as well.

export type KeyGroupId = 'weather' | 'webcams' | 'transit' | 'routing' | 'tiles3d' | 'snapshot';
export interface KeyStep {
  t: string;
  u?: string;
}

export interface KeyDef {
  /** name in the stored keys (store.getKeys()) = file name */
  id: string;
  order: number;
  /** group (accordion block) in the settings panel */
  group: KeyGroupId;
  /** short description next to the key (tooltip) */
  tip: string | (() => string);
  /** quick guide behind the ⓘ: how to get the key */
  steps: KeyStep[];
  /** we deliver a fallback ourselves (public source, built-in proxy or shared snapshot) */
  optional?: boolean | (() => boolean);
  label: string;
  placeholder: string | (() => string);
  /** input type (default: password) */
  type?: 'password' | 'url';
  /** keep only values that start with https:// */
  httpsOnly?: boolean;
}

export const defineKey = (def: KeyDef): KeyDef => def;

/** the groups of the API key section, in display order */
export const KEY_GROUPS: { id: KeyGroupId; label: string }[] = [
  { id: 'weather', label: 'Wetter, Feuer & Radar' },
  { id: 'webcams', label: 'Webcams & Schiffe' },
  { id: 'transit', label: 'Verkehr & Nahverkehr' },
  { id: 'routing', label: 'Routenplanung' },
  { id: 'tiles3d', label: '3D-Kacheln' },
  { id: 'snapshot', label: 'Schon mit Daten im Repo (Fallback-Snapshot)' },
];
