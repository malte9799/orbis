import { snapshotJson } from './data';

export interface HormuzWindow {
  in?: number;
  out?: number;
  total?: number;
  tankers?: number;
  cargo?: number;
  crude?: number;
  products?: number;
  lng?: number;
  lpg?: number;
  container?: number;
  bulk?: number;
  dwt?: number;
  since?: number;
  until?: number;
  allVessels?: number;
  [key: string]: unknown;
}

export interface HormuzStatus {
  generatedAt?: number;
  status?: {
    level?: string;
    label?: string;
    sublabel?: string;
    reason?: string;
    source?: string;
    pct?: number;
    ais24?: number;
    ais7?: number;
    ais7Equiv?: number;
    baseline?: number;
    estimated?: boolean;
    health?: string;
    dayCount?: number;
    crisisStart?: string;
    asOf?: number;
    since?: number;
    autoLevel?: string;
    autoSublabel?: string;
  };
  today?: HormuzWindow;
  last24h?: HormuzWindow;
  last7d?: HormuzWindow;
  avg7d?: number;
  lastCrossing?: Record<string, unknown>;
  fleet?: {
    vessels?: number;
    commercial?: number;
    tankers?: number;
    lng?: number;
    waitingGulf?: number;
    waitingOman?: number;
  };
  feed?: Record<string, unknown>;
  baseline?: Record<string, unknown>;
  portwatch?: Record<string, unknown>;
  license?: string;
  source?: string;
  [key: string]: unknown;
}

export interface HormuzCompactSnapshot {
  t: number;
  n: number;
  fields: string[];
  rows: unknown[][];
}

export interface HormuzData {
  generated: string;
  status: HormuzStatus;
  snapshot?: HormuzCompactSnapshot;
}

/** hormuz.now: Strait of Hormuz status & ship positions (snapshot from orbis-data, live fallback). */
export async function loadHormuz(): Promise<HormuzData> {
  return snapshotJson<HormuzData>(
    'intel/hormuz.json',
    async () => {
      const statusRes = await fetch('https://hormuz.now/status.json');
      if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
      const status = (await statusRes.json()) as HormuzStatus;

      let snapshot: HormuzCompactSnapshot | undefined;
      try {
        const snapRes = await fetch('https://hormuz.now/api/snapshot?format=compact');
        if (snapRes.ok) snapshot = (await snapRes.json()) as HormuzCompactSnapshot;
      } catch {
        // positions are optional; keep status
      }

      return {
        generated: new Date().toISOString(),
        status,
        snapshot,
      };
    },
  );
}