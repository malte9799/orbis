import { snapshotJson } from './data';

export interface NasaGibsResourceUrl {
  format: string;
  resourceType: string;
  template: string;
}

export interface NasaGibsLayer {
  id: string;
  title: string;
  abstract: string | null;
  format: string | null;
  tileMatrixSets: string[];
  defaultTime: string | null;
  /** Time dimension values/ranges from WMTS capabilities (e.g. single dates or `start/end/P1D`). */
  time: string | null;
  resourceUrls: NasaGibsResourceUrl[];
}

export interface NasaGibsData {
  generated: string;
  source: string;
  capabilitiesUrl: string;
  /** WMTS/XYZ event-imagery template hints (GIBS EPSG:4326 best). `{Time}` = ISO date or `default`. */
  templateHints: {
    wmtsTile: string;
    xyz4326: string;
  };
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

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? unescapeXml(m[1]) : null;
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
    const formatMatch = block.match(/<Format>([\s\S]*?)<\/Format>/);
    const format = formatMatch ? unescapeXml(formatMatch[1]) : null;

    const tileMatrixSets = [...block.matchAll(/<TileMatrixSet>([\s\S]*?)<\/TileMatrixSet>/g)].map((m) =>
      unescapeXml(m[1]),
    );

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

    const resourceUrls: NasaGibsResourceUrl[] = [];
    for (const m of block.matchAll(/<ResourceURL\b([^>]*)\/?>/g)) {
      const tag = m[1];
      const template = attr(tag, 'template');
      if (!template) continue;
      resourceUrls.push({
        format: attr(tag, 'format') ?? 'image/jpeg',
        resourceType: attr(tag, 'resourceType') ?? 'tile',
        template,
      });
    }

    layers.push({ id, title, abstract, format, tileMatrixSets, defaultTime, time, resourceUrls });
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
    capabilitiesUrl: GIBS_CAPABILITIES_URL,
    templateHints: {
      wmtsTile:
        'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{Layer}/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.{ext}',
      xyz4326:
        'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{Layer}/default/{Time}/{TileMatrixSet}/{z}/{y}/{x}.{ext}',
    },
    total: layers.length,
    layers,
  };
}

export async function loadNasaGibs(): Promise<NasaGibsData> {
  return snapshotJson<NasaGibsData>('intel/nasa-gibs.json', fetchNasaGibsLive, 120000);
}