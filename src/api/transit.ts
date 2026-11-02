import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { fetchJson, fetchJsonEtag, pruneEtagCache } from '../util';
import { uTok } from '../units';
import { viaProxy } from './proxy';

// Public transport and rail – live positions.
// • Transitous (community-run MOTIS, timetables + realtime for Germany and many other countries):
//   trip segments with stop-to-stop polylines; current positions are interpolated from the
//   (real-time) departure and arrival times, exactly like transitous.org does.
// • Amtraker: GPS positions of Amtrak trains (USA).
// Germany-specific: Autobahn traffic reports and NINA public warnings.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// ---------------------------------------------------------------------------
// Transitous

export type TransitMode =
  | 'HIGHSPEED_RAIL'
  | 'LONG_DISTANCE'
  | 'NIGHT_RAIL'
  | 'REGIONAL_FAST_RAIL'
  | 'REGIONAL_RAIL'
  | 'RAIL'
  | 'SUBURBAN'
  | 'SUBWAY'
  | 'METRO'
  | 'TRAM'
  | 'BUS'
  | 'COACH'
  | 'FERRY'
  | string;

export const RAIL_MODES = new Set(['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'RAIL', 'SUBURBAN']);

export const MODE_STYLE: Record<string, { label: string; color: string }> = {
  HIGHSPEED_RAIL: { label: 'Hochgeschwindigkeitszug', color: '#ef5350' },
  LONG_DISTANCE: { label: 'Fernzug', color: '#ff7043' },
  NIGHT_RAIL: { label: 'Nachtzug', color: '#7e57c2' },
  REGIONAL_FAST_RAIL: { label: 'Regionalexpress', color: '#66bb6a' },
  REGIONAL_RAIL: { label: 'Regionalzug', color: '#9ccc65' },
  RAIL: { label: 'Zug', color: '#9ccc65' },
  SUBURBAN: { label: 'S-Bahn', color: '#26a69a' },
  SUBWAY: { label: 'U-Bahn', color: '#42a5f5' },
  METRO: { label: 'Metro', color: '#42a5f5' },
  TRAM: { label: 'Straßenbahn', color: '#ec407a' },
  BUS: { label: 'Bus', color: '#ab47bc' },
  COACH: { label: 'Fernbus', color: '#8d6e63' },
  ODM: { label: 'Rufbus', color: '#fdd835' },
  FLEX: { label: 'Rufbus', color: '#fdd835' },
  FERRY: { label: 'Fähre', color: '#29b6f6' },
};
export const modeStyle = (m: string) => MODE_STYLE[m] ?? { label: 'ÖPNV', color: '#bdbdbd' };

/** vehicle glyphs for the badges (viewBox 0 0 24 24, drawn with currentColor; one per type: ICE / IC / RE / S / U / Tram / Bus / RUF / ship) */
export const MODE_ICONS: Record<string, string> = {
  HIGHSPEED_RAIL: 'M14 20h-4a1 1 0 0 1-.975-.779c-.6-.425-1.119-1.068-1.517-2.02Q8.56 17.956 9 18.228c.44.27.997.469 1.658.513h2.682a3.7 3.7 0 0 0 1.66-.513q.489-.298 1.732-1.204c-.416 1.003-1.017 1.782-1.774 2.259Q14.737 20 14 20M11.974 4c3.684 0 5.474 2.502 5.52 6.006l.003 2.008c0 .78-.036 1.745-.147 2.612q-.546.475-1.355 1.078-.809.605-1.642 1.16c-.32.215-.782.386-1.26.386h-2.185c-.474 0-.946-.175-1.26-.386-.316-.212-1.062-.73-1.643-1.16a24 24 0 0 1-1.142-.898q-.366-1.967-.366-2.798v-2.002C6.497 6.502 8.205 4 11.974 4m-1.801 9.168a.75.75 0 0 0-1.41.47l.564 1.694a.75.75 0 0 0 1.41-.47zm4.564-.38a.75.75 0 0 0-.91.38l-.564 1.694a.75.75 0 0 0 1.41.47l.564-1.694a.75.75 0 0 0-.5-.85M12 6q-1.731 0-2.754.546a2.27 2.27 0 0 0-1.144 2.276q.295 1.42.374 1.692c.16.546.596.962 1.141 1.1q1.455.26 2.383.265.93.005 2.248-.238a1.6 1.6 0 0 0 1.28-1.127c.077-.265.328-1.395.372-1.696.128-.864-.674-2.062-1.333-2.365Q13.577 6 12 6',
  LONG_DISTANCE: 'M17.592 16.908c-.442 1.205-1.416 2.167-2.649 2.634a1 1 0 0 0-1.153-.645q-1.071.229-1.79.228-.719 0-1.79-.228a1 1 0 0 0-1.153.645c-1.232-.466-2.206-1.428-2.648-2.632.295.134 1.329.55 2.723.92.342.08.296.062.724.123q.474.034.834.038l2.783-.004q.276-.007.668-.034a4.5 4.5 0 0 0 .723-.123q1.474-.408 2.728-.922M13.45 4.15c2.349 0 4.283 1.766 4.395 4.005l.005 6.919q-1.11.607-2.003.899c-.893.292-1.33.417-1.704.471s-1.127.054-2.141.054-1.93-.027-2.148-.054c-.486-.06-.815-.164-1.245-.302a23 23 0 0 1-1.521-.572 8 8 0 0 1-.938-.495V8.36c0-2.267 1.865-4.1 4.188-4.205zM9.02 13.5a.85.85 0 0 0-.251 1.668l1.21.182a.85.85 0 0 0 .252-1.667zm4.749.183a.85.85 0 0 0 .251 1.667l1.211-.182a.85.85 0 0 0-.251-1.668zm-3.683-8.634a2 2 0 0 0-1.74 2.144l.317 3.958c.07.872.887 1.662 1.738 1.727.852.065 2.28.07 3.203 0a1.88 1.88 0 0 0 1.733-1.727l.317-3.958a2 2 0 0 0-1.74-2.144c-.257-.033-3.571-.033-3.828 0',
  NIGHT_RAIL: 'M17.592 16.908c-.442 1.205-1.416 2.167-2.649 2.634a1 1 0 0 0-1.153-.645q-1.071.229-1.79.228-.719 0-1.79-.228a1 1 0 0 0-1.153.645c-1.232-.466-2.206-1.428-2.648-2.632.295.134 1.329.55 2.723.92.342.08.296.062.724.123q.474.034.834.038l2.783-.004q.276-.007.668-.034a4.5 4.5 0 0 0 .723-.123q1.474-.408 2.728-.922M13.45 4.15c2.349 0 4.283 1.766 4.395 4.005l.005 6.919q-1.11.607-2.003.899c-.893.292-1.33.417-1.704.471s-1.127.054-2.141.054-1.93-.027-2.148-.054c-.486-.06-.815-.164-1.245-.302a23 23 0 0 1-1.521-.572 8 8 0 0 1-.938-.495V8.36c0-2.267 1.865-4.1 4.188-4.205zM9.02 13.5a.85.85 0 0 0-.251 1.668l1.21.182a.85.85 0 0 0 .252-1.667zm4.749.183a.85.85 0 0 0 .251 1.667l1.211-.182a.85.85 0 0 0-.251-1.668zm-3.683-8.634a2 2 0 0 0-1.74 2.144l.317 3.958c.07.872.887 1.662 1.738 1.727.852.065 2.28.07 3.203 0a1.88 1.88 0 0 0 1.733-1.727l.317-3.958a2 2 0 0 0-1.74-2.144c-.257-.033-3.571-.033-3.828 0',
  REGIONAL_FAST_RAIL: 'M10.58 4.002h2.84c1.197.017 1.845.157 2.517.517.663.355 1.19.881 1.544 1.544.36.672.5 1.32.517 2.518L18 15.154c0 1.37-.134 2.063-.519 2.783a3.73 3.73 0 0 1-1.544 1.544c-.672.36-1.32.5-2.518.517L10.846 20c-1.37 0-2.063-.134-2.783-.519a3.73 3.73 0 0 1-1.544-1.544c-.36-.672-.5-1.32-.517-2.518V8.581c.017-1.198.157-1.846.517-2.518A3.73 3.73 0 0 1 8.063 4.52c.672-.36 1.32-.5 2.518-.517M9.25 16.5a1 1 0 0 0-.117 1.993L10 18.5a1 1 0 0 0 .117-1.993zm4.75 0a1 1 0 0 0-.117 1.993l.867.007a1 1 0 0 0 .117-1.993zM14.913 6l-5.91.003a1 1 0 0 0-.916.963l.564 6.845c.035.423.089.573.18.724q.139.226.376.345c.138.07.273.11.59.118l4.26.002c.424 0 .579-.041.736-.12a.9.9 0 0 0 .376-.345c.08-.132.13-.264.166-.578q.578-6.93.578-6.957a1 1 0 0 0-1-1',
  REGIONAL_RAIL: 'M10.58 4.002h2.84c1.197.017 1.845.157 2.517.517.663.355 1.19.881 1.544 1.544.36.672.5 1.32.517 2.518L18 15.154c0 1.37-.134 2.063-.519 2.783a3.73 3.73 0 0 1-1.544 1.544c-.672.36-1.32.5-2.518.517L10.846 20c-1.37 0-2.063-.134-2.783-.519a3.73 3.73 0 0 1-1.544-1.544c-.36-.672-.5-1.32-.517-2.518V8.581c.017-1.198.157-1.846.517-2.518A3.73 3.73 0 0 1 8.063 4.52c.672-.36 1.32-.5 2.518-.517M9.25 16.5a1 1 0 0 0-.117 1.993L10 18.5a1 1 0 0 0 .117-1.993zm4.75 0a1 1 0 0 0-.117 1.993l.867.007a1 1 0 0 0 .117-1.993zM14.913 6l-5.91.003a1 1 0 0 0-.916.963l.564 6.845c.035.423.089.573.18.724q.139.226.376.345c.138.07.273.11.59.118l4.26.002c.424 0 .579-.041.736-.12a.9.9 0 0 0 .376-.345c.08-.132.13-.264.166-.578q.578-6.93.578-6.957a1 1 0 0 0-1-1',
  RAIL: 'M10.58 4.002h2.84c1.197.017 1.845.157 2.517.517.663.355 1.19.881 1.544 1.544.36.672.5 1.32.517 2.518L18 15.154c0 1.37-.134 2.063-.519 2.783a3.73 3.73 0 0 1-1.544 1.544c-.672.36-1.32.5-2.518.517L10.846 20c-1.37 0-2.063-.134-2.783-.519a3.73 3.73 0 0 1-1.544-1.544c-.36-.672-.5-1.32-.517-2.518V8.581c.017-1.198.157-1.846.517-2.518A3.73 3.73 0 0 1 8.063 4.52c.672-.36 1.32-.5 2.518-.517M9.25 16.5a1 1 0 0 0-.117 1.993L10 18.5a1 1 0 0 0 .117-1.993zm4.75 0a1 1 0 0 0-.117 1.993l.867.007a1 1 0 0 0 .117-1.993zM14.913 6l-5.91.003a1 1 0 0 0-.916.963l.564 6.845c.035.423.089.573.18.724q.139.226.376.345c.138.07.273.11.59.118l4.26.002c.424 0 .579-.041.736-.12a.9.9 0 0 0 .376-.345c.08-.132.13-.264.166-.578q.578-6.93.578-6.957a1 1 0 0 0-1-1',
  SUBURBAN: 'M11.909 6.375c-1.873 0-3.959 1.19-3.959 3.4 0 1.968 1.346 2.688 2.783 3.144.615.191.97.278 1.797.52.916.294 1.602.668 1.602 1.483 0 .647-.824 1.254-1.848 1.254-1.59 0-3.297-.966-4.247-2.405v2.25c.962.892 2.723 1.604 4.247 1.604 2.735 0 4.36-2.017 4.36-3.75 0-1.909-1.242-2.606-2.621-3.02a82 82 0 0 0-1.65-.423c-1.116-.287-2.013-.64-2.013-1.626 0-.62.55-1.15 1.511-1.15 1.6 0 3.144.877 4.11 2.016V7.798a6.44 6.44 0 0 0-4.072-1.423',
  SUBWAY: 'M14 6v7.36c0 1.343-.815 2.14-2 2.14-1.184 0-2-.797-2-2.14V6H7v7.633C7 16.828 9.293 18 12 18s5-1.17 5-4.367V6z',
  METRO: 'M14 6v7.36c0 1.343-.815 2.14-2 2.14-1.184 0-2-.797-2-2.14V6H7v7.633C7 16.828 9.293 18 12 18s5-1.17 5-4.367V6z',
  TRAM: 'M13.436 4.15q.213 0 1.27.275a.85.85 0 0 1-.307 1.67l-1.051-.241-.498-.005v1.15l.586.001c.963 0 1.512.118 2.012.385.5.268.9.666 1.167 1.167.262.49.367.962.383 1.78L17 16.686c0 .964-.1 1.477-.385 2.012-.268.5-.666.9-1.167 1.167-.49.262-.962.367-1.78.383l-3.104.002c-.964 0-1.477-.1-2.012-.385a2.8 2.8 0 0 1-1.167-1.167c-.262-.49-.367-.962-.383-1.78L7 10.564c0-.964.1-1.477.385-2.012.268-.5.666-.9 1.167-1.167.49-.262.962-.367 1.78-.383L11.15 7v-1.15l-.505.001-.939.225a.86.86 0 0 1-1.03-.619c-.111-.442.153-.886.516-.998.363-.113 1.116-.308 1.372-.308zM9.398 16.507a.75.75 0 0 0 0 1.486h1.004a.75.75 0 0 0 0-1.486zm4.25 0a.75.75 0 0 0 0 1.486h1.004a.75.75 0 0 0 0-1.486zM9.982 8.7c-.446 0-.607.046-.77.134a.9.9 0 0 0-.378.378c-.077.142-.122.284-.132.616L8.7 15.03q1.8.113 3.3.113c.833 0 2.172-.045 3.3-.113V9.98c0-.445-.046-.606-.134-.77a.9.9 0 0 0-.378-.377c-.142-.077-.284-.122-.616-.132zM13 10a.75.75 0 0 1 .75.75c0 .38-.294.75-.75.75h-2a.75.75 0 0 1-.75-.75c0-.38.314-.75.75-.75z',
  BUS: 'M15.436 4.15c.941 0 1.431.095 1.942.368.474.253.85.63 1.104 1.104.213.397.317.782.353 1.376L19.8 7v4l-.95-.001v5.72c0 .467-.046.764-.174 1.049s-.415.653-.676.78V20h-2.5v-1.15H8.499L8.5 20H6l-.002-1.45a1.76 1.76 0 0 1-.614-.66c-.152-.285-.217-.56-.231-.981q-.014-.423-.003-5.91L4.2 11V7l.965-.002c.036-.594.14-.979.353-1.376.253-.474.63-.85 1.104-1.104.468-.25.919-.351 1.716-.366zM7.85 15.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2m8.194 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2m1.106-7.501H6.85l.001 5.883a34.6 34.6 0 0 0 5.149.386 34.6 34.6 0 0 0 5.15-.386zM15 5.25H9v1.5h6z',
  COACH: 'M15.436 4.15c.941 0 1.431.095 1.942.368.474.253.85.63 1.104 1.104.213.397.317.782.353 1.376L19.8 7v4l-.95-.001v5.72c0 .467-.046.764-.174 1.049s-.415.653-.676.78V20h-2.5v-1.15H8.499L8.5 20H6l-.002-1.45a1.76 1.76 0 0 1-.614-.66c-.152-.285-.217-.56-.231-.981q-.014-.423-.003-5.91L4.2 11V7l.965-.002c.036-.594.14-.979.353-1.376.253-.474.63-.85 1.104-1.104.468-.25.919-.351 1.716-.366zM7.85 15.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2m8.194 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2m1.106-7.501H6.85l.001 5.883a34.6 34.6 0 0 0 5.149.386 34.6 34.6 0 0 0 5.15-.386zM15 5.25H9v1.5h6z',
  ODM: 'M15 4.5v1.506h.705c.814.068 1.578.688 1.785 1.404q.207.716.813 3.59H20v2.003L18.895 13q-.225 2.24-.3 2.629c-.075.39-.292.9-.595 1.197V19.5h-2.5v-1.759a23.9 23.9 0 0 1-7 0V19.5H6v-2.674c-.23-.223-.444-.616-.55-1.005q-.106-.388-.346-2.821L4 13.003V11h1.696l.761-3.432c.238-.805.882-1.41 1.677-1.541q.255-.038.866-.021V4.5zm-1 8.65h-4v1.7h4zm3 0h-2v1.7h2zm-8 0H7v1.7h2zm6.914-5.45H8.086L7.443 11h9.113z',
  FLEX: 'M15 4.5v1.506h.705c.814.068 1.578.688 1.785 1.404q.207.716.813 3.59H20v2.003L18.895 13q-.225 2.24-.3 2.629c-.075.39-.292.9-.595 1.197V19.5h-2.5v-1.759a23.9 23.9 0 0 1-7 0V19.5H6v-2.674c-.23-.223-.444-.616-.55-1.005q-.106-.388-.346-2.821L4 13.003V11h1.696l.761-3.432c.238-.805.882-1.41 1.677-1.541q.255-.038.866-.021V4.5zm-1 8.65h-4v1.7h4zm3 0h-2v1.7h2zm-8 0H7v1.7h2zm6.914-5.45H8.086L7.443 11h9.113z',
  FERRY: 'M17.894 16.772c.423.458.82.727 1.106.727a.85.85 0 0 1 0 1.7q-.904 0-1.741-.697-.906.697-1.82.697-.912 0-1.801-.72-.943.72-1.813.72t-1.761-.678q-.763.678-1.632.678t-1.853-.722q-.726.572-1.579.572a.85.85 0 0 1 0-1.7q.39 0 .88-.527a.85.85 0 0 1 1.265-.077c.094.093.794.754 1.22.754q.412 0 .936-.634a.85.85 0 0 1 1.315-.102c.086.09.762.736 1.209.736.414 0 1.117-.645 1.202-.734a.85.85 0 0 1 1.243.008c.081.088.74.726 1.198.726.282 0 .696-.223 1.187-.737a.85.85 0 0 1 1.239.01M14.75 4.15a.85.85 0 0 1 .79.534l.343 1.346-6.902.007c-.418 0-.79.41-.79.843 0 .434.424.85.79.85h7.327l.355 1.42h2.539a.85.85 0 0 1 .844.952c-.06.49-1.331 3.082-2.29 4.037q-.503.559-.928.827a2.63 2.63 0 0 1-1.411.427q-.82 0-1.739-.667-.866.893-1.763.923t-1.845-.803q-.769.806-1.638.806t-1.762-.816q-.79.816-1.67.816c-.433 0-.85-.358-.85-.806V5c0-.433.324-.85.85-.85zm.287 5.341a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
};

export interface Segment {
  id: string;
  name: string;
  mode: TransitMode;
  from: string;
  to: string;
  dep: number;
  arr: number;
  delayMin: number | null;
  realTime: boolean;
  coords: [number, number][];
  /** cumulative length along coords (degrees, cos-corrected) */
  cum: number[];
}

/** Google encoded polyline → [lon, lat][] */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  const f = 10 ** precision;
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lon += d;
    }
    out.push([lon / f, lat / f]);
  }
  return out;
}

