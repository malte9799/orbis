import { defineExtra, type ExtraCtx } from '../types';
import type { Feature } from 'geojson';
import { store } from '../../../store';
import { OFM_CLASS, TrafficSim, linesOf, makeRoad, tomtomClass, type Coord, type Road } from '../shared/trafficsim';

// Fahrzeug-Simulation auf dem Straßennetz der Karte (OpenFreeMap) – ab Stadtzoom. Mit eigenem
// TomTom-Key kommt die Live-Verkehrslage dazu: Straßen werden grün/gelb/rot, Fahrzeuge fahren
// entsprechend langsamer und dichter. Muster nach bilawalsidhu/gods-eye-view (Punkte auf Straßenlinien).

const ID = 'traffic';
const SIM_ZOOM = 13;
const FLOW_SOURCE = 'tomtom-flow';
const FLOW_LAYER = 'traffic-flow';
const FLOW_URL = (key: string) => `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf?key=${encodeURIComponent(key)}`;
const ROAD_CLASSES = Object.keys(OFM_CLASS);

type St = { ordering: boolean; sim: TrafficSim; raf: number; last: number; zoomLevel: number; key: string; live: boolean; listening: boolean; flowError: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>(ID, () => ({ ordering: false, sim: new TrafficSim(), raf: 0, last: 0, zoomLevel: 0, key: '', live: false, listening: false, flowError: '' }));

/** Straßen aus den geladenen Kacheln; dieselbe Straße über Kachelgrenzen hinweg wird nur einmal genommen. */
function collectRoads(ctx: ExtraCtx, live: boolean): Road[] {
  const b = ctx.map.getBounds();
  const padX = (b.getEast() - b.getWest()) * 0.25;
  const padY = (b.getNorth() - b.getSouth()) * 0.25;
  const inView = (c: Coord) => c[0] > b.getWest() - padX && c[0] < b.getEast() + padX && c[1] > b.getSouth() - padY && c[1] < b.getNorth() + padY;
  const seen = new Map<string, Road>();
  const feats: Feature[] = live
    ? ctx.map.querySourceFeatures(FLOW_SOURCE, { sourceLayer: 'Traffic flow' })
    : ctx.map.querySourceFeatures('ofm', { sourceLayer: 'transportation', filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]] });

  for (const f of feats) {
    const p = f.properties ?? {};
    if (live ? p.road_closure === true || p.road_closure === 'true' : p.brunnel === 'tunnel') continue;
    const cls = live ? tomtomClass(p.road_type) : OFM_CLASS[String(p.class)];
    if (!cls) continue;
    const level = live ? (typeof p.traffic_level === 'number' ? Math.min(1, Math.max(0, p.traffic_level)) : null) : null;
    if (live && level == null) continue;
    // TomTom-Linien laufen in Fahrtrichtung, OSM-Wege können beidseitig befahren werden
    const oneway = live ? 1 : p.oneway === 1 || p.oneway === '1' ? 1 : p.oneway === -1 || p.oneway === '-1' ? -1 : 0;
    for (const coords of linesOf(f)) {
      if (!coords.some(inView)) continue;
      const a = coords[0];
      const z = coords[coords.length - 1];
      const key = `${a[0].toFixed(5)},${a[1].toFixed(5)}>${z[0].toFixed(5)},${z[1].toFixed(5)}:${coords.length}`;
      if (seen.has(key)) continue;
      const road = makeRoad(key, coords, { ...cls, oneway: oneway as 1 | -1 | 0, level });
      if (road) seen.set(key, road);
    }
  }
  return [...seen.values()];
}

/**
 * Reihenfolge absichern: Das Straßennetz hängt sich an `lbl-border-country` an und landet am Stilende (auch hinter
 * `marker`), wenn es das beim Anlegen noch nicht gibt – dann läge es über den Fahrzeugen. Deshalb werden Straßennetz
 * und Verkehrslage unter die Fahrzeuge geschoben; sonst bleibt alles, wie es ist (Meldungen und Marker darüber).
 */
