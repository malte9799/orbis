import { beforeEach, describe, expect, it } from 'vitest';

// store.ts liest die Einstellungen aus localStorage
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { altTxt, climbFtTxt, depthTxt, kntTxt, localize } = await import('./units');

const set = (o: Record<string, string>) => mem.set('wg.options', JSON.stringify(o));
beforeEach(() => mem.clear());

describe('Einheiten im Ereignistext', () => {
  it('Wassertiefe: Meter, Fuß in Klammern', () => {
    expect(depthTxt(3346)).toBe('3.346 m (10.978 ft)');
    expect(localize('in {{d:3346}} Tiefe')).toBe('in 3.346 m (10.978 ft) Tiefe');
  });
  it('metrisch: Meter, Fuß in Klammern', () => {
    expect(altTxt(35000)).toBe('10.668 m (35.000 ft)');
    expect(climbFtTxt(-41250)).toBe('−209,6 m/s (−41.250 ft/min)');
    expect(kntTxt(437)).toBe('809 km/h');
  });
  it('im Text: Fuß in Klammern klein', () => {
    expect(altTxt(35000, true)).toBe('10.668 m <small class="ic-ft">(35.000 ft)</small>');
    expect(localize('{{ft:35000}}', true)).toBe('10.668 m <small class="ic-ft">(35.000 ft)</small>');
    set({ height: 'ft' });
    expect(localize('{{ft:35000}} und {{fpm:41250}}', true)).toBe('35.000 ft und 41.250 ft/min');
  });
  it('Fuß eingestellt: nur Fuß', () => {
    set({ height: 'ft', dist: 'nmi' });
    expect(altTxt(35000)).toBe('35.000 ft');
    expect(climbFtTxt(-41250)).toBe('−41.250 ft/min');
    expect(kntTxt(437)).toBe('437 kn');
  });
  it('ersetzt die Platzhalter im Text', () => {
    expect(localize('Von {{ft:41000}} auf {{ft:35000}}, {{kn:437}}, rund {{m:180}}.')).toBe('Von 12.497 m (41.000 ft) auf 10.668 m (35.000 ft), 809 km/h, rund 180 m.');
    expect(localize('ohne Platzhalter')).toBe('ohne Platzhalter');
  });
});