interface TripSegmentDto {
  trips: { tripId: string; displayName?: string; routeShortName?: string }[];
  mode: string;
  from: { name: string };
  to: { name: string };
  departure: string;
  arrival: string;
  scheduledDeparture: string;
  realTime: boolean;
  polyline: string;
}

/**
 * Trip segments running inside the bounds during [start, end]. The server thins out minor
 * modes by zoom level by itself.
 */
export async function loadSegments(b: Bounds, zoom: number, start: number, end: number): Promise<Segment[]> {
  const q = new URLSearchParams({
    min: `${b.south.toFixed(4)},${b.east.toFixed(4)}`,
    max: `${b.north.toFixed(4)},${b.west.toFixed(4)}`,
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    zoom: String(Math.round(zoom)),
    precision: '5',
  });
  const list = await fetchJson<TripSegmentDto[]>(`https://api.transitous.org/api/v5/map/trips?${q}`, undefined, 25000);
  const out: Segment[] = [];
  for (const s of list) {
    const coords = decodePolyline(s.polyline, 5);
    if (coords.length < 2) continue;
    const cum = [0];
    for (let k = 1; k < coords.length; k++) {
      const [x0, y0] = coords[k - 1];
      const [x1, y1] = coords[k];
      const c = Math.cos((y0 * Math.PI) / 180);
      cum.push(cum[k - 1] + Math.hypot((x1 - x0) * c, y1 - y0));
    }
    const t = s.trips[0];
    const dep = Date.parse(s.departure);
    out.push({
      id: t?.tripId ?? `${s.from.name}-${s.departure}`,
      name: (t?.displayName ?? t?.routeShortName ?? '').trim(),
      mode: s.mode,
      from: s.from.name,
      to: s.to.name,
      dep,
      arr: Date.parse(s.arrival),
      delayMin: s.realTime ? Math.round((dep - Date.parse(s.scheduledDeparture)) / 60000) : null,
      realTime: s.realTime,
      coords,
      cum,
    });
  }
  return out;
}

