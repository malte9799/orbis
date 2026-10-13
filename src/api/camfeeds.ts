import type { Feature, Point } from 'geojson';
import { store } from '../store';
import { fetchJson } from '../util';

// Public traffic, weather and wildfire cameras from open government / operator feeds.
// Each feed is loaded once its region comes into view (and refreshed every 10 minutes);
// still images get a cache-buster when the popup opens.

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
  p: { id: string; title: string; subtitle?: string; image?: string; video?: string; url?: string; source: string; live?: boolean },
): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { ...p, kind: p.live === false ? 'signed' : 'road' },
});

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
        return cam(c.lon, c.lat, { id: c.id, title: c.commonName, subtitle: 'Verkehrskamera London', image: prop('imageUrl'), video: prop('videoUrl'), url: prop('videoUrl') ?? prop('imageUrl'), source: 'Transport for London' });
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
      return (j.items[0]?.cameras ?? []).map((c) => cam(c.location.longitude, c.location.latitude, { id: `sg-${c.camera_id}`, title: `Kamera ${c.camera_id}`, subtitle: 'Verkehrskamera Singapur', image: c.image, url: c.image, source: 'LTA / data.gov.sg', live: false }));
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
        return [cam(lon, lat, { id: `hk-${t('key')}`, title: t('description') || t('key'), subtitle: [t('district'), t('region')].filter(Boolean).join(', '), image: t('url'), url: t('url'), source: 'Transport Department HK' })];
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
          fetchJson<{ data: { cctv: { index: string; inService?: string; location: { locationName: string; nearbyPlace?: string; route?: string; latitude: string; longitude: string }; imageData?: { static?: { currentImageURL?: string }; streamingVideoURL?: string } } }[] }>(
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
                  url: c.imageData?.streamingVideoURL || c.imageData?.static?.currentImageURL,
                  source: 'Caltrans',
                }),
              ),
      );
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
        'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_Sensors_WebMercator/MapServer/93/query?where=1%3D1&outFields=*&outSR=4326&f=geojson',
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
        const list = await fetchJson<{ Id: string | number; Roadway?: string; Location?: string; Latitude: number; Longitude: number; Views?: { Url: string; Status?: string; Description?: string }[] }[]>(
          `https://${host}/api/v2/get/cameras?format=json`,
          undefined,
          30000,
        );
        return list
          .filter((c) => ok(c.Longitude, c.Latitude))
          .map((c) => {
            const view = c.Views?.find((v) => v.Status !== 'Disabled') ?? c.Views?.[0];
            return cam(c.Longitude, c.Latitude, { id: `${host}-${c.Id}`, title: c.Location || c.Roadway || 'Kamera', subtitle: c.Roadway, image: view?.Url, url: view?.Url, source: host });
          });
      },
    }),
  ),
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
      const { roads } = await fetchJson<{ roads: string[] }>(`${AB}/`, undefined, 20000);
      const parts = await Promise.allSettled(
        roads.map((r) => fetchJson<{ webcam?: { identifier: string; title?: string; subtitle?: string; coordinate?: { lat: string; long: string }; imageurl?: string; linkurl?: string }[] }>(`${AB}/${encodeURIComponent(r.trim())}/services/webcam`, undefined, 20000)),
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
      const j = await fetchJson<{ data: { id: string; title: string; url?: string; latitude?: number | string; longitude?: number | string; images?: { url: string }[]; isStreaming?: boolean; status?: string; relatedParks?: { fullName?: string }[] }[] }>(
        `https://developer.nps.gov/api/v1/webcams?limit=600&api_key=${encodeURIComponent(key)}`,
        undefined,
        30000,
      );
      return j.data
        .filter((w) => w.status !== 'Inactive' && ok(w.longitude, w.latitude))
        .map((w) => cam(Number(w.longitude), Number(w.latitude), { id: `nps-${w.id}`, title: w.title, subtitle: [w.relatedParks?.[0]?.fullName, w.isStreaming ? 'Livestream' : ''].filter(Boolean).join(' · '), image: w.images?.[0]?.url, url: w.url, source: 'US National Park Service', live: false }));
    },
  },
];

export function camFeedsInView(b: { west: number; south: number; east: number; north: number }): CamFeed[] {
  const keys = store.getKeys();
  return CAM_FEEDS.filter((f) => (!f.key || keys[f.key]) && f.bbox[0] < b.east && f.bbox[2] > b.west && f.bbox[1] < b.north && f.bbox[3] > b.south);
}
