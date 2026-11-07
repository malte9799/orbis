import { snapshotJson } from './data';

export interface GlobalFirepowerCountry {
  id: string;
  rank: number;
  name: string;
  code: string;
  pwrIndex: number;
  trend?: string;
}

export interface GlobalFirepowerData {
  generated?: string;
  source?: string;
  countries: GlobalFirepowerCountry[];
}

function parseListing(html: string): GlobalFirepowerData {
  const re = /country-military-strength-detail\.php\?country_id=([a-z0-9-]+)"[^>]*>([\s\S]*?)PwrIndx:\s*([0-9.]+)/g;
  const countries: GlobalFirepowerCountry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const chunk = m[2];
    const pwr = Number(m[3]);
    const rankM = /rankNumContainer[\s\S]*?>\s*(\d+)\s*</.exec(chunk);
    const nameM = /longFormName[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/.exec(chunk);
    const codeM = /shortFormName[\s\S]*?<span[^>]*>\s*([A-Z]{3})\s*<\/span>/.exec(chunk);
    const trendM = /arrow-([a-z]+)\.png/.exec(chunk);
    if (!rankM || !nameM || !codeM) continue;
    countries.push({
      id,
      rank: Number(rankM[1]),
      name: nameM[1].trim(),
      code: codeM[1].trim(),
      pwrIndex: pwr,
      trend: trendM ? trendM[1] : undefined,
    });
  }
  if (countries.length < 100) throw new Error(`Global Firepower: only ${countries.length} countries`);
  countries.sort((a, b) => a.rank - b.rank);
  return { generated: new Date().toISOString(), source: 'Global Firepower (globalfirepower.com)', countries };
}

/** Global Firepower country military strength ranking (snapshot from orbis-data, live fallback). */
export async function loadGlobalFirepower(): Promise<GlobalFirepowerData> {
  return snapshotJson<GlobalFirepowerData>(
    'intel/globalfirepower.json',
    async () => {
      const res = await fetch('https://www.globalfirepower.com/countries-listing.php');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseListing(await res.text());
    },
  );
}