const UNDER_CARS = ['road-secondary', 'road-primary', 'road-trunk', 'road-motorway', 'road-ref', FLOW_LAYER];
function fixOrder(ctx: ExtraCtx) {
  const m = ctx.map;
  if (!m.getLayer('traffic-cars')) return;
  const ids = m.getStyle().layers.map((l) => l.id);
  const at = ids.indexOf('traffic-cars');
  for (const id of UNDER_CARS) if (ids.indexOf(id) > at) m.moveLayer(id, 'traffic-cars');
}

function refresh(ctx: ExtraCtx) {
  fixOrder(ctx);
  const st = getState(ctx);
  if (ctx.map.getZoom() < SIM_ZOOM) {
    st.sim.clear();
    ctx.setData('traffic-cars', { type: 'FeatureCollection', features: [] });
    ctx.set(ID, { count: undefined, note: 'Reinzoomen (Stadt) für fahrende Fahrzeuge' + (st.live ? ' – Verkehrslage ist schon sichtbar' : '') });
    return;
  }
  // Kachel-Zoomstufe gewechselt: Geometrie ist eine andere, also neu aufbauen statt Duplikate zu sammeln
  const zl = Math.min(14, Math.floor(ctx.map.getZoom()));
  if (zl !== st.zoomLevel) {
    st.zoomLevel = zl;
    st.sim.clear();
  }
  const b = ctx.map.getBounds();
  const padX = (b.getEast() - b.getWest()) * 0.6;
  const padY = (b.getNorth() - b.getSouth()) * 0.6;
  const near = (r: Road) => r.coords.some((c) => c[0] > b.getWest() - padX && c[0] < b.getEast() + padX && c[1] > b.getSouth() - padY && c[1] < b.getNorth() + padY);
  st.sim.setRoads(collectRoads(ctx, st.live), near);
  ctx.set(ID, {
    count: st.sim.count || undefined,
    note: st.flowError || (st.live ? 'Live-Verkehrslage (TomTom): grün frei · gelb zäh · rot Stau' : 'Simulation (1,5× Tempo) – für Live-Verkehrslage TomTom-Key in den Einstellungen eintragen'),
  });
}

/** Der Key; wird versehentlich eine ganze Kachel-URL eingefügt, wird `key=…` daraus gelesen. */
function tomtomKey(): string {
  const raw = (store.getKeys().tomtom ?? '').trim();
  return /^https?:/i.test(raw) ? (raw.match(/[?&]key=([^&\s]+)/i)?.[1] ?? '') : raw;
}

/** TomTom-Quelle/Linien anlegen, wechseln oder entfernen, je nach gespeichertem Key. */
function syncFlow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const key = tomtomKey();
  const typed = (store.getKeys().tomtom ?? '').trim();
  if (typed && !key) st.flowError = 'Im TomTom-Feld steht ein Link statt des Keys – bitte den API-Key (ca. 32 Zeichen) eintragen';
  else if (!typed && st.flowError.startsWith('Im TomTom-Feld')) st.flowError = '';
  const m = ctx.map;
  // Ein Stilwechsel (Basiskarte) löscht Quelle und Linien: dann neu anlegen, auch bei gleichem Key
  if (key === st.key && (!key || m.getSource(FLOW_SOURCE))) return;
  st.key = key;
  st.flowError = '';
  if (!st.listening) {
    st.listening = true;
    m.on('error', (e) => {
      const err = e as { sourceId?: string; error?: { status?: number; message?: string } };
      if (err.sourceId !== FLOW_SOURCE) return;
      const status = err.error?.status;
      st.flowError = status === 401 || status === 403 ? 'TomTom lehnt den Key ab (ungültig oder ohne Traffic-API)' : status === 429 ? 'TomTom-Kontingent erschöpft' : `TomTom-Kacheln nicht ladbar (${status ?? err.error?.message ?? 'Fehler'})`;
      ctx.set(ID, { note: st.flowError });
    });
  }
  if (m.getLayer(FLOW_LAYER)) m.removeLayer(FLOW_LAYER);
  if (m.getSource(FLOW_SOURCE)) m.removeSource(FLOW_SOURCE);
  st.live = !!key;
  if (!key) return;
  m.addSource(FLOW_SOURCE, {
    type: 'vector',
    tiles: [FLOW_URL(key)],
    minzoom: 8,
    maxzoom: 16,
    attribution: 'Verkehrslage © <a href="https://www.tomtom.com/">TomTom</a>',
  });
  ctx.add(
    {
      id: FLOW_LAYER,
      type: 'line',
      source: FLOW_SOURCE,
      'source-layer': 'Traffic flow',
      minzoom: 8,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2.5, 16, 6],
        'line-opacity': 0.75,
        'line-color': ['case', ['==', ['get', 'road_closure'], true], '#8e24aa', ['step', ['coalesce', ['get', 'traffic_level'], 1], '#e05252', 0.55, '#f0b23e', 0.85, '#2ecc71']],
      },
    },
    'traffic-cars',
  );
  ctx.registerLayers(ID, [FLOW_LAYER]);
}

