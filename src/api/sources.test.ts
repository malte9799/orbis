import { describe, it, expect } from 'vitest';
import { parseEdgarFilings, edgarSearchUrl } from './edgar';
import { parseOfacConsolidated } from './sanctions';
import { parseEiaResponse } from './eia';
import { parseEpochDcCsv } from './epoch';
import { transformBundle } from './mitre';
import { parseGibsCapabilities } from './nasagibs';
import { parseUcdpEvents } from './events';
import { vipPhotoCredit, VIP_ATTRIBUTION } from './vip';

describe('edgar', () => {
  it('parses filings, dedupes by accession and splits tickers', () => {
    const hit = (adsh: string) => ({
      _id: `${adsh}:doc.htm`,
      _source: {
        adsh,
        ciks: ['0000320193'],
        display_names: ['Apple Inc.  (AAPL)  (CIK 0000320193)'],
        form: '8-K',
        root_forms: ['8-K'],
        file_date: '2026-01-05',
        items: ['2.02'],
        biz_locations: ['Cupertino, CA'],
      },
    });
    const out = parseEdgarFilings({ hits: { hits: [hit('0000320193-26-000001'), hit('0000320193-26-000001')] } });
    expect(out).toHaveLength(1);
    expect(out[0].company).toBe('Apple Inc.');
    expect(out[0].tickers).toEqual(['AAPL']);
    expect(out[0].url).toBe('https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/doc.htm');
  });
  it('handles garbage and builds a search url', () => {
    expect(parseEdgarFilings(null)).toEqual([]);
    expect(edgarSearchUrl(7, new Date('2026-01-10T12:00:00Z'))).toContain('startdt=2026-01-03&enddt=2026-01-10');
  });
});

describe('sanctions OFAC parser', () => {
  it('reads the name from the primary block, not from an alias', () => {
    const xml = `<sdnList><publshInformation><Publish_Date>01/02/2026</Publish_Date></publshInformation>
<sdnEntry><uid>1</uid><lastName>PRIMARY CORP</lastName><sdnType>Entity</sdnType>
<programList><program>RUSSIA-EO14024</program></programList>
<akaList><aka><uid>9</uid><lastName>ALIAS CO</lastName></aka></akaList></sdnEntry>
<sdnEntry><uid>2</uid><firstName>John</firstName><lastName>Doe</lastName><sdnType>Individual</sdnType>
<akaList><aka><firstName>Johnny</firstName><lastName>D</lastName></aka></akaList></sdnEntry></sdnList>`;
    const out = parseOfacConsolidated(xml);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('PRIMARY CORP');
    expect(out[0].aliases).toEqual(['ALIAS CO']);
    expect(out[0].program).toBe('RUSSIA-EO14024');
    expect(out[1].name).toBe('John Doe');
    expect(out[1].aliases).toEqual(['Johnny D']);
  });
});

describe('eia', () => {
  it('parses rows and rejects empty responses', () => {
    const d = parseEiaResponse({ response: { data: [{ period: '2026-01-02', series: 'RWTC', 'series-description': 'WTI', value: '71.2', units: '$/BBL' }, { period: '', series: 'X' }] } });
    expect(d.prices).toHaveLength(1);
    expect(d.prices[0].value).toBe(71.2);
    expect(() => parseEiaResponse({})).toThrow();
  });
});

describe('epoch', () => {
  it('parses a csv with quoted fields', () => {
    const csv = 'Name,Owner,Current power (MW),Current H100 equivalents,Country\n"Site, A",Acme #x,150,1000,US\n,,,,\n';
    const out = parseEpochDcCsv(csv);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Site, A');
    expect(out[0].owner).toBe('Acme');
    expect(out[0].powerMw).toBe(150);
  });
});

describe('mitre', () => {
  it('maps tactics, techniques and group usage', () => {
    const ref = (id: string) => [{ source_name: 'mitre-attack', external_id: id, url: `https://attack.mitre.org/${id}` }];
    const data = transformBundle({
      objects: [
        { type: 'x-mitre-tactic', id: 'tac--1', name: 'Execution', x_mitre_shortname: 'execution', external_references: ref('TA0002') },
        { type: 'attack-pattern', id: 'ap--1', name: 'PowerShell', kill_chain_phases: [{ phase_name: 'execution' }], external_references: ref('T1059.001'), x_mitre_is_subtechnique: true },
        { type: 'attack-pattern', id: 'ap--2', name: 'Old', revoked: true, external_references: ref('T0000') },
        { type: 'intrusion-set', id: 'is--1', name: 'APT1', aliases: ['Comment Crew'], external_references: ref('G0006') },
        { type: 'relationship', relationship_type: 'uses', source_ref: 'is--1', target_ref: 'ap--1' },
      ],
    });
    expect(data.tactics).toHaveLength(1);
    expect(data.techniques).toHaveLength(1);
    expect(data.techniques[0].parentTechnique).toBe('T1059');
    expect(data.techniques[0].tactics).toEqual(['Execution']);
    expect(data.groups[0].techniques).toEqual(['T1059.001']);
  });
});

describe('nasagibs', () => {
  it('parses layer identifiers from capabilities xml', () => {
    const xml = `<Capabilities><Contents><Layer><ows:Title>Sea Surface</ows:Title><ows:Identifier>GHRSST_L4</ows:Identifier><Format>image/png</Format><TileMatrixSet>250m</TileMatrixSet></Layer></Contents></Capabilities>`;
    const l = parseGibsCapabilities(xml);
    expect(l).toHaveLength(1);
    expect(l[0].id).toBe('GHRSST_L4');
    expect(l[0].title).toBe('Sea Surface');
  });
});

describe('ucdp mapping', () => {
  it('sums deaths and never yields NaN for missing fields', () => {
    const fc = parseUcdpEvents({ Result: [{ id: 5, longitude: 10, latitude: 20, deaths_a: 2, deaths_civilians: 3, side_a: 'A', side_b: 'B' }] });
    expect(fc.features[0].properties.deaths).toBe(5);
    expect(fc.features[0].geometry.coordinates).toEqual([10, 20]);
    expect(parseUcdpEvents({}).features).toEqual([]);
  });
});

describe('vip', () => {
  it('builds the photo credit line', () => {
    expect(vipPhotoCredit({ photo: 'u', photo_credit: 'Jane', photo_license: 'CC BY 2.0' })).toBe('Jane, CC BY 2.0 (Wikimedia Commons)');
    expect(vipPhotoCredit({ photo: null })).toBeNull();
    expect(VIP_ATTRIBUTION).toContain('Wikidata');
  });
});