/** Interpolated vehicle positions at time t (one per trip). */
export function positionsAt(segs: Segment[], t: number, filter: (mode: string) => boolean): FeatureCollection<Point> {
  const seen = new Set<string>();
  const features: Feature<Point>[] = [];
  for (const s of segs) {
    if (t < s.dep || t > s.arr || seen.has(s.id) || !filter(s.mode)) continue;
    seen.add(s.id);
    const frac = s.arr > s.dep ? (t - s.dep) / (s.arr - s.dep) : 0;
    const target = frac * s.cum[s.cum.length - 1];
    let k = 1;
    while (k < s.cum.length - 1 && s.cum[k] < target) k++;
    const seg = s.cum[k] - s.cum[k - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - s.cum[k - 1]) / seg));
    const [x0, y0] = s.coords[k - 1];
    const [x1, y1] = s.coords[k];
    const bearing = (Math.atan2((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0) * 180) / Math.PI;
    const st = modeStyle(s.mode);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f] },
      properties: {
        src: 'transitous',
        id: s.id,
        name: s.name || st.label,
        mode: s.mode,
        color: st.color,
        rail: RAIL_MODES.has(s.mode),
        from: s.from,
        to: s.to,
        dep: s.dep,
        arr: s.arr,
        delay: s.delayMin ?? -999,
        realTime: s.realTime,
        bearing,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Amtrak (USA) – GPS via Amtraker

const COMPASS: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export async function loadAmtrak(): Promise<Feature<Point>[]> {
  const json = await fetchJson<Record<string, { routeName: string; trainNum: string | number; lat: number; lon: number; heading?: string; velocity?: number; origName?: string; destName?: string; trainState?: string; trainTimely?: string }[]>>(
    'https://api-v3.amtraker.com/v3/trains',
    undefined,
    20000,
  );
  const out: Feature<Point>[] = [];
  for (const list of Object.values(json)) {
    for (const t of list) {
      if (t.lat == null || t.lon == null || (t.trainState && t.trainState !== 'Active')) continue;
      out.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: {
          src: 'amtrak',
          name: `${t.routeName} ${t.trainNum}`,
          mode: 'LONG_DISTANCE',
          color: '#1e88e5',
          rail: true,
          from: t.origName ?? '',
          to: t.destName ?? '',
          speed: t.velocity != null ? Math.round(t.velocity * 1.609) : null,
          timely: t.trainTimely ?? '',
          bearing: COMPASS[t.heading ?? ''] ?? 0,
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Autobahn GmbH: traffic reports, closures and roadworks on German motorways (keyless).
//
// The API has no spatial query (no bbox/area filter): report locations are only known
// after each road's full answer arrives, so every road × kind must be fetched at least
// once. To keep that bearable the answers are cached in the browser (Cache Storage,
// across page loads) and revalidated via the API's ETag support: unchanged roads reply
// with an empty 304, so only roads with actual changes transfer data again. Reports
// also surface progressively via the `onProgress` callback as roads finish loading.

export type AutobahnKind = 'warning' | 'closure' | 'roadworks';

const AB = 'https://verkehr.autobahn.de/o/autobahn';
const AB_CACHE = 'autobahn-reports-v1';

export interface AutobahnProgress {
  points: Feature<Point>[];
  lines: Feature<LineString>[];
}

interface AbItem {
  identifier: string;
  title?: string;
  subtitle?: string;
  description?: string[];
  coordinate?: { lat: string | number; long: string | number };
  geometry?: { type: string; coordinates: number[][] };
  startTimestamp?: string;
  delayTimeValue?: string;
  abnormalTrafficType?: string;
  averageSpeed?: string;
  isBlocked?: string | boolean;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { status: 'fulfilled', value: await fn(items[i]) };
        } catch (e) {
          out[i] = { status: 'rejected', reason: e };
        }
      }
    }),
  );
  return out;
}

