import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { fetchJson } from '../util';
import { overpass } from './overpass';
import { snapshotOrNull } from './osmtiles';
import { getLang, t } from '../i18n';

// Mineral and energy resources at three levels of detail:
// • worldwide: mines, oil, gas and coal fields from Wikidata (CC0)
// • regional (zoom ≥ 7): USGS Mineral Resources Data System (MRDS, public domain);
//   in Germany additionally the BGR map of near-surface deposits (KOR250, map image)
// • local (zoom ≥ 10): mines, quarries and wells mapped in OpenStreetMap
// Pipelines (oil, gas) from OpenStreetMap.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type ResourceCat = 'oil' | 'gas' | 'coal' | 'iron' | 'gold' | 'copper' | 'uranium' | 'lithium' | 'salt' | 'stone' | 'metal' | 'gem' | 'other';

export const RESOURCE_STYLE: Record<ResourceCat, { label: string; color: string }> = {
  oil: { label: t('map.res.cat.oil' as never), color: '#212121' },
  gas: { label: t('map.res.cat.gas' as never), color: '#29b6f6' },
  coal: { label: t('map.res.cat.coal' as never), color: '#6d4c41' },
  iron: { label: t('map.res.cat.iron' as never), color: '#c62828' },
  gold: { label: t('map.res.cat.gold' as never), color: '#fdd835' },
  copper: { label: t('map.res.cat.copper' as never), color: '#ff7043' },
  uranium: { label: t('map.res.cat.uranium' as never), color: '#76ff03' },
  lithium: { label: t('map.res.cat.lithium' as never), color: '#e040fb' },
  salt: { label: t('map.res.cat.salt' as never), color: '#eeeeee' },
  stone: { label: t('map.res.cat.stone' as never), color: '#bcaaa4' },
  metal: { label: t('map.res.cat.metal' as never), color: '#90a4ae' },
  gem: { label: t('map.res.cat.gem' as never), color: '#00e5ff' },
  other: { label: t('map.res.cat.other' as never), color: '#a1887f' },
};

const RULES: [RegExp, ResourceCat][] = [
  [/petroleum|crude|\boil\b|erdöl|öl\b|oil field|oil sand|bitumen|tar sand/i, 'oil'],
  [/natural gas|\bgas\b|erdgas|gas field|methane/i, 'gas'],
  [/coal|kohle|lignite|braunkohle|anthracite|coalfield/i, 'coal'],
  [/\biron|eisen|hematite|magnetite|taconite/i, 'iron'],
  [/gold|silver|silber|platinum|platin|\bau\b|\bag\b/i, 'gold'],
  [/copper|kupfer|\bcu\b/i, 'copper'],
  [/uranium|uran\b/i, 'uranium'],
  [/lithium/i, 'lithium'],
  [/salt|salz|potash|kali|halite|gypsum|gips/i, 'salt'],
  [/diamond|diamant|emerald|ruby|sapphire|gem/i, 'gem'],
  [/sand|gravel|kies|stone|stein|limestone|kalk|granite|granit|clay|ton\b|basalt|quarry|marble|marmor|aggregate|crushed/i, 'stone'],
  [/zinc|zink|lead|blei|nickel|tin\b|zinn|tungsten|wolfram|molybdenum|cobalt|kobalt|manganese|mangan|chromium|chrom|bauxite|alumin|rare earth|seltene|titan|vanadium|antimony|mercury/i, 'metal'],
];

export function classify(text: string): ResourceCat {
  for (const [re, cat] of RULES) if (re.test(text)) return cat;
  return 'other';
}

const point = (lon: number, lat: number, cat: ResourceCat, props: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { ...props, cat, catLabel: RESOURCE_STYLE[cat].label, color: RESOURCE_STYLE[cat].color },
});

// ---------------------------------------------------------------------------
// Wikidata (worldwide overview)

const WD_CLASSES = [
  'oil field',
  'natural gas field',
  'gas field',
  'oil and gas field',
  'coalfield',
  'mine',
  'coal mine',
  'iron mine',
  'gold mine',
  'copper mine',
  'silver mine',
  'uranium mine',
  'lithium mine',
  'salt mine',
  'diamond mine',
  'open-pit mine',
  'underground mine',
  'surface mine',
  'lignite mine',
  'potash mine',
  'nickel mine',
  'zinc mine',
  'tin mine',
];

const WD_CACHE = 'wg.resources.wd.v1';

