import type { Feature, Point } from 'geojson';
import { viaProxy } from './proxy';
import { store } from '../store';
import { fetchJson } from '../util';
import { fetchText } from './data';

// Public traffic, weather and wildfire cameras from open government / operator feeds.
// Each feed is loaded once its region comes into view (and refreshed every 10 minutes);
// still images get a cache-buster when the popup opens.

/** First child text of `tag` in a simple, flat XML fragment (also usable under Node). */
const xmlTag = (s: string, tag: string) => s.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? '';

/** All blocks `<tag …>…</tag>` – flat, so only for elements that never nest themselves. */
const xmlBlocks = (s: string, tag: string) => s.match(new RegExp(`<${tag}(?:\\s[^>]*)??>[\\s\\S]*?</${tag}>`, 'g')) ?? [];

export interface CamFeed {
  id: string;
  label: string;
  /** west, south, east, north */
  bbox: [number, number, number, number];
  /** id of the settings key (src/settings/keys) this feed needs */
  key?: string;
  load(): Promise<Feature<Point>[]>;
}

const cam = (
  lon: number,
  lat: number,
  p: { id: string; title: string; subtitle?: string; image?: string; video?: string; hls?: string; url?: string; source: string; live?: boolean; dir?: number },
): Feature<Point> => {
  const { dir, ...rest } = p;
  // viewing direction only when known (the webcam layer draws a cone for dir >= 0)
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { ...rest, kind: p.live === false ? 'signed' : 'road', ...(dir != null && Number.isFinite(dir) ? { dir } : {}) } };
};

/**
 * Compass heading from a direction text, or undefined. Dedicated direction fields ("North", "N-E",
 * "SW") may use bare words (`bare`); in free names only travel forms count ("NB", "Westbound"),
 * since street names like "West Ave" contain cardinal words too. Mostly the direction of travel of
 * the road the camera watches – an approximation of where it looks. Ambiguous text: undefined.
 */
export function directionToHeading(value: string | undefined, bare = false): number | undefined {
  const text = String(value ?? '').trim().toUpperCase().replace(/(\b[NS])-([EW]\b)/g, '$1$2');
  if (!text) return undefined;
  const tiers: [RegExp, number][][] = [
    [[/\bNORTHBOUND\b|\bNB\b/, 0], [/\bSOUTHBOUND\b|\bSB\b/, 180], [/\bEASTBOUND\b|\bEB\b/, 90], [/\bWESTBOUND\b|\bWB\b/, 270]],
    [[/\bNORTHEAST\b|\bNE\b/, 45], [/\bNORTHWEST\b|\bNW\b/, 315], [/\bSOUTHEAST\b|\bSE\b/, 135], [/\bSOUTHWEST\b|\bSW\b/, 225]],
  ];
  if (bare) tiers.push([[/\bNORTH\b|^N$/, 0], [/\bSOUTH\b|^S$/, 180], [/\bEAST\b|^E$/, 90], [/\bWEST\b|^W$/, 270]]);
  for (const forms of tiers) {
    const hits = new Set(forms.filter(([re]) => re.test(text)).map(([, h]) => h));
    if (hits.size) return hits.size === 1 ? [...hits][0] : undefined;
  }
  return undefined;
}

/** only https URLs (an http stream would be blocked as mixed content) */
const https = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);

const ok = (lon: unknown, lat: unknown) => Number.isFinite(Number(lon)) && Number.isFinite(Number(lat)) && !(Number(lon) === 0 && Number(lat) === 0);