function frame(ctx: ExtraCtx, t: number) {
  const st = getState(ctx);
  st.raf = requestAnimationFrame((n) => frame(ctx, n));
  if (document.hidden || ctx.map.getZoom() < SIM_ZOOM) return;
  // ~30 Bilder/s: flüssig genug, setData bleibt bezahlbar
  if (t - st.last < 33) return;
  const dt = st.last ? (t - st.last) / 1000 : 0.033;
  st.last = t;
  st.sim.step(dt);
  // Meter pro Bildschirmpixel (Web-Mercator) für die Mindestgröße der Quader
  const c = ctx.map.getCenter();
  const mpp = (156543.03 * Math.cos((c.lat * Math.PI) / 180)) / 2 ** ctx.map.getZoom() / 2;
  ctx.setData('traffic-cars', st.sim.toGeoJSON(mpp));
}

function stop(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.raf) cancelAnimationFrame(st.raf);
  st.raf = 0;
  st.last = 0;
  ctx.clear('traffic-roads');
}

export default defineExtra({
  id: ID,
  order: 470,
  section: 'infra',
  cat: 'verkehr',
  label: 'Verkehr: Fahrzeuge & Lage',
  hint: 'fahrende Fahrzeuge auf den Straßen (Stadtzoom); mit TomTom-Key Live-Stau',
  glyph: 'warn',
  icon: 'car',
  color: '#26c6da',
  sources: { 'traffic-cars': '' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'traffic-cars',
        type: 'fill-extrusion',
        source: 'traffic-cars',
        minzoom: SIM_ZOOM,
        layout: { ...hidden },
        paint: {
          'fill-extrusion-color': ['get', 'c'],
          'fill-extrusion-height': ['+', ['get', 'h'], 0.2],
          'fill-extrusion-base': 0.2,
          'fill-extrusion-opacity': 0.95,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    const st = getState(ctx);
    syncFlow(ctx);
    // jede Stiländerung (Ebene hinzugefügt/umsortiert) prüfen, nicht nur im Takt
    if (!st.ordering) {
      st.ordering = true;
      ctx.map.on('styledata', () => fixOrder(ctx));
    }
    fixOrder(ctx);
    // Kacheln laden nach dem Bewegen nach; ein Takt holt sie ab, wenn sie erst später fertig werden
    ctx.every('traffic-roads', 4000, () => refresh(ctx));
    if (!st.raf) st.raf = requestAnimationFrame((n) => frame(ctx, n));
  },
  disable(ctx) {
    stop(ctx);
    const st = getState(ctx);
    st.sim.clear();
  },
  onMoveEnd(ctx) {
    refresh(ctx);
  },
  layers: ['traffic-cars'],
});
