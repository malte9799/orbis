import type { KeyDef } from './types';

export { KEY_GROUPS } from './types';
export type { KeyDef, KeyGroupId, KeyStep } from './types';

const modules = import.meta.glob<{ default: KeyDef }>('./keys/*.ts', { eager: true });

export const KEY_DEFS: KeyDef[] = Object.entries(modules)
  .map(([path, m]) => {
    const file = path.slice(path.lastIndexOf('/') + 1, -3);
    if (m.default.id !== file) throw new Error(`settings/keys/${file}.ts defines '${m.default.id}' – file name and id must match`);
    return m.default;
  })
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

export const text = (v: string | (() => string)) => (typeof v === 'function' ? v() : v);
