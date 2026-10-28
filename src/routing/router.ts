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

/** Valhalla is the default for navigation (own heading on reroute, German sentences, good bike/foot profiles) */
export const defaultProvider = (_keys: ApiKeys): string => 'valhalla';

/**
 * Plans a route with the chosen provider; when it fails (no key quota, server down, no route there) the next usable one
 * is tried, so a planned trip does not stop at one provider's outage.
 *
 * A provider with a `preview` (Valhalla → OSRM) is asked together with its fast sibling: `onPreview` gets the fast answer
 * as soon as it is there, the final result is the slow provider's. If the slow one fails, the preview stays as the answer.
 */
export async function planRoute(req: RouteRequest, keys: ApiKeys, wanted?: string, onPreview?: (p: Planned) => void): Promise<Planned> {
  const failed: Planned['failed'] = [];
  const chain = usable(req.profile, keys, wanted && wanted !== 'auto' ? wanted : undefined);
  const ok = (routes: Route[]) => routes.length > 0 && routes[0].geometry.length > 1;
  const sorted = (routes: Route[]) => routes.sort((a, b) => a.duration - b.duration);

  // the fast sibling of the first provider is asked in parallel
  const first = chain[0];
  const fast = first?.preview ? chain.find((p) => p.id === first.preview) : undefined;
  let finished = false;
  const fastResult: Promise<Planned | null> = fast
    ? fast
        .route(req, keys)
        .then((routes): Planned | null => (ok(routes) ? { routes: sorted(routes), provider: fast, failed: [] } : null))
        .catch(() => null)
        .then((p) => {
          if (p && !finished) onPreview?.(p);
          return p;
        })
    : Promise.resolve(null);

  for (const provider of chain) {
    if (provider === fast) continue; // already asked above
    try {
      const routes = await provider.route(req, keys);
      if (ok(routes)) {
        finished = true;
        return { routes: sorted(routes), provider, failed };
      }
      failed.push({ provider, error: 'keine Route gefunden' });
    } catch (e) {
      failed.push({ provider, error: e instanceof Error ? e.message : String(e) });
    }
    // the first provider failed: the fast answer is good enough, so use it before trying the keyed ones
    if (provider === first) {
      const p = await fastResult;
      if (p) {
        finished = true;
        return { ...p, failed };
      }
    }
  }
  finished = true;
  const late = await fastResult; // only reached when nothing else worked (or fast is the only provider)
  if (late) return { ...late, failed };
  throw new Error(failed.length ? failed.map((f) => `${f.provider.label}: ${f.error}`).join(' · ') : 'Kein Routing-Anbieter verfügbar');
}

export { providerById };