export async function loadAutobahn(onProgress?: (p: AutobahnProgress) => void): Promise<{ points: FeatureCollection<Point>; lines: FeatureCollection<LineString> }> {
  const { roads } = await fetchJsonEtag<{ roads: string[] }>(`${AB}/`, AB_CACHE);
  const names = [...new Set(roads.map((r) => r.trim()))];
  const kinds: AutobahnKind[] = ['warning', 'closure', 'roadworks'];
  const jobs: [string, AutobahnKind][] = names.flatMap((road) => kinds.map((kind) => [road, kind] as [string, AutobahnKind]));
  const points: Feature<Point>[] = [];
  const lines: Feature<LineString>[] = [];
  const seen = new Set<string>();
  let dirty = false;
  let flushAt = 0;
  /** Throttled: surface finished roads to the map while the sweep is still running. */
  const flush = (force = false) => {
    if (!onProgress || !dirty) return;
    const t = Date.now();
    if (!force && t < flushAt) return;
    flushAt = t + 500;
    dirty = false;
    onProgress({ points: [...points], lines: [...lines] });
  };
  const addItems = (road: string, kind: string, items: AbItem[]) => {
    for (const it of items) {
      if (seen.has(it.identifier)) continue;
      seen.add(it.identifier);
      const lat = Number(it.coordinate?.lat);
      const lon = Number(it.coordinate?.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const jam = kind === 'warning' && /stau|stockend|traffic/i.test(`${it.title} ${it.abnormalTrafficType ?? ''} ${(it.description ?? []).join(' ')}`);
      const sub = kind === 'roadworks' ? 'Baustelle' : kind === 'closure' ? 'Sperrung' : jam ? 'Stau' : 'Verkehrsmeldung';
      const color = kind === 'closure' ? '#d32f2f' : kind === 'roadworks' ? '#ffa000' : jam ? '#e53935' : '#fdd835';
      const props = {
        kind: jam ? 'jam' : kind,
        title: `${road}: ${(it.title ?? sub).replace(/^\s*A\d+\s*\|\s*/, '')}`,
        subtitle: [sub, it.subtitle, it.delayTimeValue ? `+${it.delayTimeValue} min` : '', it.averageSpeed ? `Ø ${uTok('speed', Number(it.averageSpeed))}` : ''].filter(Boolean).join(' · '),
        description: (it.description ?? []).filter(Boolean).join('\n'),
        date: it.startTimestamp ?? '',
        color,
        source: 'Autobahn GmbH des Bundes',
        url: 'https://www.autobahn.de/verkehrsmeldungen',
      };
      points.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
      if (it.geometry?.type === 'LineString' && it.geometry.coordinates.length > 1 && kind !== 'roadworks') {
        lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: it.geometry.coordinates }, properties: props });
      }
      dirty = true;
    }
    flush();
  };
  const results = await pool(jobs, 12, ([road, kind]) => fetchJsonEtag<Record<string, AbItem[]>>(`${AB}/${encodeURIComponent(road)}/services/${kind}`, AB_CACHE).then((value) => addItems(road, kind, value[kind] ?? [])));
  if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
  flush(true);
  if (names.length) pruneEtagCache(AB_CACHE, [`${AB}/`, ...jobs.map(([road, kind]) => `${AB}/${encodeURIComponent(road)}/services/${kind}`)]);
  return { points: { type: 'FeatureCollection', features: points }, lines: { type: 'FeatureCollection', features: lines } };
}