export async function loadWikidataResources(): Promise<FeatureCollection<Point>> {
  try {
    const c = JSON.parse(localStorage.getItem(WD_CACHE) ?? 'null') as { at: number; fc: FeatureCollection<Point> } | null;
    if (c && Date.now() - c.at < 7 * 86400000) return c.fc;
  } catch {
    /* ignore */
  }
  const query = `SELECT ?item ?itemLabel ?coord ?classLabel (GROUP_CONCAT(DISTINCT ?prodLabel; separator=", ") AS ?products) WHERE {
    VALUES ?cl { ${WD_CLASSES.map((c) => `"${c}"@en`).join(' ')} }
    ?class rdfs:label ?cl .
    ?item wdt:P31 ?class ; wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P1056 ?prod . ?prod rdfs:label ?prodLabel . FILTER(LANG(?prodLabel) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${getLang()},en". ?item rdfs:label ?itemLabel . ?class rdfs:label ?classLabel . }
  } GROUP BY ?item ?itemLabel ?coord ?classLabel LIMIT 40000`;
  const json = await fetchJson<{ results: { bindings: Record<string, { value: string }>[] } }>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/sparql-results+json' } },
    60000,
  );
  const seen = new Set<string>();
  const features: Feature<Point>[] = [];
  for (const b of json.results.bindings) {
    const id = b.item.value.split('/').pop()!;
    if (seen.has(id)) continue;
    const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(b.coord.value);
    if (!m) continue;
    seen.add(id);
    const products = b.products?.value ?? '';
    const cls = b.classLabel?.value ?? '';
    const cat = classify(`${products} ${cls}`);
    features.push(
      point(Number(m[1]), Number(m[2]), cat, {
        title: b.itemLabel?.value ?? id,
        subtitle: [cls, products].filter(Boolean).join(' · '),
        url: `https://www.wikidata.org/wiki/${id}`,
        source: 'Wikidata',
        lvl: 0,
      }),
    );
  }
  const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features };
  try {
    localStorage.setItem(WD_CACHE, JSON.stringify({ at: Date.now(), fc }));
  } catch {
    /* too large for storage – memory only */
  }
  return fc;
}

// ---------------------------------------------------------------------------
// USGS MRDS via WFS 1.0.0 (GML; 1.0.0 keeps lon/lat axis order for the BBOX)

const DEV_STAT: Record<string, string> = { Producer: t('map.res.dev.producer'), 'Past Producer': t('map.res.dev.past'), Prospect: t('map.res.dev.prospect'), Occurrence: t('map.res.dev.occurrence'), Plant: t('map.res.dev.plant') };

