import { snapshotJson } from './data';

/** A vessel designated under sanctions (OFAC SDN and other programs as available). */
export interface SanctionedVessel {
  /** Stable id, e.g. "ofac-vessel:<uid>". */
  id: string;
  name: string;
  aliases?: string[];
  /** IMO ship identification number (digits). */
  imo?: string;
  mmsi?: string;
  callSign?: string;
  /** Flag state / country of registration as reported by the source. */
  flag?: string;
  vesselType?: string;
  tonnage?: string;
  grt?: string;
  programs: string[];
  source: 'ofac';
  listed?: string;
  remarks?: string;
}

export interface SanctionedVesselsData {
  generated: string;
  source?: string;
  count?: number;
  vessels: SanctionedVessel[];
}

function parseOfacSdnVessels(xml: string): SanctionedVessel[] {
  const publish = (xml.match(/<Publish_Date>([^<]+)<\/Publish_Date>/)?.[1] ?? '').trim();
  const vessels: SanctionedVessel[] = [];
  const tag = (block: string, t: string) => {
    const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i'));
    return m ? m[1].trim() : '';
  };

  for (const chunk of xml.split('<sdnEntry>')) {
    if (!chunk.includes('</sdnEntry>')) continue;
    const block = chunk.slice(0, chunk.indexOf('</sdnEntry>'));
    if (!/\bVessel\b/i.test(tag(block, 'sdnType'))) continue;
    const uid = tag(block, 'uid');
    const last = tag(block, 'lastName');
    const first = tag(block, 'firstName');
    const name = [first, last].filter(Boolean).join(' ').trim() || last || first;
    if (!name) continue;

    const programs = [...block.matchAll(/<program>([^<]+)<\/program>/gi)].map((m) => m[1].trim()).filter(Boolean);

    const aliases: string[] = [];
    for (const aka of block.split('<aka>')) {
      if (!aka.includes('</aka>')) continue;
      const ab = aka.slice(0, aka.indexOf('</aka>'));
      const af = (ab.match(/<firstName>([^<]*)<\/firstName>/i)?.[1] ?? '').trim();
      const al = (ab.match(/<lastName>([^<]*)<\/lastName>/i)?.[1] ?? '').trim();
      const an = [af, al].filter(Boolean).join(' ').trim() || al || af;
      if (an && an !== name && !aliases.includes(an)) aliases.push(an);
    }

    let imo = '', mmsi = '', callSign = '', flag = '', vesselType = '', tonnage = '', grt = '';
    for (const id of block.split('<id>')) {
      if (!id.includes('</id>')) continue;
      const ib = id.slice(0, id.indexOf('</id>'));
      const idType = (ib.match(/<idType>([^<]*)<\/idType>/i)?.[1] ?? '').trim();
      const idNum = (ib.match(/<idNumber>([^<]*)<\/idNumber>/i)?.[1] ?? '').trim();
      const idCountry = (ib.match(/<idCountry>([^<]*)<\/idCountry>/i)?.[1] ?? '').trim();
      if (!idNum) continue;
      const t = idType.toLowerCase();
      if (t.includes('imo')) imo ||= idNum.replace(/^IMO\s*/i, '');
      else if (t.includes('mmsi')) mmsi ||= idNum;
      else if (t.includes('call sign')) callSign ||= idNum;
      else if (t.includes('registration') && idCountry) flag ||= idCountry;
    }

    const vi = (block.match(/<vesselInfo>([\s\S]*?)<\/vesselInfo>/i)?.[1] ?? '');
    if (vi) {
      flag ||= tag(vi, 'vesselFlag');
      vesselType ||= tag(vi, 'vesselType');
      tonnage ||= tag(vi, 'tonnage');
      grt ||= tag(vi, 'grossRegisteredTonnage');
      callSign ||= tag(vi, 'callSign');
    }

    if (!flag) {
      const addrCountry = (block.match(/<address>[\s\S]*?<country>([^<]+)<\/country>[\s\S]*?<\/address>/i)?.[1] ?? '').trim();
      if (addrCountry) flag = addrCountry;
    }

    const remarks = tag(block, 'remarks') || undefined;
    vessels.push({
      id: `ofac-vessel:${uid || imo || name}`,
      name,
      ...(aliases.length ? { aliases } : {}),
      ...(imo ? { imo } : {}),
      ...(mmsi ? { mmsi } : {}),
      ...(callSign ? { callSign } : {}),
      ...(flag ? { flag } : {}),
      ...(vesselType ? { vesselType } : {}),
      ...(tonnage ? { tonnage } : {}),
      ...(grt ? { grt } : {}),
      programs,
      source: 'ofac',
      ...(publish ? { listed: publish } : {}),
      ...(remarks ? { remarks: remarks.slice(0, 500) } : {}),
    });
  }
  return vessels;
}

/** Sanctioned vessels (OFAC SDN and others as available) from orbis-data snapshot, live fallback to OFAC SDN. */
export async function loadSanctionedVessels(): Promise<SanctionedVesselsData> {
  return snapshotJson<SanctionedVesselsData>(
    'intel/sanctioned-vessels.json',
    async () => {
      const res = await fetch('https://sanctionslistservice.ofac.treas.gov/api/download/sdn.xml');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const vessels = parseOfacSdnVessels(await res.text());
      return { generated: new Date().toISOString(), source: 'OFAC SDN (live)', count: vessels.length, vessels };
    },
  );
}
