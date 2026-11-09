import { snapshotJson } from './data';

/** Credits for the lists contained in the sanctions snapshot. */
export const OFAC_ATTRIBUTION = 'U.S. Treasury OFAC SDN list (public domain)';
export const UK_SANCTIONS_ATTRIBUTION = 'UK Sanctions List, FCDO (Open Government Licence v3.0)';

export interface SanctionEntry {
  id: string;
  name: string;
  aliases: string[];
  type: string;
  country: string;
  program: string;
  source: 'ofac' | 'uk' | 'eu' | 'canada';
  listed: string;
}

export interface SanctionsData {
  generated: string;
  entries: SanctionEntry[];
}

export function parseOfacConsolidated(xml: string): SanctionEntry[] {
  const out: SanctionEntry[] = [];
  const publish = (xml.match(/<Publish_Date>([^<]+)<\/Publish_Date>/)?.[1] ?? '').trim();
  for (const chunk of xml.split('<sdnEntry>')) {
    if (!chunk.includes('</sdnEntry>')) continue;
    const block = chunk.slice(0, chunk.indexOf('</sdnEntry>'));
    // primary identity = everything before the first <akaList>; names inside aliases must not leak into it
    const akaStart = block.indexOf('<akaList>');
    const primary = akaStart >= 0 ? block.slice(0, akaStart) : block;
    const tag = (t: string) => {
      const m = primary.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
      return m ? m[1].trim() : '';
    };
    const uid = tag('uid');
    const first = tag('firstName');
    const last = tag('lastName');
    const type = tag('sdnType') || 'Entity';
    const name = [first, last].filter(Boolean).join(' ').trim() || last || first;
    if (!name) continue;
    const programs = [...primary.matchAll(/<program>([^<]+)<\/program>/g)].map((m) => m[1].trim());
    const aliases: string[] = [];
    for (const aka of block.split('<aka>')) {
      if (!aka.includes('</aka>')) continue;
      const ab = aka.slice(0, aka.indexOf('</aka>'));
      const af = (ab.match(/<firstName>([^<]*)<\/firstName>/)?.[1] ?? '').trim();
      const al = (ab.match(/<lastName>([^<]*)<\/lastName>/)?.[1] ?? '').trim();
      const an = [af, al].filter(Boolean).join(' ').trim();
      if (an && an !== name && !aliases.includes(an)) aliases.push(an);
    }
    out.push({
      id: `ofac:${uid || name}`,
      name,
      aliases,
      type,
      country: '',
      program: programs.join('; '),
      source: 'ofac',
      listed: publish,
    });
  }
  return out;
}

/** Sanctions lists (OFAC, UK, EU, Canada) from orbis-data snapshot, live fallback to OFAC consolidated. */
export async function loadSanctions(): Promise<SanctionsData> {
  return snapshotJson<SanctionsData>(
    'intel/sanctions.json',
    async () => {
      const res = await fetch('https://sanctionslistservice.ofac.treas.gov/api/download/consolidated.xml');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { generated: new Date().toISOString(), entries: parseOfacConsolidated(await res.text()) };
    },
  );
}