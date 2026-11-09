import { describe, expect, it } from 'vitest';
import { cyberFeatures, gdeltFeatures, gemFeatures, gemGroup, hormuzFeatures, portwatchFeatures, ucdpFeatures, validLonLat, vipFeatures } from './intel';

const pt = <T extends object>(lon: number, lat: number, properties: T) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lon, lat] }, properties });

describe('intel feature mapping', () => {
  it('validates positions', () => {
    expect(validLonLat(10, 50)).toBe(true);
    expect(validLonLat(0, 0)).toBe(false);
    expect(validLonLat(NaN, 1)).toBe(false);
    expect(validLonLat(200, 1)).toBe(false);
  });
  it('gdelt drops invalid and duplicate points', () => {
    const out = gdeltFeatures({ type: 'FeatureCollection', features: [pt(1, 2, { name: 'A', url: 'u' }), pt(1, 2, { name: 'A', url: 'u' }), pt(NaN, 2, { name: 'B', url: 'v' })] });
    expect(out.features).toHaveLength(1);
    expect(gdeltFeatures(null).features).toHaveLength(0);
  });
  it('ucdp keeps deaths', () => {
    const out = ucdpFeatures({ type: 'FeatureCollection', features: [pt(30, 48, { id: '1', deaths: 12, side_a: 'a', side_b: 'b' })] });
    expect(out.features[0].properties.deaths).toBe(12);
  });
  it('gem groups fuel types and skips assets without position', () => {
    expect(gemGroup('Coal Mine')).toBe('coal');
    expect(gemGroup('Oil & Gas Pipeline')).toBe('oil');
    expect(gemGroup('LNG Terminal')).toBe('gas');
    expect(gemGroup(undefined)).toBe('other');
    const out = gemFeatures([
      { asset_id: 'a', asset_name: 'X', asset_type: 'Solar Farm', latitude: 10, longitude: 20, capacity_value: 5, capacity_unit: 'MW' },
      { asset_id: 'b', asset_name: 'Y', asset_type: 'Coal Mine', latitude: null, longitude: null },
    ]);
    expect(out.features).toHaveLength(1);
    expect(out.features[0].properties.group).toBe('solar');
  });
  it('portwatch merges chokepoints and ports', () => {
    const out = portwatchFeatures({ generated: '', ports: [{ portid: 'p', portname: 'P', lat: 1, long: 2, vessel_count_total: 7 }, { portid: 'q', portname: 'Q' }], chokepoints: [{ portid: 'c', portname: 'C', lat: 3, lon: 4 }] });
    expect(out.features.map((f) => f.properties.kind)).toEqual(['choke', 'port']);
    expect(out.features[0].properties.n).toBe(0);
  });
  it('cyber only maps entries with lat/lon', () => {
    const out = cyberFeatures([{ ip_address: '1.1.1.1', port: 443, status: 'online', lat: 5, lon: 6 }, { ip_address: '2.2.2.2', port: 80, status: 'online' }]);
    expect(out.features).toHaveLength(1);
  });
  it('hormuz maps compact rows by field name', () => {
    const out = hormuzFeatures({ t: 0, n: 2, fields: ['id', 'name', 'lat', 'lon', 'speed', 'category'], rows: [['1', 'SHIP', 25, 56, 3, 'cargo'], ['2', 'NOPOS', null, null, 0, 'x']] });
    expect(out.features).toHaveLength(1);
    expect(out.features[0].properties).toMatchObject({ name: 'SHIP', cat: 'cargo', speed: 3 });
  });
  it('vip maps company headquarters', () => {
    const out = vipFeatures({ generated: '', people: [{ id: 'p', name: 'P', companies: [{ id: 'c', name: 'C', lon: 1, lat: 2 }], aircraft: [], yacht: [], home_lon: 0, home_lat: 0 }] });
    expect(out.features[0].properties).toMatchObject({ i: 0, c: 0, person: 'P' });
  });
});
