import type { ApiKeys } from '../store';
import { PROVIDERS, providerById } from './providers';
import type { Profile, Route, RouteRequest, RoutingProvider } from './types';

export interface Planned {
  routes: Route[];
  provider: RoutingProvider;
  /** providers that were tried and failed first (provider id → message) */
  failed: { provider: RoutingProvider; error: string }[];
}

/** providers that can serve a profile with the keys at hand, the wanted one first */
export function usable(profile: Profile, keys: ApiKeys, wanted?: string): RoutingProvider[] {
  const list = PROVIDERS.filter((p) => p.profiles.includes(profile) && p.available(keys));
  const first = wanted ? list.find((p) => p.id === wanted) : undefined;
  return first ? [first, ...list.filter((p) => p !== first)] : list;
}

/** the preferred provider, or the first usable one when the choice is "auto" */
export const defaultProvider = (keys: ApiKeys): string => PROVIDERS.find((p) => p.available(keys))?.id ?? 'fossgis';

/**
 * Plans a route with the chosen provider; when it fails (no key quota, server down, no route there) the next usable one
 * is tried, so a planned trip does not stop at one provider's outage.
 */
export async function planRoute(req: RouteRequest, keys: ApiKeys, wanted?: string): Promise<Planned> {
  const failed: Planned['failed'] = [];
  const chain = usable(req.profile, keys, wanted && wanted !== 'auto' ? wanted : undefined);
  for (const provider of chain) {
    try {
      const routes = await provider.route(req, keys);
      if (routes.length && routes[0].geometry.length > 1) return { routes: routes.sort((a, b) => a.duration - b.duration), provider, failed };
      failed.push({ provider, error: 'keine Route gefunden' });
    } catch (e) {
      failed.push({ provider, error: e instanceof Error ? e.message : String(e) });
    }
    // an explicit choice that failed on a clear "no route" is still worth trying elsewhere: the others may know more roads
  }
  throw new Error(failed.length ? failed.map((f) => `${f.provider.label}: ${f.error}`).join(' · ') : 'Kein Routing-Anbieter verfügbar');
}

export { providerById };
