import { describe, expect, it, vi } from 'vitest';
import type { Route, RoutingProvider } from './types';

const route = (provider: string, duration: number): Route => ({ provider, profile: 'car', geometry: [[0, 0], [1, 1]], distance: 1, duration, steps: [] });
const fakes: Record<string, { delay: number; fail?: boolean }> = { valhalla: { delay: 30 }, fossgis: { delay: 5 }, google: { delay: 5 } };
const make = (id: string, order: number, preview?: string): RoutingProvider => ({
  id,
  order,
  label: id,
  note: '',
  preview,
  profiles: ['car', 'bike', 'foot'],
  available: () => true,
  route: (_req, _k) =>
    new Promise((resolve, reject) =>
      setTimeout(() => (fakes[id].fail ? reject(new Error(`${id} down`)) : resolve([route(id, 100)])), fakes[id].delay),
    ),
});
vi.mock('./providers', () => {
  const list = [make('valhalla', 10, 'fossgis'), make('fossgis', 20), make('google', 30)];
  return { PROVIDERS: list, providerById: (id: string) => list.find((p) => p.id === id) };
});
const { planRoute } = await import('./router');
const req = { points: [[0, 0], [1, 1]] as [number, number][], profile: 'car' as const, alternatives: false };

describe('planRoute with a fast preview', () => {
  it('shows the fast answer first, then the slow provider wins', async () => {
    fakes.valhalla.fail = false;
    fakes.fossgis.fail = false;
    const seen: string[] = [];
    const res = await planRoute(req, {}, 'valhalla', (p) => seen.push(p.provider.id));
    expect(seen).toEqual(['fossgis']);
    expect(res.provider.id).toBe('valhalla');
  });

  it('keeps the fast answer when the slow provider fails', async () => {
    fakes.valhalla.fail = true;
    fakes.fossgis.fail = false;
    const res = await planRoute(req, {}, 'valhalla');
    expect(res.provider.id).toBe('fossgis');
    expect(res.failed[0].provider.id).toBe('valhalla');
  });

  it('uses the slow answer when the fast one fails', async () => {
    fakes.valhalla.fail = false;
    fakes.fossgis.fail = true;
    const seen: string[] = [];
    const res = await planRoute(req, {}, 'valhalla', (p) => seen.push(p.provider.id));
    expect(seen).toEqual([]);
    expect(res.provider.id).toBe('valhalla');
  });

  it('falls on to the next provider when both fail, and throws when none works', async () => {
    fakes.valhalla.fail = true;
    fakes.fossgis.fail = true;
    fakes.google.fail = false;
    expect((await planRoute(req, {}, 'valhalla')).provider.id).toBe('google');
    fakes.google.fail = true;
    await expect(planRoute(req, {}, 'valhalla')).rejects.toThrow(/valhalla/);
  });

  it('does not preview for a provider without one', async () => {
    fakes.google.fail = false;
    const seen: string[] = [];
    const res = await planRoute(req, {}, 'google', (p) => seen.push(p.provider.id));
    expect(res.provider.id).toBe('google');
    expect(seen).toEqual([]);
  });
});
