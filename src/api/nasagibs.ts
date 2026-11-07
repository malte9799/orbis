import { snapshotJson } from './data';

export interface NasaGibsLayer {
  id: string;
  title: string;
  abstract: string | null;
  defaultTime: string | null;
  time: string | null;
}

export interface NasaGibsData {
  generated: string;
  source: string;
  total: number;
  layers: NasaGibsLayer[];
}

export const GIBS_CAPABILITIES_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities';

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

export function parseGibsCapabilities(xml: string): NasaGibsLayer[] {
  const layers: NasaGibsLayer[] = [];
  const layerBlocks = xml.match(/<Layer\b[^>]*>[\s\S]*?<\/Layer>/g) ?? [];
  for (const block of layerBlocks) {
    const idMatch = block.match(/<ows:Identifier>([\s\S]*?)<\/ows:Identifier>/);
    const id = idMatch ? unescapeXml(idMatch[1]) : '';
    if (!id) continue;
    const titleMatch = block.match(/<ows:Title(?:\s[^>]*)?>([\s\S]*?)<\/ows:Title>/);
    const title = titleMatch ? unescapeXml(titleMatch[1]) : id;
    const abstractMatch = block.match(/<ows:Abstract(?:\s[^>]*)?>([\s\S]*?)<\/ows:Abstract>/);
    const abstract = abstractMatch ? unescapeXml(abstractMatch[1]) : null;

    let defaultTime: string | null = null;
    let time: string | null = null;
    const dimMatch = block.match(/<Dimension>[\s\S]*?<ows:Identifier>Time<\/ows:Identifier>[\s\S]*?<\/Dimension>/);
    if (dimMatch) {
      const dim = dimMatch[0];
      const defMatch = dim.match(/<Default>([\s\S]*?)<\/Default>/);
      defaultTime = defMatch ? unescapeXml(defMatch[1]) : null;
      const values = [...dim.matchAll(/<Value>([\s\S]*?)<\/Value>/g)].map((m) => unescapeXml(m[1]));
      time = values.length > 0 ? values.join('; ') : null;
    }

    layers.push({ id, title, abstract, defaultTime, time });
  }
  return layers;
}

async function fetchNasaGibsLive(): Promise<NasaGibsData> {
  const res = await fetch(GIBS_CAPABILITIES_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const layers = parseGibsCapabilities(await res.text());
  if (layers.length === 0) throw new Error('NASA GIBS: no layers parsed');
  return {
    generated: new Date().toISOString(),
    source: 'NASA GIBS (earthdata.nasa.gov)',
    total: layers.length,
    layers,
  };
}

export async function loadNasaGibs(): Promise<NasaGibsData> {
  return snapshotJson<NasaGibsData>('intel/nasa-gibs.json', fetchNasaGibsLive, 120000);
}