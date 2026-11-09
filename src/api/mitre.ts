import { snapshotJson } from './data';

/** Source credit to show wherever this data is rendered. */
export const MITRE_ATTRIBUTION = 'MITRE ATT&CK® © The MITRE Corporation, used under the ATT&CK Terms of Use';

export interface MitreTactic {
  id: string;
  name: string;
  shortname?: string;
  description?: string;
  modified?: string;
}

export interface MitreTechnique {
  id: string;
  name: string;
  description?: string;
  isSubtechnique: boolean;
  parentTechnique?: string;
  tactics: string[];
  platforms: string[];
  url?: string;
  modified?: string;
}

export interface MitreGroup {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  url?: string;
  modified?: string;
  techniques: string[];
}

export interface MitreAttackData {
  generated: string;
  groups: MitreGroup[];
  techniques: MitreTechnique[];
  tactics: MitreTactic[];
}

function extId(obj: any): string | undefined {
  return (obj?.external_references as any[] | undefined)?.find((r) => r?.source_name === 'mitre-attack')?.external_id;
}

function link(obj: any): string | undefined {
  return (obj?.external_references as any[] | undefined)?.find((r) => r?.source_name === 'mitre-attack')?.url;
}

function hasEnterpriseDomain(obj: any): boolean {
  const d = obj?.x_mitre_domains;
  return !Array.isArray(d) || d.includes('enterprise-attack');
}

function isActive(obj: any): boolean {
  return !obj?.revoked && !obj?.x_mitre_deprecated && hasEnterpriseDomain(obj);
}

export function transformBundle(bundle: any): MitreAttackData {
  const objects: any[] = Array.isArray(bundle?.objects) ? bundle.objects : [];

  const tactics: MitreTactic[] = [];
  for (const o of objects.filter((o) => o?.type === 'x-mitre-tactic' && isActive(o))) {
    const id = extId(o);
    if (!id) continue;
    tactics.push({
      id,
      name: String(o.name ?? ''),
      shortname: o.x_mitre_shortname ? String(o.x_mitre_shortname) : undefined,
      description: o.description ? String(o.description) : undefined,
      modified: o.modified ? String(o.modified) : undefined,
    });
  }

  const techniques: MitreTechnique[] = [];
  const techByStix = new Map<string, string>();
  for (const o of objects.filter((o) => o?.type === 'attack-pattern' && isActive(o))) {
    const id = extId(o);
    if (!id) continue;
    const isSub = Boolean(o.x_mitre_is_subtechnique);
    const parent = isSub ? id.split('.')[0] : undefined;
    const tacticNames = (Array.isArray(o.kill_chain_phases) ? o.kill_chain_phases : []).map((k: any) => {
      const t = tactics.find((x) => x.shortname === k?.phase_name);
      return t ? t.name : String(k?.phase_name ?? '');
    });
    techniques.push({
      id,
      name: String(o.name ?? ''),
      description: o.description ? String(o.description) : undefined,
      isSubtechnique: isSub,
      parentTechnique: parent && parent !== id ? parent : undefined,
      tactics: tacticNames,
      platforms: Array.isArray(o.x_mitre_platforms) ? o.x_mitre_platforms.map((p: any) => String(p)) : [],
      url: link(o),
      modified: o.modified ? String(o.modified) : undefined,
    });
    techByStix.set(String(o.id), id);
  }

  const groups: MitreGroup[] = [];
  const groupByStix = new Map<string, MitreGroup>();
  for (const o of objects.filter((o) => o?.type === 'intrusion-set' && isActive(o))) {
    const id = extId(o);
    if (!id) continue;
    const g: MitreGroup = {
      id,
      name: String(o.name ?? ''),
      aliases: Array.isArray(o.aliases) ? o.aliases.map((a: any) => String(a)) : [],
      description: o.description ? String(o.description) : undefined,
      url: link(o),
      modified: o.modified ? String(o.modified) : undefined,
      techniques: [],
    };
    groups.push(g);
    groupByStix.set(String(o.id), g);
  }

  for (const r of objects.filter((o) => o?.type === 'relationship' && o?.relationship_type === 'uses' && !o?.revoked && !o?.x_mitre_deprecated)) {
    const g = groupByStix.get(String(r.source_ref));
    if (!g) continue;
    const tid = techByStix.get(String(r.target_ref));
    if (!tid) continue;
    if (!g.techniques.includes(tid)) g.techniques.push(tid);
  }

  for (const g of groups) g.techniques.sort();
  groups.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  techniques.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  tactics.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return { generated: new Date().toISOString(), groups, techniques, tactics };
}

/** MITRE ATT&CK (intrusion groups/techniques) from orbis-data snapshot, live fallback to MITRE CTI. */
export async function loadMitreAttack(): Promise<MitreAttackData> {
  return snapshotJson<MitreAttackData>(
    'intel/mitre-attack.json',
    async () => {
      const res = await fetch('https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return transformBundle(await res.json());
    },
  );
}