// ---------------------------------------------------------------------------
// NINA – warnings of the German federal warning system (BBK): MoWaS, KATWARN, BIWAPP,
// flood portal (LHP) and police. DWD weather warnings have their own layer. The API sends
// no CORS headers, so requests go through the data proxy.

const NINA = 'https://warnung.bund.de/api31';
const NINA_SOURCES = ['mowas', 'katwarn', 'biwapp', 'lhp', 'police'];
const SEVERITY_COLOR: Record<string, string> = { Extreme: '#880e4f', Severe: '#e53935', Moderate: '#fb8c00', Minor: '#fdd835' };
const SOURCE_LABEL: Record<string, string> = { mowas: 'MoWaS', katwarn: 'KATWARN', biwapp: 'BIWAPP', lhp: 'Hochwasserportal', police: 'Polizei' };

export async function loadNina(): Promise<FeatureCollection> {
  const lists = await Promise.allSettled(
    NINA_SOURCES.map((src) =>
      fetchJson<{ id: string; severity?: string; startDate?: string; i18nTitle?: Record<string, string> }[]>(viaProxy(`${NINA}/${src}/mapData.json`), undefined, 20000).then((l) => l.map((w) => ({ ...w, src }))),
    ),
  );
  if (lists.every((l) => l.status === 'rejected')) throw (lists[0] as PromiseRejectedResult).reason;
  const all = lists.flatMap((l) => (l.status === 'fulfilled' ? l.value : []));
  const geo = await pool(all, 6, (w) => fetchJson<FeatureCollection>(viaProxy(`${NINA}/warnings/${encodeURIComponent(w.id)}.geojson`), undefined, 20000));
  const features: Feature[] = [];
  geo.forEach((g, i) => {
    if (g.status !== 'fulfilled') return;
    const w = all[i];
    for (const f of g.value.features ?? []) {
      if (!f.geometry) continue;
      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: w.id,
          title: w.i18nTitle?.de ?? w.i18nTitle?.en ?? 'Warnung',
          subtitle: `${SOURCE_LABEL[w.src] ?? w.src}${w.severity ? ` · ${{ Extreme: 'extrem', Severe: 'schwer', Moderate: 'mittel', Minor: 'gering' }[w.severity] ?? w.severity}` : ''}`,
          date: w.startDate ?? '',
          color: SEVERITY_COLOR[w.severity ?? ''] ?? '#fb8c00',
          source: `NINA / BBK (${SOURCE_LABEL[w.src] ?? w.src})`,
          url: `https://warnung.bund.de/meldungen/${encodeURIComponent(w.id)}`,
        },
      });
    }
  });
  return { type: 'FeatureCollection', features };
}

/** Full text of a NINA warning (for the popup). */
export async function loadNinaDetails(id: string): Promise<string> {
  const j = await fetchJson<{ info?: { description?: string; instruction?: string; headline?: string }[] }>(`${NINA}/warnings/${encodeURIComponent(id)}.json`, undefined, 15000);
  const info = j.info?.[0];
  return [info?.description, info?.instruction].filter(Boolean).join('\n\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
}
