import type { Feature, FeatureCollection, Point } from 'geojson';
import { t as tT } from '../../../i18n';
import { Airport3D } from '../../airport3d';
import type { FlightInfo, SondeInfo } from '../../extras';
import type { ExtraCtx } from '../types';
import type { AircraftResult } from '../../../api/tracking';
import { empty } from './geo';
import { feedGnss } from './gnss';
import { AC_ALL_PAUSED, loadAircraft, loadAircraftByHex, loadGlobalAircraft } from '../../../api/tracking';

type St = { aircraftSeq: number; aircraftBusy: boolean; aircraftAgain: boolean; aircraftAt: number; aircraftDelay: number | undefined; aircraftErr: string; airport3d: Airport3D | null; lastAircraft: AircraftResult | null; lastSondes: FeatureCollection<Point> | null; lastSondesFed: number; sondes3D: boolean; heliFeatures: Feature<Point>[]; rotorShown: boolean; selectedBusy: boolean };
export const getState = (ctx: ExtraCtx) => ctx.state<St>('air', () => ({ aircraftSeq: 0, aircraftBusy: false, aircraftAgain: false, aircraftAt: 0, aircraftDelay: undefined, aircraftErr: '', airport3d: null, lastAircraft: null, lastSondes: null, lastSondesFed: 0, sondes3D: false, heliFeatures: [], rotorShown: false, selectedBusy: false }));

export function wantsAircraft(ctx: ExtraCtx) {
  return ctx.isOn('aircraft') || ctx.isOn('airport3d');
}

/** the live ADS-B feed is also needed by the GNSS layer (navigation quality of the aircraft) */
const wantsLive = (ctx: ExtraCtx) => wantsAircraft(ctx) || ctx.isOn('gnss');

export function loadAircraftNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!wantsLive(ctx)) return;
  if (st.aircraftBusy) {
    st.aircraftAgain = true;
    return;
  }
  const wait = st.aircraftAt + 5000 - Date.now();
  if (wait > 0) {
    clearTimeout(st.aircraftDelay);
    st.aircraftDelay = window.setTimeout(() => loadAircraftNow(ctx), wait);
    return;
  }
  st.aircraftBusy = true;
  st.aircraftAt = Date.now();
  fetchAircraft(ctx).finally(() => {
    st.aircraftBusy = false;
    if (st.aircraftAgain) {
      st.aircraftAgain = false;
      loadAircraftNow(ctx);
    }
  });
}

export function fetchSelected(ctx: ExtraCtx) {
  const st = getState(ctx);
  const hex = st.airport3d?.selectedHex();
  if (!hex || st.selectedBusy) return;
  st.selectedBusy = true;
  loadAircraftByHex(hex)
    .then((fc) => st.airport3d?.feed(fc))
    .catch(() => undefined)
    .finally(() => (st.selectedBusy = false));
}

