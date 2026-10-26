import { beforeEach, describe, expect, it } from 'vitest';

// tiny localStorage stand-in: store.ts reads the options from there
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { tempTxt, windTxt, windDirTxt, pressureTxt, rainTxt, rainVal, distTxt, speedTxt, areaTxt, acresTxt, coordsTxt, hourTxt, clockTxt } = await import('./units');

const set = (o: Record<string, string>) => mem.set('wg.options', JSON.stringify(o));
beforeEach(() => mem.clear());

describe('units (defaults)', () => {
  it('stays metric', () => {
    expect(tempTxt(12.34)).toBe('12,3 °C');
    expect(windTxt(20)).toBe('20 km/h');
    expect(pressureTxt(1013.4)).toBe('1.013 hPa');
    expect(distTxt(5)).toBe('5,0 km');
    expect(areaTxt(12)).toBe('12,0 km²');
    expect(windDirTxt(186)).toBe('S');
  });
});

describe('temperature / wind / pressure', () => {
  it('converts °C → °F', () => {
    set({ temp: 'f' });
    expect(tempTxt(0)).toBe('32,0 °F');
    expect(tempTxt(100)).toBe('212,0 °F');
  });
  it('converts wind', () => {
    set({ wind: 'ms' });
    expect(windTxt(36)).toBe('10 m/s');
    set({ wind: 'kn' });
    expect(windTxt(18.52)).toBe('10 Knoten');
    set({ wind: 'bft' });
    expect(windTxt(100)).toBe('10 Bft');
    set({ wind: 'mph' });
    expect(windTxt(100)).toBe('62 mph');
  });
  it('wind direction in degrees wraps negatives', () => {
    set({ windDir: 'deg' });
    expect(windDirTxt(186)).toBe('186°');
    expect(windDirTxt(-90)).toBe('270°');
  });
  it('converts pressure', () => {
    set({ pressure: 'mmhg' });
    expect(pressureTxt(1013.25)).toBe('760 mmHg');
    set({ pressure: 'inhg' });
    expect(pressureTxt(1013.25)).toBe('29,92 inHg');
    set({ pressure: 'mb' });
    expect(pressureTxt(1000)).toBe('1.000 mb');
  });
});

describe('rain', () => {
  it('mm/h → in/h', () => {
    set({ rain: 'in' });
    expect(rainTxt(25.4, 2)).toBe('1,00 in/h');
  });
  it('mm/h → dBZ (Marshall–Palmer, Z = 200·R^1.6)', () => {
    set({ rain: 'dbz' });
    expect(rainVal(1)).toBeCloseTo(23.01, 1);
    expect(rainVal(10)).toBeCloseTo(39.0, 0);
  });
});

describe('distance / speed / area', () => {
  it('distance', () => {
    set({ dist: 'mi' });
    expect(distTxt(100, 0)).toBe('62 Meilen');
    set({ dist: 'nmi' });
    expect(distTxt(185.2, 0)).toBe('100 Seemeilen');
  });
  it('vehicle speed follows the distance unit', () => {
    expect(speedTxt(100)).toBe('100 km/h');
    set({ dist: 'mi' });
    expect(speedTxt(100)).toBe('62 mph');
    set({ dist: 'nmi' });
    expect(speedTxt(185.2)).toBe('100 kn');
  });
  it('area and burned area are independent', () => {
    set({ area: 'ha', burned: 'acre' });
    expect(areaTxt(1, false, 0)).toBe('100 Hektar');
    expect(areaTxt(1, true, 0)).toBe('247 Acre');
    expect(acresTxt(247.105, true, 0)).toBe('247 Acre');
  });
});

describe('coordinates', () => {
  it('decimal degrees', () => {
    expect(coordsTxt(51.513, -0.1)).toBe('51,513° N, 0,1° W');
  });
  it('DMS carries 60″ into the minutes', () => {
    set({ coords: 'gms' });
    expect(coordsTxt(51.5128, 10)).toBe('51° 30′ 46″ N, 10° 0′ 0″ O');
    expect(coordsTxt(10.99999, 0)).toBe('11° 0′ 0″ N, 0° 0′ 0″ O');
  });
});

describe('time', () => {
  it('12 h clock', () => {
    set({ hour12: '12h' });
    expect(hourTxt('00:05')).toBe('12:05 AM');
    expect(hourTxt('12:00')).toBe('12:00 PM');
    expect(hourTxt('14:30')).toBe('2:30 PM');
  });
  it('24 h clock leaves the string alone', () => {
    expect(hourTxt('14:30')).toBe('14:30');
  });
  it('UTC clock is labelled', () => {
    set({ tz: 'utc' });
    expect(clockTxt(Date.UTC(2026, 0, 1, 14, 5))).toBe('14:05 UTC');
    set({ tz: 'utc', hour12: '12h' });
    expect(clockTxt(Date.UTC(2026, 0, 1, 14, 5))).toMatch(/^2:05\s?PM UTC$/);
  });
});
