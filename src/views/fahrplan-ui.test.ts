import { describe, expect, it } from 'vitest';
import type { Itinerary, Leg } from '../api/connections';

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
const { timeline, lineName } = await import('./fahrplan-ui');

const leg = (over: Partial<Leg>): Leg => ({ mode: 'BUS', line: '32', headsign: 'Moorbrink', from: 'A', to: 'B', dep: 1000, arr: 61000, schedDep: 1000, schedArr: 61000, delayMin: null, arrDelayMin: null, cancelled: false, via: [], ...over });
const itin = (l: Leg): Itinerary => ({ dep: l.dep, arr: l.arr, transfers: 0, legs: [l] });

describe('line names', () => {
  it('writes "Bus" before city bus numbers and "RUF" for on-demand buses', () => {
    expect(lineName('BUS', '235')).toBe('Bus 235');
    expect(lineName('BUS', 'Bus 12')).toBe('Bus 12');
    expect(lineName('COACH', 'FlixBus N232')).toBe('FlixBus N232');
    expect(lineName('ODM', '32')).toBe('RUF');
  });
});

describe('on-demand bus in the timeline', () => {
  it('shows the number to call and when', () => {
    const html = timeline(itin(leg({ mode: 'ODM', agency: 'Nordwestmecklenburg', reservation: 'COMPULSORY' })));
    expect(html).toContain('RUF');
    expect(html).toContain('href="tel:038555573340"');
    expect(html).toContain('0385 55573340');
    expect(html).toContain('Anruf 60 min vor Abfahrt');
  });
  it('only says a booking is needed when the operator is not known', () => {
    const html = timeline(itin(leg({ mode: 'ODM', agency: 'Irgendwo', reservation: 'COMPULSORY' })));
    expect(html).toContain('Anmeldung erforderlich');
    expect(html).not.toContain('tel:');
  });
  it('shows nothing for a normal bus', () => {
    expect(timeline(itin(leg({ agency: 'Nordwestmecklenburg' })))).not.toContain('tel:');
  });
});
