import type { RoutingProvider } from '../types';

const modules = import.meta.glob<{ default: RoutingProvider }>('./*.ts', { eager: true });

/** all routing providers, one file each in this folder (order = list order) */
export const PROVIDERS: RoutingProvider[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.ts'))
  .map(([path, m]) => {
    const file = path.slice(path.lastIndexOf('/') + 1, -3);
    if (m.default.id !== file) throw new Error(`routing/providers/${file}.ts defines '${m.default.id}' – file name and id must match`);
    return m.default;
  })
  .sort((a, b) => a.order - b.order);

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id);
