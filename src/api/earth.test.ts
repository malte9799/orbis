import { describe, expect, it } from 'vitest';
import { pickRtsw, parseStukXml, packHcStations } from './earth';
import stukXml from './fixtures/stuk-multipointcoverage.xml?raw';
import hcJson from './fixtures/hc-fpsn.geojson?raw';

describe('pickRtsw', () => {
  it('prefers the newest active row and skips fill values', () => {
    const rows = [
      { time_tag: '2026-11-03T16:18:00', active: false, bz_gsm: 9 },
      { time_tag: '2026-11-03T16:17:00', active: true, bz_gsm: -2.1 },
      { time_tag: '2026-11-03T16:16:00', active: true, bz_gsm: -9999 },
      { time_tag: '2026-11-03T16:15:00', active: true, bz_gsm: -1.5 },
    ];
    expect(pickRtsw<{ bz_gsm: number }>(rows, 'bz_gsm')?.bz_gsm).toBe(-2.1);
  });
  it('returns null for non-arrays', () => expect(pickRtsw({}, 'x' as never)).toBeNull());
});

describe('parseStukXml', () => {
  const now = 1793733000 * 1000 + 3600000;
  it('reads name, position, dose rate and time; drops stale and NaN stations', () => {
    expect(parseStukXml(stukXml, now)).toEqual([
      ['Helsinki Vuosaaren Satama', 25.1788, 60.2229, 0.112, 1793733000],
      ['Helsinki Suomenlinna', 24.9903, 60.1464, 0.161, 1793733000],
    ]);
  });
  it('returns an empty list for unrelated XML', () => expect(parseStukXml('<a/>', now)).toEqual([]));
});

describe('packHcStations', () => {
  const now = 1793732400000 + 3600000;
  it('converts nSv/h to µSv/h, strips the coordinates from the name, drops stale and zero readings', () => {
    const out = packHcStations(JSON.parse(hcJson), now);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(['1000_10', -79.0614, 43.8173, 0.03, 1793732400]);
  });
});
