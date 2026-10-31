// The API keys the user can enter in the settings panel. One file per key in ./keys; index.ts
// collects them, so a new key never touches a list that other features edit as well.

export type KeyGroupId = 'weather' | 'webcams' | 'transit' | 'routing' | 'snapshot';
export interface KeyStep {
  /** step number of the guide ("1", "2" …) – the text lives at keys.<id>.steps.<t> */
  t: string;
  u?: string;
}

export interface KeyDef {
  /** name in the stored keys (store.getKeys()) = file name */
  id: string;
  order: number;
  /** group (accordion block) in the settings panel */
  group: KeyGroupId;
  /** short description next to the key (tooltip) – message keys.<id>.<tip>, or () => text */
  tip: string | (() => string);
  /** quick guide behind the ⓘ: how to get the key */
  steps: KeyStep[];
  /** we deliver a fallback ourselves (public source, built-in proxy or shared snapshot) */
  optional?: boolean | (() => boolean);
  /** message-key suffix – text lives at keys.<id>.<label> */
  label: string;
  /** message-key suffix (text at keys.<id>.<placeholder>), or () => technical value (URL) */
  placeholder: string | (() => string);
  /** input type (default: password) */
  type?: 'password' | 'url';
  /** keep only values that start with https:// */
  httpsOnly?: boolean;
}

export const defineKey = (def: KeyDef): KeyDef => def;

/** the groups of the API key section, in display order (label = message key keys.group.<id>) */
export const KEY_GROUPS: { id: KeyGroupId; label: string }[] = [
  { id: 'weather', label: 'weather' },
  { id: 'webcams', label: 'webcams' },
  { id: 'transit', label: 'transit' },
  { id: 'routing', label: 'routing' },
  { id: 'snapshot', label: 'snapshot' },
];