/** Generic ArcGIS/GeoJSON parser: picks a name and the first image URL from the attributes. */
function genericCams(fc: { features?: { geometry?: { type: string; coordinates: number[] } | null; properties?: Record<string, unknown> | null }[] }, source: string, idPrefix: string) {
  const out: Feature<Point>[] = [];
  (fc.features ?? []).forEach((f, i) => {
    if (f.geometry?.type !== 'Point') return;
    const p = f.properties ?? {};
    const values = Object.values(p).filter((v): v is string => typeof v === 'string');
    const image = values.find((v) => /^https?:\/\/.+\.(jpe?g|png|gif)(\?.*)?$/i.test(v));
    const url = values.find((v) => /^https?:\/\//.test(v) && v !== image);
    const nameKey = Object.keys(p).find((k) => /name|desc|location|title/i.test(k) && typeof p[k] === 'string');
    const [lon, lat] = f.geometry.coordinates;
    if (!ok(lon, lat) || (!image && !url)) return;
    out.push(cam(lon, lat, { id: `${idPrefix}-${i}`, title: nameKey ? String(p[nameKey]) : 'Kamera', image, url: url ?? image, source }));
  });
  return out;
}

/** One public ArcGIS point layer with cameras (hosted by the operator itself or its GIS office). */
interface ArcSpec {
  id: string;
  label: string;
  bbox: [number, number, number, number];
  /** FeatureServer/MapServer layer URL */
  layer: string;
  source: string;
  /** attributes → popup fields; undefined skips the record */
  map(p: Record<string, unknown>): { id: string | number; title?: string; subtitle?: string; image?: string; hls?: string; url?: string; dir?: number } | undefined;
  /** fallback position when the geometry is empty */
  pos?(p: Record<string, unknown>): [number, number];
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim() !== '<Null>' ? v.trim() : undefined);

/** All features of a layer, paged (ArcGIS caps the answer per request). */
async function arcgisAll(layer: string): Promise<{ geometry?: { type: string; coordinates: number[] } | null; properties?: Record<string, unknown> | null }[]> {
  const out: { geometry?: { type: string; coordinates: number[] } | null; properties?: Record<string, unknown> | null }[] = [];
  for (let offset = 0; offset < 20000; ) {
    const q = new URLSearchParams({ where: '1=1', outFields: '*', f: 'geojson', outSR: '4326', resultOffset: String(offset), resultRecordCount: '1000' });
    const j = await fetchJson<{ features?: typeof out; properties?: { exceededTransferLimit?: boolean }; exceededTransferLimit?: boolean; error?: { message?: string } }>(`${layer}/query?${q}`, undefined, 30000);
    if (j.error) throw new Error(j.error.message ?? 'ArcGIS error');
    const got = j.features ?? [];
    out.push(...got);
    offset += got.length;
    if (!got.length || !(j.properties?.exceededTransferLimit || j.exceededTransferLimit)) break;
  }
  return out;
}

const arcFeed = (a: ArcSpec): CamFeed => ({
  id: a.id,
  label: a.label,
  bbox: a.bbox,
  async load() {
    return (await arcgisAll(a.layer)).flatMap((f) => {
      const p = f.properties ?? {};
      const [lon, lat] = f.geometry?.type === 'Point' && f.geometry.coordinates?.length >= 2 ? f.geometry.coordinates : (a.pos?.(p) ?? []);
      const m = a.map(p);
      if (!m || !ok(lon, lat) || (!m.image && !m.hls && !m.url)) return [];
      return [cam(Number(lon), Number(lat), { id: `${a.id}-${m.id}`, title: m.title || 'Kamera', subtitle: m.subtitle, image: m.image, hls: m.hls, url: m.url ?? m.image, source: a.source, dir: m.dir })];
    });
  },
});

const ARC_FEEDS: ArcSpec[] = [
  {
    id: 'il',
    label: 'IDOT / Travel Midwest (Illinois)',
    bbox: [-91.6, 36.9, -87.0, 42.6],
    layer: 'https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0',
    source: 'Illinois DOT / Travel Midwest',
    map: (p) => ({ id: String(p.OBJECTID), title: str(p.CameraLocation), subtitle: 'Verkehrskamera Illinois', image: https(str(p.SnapShot)), url: https(str(p.ImgPath)), dir: directionToHeading(str(p.CameraDirection), true) }),
  },
  {
    id: 'or',
    label: 'TripCheck (Oregon)',
    bbox: [-124.7, 41.9, -116.4, 46.4],
    layer: 'https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/TripCheck_Cameras/FeatureServer/0',
    source: 'Oregon DOT TripCheck',
    pos: (p) => [Number(p.attributes_longitude), Number(p.attributes_latitude)],
    map: (p) => ({ id: String(p.attributes_cameraId ?? p.ObjectId), title: str(p.attributes_title), subtitle: ['Verkehrskamera Oregon', str(p.attributes_route)].filter(Boolean).join(' · '), image: https(str(p.attributes_filename)) }),
  },
  {
    id: 'mi',
    label: 'MiDrive (Michigan)',
    bbox: [-90.5, 41.6, -82.0, 47.6],
    layer: 'https://services2.arcgis.com/67lKNkQ2TO1I3lhR/arcgis/rest/services/MiDrive%20Cameras/FeatureServer/0',
    source: 'Michigan DOT (MiDrive)',
    pos: (p) => [Number(p.Lon), Number(p.Lat)],
    map: (p) => ({ id: String(p.OBJECTID), title: [str(p.Route), str(p.Location)].filter(Boolean).join(' '), subtitle: ['Verkehrskamera Michigan', str(p.County)].filter(Boolean).join(' · '), image: https(str(p.Image)), dir: directionToHeading(str(p.Direction), true) }),
  },
  {
    id: 'ia',
    label: 'Iowa DOT',
    bbox: [-96.7, 40.3, -90.1, 43.6],
    layer: 'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0',
    source: 'Iowa DOT (CC BY 4.0)',
    map: (p) => ({ id: String(p.device_id ?? p.FID), title: str(p.Desc_) ?? str(p.ImageName), subtitle: ['Verkehrskamera Iowa', str(p.REGION)].filter(Boolean).join(' · '), image: https(str(p.ImageURL)), hls: https(str(p.VideoURL)) }),
  },
  {
    // the catalog has no still image, only HLS streams
    id: 'mo',
    label: 'MoDOT (Missouri)',
    bbox: [-95.8, 35.9, -89.0, 40.7],
    layer: 'https://services2.arcgis.com/jWXb6JPWtBjOCalT/arcgis/rest/services/MODOT_Traffic_Cameras/FeatureServer/1',
    source: 'Missouri DOT',
    map: (p) => {
      const hls = https(str(p.URL2));
      return str(p.STREAM_ERROR) === 'Y' || !hls ? undefined : { id: String(p.CAM_ID__ ?? p.OBJECTID), title: str(p.DESCRIPTION), subtitle: 'Verkehrskamera Missouri', hls };
    },
  },
  {
    // snapshots are http only (blocked as mixed content) → position and link to the image
    id: 'ga',
    label: 'GDOT (Georgia)',
    bbox: [-85.7, 30.3, -80.7, 35.1],
    layer: 'https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_Live_Traffic_Cameras/FeatureServer/0',
    source: 'Georgia DOT (GDOT) / GEMA',
    map: (p) => ({ id: String(p.cctv_id ?? p.OBJECTID), title: str(p.location_description) ?? str(p.name), subtitle: ['Verkehrskamera Georgia', str(p.county)].filter(Boolean).join(' · '), image: https(str(p.url)), url: str(p.url), hls: https(str(p.HLS)) }),
  },
  {
    id: 'ky',
    label: 'KYTC (Kentucky)',
    bbox: [-89.7, 36.4, -81.9, 39.2],
    layer: 'https://services2.arcgis.com/CcI36Pduqd0OR4W9/arcgis/rest/services/trafficCamerasCur_Prd/FeatureServer/0',
    source: 'Kentucky Transportation Cabinet (KYTC)',
    map: (p) => ({ id: String(p.OBJECTID), title: str(p.description) ?? str(p.name), subtitle: 'Verkehrskamera Kentucky', image: https(str(p.snapshot)), url: str(p.snapshot) }),
  },
  {
    id: 'nl-ca',
    label: 'Newfoundland und Labrador',
    bbox: [-67.9, 46.5, -52.5, 60.5],
    layer: 'https://services8.arcgis.com/aCyQID5qQcyrJMm2/arcgis/rest/services/TI_HighwayCamera/FeatureServer/0',
    source: 'Government of Newfoundland and Labrador, Transportation and Infrastructure',
    map: (p) => ({ id: String(p.objectid), title: str(p.location), subtitle: 'Straßenkamera Neufundland und Labrador', image: https(str(p.url)) }),
  },
  {
    // 511 platform: position and link to the camera page (no still image in the layer)
    id: 'sk',
    label: 'Highway Hotline (Saskatchewan)',
    bbox: [-110.1, 49, -101.3, 60.1],
    layer: 'https://services.arcgis.com/wjcPoefzjpzCgffS/arcgis/rest/services/Saskatchewan_Highway_Hotline/FeatureServer/0',
    source: 'Saskatchewan Highway Hotline (Esri Canada)',
    map: (p) => (str(p.Status) === 'Disabled' ? undefined : { id: String(p.Id ?? p.OBJECTID), title: str(p.Name), subtitle: ['Straßenkamera Saskatchewan', str(p.RoadwayName)].filter(Boolean).join(' · '), url: https(str(p.Url)) }),
  },
  {
    id: 'yt',
    label: 'Yukon 511',
    bbox: [-141.1, 59.9, -123.7, 69.7],
    layer: 'https://services.arcgis.com/wjcPoefzjpzCgffS/arcgis/rest/services/Yukon511/FeatureServer/0',
    source: 'Yukon 511 (Esri Canada)',
    map: (p) => (str(p.Status) === 'Disabled' ? undefined : { id: String(p.Id ?? p.OBJECTID), title: str(p.Roadway) ?? str(p.Description), subtitle: 'Straßenkamera Yukon', url: https(str(p.Url)) }),
  },
  {
    id: 'ie-donegal',
    label: 'Donegal (Irland)',
    bbox: [-8.7, 54.5, -7.0, 55.5],
    layer: 'https://services2.arcgis.com/WRtfelnPg3R7bCEW/arcgis/rest/services/TrafficCameras/FeatureServer/0',
    source: 'Donegal County Council / Transport Infrastructure Ireland',
    map: (p) => ({ id: String(p.ID ?? p.OBJECTID), title: str(p.Name), subtitle: 'Wetter-/Straßenkamera Donegal', image: https(str(p.WeatherCAM) ?? str(p.link)) }),
  },
];

/** 511 portals on the same platform as Ontario/Alberta (`/api/v2/get/cameras`, free developer key per portal). */
const IBI_511 = [
  { id: 'ut', key: 'utah511', host: 'prod-ut.ibi511.com', label: 'UDOT Traffic (Utah)', bbox: [-114.1, 36.9, -109.0, 42.1] as [number, number, number, number], source: 'Utah DOT (UDOT Traffic)', name: 'UDOT' },
  { id: 'az', key: 'arizona511', host: 'az511.com', label: 'AZ511 (Arizona)', bbox: [-114.9, 31.3, -109.0, 37.1] as [number, number, number, number], source: 'Arizona DOT (AZ511)', name: 'AZ511' },
  { id: 'id', key: 'idaho511', host: '511.idaho.gov', label: 'Idaho 511', bbox: [-117.3, 41.9, -111.0, 49.1] as [number, number, number, number], source: 'Idaho Transportation Department (Idaho 511)', name: 'Idaho 511' },
  { id: 'nv', key: 'nevada511', host: 'nvroads.com', label: 'Nevada Roads', bbox: [-120.1, 35.0, -114.0, 42.1] as [number, number, number, number], source: 'Nevada DOT (NVRoads)', name: 'NVRoads' },
  { id: 'ak', key: 'alaska511', host: '511.alaska.gov', label: 'Alaska 511', bbox: [-170.0, 51.0, -129.9, 71.5] as [number, number, number, number], source: 'Alaska DOT&PF (Alaska 511)', name: 'Alaska 511' },
  { id: 'ga511', key: 'georgia511', host: '511ga.org', label: 'Georgia 511', bbox: [-85.7, 30.3, -80.7, 35.1] as [number, number, number, number], source: 'Georgia DOT (Georgia 511)', name: 'Georgia 511' },
  { id: 'la', key: 'louisiana511', host: '511la.org', label: 'Louisiana 511', bbox: [-94.1, 28.8, -88.7, 33.1] as [number, number, number, number], source: 'Louisiana DOTD (511 Louisiana)', name: 'Louisiana 511' },
  { id: 'pa', key: 'pennsylvania511', host: '511pa.com', label: '511PA (Pennsylvania)', bbox: [-80.6, 39.7, -74.6, 42.3] as [number, number, number, number], source: 'PennDOT (511PA)', name: '511PA' },
] as const;

export const CAM_FEEDS: CamFeed[] = [
  {
    id: 'tfl',
    label: 'TfL JamCams (London)',
    bbox: [-0.6, 51.25, 0.35, 51.72],
    async load() {
      const list = await fetchJson<{ id: string; commonName: string; lat: number; lon: number; additionalProperties?: { key: string; value: string }[] }[]>('https://api.tfl.gov.uk/Place/Type/JamCam', undefined, 30000);
      return list.map((c) => {
        const prop = (k: string) => c.additionalProperties?.find((p) => p.key === k)?.value;
        return cam(c.lon, c.lat, { id: c.id, title: c.commonName, subtitle: 'Verkehrskamera London', image: prop('imageUrl'), video: prop('videoUrl'), url: prop('videoUrl') ?? prop('imageUrl'), source: 'Powered by TfL Open Data · Contains OS data © Crown copyright and database rights 2016 and Geomni UK Map data © and database rights 2019' });
      });
    },
  },
  {
    id: 'singapore',
    label: 'LTA (Singapur)',
    bbox: [103.55, 1.15, 104.1, 1.5],
    async load() {
      const j = await fetchJson<{ items: { cameras: { camera_id: string; image: string; timestamp?: string; location: { latitude: number; longitude: number } }[] }[] }>('https://api.data.gov.sg/v1/transport/traffic-images', undefined, 20000);
      // signed image URLs – reload the feed instead of busting the cache
      return (j.items[0]?.cameras ?? []).map((c) => cam(c.location.longitude, c.location.latitude, { id: `sg-${c.camera_id}`, title: `Kamera ${c.camera_id}`, subtitle: 'Verkehrskamera Singapur', image: c.image, url: c.image, source: `LTA – Contains information from Traffic Images accessed on ${new Date().toLocaleDateString('de-DE')} from data.gov.sg which is made available under the terms of the Singapore Open Data Licence version 1.0`, live: false }));
    },
  },
  {
    id: 'hongkong',
    label: 'Transport Department (Hongkong)',
    bbox: [113.8, 22.15, 114.45, 22.6],
    async load() {
      const res = await fetch('https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
      return Array.from(doc.getElementsByTagName('image')).flatMap((el) => {
        const t = (n: string) => el.getElementsByTagName(n)[0]?.textContent?.trim() ?? '';
        const lat = Number(t('latitude'));
        const lon = Number(t('longitude'));
        if (!ok(lon, lat)) return [];
        return [cam(lon, lat, { id: `hk-${t('key')}`, title: t('description') || t('key'), subtitle: [t('district'), t('region')].filter(Boolean).join(', '), image: t('url'), url: t('url'), source: 'Transport Department HK, DATA.GOV.HK (Nutzungsbedingungen: data.gov.hk/en/terms-and-conditions)' })];
      });
    },
  },
  {
    id: 'caltrans',
    label: 'Caltrans (Kalifornien)',
    bbox: [-124.5, 32.5, -114.1, 42.0],
    async load() {
      const parts = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) => i + 1).map((d) =>
          fetchJson<{ data: { cctv: { index: string; inService?: string; location: { locationName: string; nearbyPlace?: string; route?: string; direction?: string; latitude: string; longitude: string }; imageData?: { static?: { currentImageURL?: string }; streamingVideoURL?: string } } }[] }>(
            `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2, '0')}.json`,
            undefined,
            30000,
          ),
        ),
      );
      if (parts.every((p) => p.status === 'rejected')) throw (parts[0] as PromiseRejectedResult).reason;
      return parts.flatMap((p, di) =>
        p.status !== 'fulfilled'
          ? []
          : p.value.data
              .map((x) => x.cctv)
              .filter((c) => c.inService !== 'false' && ok(c.location.longitude, c.location.latitude))
              .map((c) =>
                cam(Number(c.location.longitude), Number(c.location.latitude), {
                  id: `ct-${di}-${c.index}`,
                  title: c.location.locationName,
                  subtitle: [c.location.route, c.location.nearbyPlace].filter(Boolean).join(' · '),
                  image: c.imageData?.static?.currentImageURL,
                  hls: https(c.imageData?.streamingVideoURL),
                  dir: directionToHeading(c.location.direction, true),
                  url: c.imageData?.streamingVideoURL || c.imageData?.static?.currentImageURL,
                  source: 'Caltrans',
                }),
              ),
      );
    },
  },
  {
    // all cameras stream live (HLS); the catalog has no still image
    id: 'deldot',
    label: 'DelDOT (Delaware)',
    bbox: [-75.8, 38.4, -75.0, 39.9],
    async load() {
      const j = await fetchJson<{ videoCameras: { id: string; title: string; county?: string; lat: number; lon: number; enabled?: boolean; status?: string; urls?: { m3u8s?: string } }[] }>('https://tmc.deldot.gov/json/videocamera.json', undefined, 20000);
      return j.videoCameras
        .filter((c) => c.enabled !== false && c.status === 'Active' && ok(c.lon, c.lat) && https(c.urls?.m3u8s))
        .map((c) => cam(c.lon, c.lat, { id: `deldot-${c.id}`, title: c.title, subtitle: [c.county && `${c.county} County`, 'Livestream'].filter(Boolean).join(' · '), hls: c.urls!.m3u8s, dir: directionToHeading(c.title), url: `https://deldot.gov/map/index.shtml?tab=TrafficCameras`, source: 'Delaware Department of Transportation (DelDOT)' }));
    },
  },
  {
    // Statens vegvesen: still images of all road cameras, live video (HLS) for some of them
    id: 'vegvesen',
    label: 'Statens vegvesen (Norwegen)',
    bbox: [4.0, 57.8, 31.5, 71.3],
    async load() {
      const fc = await fetchJson<{ features: { geometry?: { coordinates: number[] } | null; properties: Record<string, string | number | undefined> }[] }>(
        'https://ogckart-sn1.atlas.vegvesen.no/ogc/features/v1/collections/datex_3_1:CctvSimple/items?f=application/geo%2Bjson&limit=5000',
        undefined,
        30000,
      );
      return fc.features.flatMap((f) => {
        const p = f.properties;
        const [lon, lat] = f.geometry?.coordinates ?? [];
        const image = https(String(p.stillImageUrl ?? ''));
        if (!ok(lon, lat) || !image || p['status.stillImageAvailability'] === 'videoOrImagesUnavailableDueToCameraFault') return [];
        const hls = p.videoEncodingStandard === 'hls' && Number(p.videoServiceLevel) > 0 ? https(String(p.videoUrl ?? '')) : undefined;
        const place = String(p.description ?? '').trim() || `Kamera ${p.cameraId}`;
        const towards = String(p.orientationDescription ?? '').trim();
        return [
          cam(lon, lat, {
            id: `vv-${p.cameraId}`,
            title: towards && towards !== place ? `${place} → ${towards}` : place,
            subtitle: [p.roadNumber, hls && 'Livestream'].filter(Boolean).join(' · '),
            image,
            hls,
            url: image,
            source: 'Statens vegvesen (NLOD)',
          }),
        ];
      });
    },
  },
  {
    // City of Austin traffic cameras (Socrata): only cameras that are switched on
    id: 'austin',
    label: 'City of Austin (Texas)',
    bbox: [-98.1, 30.0, -97.5, 30.6],
    async load() {
      const list = await fetchJson<{ camera_id: string; location_name?: string; screenshot_address?: string; location?: { coordinates: number[] } }[]>(
        'https://data.austintexas.gov/resource/b4k4-adkb.json?camera_status=TURNED_ON&$limit=5000&$select=camera_id,location_name,screenshot_address,location',
        undefined,
        30000,
      );
      return list.flatMap((c) => {
        const [lon, lat] = c.location?.coordinates ?? [];
        const image = https(c.screenshot_address);
        if (!ok(lon, lat) || !image) return [];
        return [cam(lon, lat, { id: `austin-${c.camera_id}`, title: (c.location_name ?? '').trim() || `Kamera ${c.camera_id}`, subtitle: 'Verkehrskamera Austin', image, url: image, source: 'City of Austin Open Data' })];
      });
    },
  },
  {
    // WSDOT: all highway cameras of Washington State (plus a few of neighbouring operators); Esri JSON in Web Mercator
    id: 'wsdot',
    label: 'WSDOT (Washington State)',
    bbox: [-124.9, 45.5, -116.9, 49.1],
    async load() {
      const j = await fetchJson<{ features: { attributes: { CameraID: number; CompassDirection?: string; CameraTitle?: string; ImageURL?: string }; geometry?: { x: number; y: number } }[] }>(
        'https://data.wsdot.wa.gov/travelcenter/Cameras.json',
        undefined,
        30000,
      );
      const R = 6378137;
      return j.features.flatMap(({ attributes: a, geometry: g }) => {
        if (!g) return [];
        const lon = (g.x / R) * (180 / Math.PI);
        const lat = (2 * Math.atan(Math.exp(g.y / R)) - Math.PI / 2) * (180 / Math.PI);
        const image = https(a.ImageURL);
        if (!ok(lon, lat) || !image) return [];
        // B: both directions, O: other – no single viewing direction
        return [cam(lon, lat, { id: `wsdot-${a.CameraID}`, title: a.CameraTitle ?? `Kamera ${a.CameraID}`, subtitle: 'Verkehrskamera WSDOT', image, url: image, dir: directionToHeading(a.CompassDirection, true), source: 'Washington State DOT' })];
      });
    },
  },
  {
    // King County Road Services (unincorporated King County, WA); image URLs come as http – the host serves https too
    id: 'kingcounty',
    label: 'King County (Washington)',
    bbox: [-122.6, 47.0, -121.0, 47.8],
    async load() {
      const fc = await fetchJson<{ features: { geometry?: { coordinates: number[] } | null; properties: { AssetID: number; Location?: string; ImageURL?: string; CurrentStatus?: string } }[] }>(
        'https://services.arcgis.com/Ej0PsM5Aw677QF1W/arcgis/rest/services/TRAFFICCAMERA_POINT_2029/FeatureServer/0/query?where=1%3D1&outFields=AssetID,Location,ImageURL,CurrentStatus&f=geojson',
        undefined,
        30000,
      );
      return fc.features.flatMap((f) => {
        const [lon, lat] = f.geometry?.coordinates ?? [];
        const p = f.properties;
        const image = https((p.ImageURL ?? '').trim().replace(/^http:\/\//, 'https://'));
        if (!ok(lon, lat) || !image || (p.CurrentStatus && p.CurrentStatus !== 'Active')) return [];
        return [cam(lon, lat, { id: `kc-${p.AssetID}`, title: p.Location ?? `Kamera ${p.AssetID}`, subtitle: 'Verkehrskamera King County', image, url: image, source: 'King County Road Services' })];
      });
    },
  },
  {
    id: 'nyc',
    label: 'NYC DOT (New York)',
    bbox: [-74.3, 40.48, -73.68, 40.93],
    async load() {
      const list = await fetchJson<{ id: string; name: string; latitude: number; longitude: number; imageUrl: string; isOnline?: string | boolean }[]>('https://webcams.nyctmc.org/api/cameras', undefined, 20000);
      return list.filter((c) => String(c.isOnline) !== 'false' && ok(c.longitude, c.latitude)).map((c) => cam(c.longitude, c.latitude, { id: `nyc-${c.id}`, title: c.name, subtitle: 'Verkehrskamera New York', image: c.imageUrl, url: c.imageUrl, source: 'NYC DOT' }));
    },
  },
  {
    id: 'dc',
    label: 'DDOT (Washington, D.C.)',
    bbox: [-77.15, 38.79, -76.9, 39.0],
    async load() {
      const fc = await fetchJson<Parameters<typeof genericCams>[0]>(
        viaProxy('https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Sensors_WebMercator/MapServer/93/query?where=1%3D1&outFields=*&outSR=4326&f=geojson'),
        undefined,
        20000,
      );
      return genericCams(fc, 'DDOT / Open Data DC', 'dc');
    },
  },
  ...(['511on.ca', '511.alberta.ca'] as const).map(
    (host): CamFeed => ({
      id: host,
      label: host === '511on.ca' ? '511 Ontario' : '511 Alberta',
      bbox: host === '511on.ca' ? [-95.2, 41.6, -74.3, 56.9] : [-120.0, 49.0, -110.0, 60.0],
      async load() {
        // beide Feeds verlangen inzwischen einen kostenlosen Developer-Key (10 Aufrufe/min)
        const key = store.getKeys()[host === '511on.ca' ? 'ontario511' : 'alberta511'];
        const keyParam = key ? `&key=${encodeURIComponent(key)}` : '';
        const list = await fetchJson<{ Id: string | number; Roadway?: string; Location?: string; Latitude: number; Longitude: number; Views?: { Url: string; Status?: string; Description?: string }[] }[]>(
          viaProxy(`https://${host}/api/v2/get/cameras?format=json${keyParam}`),
          undefined,
          30000,
        );
        return list
          .filter((c) => ok(c.Longitude, c.Latitude))
          .map((c) => {
            const view = c.Views?.find((v) => v.Status !== 'Disabled') ?? c.Views?.[0];
            return cam(c.Longitude, c.Latitude, { id: `${host}-${c.Id}`, title: c.Location || c.Roadway || 'Kamera', subtitle: c.Roadway, image: view?.Url, url: view?.Url, source: host === '511on.ca' ? '511 Ontario (Ministry of Transportation Ontario)' : '511 Alberta (Alberta Transportation)' });
          });
      },
    }),
  ),
  {
    id: 'is',
    label: 'Vegagerðin (Island)',
    bbox: [-25.6, 63.2, -13.0, 66.8],
    async load() {
      const list = await fetchJson<{ Maelist_nr: number; Myndavel: string; Vegheiti?: string; NrVegur?: string; Skyring?: string; Slod: string; Breidd: number; Lengd: number }[]>(
        'https://gagnaveita.vegagerdin.is/api/vefmyndavelar2014_1',
        undefined,
        30000,
      );
      return list.flatMap((c) => {
        const id = c.Slod?.split('/').pop();
        if (!id || !ok(c.Lengd, c.Breidd)) return [];
        return [
          cam(c.Lengd, c.Breidd, {
            id: `is-${id}`,
            title: c.Myndavel,
            subtitle: ['Straßenwetterkamera Island', c.Vegheiti || `Route ${c.NrVegur}`].filter(Boolean).join(' · '),
            image: c.Slod,
            url: c.Slod,
            source: 'Vegagerðin (Icelandic Road and Coastal Administration)',
          }),
        ];
      });
    },
  },
  {
    id: 'nz',
    label: 'NZTA (Neuseeland)',
    bbox: [165.9, -47.7, 179.2, -34.0],
    async load() {
      const xml = await fetchText('https://trafficnz.info/service/traffic/rest/4/cameras/all', 30000);
      return xmlBlocks(xml, 'camera').flatMap((b) => {
        const lat = Number(xmlTag(b, 'latitude'));
        const lon = Number(xmlTag(b, 'longitude'));
        const id = xmlTag(b, 'id');
        const img = xmlTag(b, 'imageUrl');
        if (!ok(lon, lat) || !img || xmlTag(b, 'offline') === 'true') return [];
        return [
          cam(lon, lat, {
            id: `nz-${id}`,
            title: xmlTag(b, 'name') || xmlTag(b, 'description') || 'Verkehrskamera Neuseeland',
            subtitle: [xmlTag(b, 'highway'), xmlTag(b, 'direction')].filter(Boolean).join(' · ') || 'Verkehrskamera Neuseeland',
            image: `https://trafficnz.info${img}`,
            url: `https://trafficnz.info${xmlTag(b, 'viewUrl') || img}`,
            source: 'NZ Transport Agency / Waka Kotahi',
          }),
        ];
      });
    },
  },
  {
    id: 'drivebc',
    label: 'DriveBC (British Columbia)',
    bbox: [-139.2, 48.1, -113.9, 60.1],
    async load() {
      const list = await fetchJson<{ id: number; name?: string; caption?: string; credit?: string; highway_display?: string; orientation?: string; is_on?: boolean; location?: { coordinates: number[] } }[]>(
        'https://www.drivebc.ca/api/webcams/',
        undefined,
        40000,
      );
      return list
        .filter((c) => Number.isFinite(c.id) && ok(c.location?.coordinates?.[0], c.location?.coordinates?.[1]) && c.is_on !== false)
        .map((c) =>
          cam(c.location!.coordinates[0], c.location!.coordinates[1], {
            id: `bc-${c.id}`,
            title: c.name ?? 'Kamera',
            subtitle: [c.caption, c.highway_display ? `Highway ${c.highway_display}` : '', c.credit].filter(Boolean).join(' · '),
            image: `https://www.drivebc.ca/images/${c.id}.jpg`,
            url: `https://www.drivebc.ca/images/${c.id}.jpg`,
            dir: directionToHeading(c.orientation, true),
            source: 'DriveBC (Open Government Licence – British Columbia)',
          }),
        );
    },
  },
  {
    id: 'nsw',
    label: 'TfNSW Live Traffic (NSW, Australien)',
    bbox: [140.9, -38.1, 153.8, -28.2],
    async load() {
      const fc = await fetchJson<{ features: { id: string; geometry: { coordinates: number[] }; properties?: { title?: string; view?: string; href?: string; direction?: string } }[] }>(
        'https://data.livetraffic.com/cameras/traffic-cam.json',
        undefined,
        30000,
      );
      return (fc.features ?? []).flatMap((f) => {
        const [lon, lat] = f.geometry?.coordinates ?? [];
        const href = f.properties?.href;
        if (!ok(lon, lat) || !href?.startsWith('http')) return [];
        return [
          cam(lon!, lat!, {
            id: `nsw-${f.id}`,
            title: f.properties?.title ?? 'Verkehrskamera NSW',
            subtitle: f.properties?.view,
            image: href,
            url: href,
            dir: directionToHeading(f.properties?.direction, true),
            source: 'Transport for NSW (CC BY 4.0)',
          }),
        ];
      });
    },
  },
  {
    id: 'calgary',
    label: 'Calgary (Alberta)',
    bbox: [-114.65, 50.65, -113.55, 51.35],
    async load() {
      const list = await fetchJson<{ camera_location?: string; quadrant?: string; camera_url?: { url?: string }; point?: { coordinates?: number[] } }[]>(
        'https://data.calgary.ca/resource/k7p9-kppz.json',
        undefined,
        20000,
      );
      return list.flatMap((c) => {
        const [lon, lat] = c.point?.coordinates ?? [];
        const img = (c.camera_url?.url ?? '').replace(/^http:\/\//, 'https://');
        if (!ok(lon, lat) || !img.startsWith('https://')) return [];
        return [
          cam(lon!, lat!, {
            id: `cal-${img.split('/').pop()}`,
            title: `${c.camera_location ?? 'Kamera'}${c.quadrant ? `  (${c.quadrant})` : ''}`,
            subtitle: 'Verkehrskamera Calgary',
            image: img,
            url: img,
            source: 'City of Calgary – Open Data',
          }),
        ];
      });
    },
  },
  {
    id: 'alertca',
    label: 'ALERTCalifornia (Waldbrandkameras)',
    bbox: [-124.5, 32.5, -114.1, 42.0],
    async load() {
      const fc = await fetchJson<{ features: { geometry: { coordinates: number[] }; properties: { id: string; name?: string; county?: string; state?: string } }[] }>(
        'https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json',
        undefined,
        30000,
      );
      return fc.features
        .filter((f) => ok(f.geometry.coordinates[0], f.geometry.coordinates[1]))
        .map((f) =>
          cam(f.geometry.coordinates[0], f.geometry.coordinates[1], {
            id: `aca-${f.properties.id}`,
            title: f.properties.name ?? f.properties.id,
            subtitle: ['Waldbrand-Beobachtungskamera', f.properties.county].filter(Boolean).join(' · '),
            image: `https://cameras.alertcalifornia.org/public-camera-data/${f.properties.id}/latest-frame.jpg`,
            url: `https://ops.alertcalifornia.org/cam-console/${f.properties.id}`,
            source: 'ALERTCalifornia (UC San Diego)',
          }),
        );
    },
  },
  {
    id: 'autobahn',
    label: 'Autobahn-Webcams',
    bbox: [5.8, 47.2, 15.1, 55.1],
    async load() {
      const AB = 'https://verkehr.autobahn.de/o/autobahn';
      const { roads } = await fetchJson<{ roads: string[] }>(viaProxy(`${AB}/`), undefined, 20000);
      const parts = await Promise.allSettled(
        roads.map((r) => fetchJson<{ webcam?: { identifier: string; title?: string; subtitle?: string; coordinate?: { lat: string; long: string }; imageurl?: string; linkurl?: string }[] }>(viaProxy(`${AB}/${encodeURIComponent(r.trim())}/services/webcam`), undefined, 20000)),
      );
      return parts.flatMap((p) =>
        p.status !== 'fulfilled'
          ? []
          : (p.value.webcam ?? [])
              .filter((w) => ok(w.coordinate?.long, w.coordinate?.lat))
              .map((w) => cam(Number(w.coordinate!.long), Number(w.coordinate!.lat), { id: `ab-${w.identifier}`, title: w.title ?? 'Autobahn-Webcam', subtitle: w.subtitle, image: w.imageurl, url: w.linkurl ?? w.imageurl, source: 'Autobahn GmbH' })),
      );
    },
  },
  {
    // DATEX2 v3.6 device list (CC BY); stills are plain JPEGs. No CORS → mirrored by the data Action
    id: 'dgt',
    label: 'DGT (Spanien)',
    bbox: [-18.3, 27.5, 4.5, 43.9],
    async load() {
      const xml = await fetchText('https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v36.xml', 60000);
      return xmlBlocks(xml, 'ns2:device').flatMap((b) => {
        const id = b.match(/\sid="([^"]+)"/)?.[1];
        const lat = Number(xmlTag(b, 'loc:latitude'));
        const lon = Number(xmlTag(b, 'loc:longitude'));
        const img = https(xmlTag(b, 'fse:deviceUrl'));
        if (!id || !img || !ok(lon, lat) || xmlTag(b, 'ns2:typeOfDevice') !== 'camera') return [];
        const road = xmlTag(b, 'loc:roadName');
        const km = xmlTag(b, 'lse:kilometerPoint');
        const to = xmlTag(b, 'loc:roadDestination');
        return [
          cam(lon, lat, {
            id: `dgt-${id}`,
            title: [road, km && `km ${km}`].filter(Boolean).join(' · ') || 'Verkehrskamera',
            subtitle: ['Verkehrskamera Spanien', to && `Richtung ${to}`, xmlTag(b, 'lse:province')].filter(Boolean).join(' · '),
            image: img,
            url: img,
            source: 'Dirección General de Tráfico (DGT), Punto de Acceso Nacional – CC BY 4.0',
          }),
        ];
      });
    },
  },
  {
    // WFS/GML of the Servei Català de Trànsit; stills via TransitCamera (https, the link in the catalog is http)
    id: 'cat',
    label: 'Servei Català de Trànsit (Katalonien)',
    bbox: [0.1, 40.5, 3.4, 42.9],
    async load() {
      const xml = await fetchText('https://www.gencat.cat/transit/opendata/cameres.xml', 30000);
      return xmlBlocks(xml, 'cite:cameres').flatMap((b) => {
        const [lon, lat] = xmlTag(b, 'gml:coordinates').split(',').map(Number);
        const link = xmlTag(b, 'cite:link').replace(/&#13;|&amp;/g, (m) => (m === '&amp;' ? '&' : '')).trim();
        const name = link.match(/sctidcam=([\w.-]+)/)?.[1];
        // SCT cameras by name; municipal ones (e.g. Terrassa) carry their own image URL
        const img = name ? `https://mct.gencat.cat/mct2bo/TransitCamera?nom=${name}&visualitzacio=imatge` : https(link);
        if (!img || !ok(lon, lat)) return [];
        const road = xmlTag(b, 'cite:carretera');
        const pk = xmlTag(b, 'cite:pk');
        return [
          cam(lon, lat, {
            id: `cat-${(name ?? img).replace(/\W+/g, '-').slice(-40)}`,
            title: [road, pk && `km ${pk}`].filter(Boolean).join(' · ') || 'Verkehrskamera',
            subtitle: ['Verkehrskamera Katalonien', xmlTag(b, 'cite:municipi')].filter(Boolean).join(' · '),
            image: img,
            url: img,
            source: `Servei Català de Trànsit (Generalitat de Catalunya)${xmlTag(b, 'cite:font') && xmlTag(b, 'cite:font') !== 'SCT' ? ` · ${xmlTag(b, 'cite:font')}` : ''}`,
          }),
        ];
      });
    },
  },
  {
    // Trafikverket Open API (free key from Trafiklab / trafikinfo): POST with an XML query, answer as JSON
    id: 'trafikverket',
    label: 'Trafikverket (Schweden)',
    bbox: [10.9, 55.3, 24.2, 69.1],
    key: 'trafikverket',
    async load() {
      const key = store.getKeys().trafikverket!;
      const body = `<REQUEST><LOGIN authenticationkey="${key.replace(/[^\w-]/g, '')}"/><QUERY objecttype="Camera" schemaversion="1.1" limit="5000"><FILTER><EQ name="Active" value="true"/></FILTER><INCLUDE>Id</INCLUDE><INCLUDE>Name</INCLUDE><INCLUDE>Direction</INCLUDE><INCLUDE>Geometry</INCLUDE><INCLUDE>PhotoUrl</INCLUDE><INCLUDE>Location</INCLUDE><INCLUDE>Type</INCLUDE></QUERY></REQUEST>`;
      const res = await fetch('https://api.trafikinfo.trafikverket.se/v2/data.json', { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`Trafikverket HTTP ${res.status}`);
      const j = (await res.json()) as { RESPONSE?: { RESULT?: { Camera?: { Id: string; Name?: string; Direction?: number | string; Geometry?: { WGS84?: string }; PhotoUrl?: string; Location?: string; Type?: string }[]; error?: { MESSAGE?: string } }[] } };
      const result = j.RESPONSE?.RESULT?.[0];
      if (result?.error) throw new Error(`Trafikverket: ${result.error.MESSAGE ?? 'error'}`);
      return (result?.Camera ?? []).flatMap((c) => {
        const m = c.Geometry?.WGS84?.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)/);
        const img = https(c.PhotoUrl);
        if (!m || !img || !ok(m[1], m[2])) return [];
        const dir = c.Direction != null && c.Direction !== '' ? Number(c.Direction) : undefined;
        return [
          cam(Number(m[1]), Number(m[2]), {
            id: `tv-${c.Id}`,
            title: c.Name || c.Location || 'Kamera',
            subtitle: ['Straßenkamera Schweden', c.Type].filter(Boolean).join(' · '),
            image: img,
            url: img,
            source: 'Trafikverket (CC0)',
            dir: dir != null && dir >= 0 && dir <= 360 ? dir : undefined,
          }),
        ];
      });
    },
  },
  {
    // Socrata dataset of the CHART cameras: positions plus a link to the operator's video page (no still image)
    id: 'md',
    label: 'CHART (Maryland)',
    bbox: [-79.6, 37.9, -75.0, 39.8],
    async load() {
      const list = await fetchJson<{ location?: string; county?: string; feedid?: string; url?: string; lat?: string; long?: string }[]>('https://opendata.maryland.gov/resource/hua3-qc8n.json?$limit=2000', undefined, 30000);
      return list.flatMap((c) => {
        const url = https(c.url);
        if (!c.feedid || !url || !ok(c.long, c.lat)) return [];
        return [cam(Number(c.long), Number(c.lat), { id: `md-${c.feedid}`, title: c.location || 'Kamera', subtitle: ['Verkehrskamera Maryland', c.county].filter(Boolean).join(' · '), url, source: 'Maryland DOT State Highway Administration (CHART) via opendata.maryland.gov' })];
      });
    },
  },
  {
    // Socrata dataset of the city/parish: position and link to the 511 camera page
    id: 'br',
    label: 'Baton Rouge (Louisiana)',
    bbox: [-91.4, 30.3, -90.9, 30.65],
    async load() {
      const list = await fetchJson<{ id: string; image_view?: string; the_geom?: { coordinates?: number[] } }[]>('https://data.brla.gov/resource/6z6u-ts44.json?$limit=1000', undefined, 30000);
      return list.flatMap((c) => {
        const [lon, lat] = c.the_geom?.coordinates ?? [];
        const url = https(c.image_view);
        return url && ok(lon, lat) ? [cam(lon, lat, { id: `br-${c.id}`, title: `Kamera ${c.id}`, subtitle: 'Verkehrskamera Baton Rouge', url, source: 'City of Baton Rouge / East Baton Rouge Parish – Open Data' })] : [];
      });
    },
  },
  {
    id: 'nps',
    label: 'US-Nationalparks',
    bbox: [-170, 18, -64, 72],
    key: 'nps',
    async load() {
      const key = store.getKeys().nps!;
      // NPS accepts the key as the X-Api-Key header (its recommended method) or a query param
      const j = await fetchJson<{ data: { id: string; title: string; url?: string; latitude?: number | string; longitude?: number | string; images?: { url: string }[]; isStreaming?: boolean; status?: string; relatedParks?: { fullName?: string }[] }[] }>(
        viaProxy(`https://developer.nps.gov/api/v1/webcams?limit=600&api_key=${encodeURIComponent(key)}`),
        undefined,
        30000,
      );
      return j.data
        .filter((w) => w.status !== 'Inactive' && ok(w.longitude, w.latitude))
        .map((w) => cam(Number(w.longitude), Number(w.latitude), { id: `nps-${w.id}`, title: w.title, subtitle: [w.relatedParks?.[0]?.fullName, w.isStreaming ? 'Livestream' : ''].filter(Boolean).join(' · '), image: w.images?.[0]?.url, url: w.url, source: 'US National Park Service', live: false }));
    },
  },
  ...ARC_FEEDS.map(arcFeed),
  ...IBI_511.map(
    (a): CamFeed => ({
      id: a.id,
      label: a.label,
      bbox: a.bbox,
      key: a.key,
      async load() {
        const key = store.getKeys()[a.key];
        if (!key) throw new Error(`${a.label}: key missing`);
        const list = await fetchJson<{ Id: string | number; Roadway?: string; Location?: string; Direction?: string; Latitude: number; Longitude: number; Views?: { Url: string; Status?: string }[] }[]>(
          `https://${a.host}/api/v2/get/cameras?format=json&key=${encodeURIComponent(key)}`,
          undefined,
          30000,
        );
        return list
          .filter((c) => ok(c.Longitude, c.Latitude))
          .flatMap((c) => {
            const view = c.Views?.find((v) => v.Status !== 'Disabled') ?? c.Views?.[0];
            const image = https(view?.Url);
            if (!image) return [];
            return [cam(c.Longitude, c.Latitude, { id: `${a.id}-${c.Id}`, title: c.Location || c.Roadway || 'Kamera', subtitle: [`Verkehrskamera ${a.name}`, c.Roadway].filter(Boolean).join(' · '), image, url: image, source: a.source, dir: directionToHeading(c.Direction, true) })];
          });
      },
    }),
  ),
  {
    // OHGO public API (free key): cameras with several views; field casing differs between docs and answers, so both are read
    id: 'ohgo',
    label: 'OHGO (Ohio)',
    bbox: [-84.9, 38.4, -80.5, 42.4],
    key: 'ohgo',
    async load() {
      const key = store.getKeys().ohgo;
      if (!key) throw new Error('OHGO: key missing');
      type View = { direction?: string; smallUrl?: string; largeUrl?: string; SmallUrl?: string; LargeUrl?: string; Direction?: string };
      type Cam = { id?: string; Id?: string; latitude?: number; Latitude?: number; longitude?: number; Longitude?: number; location?: string; Location?: string; description?: string; Description?: string; cameraViews?: View[]; CameraViews?: View[] };
      const j = await fetchJson<{ results?: Cam[]; Results?: Cam[] }>(`https://publicapi.ohgo.com/api/v1/cameras?page-all=true&api-key=${encodeURIComponent(key)}`, undefined, 40000);
      return (j.results ?? j.Results ?? []).flatMap((c, i) => {
        const lat = c.latitude ?? c.Latitude;
        const lon = c.longitude ?? c.Longitude;
        const views = c.cameraViews ?? c.CameraViews ?? [];
        const v = views.find((x) => x.direction ?? x.Direction) ?? views[0];
        const image = https(v?.largeUrl ?? v?.LargeUrl ?? v?.smallUrl ?? v?.SmallUrl);
        if (!image || !ok(lon, lat)) return [];
        return [cam(Number(lon), Number(lat), { id: `ohgo-${c.id ?? c.Id ?? i}`, title: c.location ?? c.Location ?? c.description ?? c.Description ?? 'Kamera', subtitle: 'Verkehrskamera Ohio', image, url: image, source: 'Ohio DOT (OHGO)', dir: directionToHeading(v?.direction ?? v?.Direction, true) })];
      });
    },
  },
  {
    // QLDTraffic GeoJSON API (apikey from the spec / registration); property names are not documented in detail → generic parser
    id: 'qld',
    label: 'QLDTraffic (Queensland)',
    bbox: [138.0, -29.2, 153.6, -10.0],
    key: 'qldtraffic',
    async load() {
      const key = store.getKeys().qldtraffic;
      if (!key) throw new Error('QLDTraffic: key missing');
      const fc = await fetchJson<Parameters<typeof genericCams>[0]>(`https://api.qldtraffic.qld.gov.au/v1/webcams?apikey=${encodeURIComponent(key)}`, undefined, 30000);
      return genericCams(fc, 'Queensland Department of Transport and Main Roads (QLDTraffic)', 'qld');
    },
  },
];

/** Feeds whose camera list the data Action mirrors (not signed URLs, keys or XML); images always live. */
export const SNAPSHOT_CAMS = new Set(['tfl', 'caltrans', 'nyc', 'dc', '511on.ca', '511.alberta.ca', 'alertca', 'autobahn', 'nps', 'is', 'nz', 'drivebc', 'nsw', 'calgary', 'deldot', 'vegvesen', 'austin', 'wsdot', 'kingcounty', 'dgt', 'cat', 'trafikverket', 'md', 'il', 'or', 'mi', 'ia', 'mo', 'ga', 'ky', 'nl-ca', 'sk', 'yt', 'ie-donegal', 'br', 'ut', 'az', 'id', 'nv', 'ak', 'ga511', 'la', 'pa', 'ohgo', 'qld']);

export function camFeedsInView(b: { west: number; south: number; east: number; north: number }): CamFeed[] {
  const keys = store.getKeys();
  // a keyed feed is available either with the user's key or via the shared snapshot
  return CAM_FEEDS.filter((f) => (!f.key || keys[f.key] || SNAPSHOT_CAMS.has(f.id)) && f.bbox[0] < b.east && f.bbox[2] > b.west && f.bbox[1] < b.north && f.bbox[3] > b.south);
}