export function fetchAircraft(ctx: ExtraCtx): Promise<void> {
  const st = getState(ctx);
  const m = ctx.map;
  fetchSelected(ctx);
  if (m.getZoom() < 5) {
    // the 3D airport layer only needs the live feed
    if (!ctx.isOn('aircraft')) return Promise.resolve();
    // zoomed out: coarse worldwide overview (positions refresh every 2 minutes)
    const seq = ++st.aircraftSeq;
    return loadGlobalAircraft()
      .then((fc) => {
        if (seq !== st.aircraftSeq || !ctx.isOn('aircraft')) return;
        ctx.setData('aircraft', fc);
        ctx.set('aircraft', { loading: false, count: fc.features.length, note: tT('layers.air.noteWorld') });
      })
      .catch(() => {
        if (seq !== st.aircraftSeq) return;
        ctx.setData('aircraft', empty());
        ctx.set('aircraft', { note: tT('layers.air.noteNoWorld'), count: undefined, loading: false });
      });
  }
  const c = m.getCenter();
  const b = m.getBounds();
  // radius = distance centre → corner in nautical miles
  const dLat = ((b.getNorth() - c.lat) * Math.PI) / 180;
  const dLon = ((b.getEast() - c.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((c.lat * Math.PI) / 180) * Math.cos((b.getNorth() * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const nm = km / 1.852;
  const seq = ++st.aircraftSeq;
  if (ctx.isOn('aircraft') && !ctx.info('aircraft')?.count) ctx.set('aircraft', { loading: true, note: undefined });
  return loadAircraft(c.lat, c.lng, nm)
    .then((fc) => {
      st.aircraftErr = '';
      if (seq !== st.aircraftSeq || !wantsLive(ctx)) return;
      if (ctx.isOn('gnss')) feedGnss(ctx, fc);
      if (!wantsAircraft(ctx)) return;
      st.lastAircraft = fc;
      st.airport3d?.feed(fc, { lat: c.lat, lon: c.lng, nm });
      if (!ctx.isOn('aircraft')) return;
      refreshAircraftIcons(ctx);
      ctx.set('aircraft', { loading: false, count: fc.features.length, note: `via ${fc.source}${nm > 250 ? ' · nur Umkreis um die Kartenmitte' : ''}` });
    })
    .catch((e) => {
      // log once per distinct failure, not on every refresh
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== st.aircraftErr && msg !== AC_ALL_PAUSED) console.warn('aircraft', e);
      st.aircraftErr = msg;
      if (seq === st.aircraftSeq && ctx.isOn('aircraft'))
        ctx.set('aircraft', { loading: false, note: tT('layers.air.noteFail') });
    });
}

export function refreshAircraftIcons(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!ctx.isOn('aircraft') || !st.lastAircraft) return;
  const fc = st.lastAircraft;
  const airport = st.airport3d;
  // aircraft of the cache that the latest request did not return stay visible (they keep flying on their course)
  const cached = airport ? airport.cachedFeatures(new Set(fc.features.map((f) => String(f.properties?.hex)))) : [];
  let features = airport ? [...fc.features, ...cached].filter((f) => !airport.owns(String(f.properties?.hex))) : fc.features;
  // on a flat map the icons move like the 3D models: smoothed position and heading
  if (airport?.mode() === 'flat') {
    features = features.map((f) => {
      const live = airport.planeInfo(String(f.properties?.hex));
      return live ? { ...f, geometry: { type: 'Point', coordinates: [live.lon, live.lat] }, properties: { ...f.properties, track: live.track } } : f;
    });
  }
  st.heliFeatures = features.filter((f) => f.properties?.kind === 'heli') as Feature<Point>[];
  ctx.setData('aircraft', { ...fc, features });
}

export function refreshSondesIcons(ctx: ExtraCtx) {
  const st = getState(ctx);
  const fc = st.lastSondes;
  if (!fc || !ctx.isOn('sondes')) return;
  const air = st.airport3d;
  const features = air ? fc.features.filter((f) => !air.ownsSonde(String(f.properties?.serial))) : fc.features;
  if (features.length !== fc.features.length) ctx.setData('sondes', { ...fc, features });
}

export function refreshLiveIcons(ctx: ExtraCtx) {
  refreshAircraftIcons(ctx);
  refreshSondesIcons(ctx);
}


export function flightInfo(ctx: ExtraCtx, hex: string): FlightInfo | null {
  const st = getState(ctx);
  const f = st.lastAircraft?.features.find((x) => x.properties?.hex === hex) ?? st.airport3d?.cachedFeatures(new Set())?.find((x) => x.properties?.hex === hex);
  if (!f) return null;
  const p = f.properties as Record<string, unknown>;
  const live = st.airport3d?.planeInfo(hex);
  const [lon, lat] = f.geometry.coordinates;
  return {
    hex,
    callsign: String(p.callsign ?? ''),
    reg: String(p.reg ?? ''),
    type: String(p.type ?? ''),
    icao: String(p.icao ?? ''),
    operator: String(p.operator ?? ''),
    altM: live ? live.altM : Number(p.altM) || 0,
    speedKmh: p.speedKmh != null ? Number(p.speedKmh) : null,
    track: live ? live.track : Number(p.track) || 0,
    ground: !!p.ground,
    emergency: String(p.emergency ?? ''),
    squawk: String(p.squawk ?? ''),
    vsMs: p.vsMs != null ? Number(p.vsMs) : null,
    mil: !!p.mil,
    nic: p.nic != null ? Number(p.nic) : null,
    nacp: p.nacp != null ? Number(p.nacp) : null,
    lon: live ? live.lon : lon,
    lat: live ? live.lat : lat,
    source: st.lastAircraft?.source ?? '',
    route: st.airport3d?.route(hex),
    history: live ? { alt: live.hist.map((h) => h[0]), speed: live.hist.map((h) => h[1]), vs: live.hist.map((h) => h[2]), track: live.hist.map((h) => h[3]) } : undefined,
  };
}

export function pickFlight(ctx: ExtraCtx, x: number, y: number): string | null {
  const st = getState(ctx);
  return st.airport3d?.pick(x, y) ?? null;
}

export function selectFlight(ctx: ExtraCtx, hex: string | null) {
  const st = getState(ctx);
  st.airport3d?.select(hex);
}

export function fitFlight(ctx: ExtraCtx, hex: string) {
  const st = getState(ctx);
  st.airport3d?.fitTrail(hex);
}

export function sondeInfo(ctx: ExtraCtx, serial: string): SondeInfo | null {
  const st = getState(ctx);
  const f = st.lastSondes?.features.find((x) => x.properties?.serial === serial);
  if (!f) return null;
  const p = f.properties as Record<string, unknown>;
  const live = st.airport3d?.planeInfo(`sonde:${serial}`);
  return {
    serial,
    type: String(p.type ?? ''),
    subtype: String(p.subtype ?? ''),
    manufacturer: String(p.manufacturer ?? ''),
    altM: live ? live.altM : Number(p.altM) || 0,
    vsMs: p.velV != null ? Number(p.velV) : null,
    speedKmh: p.velH != null ? Math.round(Number(p.velH) * 36) / 10 : null,
    track: p.heading != null ? Number(p.heading) : null,
    frequency: p.frequency != null ? Number(p.frequency) : null,
    frame: p.frame != null ? Number(p.frame) : null,
    datetime: String(p.date ?? ''),
    timeReceived: String(p.timeReceived ?? ''),
    uploader: String(p.uploader ?? ''),
    antenna: String(p.antenna ?? ''),
    software: String(p.software ?? ''),
    url: String(p.url ?? ''),
    lon: live ? live.lon : f.geometry.coordinates[0],
    lat: live ? live.lat : f.geometry.coordinates[1],
    history: live ? { alt: live.hist.map((h) => h[0]), speed: live.hist.map((h) => h[1]), vs: live.hist.map((h) => h[2]), track: live.hist.map((h) => h[3]) } : undefined,
  };
}

export function selectSonde(ctx: ExtraCtx, serial: string | null) {
  const st = getState(ctx);
  st.airport3d?.select(serial == null ? null : `sonde:${serial}`);
}

export function fitSonde(ctx: ExtraCtx, serial: string) {
  const st = getState(ctx);
  st.airport3d?.fitTrail(`sonde:${serial}`);
}


export function applyAir(ctx: ExtraCtx) {
  const st = getState(ctx);
  // 3D layout of the airports, 3D aircraft with trails, and whether the 2D aircraft icons are shown
  st.airport3d?.configure({ layout: ctx.isOn('airport3d'), planes: wantsAircraft(ctx), icons: ctx.isOn('aircraft') });
  refreshAircraftIcons(ctx);
  // the radiosondes fly along with the aircraft: feed their positions into the 3D tracker (again
  // after each toggle and whenever the last feed lies back; the feed itself is fresh every 60 s)
  const sondesOn = ctx.isOn('sondes');
  if (sondesOn !== st.sondes3D) {
    st.sondes3D = sondesOn;
    if (sondesOn && st.lastSondes) {
      st.lastSondesFed = Date.now();
      st.airport3d?.feedSondes(st.lastSondes);
    } else if (!sondesOn) st.airport3d?.clearSondes();
  }
  if (sondesOn && st.lastSondes && Date.now() - st.lastSondesFed > 20000) {
    st.lastSondesFed = Date.now();
    st.airport3d?.feedSondes(st.lastSondes);
  }
  refreshSondesIcons(ctx);

}

/** the 3D airport layer (also carries the 3D aircraft and radiosondes) */
export function createAirport(ctx: ExtraCtx) {
  const st = getState(ctx);
  st.airport3d = new Airport3D(ctx.map, 'marker', { info: (i) => ctx.set('airport3d', i), modeChanged: () => refreshLiveIcons(ctx), iconsTick: () => refreshLiveIcons(ctx) });
  st.airport3d.init();
}

export const airApi = { flightInfo, pickFlight, selectFlight, fitFlight, sondeInfo, selectSonde, fitSonde };