export async function loadMrds(b: Bounds): Promise<FeatureCollection<Point>> {
  const url = `https://mrdata.usgs.gov/services/wfs/mrds?service=WFS&version=1.0.0&request=GetFeature&typeName=mrds&maxFeatures=4000&bbox=${b.west.toFixed(3)},${b.south.toFixed(3)},${b.east.toFixed(3)},${b.north.toFixed(3)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000);
  let text: string;
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const features: Feature<Point>[] = [];
  for (const member of Array.from(doc.getElementsByTagNameNS('*', 'featureMember'))) {
    const rec = member.firstElementChild;
    if (!rec) continue;
    const val = (name: string) => {
      for (const el of Array.from(rec.children)) if (el.localName.toLowerCase() === name) return el.textContent?.trim() ?? '';
      return '';
    };
    const coords = rec.getElementsByTagNameNS('*', 'coordinates')[0]?.textContent?.trim() ?? rec.getElementsByTagNameNS('*', 'pos')[0]?.textContent?.trim() ?? '';
    const [x, y] = coords.split(/[ ,]+/).map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const commod = [val('commod1'), val('commod2'), val('commod3')].filter(Boolean).join(', ');
    const status = val('dev_stat');
    const depId = val('dep_id');
    features.push(
      point(x, y, classify(commod), {
        title: val('site_name') || t('map.res.site'),
        subtitle: [commod, DEV_STAT[status] ?? status].filter(Boolean).join(' · '),
        url: depId ? `https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=${encodeURIComponent(depId)}` : 'https://mrdata.usgs.gov/mrds/',
        source: 'USGS MRDS',
        lvl: 1,
        producer: status === 'Producer',
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// BGR KOR250 (Germany): near-surface mineral deposits, ArcGIS map export as raster tiles

export const BGR_KOR250_TILES =
  'https://services.bgr.de/arcgis/rest/services/inspire_mr/kor250/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image';

// ---------------------------------------------------------------------------
// OpenStreetMap: mines, quarries, wells (zoom ≥ 10) and pipelines

const bbox = (b: Bounds) => `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;

export async function loadOsmResources(b: Bounds): Promise<FeatureCollection<Point>> {
  const bb = bbox(b);
  // points come from the monthly extract; Overpass then only has to deliver the ways and areas
  const snap = await snapshotOrNull<[number, number, string, string, string, string, string, number]>('resource', b);
  const sels = ['["landuse"="quarry"]', '["industrial"="mine"]', '["man_made"~"^(mineshaft|adit|petroleum_well|pumpjack)$"]', '["industrial"~"^(oil|gas|refinery)$"]'];
  const parts = sels.map((s) => (snap ? `way${s}(${bb});rel${s}(${bb});` : `nwr${s}(${bb});`)).join('');
  const j = await overpass<{ elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }>(
    `[out:json][timeout:30];(${parts});out center tags 4000;`,
    'resources',
  );
  const features: Feature<Point>[] = [];
  for (const [lon, lat, name, kind, res, resource, operator, id] of snap ?? []) {
    features.push(
      point(lon, lat, res ? classify(res) : kind === 'Steinbruch/Tagebau' ? 'stone' : 'other', {
        title: name || kind,
        subtitle: [kind, resource, operator].filter(Boolean).join(' · '),
        url: `https://www.openstreetmap.org/node/${id}`,
        source: 'OpenStreetMap',
        lvl: 2,
      }),
    );
  }
  for (const el of j.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags ?? {};
    const kind =
      tags.man_made === 'petroleum_well' || tags.man_made === 'pumpjack' ? t('map.res.kind.well') : tags.landuse === 'quarry' ? t('map.res.kind.quarry') : tags.man_made === 'mineshaft' ? t('map.res.kind.shaft') : tags.man_made === 'adit' ? t('map.res.kind.adit') : tags.industrial === 'refinery' ? t('map.res.kind.refinery') : t('map.res.kind.mine');
    const res = [tags.resource, tags['resource:type'], tags.product, tags.substance, tags.industrial === 'oil' ? 'oil' : '', tags.industrial === 'gas' ? 'gas' : '', tags.man_made === 'petroleum_well' ? 'oil' : ''].filter(Boolean).join(' ');
    features.push(
      point(lon, lat, res ? classify(res) : tags.landuse === 'quarry' ? 'stone' : 'other', {
        title: tags.name ?? kind,
        subtitle: [kind, tags.resource, tags.operator].filter(Boolean).join(' · '),
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        source: 'OpenStreetMap',
        lvl: 2,
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}

export async function loadPipelines(b: Bounds): Promise<FeatureCollection<LineString>> {
  const bb = bbox(b);
  const j = await overpass<{ elements: { type: string; id: number; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }[] }>(
    `[out:json][timeout:35];way["man_made"="pipeline"]["substance"~"^(gas|oil|fuel|hydrogen|natural_gas|lpg|crude_oil|petroleum|water)$"](${bb});out geom tags 5000;`,
    'pipelines',
  );
    const sub: Record<string, [string, string]> = {
    gas: [t('map.res.sub.gas'), '#29b6f6'],
    natural_gas: [t('map.res.sub.naturalGas'), '#29b6f6'],
    lpg: [t('map.res.sub.lpg'), '#4dd0e1'],
    hydrogen: [t('map.res.sub.hydrogen'), '#b388ff'],
    oil: [t('map.res.sub.oil'), '#ff9800'],
    crude_oil: [t('map.res.sub.crudeOil'), '#ff9800'],
    petroleum: [t('map.res.sub.petroleum'), '#ff9800'],
    fuel: [t('map.res.sub.fuel'), '#ffb74d'],
    water: [t('map.res.sub.water'), '#1e88e5'],
  };
  return {
    type: 'FeatureCollection',
    features: j.elements
      .filter((e) => e.geometry && e.geometry.length > 1)
      .map((e) => {
        const tags = e.tags ?? {};
        const [label, color] = sub[tags.substance] ?? [t('map.res.sub.pipe'), '#9e9e9e'];
        return {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: e.geometry!.map((p) => [p.lon, p.lat]) },
          properties: {
            title: tags.name ?? t('map.res.pipeline', { label }),
            subtitle: [label, tags.operator, tags.diameter ? `Ø ${tags.diameter} mm` : '', tags.location === 'underground' ? t('map.res.underground') : ''].filter(Boolean).join(' · '),
            color,
            url: `https://www.openstreetmap.org/way/${e.id}`,
            source: 'OpenStreetMap',
          },
        };
      }),
  };
}
