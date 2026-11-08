import { describe, expect, it } from 'vitest';
import { pickRtsw, parseStukXml, packHcStations, pickSsmLatest, parseNuscCsv } from './earth';
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

describe('pickSsmLatest', () => {
  it('picks the newest valid hourly value and ignores stale/invalid rows', () => {
    const now = 1794135600000 + 3600000;
    const json = {
      resolution: 'Hour',
      values: [
        [1794121200000, 0.1415],
        [1794135600000, 0.138],
        [1794132000000, 0.139],
        [1794135600000 - 49 * 3600000, 0.2],
        [1794135600000, 0],
      ],
    };
    expect(pickSsmLatest(json, now)).toEqual({ usvh: 0.138, time: 1794135600000 });
  });
  it('returns null for missing or empty values', () => {
    expect(pickSsmLatest({}, 0)).toBeNull();
    expect(pickSsmLatest({ values: [] }, 0)).toBeNull();
  });
});

describe('parseNuscCsv', () => {
  it('parses OGDL CSV rows (µSv/h, Taiwan time +08:00) and drops stale/invalid rows', () => {
    const csv = '\uFEFF監測站,監測站(英文),監測值(微西弗/時),時間,GPS經度,GPS緯度\n磺潭,HWANGTAN,0.052,2026-11-08 19:05,121.646598,25.199527\n舊站,OLD,0.040,2026-11-01 00:00,121.0,25.0\n壞站,BAD,-1,2026-11-08 19:05,121.0,25.0\n';
    const now = Date.parse('2026-11-08T12:00:00Z'); // 20:00 +08
    expect(parseNuscCsv(csv, now)).toEqual([['HWANGTAN', 121.6466, 25.1995, 0.052, Date.parse('2026-11-08T11:05:00Z') / 1000]]);
  });
  it('returns an empty list for missing data', () => expect(parseNuscCsv('', 0)).toEqual([]));
});
