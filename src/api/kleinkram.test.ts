import { describe, expect, it } from 'vitest';
import { packPowerPlants, powerFeatures } from './infra';
import { packWikidata, wikidataFeatures } from './resources';

describe('packPowerPlants', () => {
  const csv = [
    'country,country_long,name,gppd_idnr,capacity_mw,latitude,longitude,primary_fuel,commissioning_year,owner,url',
    'DEU,Germany,"Small, Hydro",G1,3.456,50.123456,8.654321,Hydro,1950.0,,',
    'FRA,France,Big Nuclear,G2,1300,49.5,0.5,Nuclear,1985.0,EDF,https://example.org/p',
    'XXX,Nowhere,Broken,G3,5,,,Coal,,,',
    'USA,United States,Odd Fuel,G4,10,40,-100,Mystery,,Acme,',
  ].join('\n');
  it('keeps the used columns, rounds, sorts by capacity and drops rows without position', () => {
    const rows = packPowerPlants(csv);
    expect(rows).toEqual([
      [0.5, 49.5, 1300, 'Nuclear', 'Big Nuclear', 'France', 1985, 'EDF', 'https://example.org/p'],
      [-100, 40, 10, 'Other', 'Odd Fuel', 'United States', 0, 'Acme', ''],
      [8.6543, 50.1235, 3.5, 'Hydro', 'Small, Hydro', 'Germany', 1950, '', ''],
    ]);
  });
  it('rejects an unexpected header', () => expect(() => packPowerPlants('a,b\n1,2')).toThrow());
  it('builds the same features the CSV loader did', () => {
    const f = powerFeatures(packPowerPlants(csv)).features;
    expect(f).toHaveLength(3);
    expect(f[0].properties).toMatchObject({ cat: 'nuclear', mw: 1300, title: 'Big Nuclear', url: 'https://example.org/p' });
    expect(f[0].properties!.subtitle).toContain('seit 1985');
    expect(f[2].properties!.url).toBe('https://datasets.wri.org/dataset/globalpowerplantdatabase');
  });
});

describe('packWikidata', () => {
  const json = {
    results: {
      bindings: [
        { item: { value: 'http://www.wikidata.org/entity/Q1' }, itemLabel: { value: 'Grube A' }, coord: { value: 'Point(12.123456 51.5)' }, classLabel: { value: 'coal mine' }, products: { value: 'coal' } },
        { item: { value: 'http://www.wikidata.org/entity/Q1' }, itemLabel: { value: 'Grube A' }, coord: { value: 'Point(12.1 51.5)' }, classLabel: { value: 'mine' }, products: { value: '' } },
        { item: { value: 'http://www.wikidata.org/entity/Q2' }, coord: { value: 'garbage' }, classLabel: { value: 'mine' } },
        { item: { value: 'http://www.wikidata.org/entity/Q3' }, coord: { value: 'Point(-1e1 5)' } },
      ],
    },
  };
  it('deduplicates by item, parses WKT and rounds', () => {
    expect(packWikidata(json)).toEqual([
      [12.1235, 51.5, 'Q1', 'Grube A', 'coal mine', 'coal'],
      [-10, 5, 'Q3', 'Q3', '', ''],
    ]);
  });
  it('turns rows into classified features', () => {
    const f = wikidataFeatures(packWikidata(json)).features;
    expect(f[0].properties).toMatchObject({ cat: 'coal', title: 'Grube A', url: 'https://www.wikidata.org/wiki/Q1', source: 'Wikidata' });
  });
});
