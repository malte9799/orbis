import type { ActFn, HudCore } from '../core';

// The click handlers of the HUD (`data-act="…"`): one file per topic, collected here. A new action
// goes into the file of its topic (or into a new file) – nothing else has to be registered.
const modules = import.meta.glob<{ default: (c: HudCore) => Record<string, ActFn> }>('./*.ts', { eager: true });

export function buildActions(core: HudCore): Record<string, ActFn> {
  const out: Record<string, ActFn> = {};
  for (const [path, m] of Object.entries(modules)) {
    if (path === './index.ts') continue;
    for (const [name, fn] of Object.entries(m.default(core))) {
      if (out[name]) throw new Error(`HUD action '${name}' is defined twice (${path})`);
      out[name] = fn;
    }
  }
  return out;
}
