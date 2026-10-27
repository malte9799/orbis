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
  key?: 'nps';
  load(): Promise<Feature<Point>[]>;
}

const cam = (
  lon: number,
  lat: number,
  p: { id: string; title: string; subtitle?: string; image?: string; video?: string; hls?: string; url?: string; source: string; live?: boolean; dir?: number },
): Feature<Point> => {
  const { dir: given, ...rest } = p;
  // names often carry the direction of travel ("… NB", "… Westbound"): use it when the feed has no direction field
  const dir = given ?? directionToHeading(p.title, false, true);
  // viewing direction only when known (the webcam layer draws a cone for dir >= 0)
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { ...rest, kind: p.live === false ? 'signed' : 'road', ...(dir != null && Number.isFinite(dir) ? { dir } : {}) } };
};

/**
 * Compass heading from a direction text, or undefined. Dedicated direction fields ("North", "N-E",
 * "SW") may use bare words (`bare`); in free names only travel forms count ("NB", "Westbound"),
 * since street names like "West Ave" contain cardinal words too. Mostly the direction of travel of
 * the road the camera watches – an approximation of where it looks. Ambiguous text: undefined.
 * `travelOnly`: only "NB"/"Westbound" forms (for free names where "NE 124th St" is a street).
 */
export function directionToHeading(value: string | undefined, bare = false, travelOnly = false): number | undefined {
  const text = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\b([NSEW])\s*\/\s*B\b/g, '$1B')
    .replace(/\b(NORTH|SOUTH)[\s\/-]?(EAST|WEST)\b/g, (_, a, b) => `${a[0]}${b[0]}`)
    .replace(/(\b[NS])[-\/]([EW]\b)/g, '$1$2');
  if (!text) return undefined;
  const tiers: [RegExp, number][][] = [
    [[/\bNORTHBOUND\b|\bNB\b/, 0], [/\bSOUTHBOUND\b|\bSB\b/, 180], [/\bEASTBOUND\b|\bEB\b/, 90], [/\bWESTBOUND\b|\bWB\b/, 270]],
    [[/\bNORTHEAST\b|\bNE\b/, 45], [/\bNORTHWEST\b|\bNW\b/, 315], [/\bSOUTHEAST\b|\bSE\b/, 135], [/\bSOUTHWEST\b|\bSW\b/, 225]],
  ];
  if (travelOnly) tiers.length = 1;
  else if (bare) tiers.push([[/\bNORTH\b|^N$/, 0], [/\bSOUTH\b|^S$/, 180], [/\bEAST\b|^E$/, 90], [/\bWEST\b|^W$/, 270]]);
  for (const forms of tiers) {
    const hits = new Set(forms.filter(([re]) => re.test(text)).map(([, h]) => h));
    if (hits.size) return hits.size === 1 ? [...hits][0] : undefined;
  }
  return undefined;
}

/** Heading from an Icelandic view description ("séð til vesturs", "í norðaustur"); place names after "í átt að" don't count. */
export function icelandicHeading(text: string | undefined): number | undefined {
  const m = (text ?? '').toLowerCase().match(/(?:til|í)\s+(norðaustur|norðvestur|suðaustur|suðvestur|norður|suður|austur|vestur)s?(?![\p{L}])/u);
  if (!m) return undefined;
  return { norðaustur: 45, norðvestur: 315, suðaustur: 135, suðvestur: 225, norður: 0, suður: 180, austur: 90, vestur: 270 }[m[1]];
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

export const CAM_FEEDS: CamFeed[] = [
  {
    id: 'tfl',
    label: 'TfL JamCams (London)',
    bbox: [-0.6, 51.25, 0.35, 51.72],
    async load() {
      const list = await fetchJson<{ id: string; commonName: string; lat: number; lon: number; additionalProperties?: { key: string; value: string }[] }[]>('https://api.tfl.gov.uk/Place/Type/JamCam', undefined, 30000);
      return list.map((c) => {
        const prop = (k: string) => c.additionalProperties?.find((p) => p.key === k)?.value;
        return cam(c.lon, c.lat, { id: c.id, title: c.commonName, subtitle: 'Verkehrskamera London', image: prop('imageUrl'), video: prop('videoUrl'), url: prop('videoUrl') ?? prop('imageUrl'), dir: directionToHeading(prop('view'), true), source: 'Powered by TfL Open Data · Contains OS data © Crown copyright and database rights 2016 and Geomni UK Map data © and database rights 2019' });
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
            return cam(c.Longitude, c.Latitude, { id: `${host}-${c.Id}`, title: c.Location || c.Roadway || 'Kamera', subtitle: c.Roadway, image: view?.Url, url: view?.Url, dir: directionToHeading(view?.Description), source: host === '511on.ca' ? '511 Ontario (Ministry of Transportation Ontario)' : '511 Alberta (Alberta Transportation)' });
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
            dir: icelandicHeading(c.Skyring),
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
            dir: directionToHeading(xmlTag(b, 'direction'), true),
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
];

/** Feeds whose camera list the data Action mirrors (not signed URLs, keys or XML); images always live. */
export const SNAPSHOT_CAMS = new Set(['tfl', 'caltrans', 'nyc', 'dc', '511on.ca', '511.alberta.ca', 'alertca', 'autobahn', 'nps', 'is', 'nz', 'drivebc', 'nsw', 'calgary', 'deldot', 'vegvesen', 'austin', 'wsdot', 'kingcounty']);

export function camFeedsInView(b: { west: number; south: number; east: number; north: number }): CamFeed[] {
  const keys = store.getKeys();
  // a keyed feed is available either with the user's key or via the shared snapshot
  return CAM_FEEDS.filter((f) => (!f.key || keys[f.key] || SNAPSHOT_CAMS.has(f.id)) && f.bbox[0] < b.east && f.bbox[2] > b.west && f.bbox[1] < b.north && f.bbox[3] > b.south);
}
