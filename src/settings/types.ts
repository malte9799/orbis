// The API keys the user can enter in the settings dialog. One file per key in ./keys; index.ts
// collects them, so a new key never touches a list that other features edit as well.

export interface KeyDef {
  /** name in the stored keys (store.getKeys()) = file name */
  id: string;
  order: number;
  /** group in the dialog */
  section: 'keys' | 'transit';
  label: string;
  /** shown small behind the label, in brackets */
  hint: string | (() => string);
  placeholder: string | (() => string);
  /** input type (default: password) */
  type?: 'password' | 'url';
  /** keep only values that start with https:// */
  httpsOnly?: boolean;
}

export const defineKey = (def: KeyDef): KeyDef => def;
