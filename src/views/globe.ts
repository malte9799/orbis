import {
  Map as MlMap,
  NavigationControl,
  Popup,
  ScaleControl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type RasterTileSource,
} from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson';
import {
  kindColor,
  loadEonet,
  loadFirms,
  loadFirmsSnapshot,
  loadGdacs,
  loadNwsSevere,
  loadQuakes,
  loadRadarFrames,
  loadSpcTornadoReports,
  type EventFeature,
  type EventKind,
  type RadarFrames,
} from '../api/events';
import {
  detailRequest,
  getDetailModel,
  getGlobalModel,
  isLimitError,
  ModelSampler,
  nearestTimeIndex,
  type ModelGrid,
} from '../api/model';
import { getCurrent, reverseGeocodePoint } from '../api/openmeteo';
import { inEurope, loadEmsc } from '../api/europe';
import { EXTRA_CLICK_LAYERS, EXTRAS, ExtraLayers, type ExtraId } from '../globe/extras';
import type { Launch } from '../api/transport';
import { FlightPanel } from '../globe/flightpanel';
import { SondePanel } from '../globe/sondepanel';
import { ShipPanel } from '../globe/shippanel';
import { LaunchPanel } from '../launch/panel';
import { detailFromLaunch, getLaunchDetails, type LaunchDetail } from '../launch/tracker';
import { labelPaint } from '../globe/vector';
import { LUT, rainLabel, rainRate, rainviewerFrame } from '../globe/hdradar';
import { RadarGl } from '../globe/radargl';
import { glyphSvg, registerEventIcons } from '../globe/icons';
import {
  FIELDS,
  isobars,
  nightPolygon,
  registerFieldProtocol,
  setActiveSampler,
  WindParticles,
  type FieldId,
} from '../globe/overlay';
import { BASES, buildStyle, DWD_RADAR_WMS, eumetsatIr, eumetsatStorm, HD_SAT, HD_SAT_BACKUP, gibsDate, gibsFires, gibsTrueColor, IMERG_WMS, type BaseId } from '../globe/style';
import { mountRawDataLink } from '../inspector/inspector';
import { tileRecorder } from '../inspector/tiles';
import { createHud, type Hud, type HudEvent, type LayerInfo, type LegendInfo } from '../hud/hud';
import { catalogOf, GROUPS, ISOBAR_OPTION_MAINS, LINKED_EXTRA, LINKED_GROUP, OWM_FAMILY, WX_FAMILIES, type FeedId, type GroupId } from '../hud/catalog';
import { defaultBuildings3d, defaultTerrain3d, type Karte, type KView } from '../hud/karten';
import { locate } from '../search';
import { builtInProxy } from '../api/proxy';
import { store, type Place } from '../store';
import { compass, debounce, escapeHtml, fmt, safeUrl, toast } from '../util';
import { describe, weatherIcon } from '../weather';

// ---------------------------------------------------------------------------
// Configuration

/** 'water' = sea surface temperature with the sea ice on top */
type LiveId = 'radar' | 'dwd-radar' | 'sat-hd' | 'sat-ir' | 'sat-storm' | 'imerg' | 'sst' | 'seaice' | 'water';
type OverlayId = 'none' | FieldId | LiveId | `owm-${string}`;

const isField = (o: string): o is FieldId => o in FIELDS;

const OWM_LAYERS: { id: string; label: string }[] = [
  { id: 'temp_new', label: 'Temperatur (OWM)' },
  { id: 'precipitation_new', label: 'Niederschlag (OWM)' },
  { id: 'clouds_new', label: 'Wolken (OWM)' },
  { id: 'wind_new', label: 'Wind (OWM)' },
  { id: 'pressure_new', label: 'Luftdruck (OWM)' },
];

const KIND_GROUP: Record<EventKind, GroupId> = {
  fire: 'fires',
  storm: 'storms',
  tornado: 'tornado',
  quake: 'quakes',
  volcano: 'volcanoes',
  flood: 'floods',
  drought: 'floods',
  landslide: 'floods',
  ice: 'ice',
  dust: 'ice',
  heat: 'ice',
  other: 'ice',
};

/** The map engine's current settings; derived from the active Karte (see applyKarte). */
interface GlobeState {
  base: BaseId;
  labels: boolean;
  night: boolean;
  overlay: OverlayId;
  /** wind particle animation */
  wind: boolean;
  isobars: boolean;
  /** 3D-Gebäude as a Grundkarten-Option (defaults on Dunkel and Hell) */
  buildings3d: boolean;
  /** 3D-Gelände as a Grundkarten-Option: the real elevation model (defaults on) */
  terrain3d: boolean;
  extras: Partial<Record<ExtraId, boolean>>;
  groups: Partial<Record<GroupId, boolean>>;
  projection: 'globe' | 'mercator';
  center: [number, number];
  zoom: number;
  version?: number;
}

const DEFAULT_STATE: GlobeState = {
  base: 'satellite',
  labels: true,
  night: true,
  overlay: 'none',
  wind: false,
  isobars: false,
  buildings3d: false,
  terrain3d: true,
  extras: {},
  groups: {},
  projection: 'mercator',
  center: [store.getLastPlace().lon, store.getLastPlace().lat],
  zoom: 5,
};

/** layers whose data keeps flowing in (green dot in the layer list) */
const LIVE_LAYERS = new Set(['aircraft', 'ships', 'trains', 'transit', 'lightning', 'autobahn', 'dwdwarn', 'nina', 'quakes', 'webcams', 'sondes', 'storms', 'fires']);

const REFRESH_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------

export interface GlobeView {
  el: HTMLElement;
  activate(focus?: { lat?: number; lon?: number; zoom?: number; projection?: 'globe' | 'mercator'; fromSpace?: boolean }): void;
  deactivate(): void;
}

export function createGlobeView(onOpenForecast: (p: Place) => void, onOpenSpace: (lat: number, lon: number) => void): GlobeView {
  const STATE_VERSION = 4;
  const saved = store.getGlobeState<Partial<GlobeState>>({});
  // only the view survives from the old saved state; layers now come from the Karten (src/hud)
  const state: GlobeState = {
    ...DEFAULT_STATE,
    // v2: 2D map became the default view – reset the projection of older saved states once.
    projection: (saved.version ?? 1) >= 2 && saved.projection === 'globe' ? 'globe' : 'mercator',
    center: Array.isArray(saved.center) ? saved.center : DEFAULT_STATE.center,
    zoom: saved.zoom ?? DEFAULT_STATE.zoom,
    version: STATE_VERSION,
  };
  const save = () => store.setGlobeState(state);

  const el = document.createElement('main');
  el.className = 'view globe-view';
  el.innerHTML = `
    <div class="map" id="map"></div>
    <dialog class="settings-dialog"></dialog>
    <div class="globe-bottom">
      <div class="legend" hidden></div>
      <div class="timeline" hidden>
        <button class="btn icon-btn tl-play" aria-label="Abspielen"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg></button>
        <div class="tl-track">
          <input type="range" class="tl-range" min="0" max="0" value="0" aria-label="Zeit"/>
          <div class="tl-days"></div>
        </div>
        <button class="btn small tl-now" title="Zur aktuellen Zeit">Jetzt</button>
        <span class="tl-time"></span>
      </div>
    </div>
    <div class="readout" hidden></div>`;

  const dockEl = el.querySelector<HTMLElement>('.globe-bottom')!;
  const legend = el.querySelector<HTMLElement>('.legend')!;
  const timeline = el.querySelector<HTMLElement>('.timeline')!;

  let map: MlMap | null = null;
  let ready = false;
  let pendingFocus: { lat: number; lon: number; zoom?: number } | null = null;
  let globalModel: ModelGrid | null = null;
  let detailModel: ModelGrid | null = null;
  let detailKey = '';
  let modelLoading = false;
  let timeIdx = -1;
  let sampler: ModelSampler | null = null;
  let wind: WindParticles | null = null;
  let nightTimer = 0;
  let refreshTimer = 0;
  let liveTimer = 0;
  let popup: Popup | null = null;
  let longPressAt = 0;

  // ----- feeds -------------------------------------------------------------
  const feedData: Record<FeedId, { at: number; loading: Promise<void> | null; error?: string }> = {
    eonet: { at: 0, loading: null },
    gdacs: { at: 0, loading: null },
    usgs: { at: 0, loading: null },
    emsc: { at: 0, loading: null },
    nws: { at: 0, loading: null },
    spc: { at: 0, loading: null },
    firms: { at: 0, loading: null },
  };
  let eonetPoints: EventFeature[] = [];
  let eonetTracks: Feature<LineString, { kind: EventKind; title: string }>[] = [];
  let gdacsPoints: EventFeature[] = [];
  let nwsPoints: EventFeature[] = [];
  let spcPoints: EventFeature[] = [];
  let nwsPolys: Feature<Polygon | MultiPolygon, { color: string; event: string }>[] = [];
  let quakePoints: EventFeature[] = [];
  let emscPoints: EventFeature[] = [];
  let extras: ExtraLayers | null = null;
  let flightPanel: FlightPanel | null = null;
  let sondePanel: SondePanel | null = null;
  let shipPanel: ShipPanel | null = null;
  let launchPanel: LaunchPanel | null = null;
  let firmsCount = 0;
  let firmsOk = false;

  const FEED_LOADERS: Record<FeedId, () => Promise<void>> = {
    eonet: async () => {
      const r = await loadEonet();
      eonetPoints = r.points;
      eonetTracks = r.tracks;
    },
    gdacs: async () => {
      gdacsPoints = await loadGdacs();
    },
    usgs: async () => {
      quakePoints = await loadQuakes();
    },
    emsc: async () => {
      emscPoints = await loadEmsc();
    },
    nws: async () => {
      const r = await loadNwsSevere();
      nwsPoints = r.points;
      nwsPolys = r.polygons;
    },
    spc: async () => {
      spcPoints = await loadSpcTornadoReports();
    },
    firms: async () => {
      const key = store.getKeys().firms;
      // own key → live points; otherwise the shared worldwide snapshot from the data branch
      const fc = key ? await loadFirms(key) : await loadFirmsSnapshot();
      firmsCount = fc.features.length;
      firmsOk = fc.features.length > 0;
      (map?.getSource('firms') as GeoJSONSource | undefined)?.setData(fc);
      applyGroups();
    },
  };
  const FEED_NAMES: Record<FeedId, string> = {
    eonet: 'NASA EONET',
    gdacs: 'GDACS',
    usgs: 'USGS Erdbeben',
    emsc: 'EMSC Erdbeben Europa',
    nws: 'NWS (USA)',
    spc: 'SPC Tornado-Meldungen',
    firms: 'NASA FIRMS',
  };

  function ensureFeeds(force = false) {
    const needed = new Set<FeedId>();
    for (const g of GROUPS) if (state.groups[g.id]) g.feeds.forEach((f) => needed.add(f));
    if (state.groups.hotspots) needed.add('firms');
    for (const id of needed) {
      const fd = feedData[id];
      if (fd.loading || (!force && Date.now() - fd.at < REFRESH_MS)) continue;
      fd.loading = FEED_LOADERS[id]()
        .then(() => {
          fd.error = undefined;
        })
        .catch((e) => {
          console.warn(`${FEED_NAMES[id]} nicht verfügbar`, e);
          fd.error = String(e?.message ?? e);
          // The SPC files have no CORS headers on some days – don't bother the user about it.
          if (id !== 'spc') toast(`${FEED_NAMES[id]} konnte nicht geladen werden.`, 'error');
        })
        .finally(() => {
          fd.at = Date.now();
          fd.loading = null;
          if (id === 'firms') applyGroups();
          syncEventSources();
          refreshHud();
        });
    }
    refreshHud();
  }

  function syncEventSources() {
    if (!map || !ready) return;
    const tag = (features: EventFeature[], group?: GroupId) =>
      features.map((f) => ({ ...f, properties: { ...f.properties, group: group ?? KIND_GROUP[f.properties.kind] } }));
    const all = [...tag(eonetPoints), ...tag(gdacsPoints), ...tag(nwsPoints, 'tornado'), ...tag(spcPoints, 'tornado')];
    setData('events', all);
    // In Europe EMSC is more complete (smaller quakes); elsewhere USGS.
    setData('quakes', emscPoints.length ? [...emscPoints, ...quakePoints.filter((q) => !inEurope(q.geometry.coordinates[0], q.geometry.coordinates[1]))] : quakePoints);
    setData('nws-poly', nwsPolys);
    setData('tracks', eonetTracks.filter((t) => t.properties.kind === 'storm'));
  }

  function setData(source: string, features: Feature[]) {
    (map?.getSource(source) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features } as FeatureCollection);
  }

  function groupCount(id: GroupId): number | null {
    const linked = LINKED_EXTRA[id];
    const linkedCount = linked ? extras?.count(linked) : undefined;
    const events = () => (feedData.eonet.at || feedData.gdacs.at ? [...eonetPoints, ...gdacsPoints].filter((f) => KIND_GROUP[f.properties.kind] === id).length : null);
    switch (id) {
      case 'quakes':
        return feedData.usgs.at || feedData.emsc.at
          ? emscPoints.length + quakePoints.filter((q) => !emscPoints.length || !inEurope(q.geometry.coordinates[0], q.geometry.coordinates[1])).length
          : null;
      case 'tornado':
        return feedData.nws.at || feedData.spc.at ? nwsPoints.length + spcPoints.length : null;
      case 'hotspots':
        return firmsCount || null;
      case 'volcanoes':
        // the full GVP catalogue includes the currently erupting ones
        return linkedCount ?? events();
      case 'fires': {
        const ev = events();
        return ev == null && linkedCount == null ? null : (ev ?? 0) + (linkedCount ?? 0);
      }
      default:
        return events();
    }
  }

  // ----- Karten: applying the active Karte to the map ------------------------
  // The HUD (src/hud) owns the Karten; the engine below only knows `state`. Whenever the active
  // Karte changes (switch, edit, reset) applyKarte() derives `state` and brings the map in line.
  let hud = null as Hud | null;
  const families = () => (store.getKeys().owm ? [...WX_FAMILIES, OWM_FAMILY] : WX_FAMILIES);
  const sameKeys = (a: object, b: object) => Object.keys(a).sort().join() === Object.keys(b).sort().join();
  /** the Karte the HUD last applied: decides whether a map click shows the weather tooltip */
  let curKarte: Karte | null = null;
  /**
   * A map click shows the place weather only on a weather Karte: the standard "Wetter" Karte
   * or an own Karte with a weather layer (menu 'wx' with a layer, or main set). Traffic and
   * other Karten get their own tooltips later.
   */
  const isWeatherKarte = (k: Karte | null): boolean => !!k && (k.menu === 'wx' || k.main != null);

  function applyKarte(k: Karte) {
    curKarte = k;
    const prev = { base: state.base, labels: state.labels, night: state.night, overlay: state.overlay, wind: state.wind, isobars: state.isobars, buildings3d: state.buildings3d, terrain3d: state.terrain3d };
    const fam = families().find((f) => f.id === k.main);
    let overlay: OverlayId = 'none';
    if (fam) overlay = (fam.variants.find(([v]) => v === k.mainVar) ?? fam.variants[0])[0] as OverlayId;
    if (overlay.startsWith('owm-') && !store.getKeys().owm) overlay = 'none';
    state.base = k.base;
    state.labels = k.labels;
    state.night = k.night;
    state.overlay = overlay;
    // wind layers bring their particles along (can be switched off); isobars are an option of wind/pressure
    state.wind = isField(overlay) && !!FIELDS[overlay].particles && k.wind !== false;
    state.isobars = !!k.isobars && !!fam && ISOBAR_OPTION_MAINS.includes(fam.id);
    // 3D-Gebäude: explicit choice, otherwise the default of the base map (on Dunkel and Hell)
    state.buildings3d = k.buildings3d ?? defaultBuildings3d(k.base);
    // 3D-Gelände: explicit choice, otherwise on (the real elevation model)
    state.terrain3d = k.terrain3d ?? defaultTerrain3d();

    const nextExtras: Partial<Record<ExtraId, boolean>> = {};
    const nextGroups: Partial<Record<GroupId, boolean>> = {};
    for (const l of k.layers) {
      if (l.hidden) continue;
      const c = catalogOf(l.id);
      if (!c) continue;
      if (c.kind === 'extra') nextExtras[l.id as ExtraId] = true;
      else {
        const g = l.id as GroupId;
        nextGroups[g] = true;
        const lg = LINKED_GROUP[g];
        if (lg) nextGroups[lg] = true;
        const lx = LINKED_EXTRA[g];
        if (lx) nextExtras[lx] = true;
      }
    }
    const extrasChanged = !sameKeys(state.extras, nextExtras);
    const groupsChanged = !sameKeys(state.groups, nextGroups);
    state.extras = nextExtras;
    state.groups = nextGroups;
    save();
    if (!map || !ready) return;

    if (prev.base !== state.base || prev.labels !== state.labels) applyBase();
    else if (prev.buildings3d !== state.buildings3d) applyBuildings();
    else if (prev.terrain3d !== state.terrain3d) applyTerrain();
    if (prev.night !== state.night) applyNight();
    if (prev.overlay !== state.overlay) void applyOverlay();
    else if (prev.wind !== state.wind || prev.isobars !== state.isobars) void applyModelLayers();
    if (extrasChanged) extras?.setEnabled(Object.keys(nextExtras) as ExtraId[]);
    if (groupsChanged) {
      applyGroups();
      ensureFeeds();
    }
    applyLayerOptions(k);
    applyPadding(true);
    refreshHud();
  }

  /** per-layer options: quake magnitude, aircraft kinds, lightning extras, opacity */
  function applyLayerOptions(k: Karte) {
    if (!map || !ready) return;
    const lay = (id: string) => k.layers.find((l) => l.id === id && !l.hidden);
    const minMag = Number(lay('quakes')?.filter) || 0;
    if (map.getLayer('quakes')) map.setFilter('quakes', (minMag ? ['>=', ['get', 'mag'], minMag] : null) as never);
    const kinds = lay('aircraft')?.filter?.split(',').filter(Boolean) ?? [];
    if (map.getLayer('aircraft')) map.setFilter('aircraft', (kinds.length ? ['in', ['get', 'kind'], ['literal', kinds]] : null) as never);
    const opts = lay('lightning')?.filter?.split(',').filter(Boolean) ?? [];
    const volTok = opts.find((t) => t.startsWith('vol-'));
    const vol = volTok ? Number(volTok.slice(4)) : NaN;
    if (extras)
      extras.setLightningOptions({
        sound: opts.includes('sound'),
        wave: opts.includes('wave'),
        detectors: opts.includes('detectors'),
        lines: opts.includes('lines'),
        thunder: opts.includes('thunder'),
        volume: Number.isFinite(vol) ? Math.max(0, Math.min(100, vol)) : undefined,
      });
    // Rohstoffe: per Komodität gefiltert (Kategorie-Filter), oder alles wenn kein Filter gesetzt
    const rcats = (lay('resources')?.filter ?? '').split(',').filter(Boolean);
    if (map.getLayer('resources')) map.setFilter('resources', (rcats.length ? ['in', ['get', 'cat'], ['literal', rcats]] : null) as never);
    if (map.getLayer('resources-label')) map.setFilter('resources-label', (rcats.length ? ['in', ['get', 'cat'], ['literal', rcats]] : null) as never);
    if (extras) for (const d of EXTRAS) extras.setOpacity(d.id, lay(d.id)?.opacity ?? 100);
    applyOrder(k);
  }

  /** map layers behind one entry of a Karte's layer list */
  const GROUP_LAYERS: Record<GroupId, string[]> = {
    fires: ['firms', 'hotspots', 'ev-circle', 'ev-glyph'],
    hotspots: ['firms', 'hotspots'],
    storms: ['tracks', 'ev-circle', 'ev-glyph'],
    tornado: ['nws-fill', 'nws-line', 'ev-circle', 'ev-glyph'],
    quakes: ['quakes'],
    volcanoes: ['ev-circle', 'ev-glyph'],
    floods: ['ev-circle', 'ev-glyph'],
    ice: ['ev-circle', 'ev-glyph'],
  };
  function mapLayersOf(id: string): string[] {
    const c = catalogOf(id);
    if (!c) return [];
    if (c.kind === 'extra') return extras?.layerIds(id as ExtraId) ?? [];
    const g = id as GroupId;
    const linked = LINKED_EXTRA[g];
    return [...GROUP_LAYERS[g], ...(linked ? (extras?.layerIds(linked) ?? []) : [])];
  }

  /**
   * Draw order follows the Karte's layer list (top of the list = drawn on top). Areas (rasters,
   * fills, lines) and points (circles, symbols) are ordered separately, so areas stay below the
   * place labels and points above them. The event groups share one point layer, which takes the
   * position of the topmost group using it.
   */
  function applyOrder(k: Karte) {
    if (!map || !ready) return;
    const m = map;
    const seen = new Set<string>();
    const entries: string[][] = []; // top → bottom
    for (const l of k.layers) {
      const ids = mapLayersOf(l.id).filter((id) => !seen.has(id) && m.getLayer(id));
      ids.forEach((id) => seen.add(id));
      if (ids.length) entries.push(ids);
    }
    if (entries.length < 2) return;
    const order = m.getStyle().layers.map((l) => l.id);
    const pos = new Map(order.map((id, i) => [id, i] as const));
    const isPoint = (id: string) => ['circle', 'symbol', 'heatmap'].includes(m.getLayer(id)!.type);
    for (const point of [false, true]) {
      // wanted order, bottom → top; the layers of one entry keep their own relative order
      const want = [...entries].reverse().flatMap((e) => e.filter((id) => isPoint(id) === point).sort((a, b) => pos.get(a)! - pos.get(b)!));
      if (want.length < 2) continue;
      const now = [...want].sort((a, b) => pos.get(a)! - pos.get(b)!);
      if (now.every((id, i) => id === want[i])) continue;
      const anchor = order[pos.get(now[now.length - 1])! + 1];
      for (const id of want) m.moveLayer(id, anchor);
    }
  }

  function layerInfo(id: string): LayerInfo {
    const c = catalogOf(id);
    if (!c) return { sub: '', live: false, count: null };
    const live = LIVE_LAYERS.has(id);
    if (c.kind === 'group') {
      const g = id as GroupId;
      if (!state.groups[g]) return { sub: '', live: false, count: null };
      const n = groupCount(g);
      const loading = GROUPS.find((x) => x.id === g)!.feeds.some((f) => feedData[f].loading);
      return { sub: loading && n == null ? 'lädt …' : n != null ? `${fmt.num(n)} aktuell` : '', live: live && n != null, count: n };
    }
    const e = id as ExtraId;
    const n = extras?.count(e);
    const parts: string[] = [];
    if (extras?.badge(e) === '…') parts.push('lädt …');
    else if (n != null) parts.push(`${fmt.num(n)} geladen`);
    const note = extras?.note(e);
    if (note) parts.push(note);
    return { sub: parts.join(' · '), live: live && n != null, count: n ?? null, delay: id === 'lightning' ? extras?.lightningDelay() : undefined };
  }

  function eventList(hours: number): HudEvent[] {
    const cutoff = Date.now() - hours * 3600000;
    const quakes = emscPoints.length ? [...emscPoints, ...quakePoints.filter((q) => !inEurope(q.geometry.coordinates[0], q.geometry.coordinates[1]))] : quakePoints;
    const items = [...eonetPoints, ...gdacsPoints, ...nwsPoints, ...spcPoints, ...quakes]
      .filter((f) => state.groups[KIND_GROUP[f.properties.kind]] && f.properties.date && Date.parse(f.properties.date) >= cutoff)
      .sort((a, b) => Date.parse(b.properties.date!) - Date.parse(a.properties.date!));
    // a mix of kinds instead of 6 quakes: at most two per kind
    const perKind: Partial<Record<EventKind, number>> = {};
    const out: HudEvent[] = [];
    for (const f of items) {
      const p = f.properties;
      if ((perKind[p.kind] ?? 0) >= 2) continue;
      perKind[p.kind] = (perKind[p.kind] ?? 0) + 1;
      out.push({ kind: p.kind, color: p.color ?? kindColor(p.kind), title: p.title, sub: p.subtitle ?? p.source, when: fmt.relative(p.date!) });
      if (out.length >= 6) break;
    }
    return out;
  }

  let hudTimer = 0;
  /** live numbers changed (feeds, counts): refresh the HUD without rebuilding it */
  function refreshHud() {
    if (hudTimer) return;
    hudTimer = window.setTimeout(() => {
      hudTimer = 0;
      hud?.refreshLive();
    }, 120);
  }

  /** Keep the globe centred in the free area next to the open Karte stack on wide screens. */
  function applyPadding(animate = false) {
    if (!map) return;
    const left = hud?.stackWidth() ?? 0;
    if (animate) map.easeTo({ padding: { left, top: 0, right: 0, bottom: 0 }, duration: 300 });
    else map.setPadding({ left, top: 0, right: 0, bottom: 0 });
  }

  // ----- settings dialog (API keys, sources) --------------------------------
  const settings = el.querySelector<HTMLDialogElement>('.settings-dialog')!;
  const openSettings = () => {
    const keys = store.getKeys();
    settings.innerHTML = `
      <form method="dialog" class="keys-form" autocomplete="off">
        <h2>Einstellungen</h2>
        <h3>API-Schlüssel (optional)</h3>
        <p class="small muted">Alle Grundfunktionen laufen ohne Schlüssel. Mit kostenlosen Schlüsseln werden zusätzliche Quellen
        freigeschaltet. Schlüssel werden nur lokal in diesem Browser gespeichert.</p>
        <label class="field-label">OpenWeatherMap <small>(zusätzliche hochauflösende Wetterkarten)</small>
          <input type="password" data-key="owm" value="${escapeHtml(keys.owm ?? '')}" placeholder="appid" autocomplete="off"/></label>
        <label class="field-label">NASA FIRMS MAP_KEY <small>(eigener Schlüssel für aktuellere Feuer-Hotspots – sonst wird ein gemeinsamer Snapshot genutzt)</small>
          <input type="password" data-key="firms" value="${escapeHtml(keys.firms ?? '')}" placeholder="MAP_KEY" autocomplete="off"/></label>
        <label class="field-label">Windy Webcams <small>(kostenloser Schlüssel von api.windy.com/keys – zehntausende Webcams weltweit)</small>
          <input type="password" data-key="windy" value="${escapeHtml(keys.windy ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">aisstream.io <small>(kostenloser Schlüssel von aisstream.io – Schiffe weltweit live)</small>
          <input type="password" data-key="aisstream" value="${escapeHtml(keys.aisstream ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">US National Park Service <small>(kostenloser Schlüssel von nps.gov/subjects/developer – Nationalpark-Webcams)</small>
          <input type="password" data-key="nps" value="${escapeHtml(keys.nps ?? '')}" placeholder="API-Key (optional – sonst gemeinsamer Snapshot)" autocomplete="off"/></label>
        <label class="field-label">511 Ontario <small>(kostenlos: auf 511on.ca anmelden, Key auf der Developers-Seite anfordern – Verkehrskameras Ontario)</small>
          <input type="password" data-key="ontario511" value="${escapeHtml(keys.ontario511 ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">511 Alberta <small>(kostenlos: auf 511.alberta.ca anmelden, Key auf der Developers-Seite anfordern – Verkehrskameras Alberta)</small>
          <input type="password" data-key="alberta511" value="${escapeHtml(keys.alberta511 ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <h3>Nahverkehr live (optional)</h3>
        <label class="field-label">Transport Victoria <small>(KeyId von opendata.transport.vic.gov.au – Melbourne: Züge, Trams, Busse)</small>
          <input type="password" data-key="victoria" value="${escapeHtml(keys.victoria ?? '')}" placeholder="KeyId" autocomplete="off"/></label>
        <label class="field-label">CTA Train Tracker <small>(Chicago „L“-Bahnen)</small>
          <input type="password" data-key="cta" value="${escapeHtml(keys.cta ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">Trafiklab <small>(„GTFS Regional Realtime“ – Busse & Bahnen in Schweden)</small>
          <input type="password" data-key="trafiklab" value="${escapeHtml(keys.trafiklab ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">Daten-Proxy <small>(Cloudflare Worker für Flugdaten & OpenStreetMap – Anleitung im README${builtInProxy() ? '; leer lassen = eingebauter Proxy' : ''})</small>
          <input type="url" data-key="adsbProxy" value="${escapeHtml(keys.adsbProxy ?? '')}" placeholder="${escapeHtml(builtInProxy() || 'https://mein-proxy.workers.dev/')}" autocomplete="off"/></label>
        <label class="field-label">Radar-Server <small>(optional: eigener RainViewer-kompatibler Server, z. B. selbst gehostetes LibreWXR – ersetzt das eingeschränkte kostenlose RainViewer)</small>
          <input type="url" data-key="radarHost" value="${escapeHtml(keys.radarHost ?? '')}" placeholder="https://radar.example.org" autocomplete="off"/></label>
        <h3>Datenquellen</h3>
        <div data-rdi></div>
        <p class="small muted">Open-Meteo, RainViewer, DWD, EUMETSAT, NASA (GPM, EONET, GIBS, FIRMS), USGS, EMSC, NOAA/NWS, GDACS,
        PEGELONLINE, Copernicus CAMS, NOAA NDBC/CO-OPS, Open-Meteo Marine, GEBCO, EMODnet, Iowa Environmental Mesonet, Environment Canada, EOX Sentinel-2, OpenTopoMap, AWS Terrain Tiles, adsb.lol, adsb.fi, airplanes.live, OpenSky Network, SondeHub, Fintraffic Digitraffic (Straße, Schiene, See), Windy Webcams, DeFlock/deflock-data, NOAA SWPC, Smithsonian GVP, NIFC, NOAA Tsunami, BfS ODL, Safecast,
        The Space Devs, aisstream.io, NGA World Port Index, Upply (UN/LOCODE), NASA GHRSST/AMSR2, Waymarked Trails, Wikidata, USGS MRDS, BGR, Macrostrat, ESA WorldCover, Radio Browser, TfL, Caltrans, Transitous, Amtraker, Entur, MBTA, SEPTA, TTC, data.gov.my, Transport Victoria, CTA, Trafiklab, OpenRailwayMap, Autobahn GmbH, NINA/BBK, CelesTrak, PeeringDB, WRI, OpenStreetMap/OpenFreeMap,
        Overpass API, Blitzortung.org, EURDEP (JRC), Japan Meteorological Agency, Finnish Meteorological Institute, NOAA MRMS, NOAA SPC, Esri World Imagery, NASA Blue/Black Marble,
        Bright Sky, BigDataCloud (Ortsname zum eigenen Standort), Nominatim/OpenStreetMap (Ortsname zum Kartenklick), Open-Meteo Geocoding/Flood (GloFAS), Global Shipping Lanes (P. Benden), PB2002 (Bird 2003), ALERTCalifornia, NYC DOT, DDOT,
        511 Ontario/Alberta, Transport Department HK, LTA Singapur, US National Park Service, Vegagerðin (Island), NZTA (Neuseeland), Transport for NSW, City of Calgary, DriveBC (British Columbia).
        Die genaue Quellenangabe steht unten rechts auf der Karte (ⓘ) bzw. im Popup.
        <a href="https://github.com/malte9799/orbis/blob/main/docs/DATENQUELLEN.md" target="_blank" rel="noopener">Alle Quellen mit Lizenzen</a> ·
        Software-Lizenzen: <a href="./licenses/maplibre-gl.txt" target="_blank">MapLibre GL</a>, <a href="./licenses/three.txt" target="_blank">three.js</a>,
        <a href="./licenses/satellite.js.txt" target="_blank">satellite.js</a>, <a href="./licenses/draco.txt" target="_blank">Draco</a>, <a href="./licenses/flag-icons.txt" target="_blank">flag-icons</a>, <a href="./licenses/mapillary-js.txt" target="_blank">mapillary-js</a>.
        Ein Klick auf die Karte zeigt das aktuelle Wetter an dieser Stelle.</p>
        <div class="dialog-actions">
          <button class="btn small" value="cancel" formnovalidate>Abbrechen</button>
          <button class="btn small primary" value="save">Speichern</button>
        </div>
      </form>`;
    mountRawDataLink(settings.querySelector<HTMLElement>('[data-rdi]')!, 'row', { beforeOpen: () => settings.close() });
    settings.showModal();
    settings.querySelector('form')!.addEventListener('submit', (e) => {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value !== 'save') return;
      const get = (k: string) => settings.querySelector<HTMLInputElement>(`input[data-key=${k}]`)!.value.trim() || undefined;
      const proxy = get('adsbProxy');
      store.setKeys({ ...store.getKeys(), owm: get('owm'), firms: get('firms'), windy: get('windy'), aisstream: get('aisstream'), victoria: get('victoria'), cta: get('cta'), trafiklab: get('trafiklab'), nps: get('nps'), ontario511: get('ontario511'), alberta511: get('alberta511'), radarHost: /^https:\/\//.test(get('radarHost') ?? '') ? get('radarHost') : undefined, adsbProxy: proxy && /^https:\/\//.test(proxy) ? proxy : undefined });
      feedData.firms.at = 0;
      firmsOk = false;
      if (hud) applyKarte(hud.current());
      applyGroups();
      ensureFeeds();
      extras?.resume();
      refreshHud();
      toast('Einstellungen gespeichert');
    });
  };

  // ----- apply state to map -----------------------------------------------
  let renderProj = () => {};
  function setProjection(next: GlobeState['projection']) {
    if (next === state.projection) return;
    state.projection = next;
    map?.setProjection({ type: next });
    if (state.wind && needsModel()) {
      wind?.stop();
      wind?.start();
    }
    renderProj();
    save();
  }

  const vis = (id: string, on: boolean) => {
    if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  };

  /** counts/notes of the extra layers changed (layers may also have been added lazily: keep the order) */
  const reorder = debounce(() => hud && applyOrder(hud.current()), 300);
  const updateBadges = () => {
    refreshHud();
    reorder();
  };

  function applyBase() {
    if (!map) return;
    for (const b of BASES) vis(`base-${b.id}`, state.base === b.id);
    const layers = map.getStyle().layers;
    for (const l of layers) {
      if (l.id.startsWith('vbase-dark-')) vis(l.id, state.base === 'dark');
      else if (l.id.startsWith('vbase-light-')) vis(l.id, state.base === 'light');
      else if (l.id.startsWith('lbl-')) vis(l.id, state.labels);
    }
    applyBuildings();
    // dark text on the light map, white text everywhere else
    const c = labelPaint(state.base === 'light' ? 'onLight' : 'onDark');
    for (const l of layers) {
      if (!l.id.startsWith('lbl-')) continue;
      if (l.type === 'symbol' && l.id !== 'lbl-water') {
        map.setPaintProperty(l.id, 'text-color', c.color);
        map.setPaintProperty(l.id, 'text-halo-color', c.halo);
      } else if (l.id === 'lbl-border-country') map.setPaintProperty(l.id, 'line-color', c.border);
      else if (l.id === 'lbl-border-state') map.setPaintProperty(l.id, 'line-color', c.state);
    }
  }

  function applyNight() {
    clearInterval(nightTimer);
    vis('night', state.night);
    if (!state.night) return;
    updateNight();
    nightTimer = window.setInterval(updateNight, 60000);
  }

  /** The 3D-Gebäude layer of the base map: light extrusions on the light map, dark ones elsewhere. */
  function applyBuildings() {
    if (!map?.getLayer('buildings-3d')) return;
    vis('buildings-3d', state.buildings3d);
    map.setPaintProperty('buildings-3d', 'fill-extrusion-color', state.base === 'light' ? '#ddd6cb' : '#1c2538');
  }

  /** 3D-Gelände: lifts/bares the real elevation model – nothing is drawn for it on the map. */
  function applyTerrain() {
    extras?.setTerrain(state.terrain3d);
  }

  /** The terminator follows the forecast timeline when one is shown. */
  function updateNight() {
    if (!state.night) return;
    const at = timelineMode() === 'model' && sampler ? new Date(sampler.time) : new Date();
    (map?.getSource('night') as GeoJSONSource | undefined)?.setData(nightPolygon(at));
  }

  function applyGroups() {
    const on = GROUPS.filter((g) => state.groups[g.id]).map((g) => g.id);
    const filter = ['in', ['get', 'group'], ['literal', on]] as const;
    map?.setFilter('ev-circle', filter as never);
    map?.setFilter('ev-glyph', filter as never);
    vis('quakes', !!state.groups.quakes);
    vis('tracks', !!state.groups.storms);
    vis('nws-fill', !!state.groups.tornado);
    vis('nws-line', !!state.groups.tornado);
    // clickable points (own key or shared snapshot) when available, else the raster image
    vis('firms', !!state.groups.hotspots && firmsOk);
    // the coarse raster is only a fallback once the point feed has actually failed (avoids a flash of other dots)
    vis('hotspots', !!state.groups.hotspots && !firmsOk && feedData.firms.at > 0);
  }

  // ----- forecast model ----------------------------------------------------
  const needsModel = () => isField(state.overlay) || state.wind || state.isobars;
  let modelErrorText = '';

  function modelError(e: unknown) {
    console.warn('Vorhersagedaten', e);
    const msg = isLimitError(e)
      ? `${(e as Error).message} – bitte später erneut versuchen.`
      : 'Vorhersagedaten (Open-Meteo) konnten nicht geladen werden.';
    if (msg !== modelErrorText) toast(msg, 'error');
    modelErrorText = msg;
    refreshHud();
    renderLegend();
  }

  async function ensureModel(): Promise<boolean> {
    modelLoading = !globalModel;
    if (modelLoading) {
      refreshHud();
      renderLegend();
    }
    try {
      const g = await getGlobalModel();
      modelErrorText = '';
      if (g !== globalModel) {
        const prevTime = globalModel && timeIdx >= 0 ? globalModel.times[timeIdx] : Date.now();
        globalModel = g;
        timeIdx = nearestTimeIndex(g.times, prevTime);
        detailModel = null;
        detailKey = '';
      }
      return true;
    } catch (e) {
      modelError(e);
      return false;
    } finally {
      if (modelLoading) {
        modelLoading = false;
        refreshHud();
      }
    }
  }

  function updateSampler() {
    if (!map || !globalModel || timeIdx < 0) return;
    sampler = new ModelSampler(globalModel, detailModel, timeIdx);
    setActiveSampler(sampler);
    if (isField(state.overlay)) {
      const version = `${globalModel.times[0]}-${timeIdx}-${detailKey.replace(/[^\w]/g, '_') || 'g'}`;
      (map.getSource('field') as RasterTileSource).setTiles([`wxfield://${state.overlay}/${version}/{z}/{x}/{y}`]);
      vis('field', true);
    }
    if (state.isobars) setGeo('isobars', isobars(sampler));
    updateNight();
    renderTimeline();
    renderLegend();
  }

  async function applyModelLayers() {
    if (!map) return;
    const on = needsModel();
    vis('isobars', on && state.isobars);
    vis('isobar-labels', on && state.isobars);
    vis('pressure-centers', on && state.isobars);
    if (!on || !state.wind) wind?.stop();
    if (!on) {
      renderTimeline();
      updateNight();
      return;
    }
    if (!(await ensureModel()) || !needsModel()) return;
    updateSampler();
    refreshDetail();
    if (state.wind) {
      wind ??= new WindParticles(map, () => sampler);
      wind.start();
    }
  }

  /** Fetch a finer grid for the current viewport once zoomed in. */
  let pendingDetail = '';
  const refreshDetail = debounce(() => {
    if (!map || !globalModel || !needsModel()) return;
    const b = map.getBounds();
    const req = detailRequest({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    if (!req) {
      pendingDetail = '';
      if (detailModel) {
        detailModel = null;
        detailKey = '';
        updateSampler();
      }
      return;
    }
    if (req.key === detailKey || req.key === pendingDetail) return;
    pendingDetail = req.key;
    getDetailModel(req)
      .then((g) => {
        if (pendingDetail !== req.key) return;
        pendingDetail = '';
        detailModel = g;
        detailKey = req.key;
        updateSampler();
      })
      .catch((e) => {
        pendingDetail = '';
        if (isLimitError(e)) modelError(e);
        else console.warn('Detailraster nicht verfügbar', e);
      });
  }, 700);

  /** HD satellite: NOAA-21, or NOAA-20 when NOAA-21 delivers nothing at all (probe of one small tile).
   *  Runs only while "Satellit HD" is actually shown – no probe fetch on every map load. */
  let hdSat: string = HD_SAT;
  let hdProbeDay = '';
  async function updateHdSource() {
    const date = gibsDate(1);
    hdProbeDay = date;
    const works = (sat: string) =>
      fetch(gibsTrueColor(date, sat).replace('{z}/{y}/{x}', '2/1/2'), { signal: AbortSignal.timeout(8000) }).then(
        (r) => r.ok,
        () => false,
      );
    hdSat = (await works(HD_SAT)) ? HD_SAT : HD_SAT_BACKUP;
    (map?.getSource('hd') as RasterTileSource | undefined)?.setTiles([gibsTrueColor(date, hdSat)]);
  }
  /** the probe (and a later switch to the backup satellite) only when HD is really displayed */
  function ensureHdSources() {
    if (state.overlay !== 'sat-hd') return;
    if (hdProbeDay !== gibsDate(1) || hdSat !== HD_SAT) void updateHdSource();
  }

  function setGeo(source: string, data: FeatureCollection) {
    (map?.getSource(source) as GeoJSONSource | undefined)?.setData(data);
  }

  async function applyOverlay() {
    if (!map) return;
    const o = state.overlay;
    stopAnimation();
    vis('field', false);
    vis('hd', o === 'sat-hd');
    if (o === 'sat-hd') ensureHdSources();
    vis('sat-ir', o === 'sat-ir');
    vis('sat-storm', o === 'sat-storm');
    vis('dwd-radar', o === 'dwd-radar');
    vis('imerg', o === 'imerg');
    vis('sst', o === 'sst' || o === 'water');
    vis('seaice', o === 'seaice' || o === 'water');
    setRadarVisible(o === 'radar');
    for (const l of OWM_LAYERS) vis(`owm-${l.id}`, false);
    hideReadout();

    if (o.startsWith('owm-')) {
      const layer = o.slice(4);
      const key = store.getKeys().owm;
      if (key) {
        const id = `owm-${layer}`;
        if (!map.getSource(id)) {
          map.addSource(id, {
            type: 'raster',
            tiles: [`https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${encodeURIComponent(key)}`],
            tileSize: 256,
            maxzoom: 10,
            attribution: 'Wetterkarten © <a href="https://openweathermap.org/">OpenWeather</a>',
          });
          map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 0.85 } }, 'anchor-weather');
        }
        vis(id, true);
      }
    } else if (o === 'radar') {
      await ensureRadar();
    }
    await applyModelLayers();
    renderLegend();
    renderTimeline();
  }

  // ----- radar -------------------------------------------------------------
  let radar: RadarFrames | null = null;
  let radarAt = 0;
  let radarIdx = 0;
  let radarT = 0; // continuous radar time in ms (the slider moves in minutes)
  let radarScrubTimer = 0;
  let radarGl: RadarGl | null = null;
  let playRaf = 0;
  let playTimer = 0;
  const rangeEl = timeline.querySelector<HTMLInputElement>('.tl-range')!;
  const timeEl = timeline.querySelector<HTMLSpanElement>('.tl-time')!;
  const daysEl = timeline.querySelector<HTMLDivElement>('.tl-days')!;
  const playBtn = timeline.querySelector<HTMLButtonElement>('.tl-play')!;
  const nowBtn = timeline.querySelector<HTMLButtonElement>('.tl-now')!;

  async function ensureRadar() {
    if (!map) return;
    if (!radar || Date.now() - radarAt > REFRESH_MS) {
      try {
        radar = await loadRadarFrames();
        radarAt = Date.now();
      } catch {
        toast('Regenradar (RainViewer) konnte nicht geladen werden.', 'error');
        return;
      }
    }
    // measurements only: RainViewer's own nowcast steps are not shown
    radar.frames = radar.frames.filter((f) => !f.nowcast && !f.hd);
    if (state.overlay !== 'radar' || !radar.frames.length) return;

    // one WebGL layer for all steps: it mixes the values of two neighbouring steps
    if (!radarGl) {
      radarGl = new RadarGl(LUT);
      map.addLayer(radarGl, 'anchor-weather');
    }
    // attributions are shown for sources of visible layers: a layer without features carries them
    if (!map.getSource('radar-attr')) {
      map.addSource('radar-attr', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        attribution: `Radar © <a href="https://www.rainviewer.com/">RainViewer</a>`,
      });
      map.addLayer({ id: 'radar-attr', type: 'circle', source: 'radar-attr', paint: { 'circle-opacity': 0 } }, 'anchor-weather');
    }
    const maxzoom = store.getKeys().radarHost ? 10 : 7;
    radarGl.setFrames(radar.frames.map((f) => rainviewerFrame(radar!.host, f.path, f.time * 1000, maxzoom)));
    showRadarFrame(lastPastRadarFrame());
    setRadarVisible(true);
  }

  const lastPastRadarFrame = () => Math.max(0, (radar?.frames.filter((f) => !f.nowcast).length ?? 1) - 1);

  function setRadarVisible(on: boolean) {
    radarGl?.setVisible(on);
    if (map?.getLayer('radar-attr')) vis('radar-attr', on);
    if (on && radar) showRadarTime(radarT);
  }

  /**
   * The radar is one WebGL layer (src/globe/radargl.ts) holding the values of two neighbouring
   * steps; showing a step sets the time, playing moves it continuously, so the rain edges slide
   * between the positions of the steps.
   */
  function showRadarFrame(i: number) {
    if (!radar || !map) return;
    radarIdx = i;
    showRadarTime(radar.frames[i].time * 1000);
  }

  /** Any point in time between the first and last step; the layer mixes the neighbouring steps. */
  function showRadarTime(t: number, debounce = false) {
    if (!radar || !map) return;
    clearTimeout(radarScrubTimer);
    const frames = radar.frames;
    radarT = Math.max(frames[0].time * 1000, Math.min(frames[frames.length - 1].time * 1000, t));
    let idx = 0;
    while (idx < frames.length - 1 && frames[idx + 1].time * 1000 <= radarT) idx++;
    radarIdx = idx;
    if (debounce) {
      // scrubbing: only the position where the slider rests loads tiles (rate limit)
      radarScrubTimer = window.setTimeout(() => radarGl?.setTime(radarT), 180);
    } else radarGl?.setTime(radarT);
    renderTimeline();
  }

  // ----- timeline (radar frames or forecast steps) ---------------------------
  type TimelineMode = 'none' | 'radar' | 'model';
  const timelineMode = (): TimelineMode =>
    state.overlay === 'radar' ? (radar?.frames.length ? 'radar' : 'none') : needsModel() && globalModel ? 'model' : 'none';

  const timeLabel = (ms: number) =>
    new Date(ms).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

  let timelineKey = '';
  function renderTimeline() {
    const mode = timelineMode();
    if (timeline.hidden !== (mode === 'none')) {
      timeline.hidden = mode === 'none';
      hud?.syncSheet();
    }
    if (mode === 'none') return;
    const times = mode === 'radar' ? radar!.frames.map((f) => f.time * 1000) : globalModel!.times;
    const idx = mode === 'radar' ? radarIdx : timeIdx;
    let t = times[idx];
    if (mode === 'radar') {
      // radar slider: one step per minute
      rangeEl.step = '1';
      rangeEl.max = String(Math.round((times[times.length - 1] - times[0]) / 60000));
      rangeEl.value = String(Math.round((radarT - times[0]) / 60000));
      t = radarT;
    } else {
      rangeEl.step = '1';
      rangeEl.max = String(times.length - 1);
      rangeEl.value = String(idx);
    }
    const nowcast = mode === 'radar' && radar!.frames[idx].nowcast;
    const rel = Math.round((t - Date.now()) / 3600000);
    timeEl.innerHTML = `<b>${escapeHtml(timeLabel(t))}</b><small>${
      mode === 'radar' ? (nowcast ? 'Prognose' : 'Radar') : Math.abs(rel) < 2 ? 'jetzt' : rel > 0 ? `+${rel} h` : `${rel} h`
    }</small>`;
    // day ticks under the slider (only rebuilt when the time axis changes)
    const key = `${mode}:${times[0]}:${times.length}`;
    if (key !== timelineKey) {
      timelineKey = key;
      let html = '';
      if (mode === 'model') {
        let lastDay = '';
        times.forEach((tt, i) => {
          const d = new Date(tt);
          const day = d.toLocaleDateString('de-DE', { weekday: 'short' });
          if (day !== lastDay && d.getHours() < 3) {
            html += `<span style="left:${(i / (times.length - 1)) * 100}%">${escapeHtml(day)}</span>`;
          }
          lastDay = day;
        });
      }
      daysEl.innerHTML = html;
    }
  }

  function setTimeIndex(i: number) {
    if (timelineMode() === 'radar') showRadarFrame(i);
    else if (globalModel) {
      timeIdx = Math.max(0, Math.min(globalModel.times.length - 1, i));
      updateSampler();
    }
  }

  function stopAnimation() {
    clearInterval(playTimer);
    playTimer = 0;
    cancelAnimationFrame(playRaf);
    playRaf = 0;
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
    playBtn.setAttribute('aria-label', 'Abspielen');
  }

  rangeEl.addEventListener('input', () => {
    stopAnimation();
    if (timelineMode() === 'radar') showRadarTime(radar!.frames[0].time * 1000 + Number(rangeEl.value) * 60000, true);
    else setTimeIndex(Number(rangeEl.value));
  });
  nowBtn.addEventListener('click', () => {
    stopAnimation();
    if (timelineMode() === 'radar') showRadarFrame(lastPastRadarFrame());
    else if (globalModel) setTimeIndex(nearestTimeIndex(globalModel.times));
  });
  playBtn.addEventListener('click', () => {
    if (playTimer || playRaf) return stopAnimation();
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    playBtn.setAttribute('aria-label', 'Pause');
    const radarMode = timelineMode() === 'radar';
    if (radarMode && radar && radarGl) {
      // continuous time: 10 minutes of radar per 700 ms; the layer mixes the steps around it
      const frames = radar.frames;
      const t0 = frames[0].time * 1000;
      const t1 = frames[frames.length - 1].time * 1000;
      const speed = 600000 / 700;
      let t = radarT;
      let last = performance.now();
      const loop = (now: number) => {
        // wait for the tiles of the next step instead of requesting them faster than they arrive
        if (!radarGl!.isLoading) t += (now - last) * speed;
        last = now;
        if (t > t1 + 600000) t = t0;
        showRadarTime(Math.min(t, t1));
        playRaf = requestAnimationFrame(loop);
      };
      playRaf = requestAnimationFrame(loop);
      return;
    }
    playTimer = window.setInterval(() => {
      const n = radarMode ? radar!.frames.length : Number(rangeEl.max) + 1;
      setTimeIndex(((radarMode ? radarIdx : timeIdx) + 1) % n);
    }, radarMode ? 700 : 1100);
  });

  // ----- legend & readout --------------------------------------------------
  function legendInfo(): LegendInfo | null {
    const o = state.overlay;
    const t = (title: string, sub: string, gradient: string, ticks: [number, string][]): LegendInfo => ({
      title, sub, gradient, ticks: ticks.map(([pos, label]) => ({ pos, label })),
    });
    if (isField(o)) {
      const def = FIELDS[o];
      const { stops, ticks, gradient } = def.legend;
      const lo = stops[0][0];
      const hi = stops[stops.length - 1][0];
      const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
      const grad = gradient ?? `linear-gradient(90deg, ${stops.map(([v, c]) => `${c} ${pct(v).toFixed(1)}%`).join(', ')})`;
      const sub = `${def.unit}${sampler ? ` · ${timeLabel(sampler.time)}` : modelLoading ? ' · lädt …' : modelErrorText ? ` · ${modelErrorText}` : ''}`;
      return t(def.label, sub, grad, ticks.map((v) => [pct(v), def.format(v)]));
    }
    switch (o) {
      case 'radar':
        return t('Niederschlagsradar', 'live', 'linear-gradient(90deg,#73afff,#5a96fa,#5587f5,#506eeb,#7855dc,#be4bb4,#e45587,#f48264,#fabe55,#fff05f)', [[0, 'leicht'], [50, 'mäßig'], [100, 'stark']]);
      case 'dwd-radar':
        return t('Radar Deutschland', 'DWD · letzte Messung, alle 5 min aktualisiert', 'linear-gradient(90deg,#a0e6ff,#4fb0ff,#2f6fe0,#2bd46f,#ffe14d,#ff8c1a,#e8384f,#b03ad6)', [[0, 'leicht'], [50, 'mäßig'], [100, 'Unwetter']]);
      case 'sat-hd':
        // a true-colour image: no colour scale
        return t('Satellit HD', 'NASA VIIRS · Tagesbild von gestern', '', []);
      case 'sat-ir':
        return t('Satellit Infrarot', 'live · hohe, kalte Wolken erscheinen hell', 'linear-gradient(90deg,#111,#777,#fff)', [[0, 'warm/tief'], [100, 'kalt/hoch']]);
      case 'sat-storm':
        return t('Satellit Gewitter', 'Meteosat Konvektions-RGB · live, Europa & Afrika', 'linear-gradient(90deg,#2a1a5e,#6a4cb8,#f2e24a)', [[0, 'ruhig'], [100, 'kräftige Gewitter']]);
      case 'water':
        return t('Wassertemperatur', 'NASA GHRSST MUR · Meer und Meereis, vor 2 Tagen · °C', 'linear-gradient(90deg,#2b0f6b,#2b2f8f,#2a6fc8,#2aa8c8,#5fd0a0,#f6d743,#f39c33,#e2462f,#9e1a3a)', [[0, '−2'], [35, '10'], [65, '20'], [100, '32']]);
      case 'sst':
        return t('Meerestemperatur', 'NASA GHRSST MUR · Tagesmittel vor 2 Tagen · °C', 'linear-gradient(90deg,#2b0f6b,#2b2f8f,#2a6fc8,#2aa8c8,#5fd0a0,#f6d743,#f39c33,#e2462f,#9e1a3a)', [[0, '−2'], [35, '10'], [65, '20'], [100, '32']]);
      case 'seaice':
        return t('Meereis-Konzentration', 'NASA GHRSST MUR · vor 2 Tagen', 'linear-gradient(90deg,#2a2ae0,#2ad0e0,#40e040,#f0e040,#f04020,#ffffff)', [[0, 'gering'], [100, '100 %']]);
      case 'imerg':
        return t('Niederschlag Satellit', 'NASA IMERG · mm/h', 'linear-gradient(90deg,#b4e3ff,#3c8fff,#28c76f,#ffe14d,#ff8c1a,#e8384f)', [[0, '0,1'], [50, '5'], [100, '50+']]);
      default:
        return null;
    }
  }

  function renderLegend() {
    const l = legendInfo();
    legend.innerHTML = l
      ? `<div class="legend-title">${escapeHtml(l.title)} <small>${escapeHtml(l.sub)}</small></div>${
          l.gradient
            ? `<div class="legend-bar" style="background:${l.gradient}"></div>
        <div class="legend-ticks">${l.ticks.map((x) => `<span style="left:${x.pos}%">${escapeHtml(x.label)}</span>`).join('')}</div>`
            : ''
        }`
      : '';
    legend.hidden = !l;
    // without a colour scale (true-colour image) the phone layouts, which show only the bar, drop it
    legend.classList.toggle('no-scale', !!l && !l.gradient);
    hud?.syncSheet();
  }

  const readout = el.querySelector<HTMLDivElement>('.readout')!;
  const hideReadout = () => {
    readout.hidden = true;
  };
  function updateReadout(point: { x: number; y: number }, lngLat: { lng: number; lat: number }, touch = false) {
    const o = state.overlay;
    if (touch && o === 'radar') {
      // long-press on a phone: rain value of the radar under the finger
      const byte = radarGl?.sample(lngLat.lng, lngLat.lat);
      if (byte == null) return hideReadout();
      const rr = rainRate(byte);
      readout.textContent = rr >= 0.05 ? `${rainLabel(rr)}, ${fmt.num(rr, rr < 1 ? 1 : 0)} mm/h` : 'kein Niederschlag';
      readout.style.transform = `translate(${Math.max(8, point.x - 40)}px, ${Math.max(8, point.y - 64)}px)`;
      readout.hidden = false;
      return;
    }
    if (!isField(o) || !sampler || (!touch && !matchMedia('(pointer: fine)').matches)) return hideReadout();
    const def = FIELDS[o];
    const v = sampler.sample(def.variable, lngLat.lat, lngLat.lng);
    if (Number.isNaN(v)) return hideReadout();
    let extra = '';
    if (o === 'wind' || o === 'gusts') {
      const u = sampler.sample('u', lngLat.lat, lngLat.lng);
      const w = sampler.sample('v', lngLat.lat, lngLat.lng);
      extra = ` ${compass(((Math.atan2(-u, -w) * 180) / Math.PI + 360) % 360)}`;
    }
    readout.textContent = `${def.format(v)} ${def.unit}${extra}`;
    readout.style.transform = touch ? `translate(${Math.max(8, point.x - 40)}px, ${Math.max(8, point.y - 64)}px)` : `translate(${point.x + 14}px, ${point.y + 14}px)`;
    readout.hidden = false;
  }

  // ----- popups ------------------------------------------------------------
  function eventPopupHtml(f: MapGeoJSONFeature): string {
    const p = f.properties as Record<string, string | number | undefined>;
    const url = safeUrl(p.url);
    const kind = (p.kind as EventKind) ?? 'quake';
    const desc = typeof p.description === 'string' ? p.description.slice(0, 400) : '';
    return `<div class="pop">
      <div class="pop-head">${glyphSvg(kind, String(p.color ?? kindColor(kind)), 26)}<b>${escapeHtml(p.title)}</b></div>
      ${p.subtitle ? `<div class="pop-sub">${escapeHtml(p.subtitle)}</div>` : ''}
      ${p.date ? `<div class="pop-sub">${escapeHtml(fmt.dateTime(String(p.date)))} (${escapeHtml(fmt.relative(String(p.date)))})</div>` : ''}
      ${desc ? `<p class="pop-desc">${escapeHtml(desc)}${desc.length >= 400 ? ' …' : ''}</p>` : ''}
      <div class="pop-foot"><span>Quelle: ${escapeHtml(p.source)}</span>${url ? ` · <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Details ↗</a>` : ''}</div>
    </div>`;
  }

  /** Opens the launch tracker panel for the next launch of a pad (popup button). */
  async function openLaunchTracker(l: Launch, lng: number, lat: number) {
    popup?.remove();
    flightPanel?.close();
    shipPanel?.close();
    let d: LaunchDetail;
    try {
      const list = await getLaunchDetails();
      d = list.find((x) => x.id && x.id === l.id) ?? detailFromLaunch(l, lng, lat);
    } catch {
      d = detailFromLaunch(l, lng, lat);
      toast('Startdetails gerade nicht erreichbar – Tracking mit Basisdaten.', 'error');
    }
    launchPanel?.open(d);
  }

  function openPopup(lngLat: { lng: number; lat: number }, html: string) {
    popup?.remove();
    const node = document.createElement('div');
    node.innerHTML = html;
    popup = new Popup({ maxWidth: '320px', className: 'wx-popup' }).setLngLat(lngLat).setDOMContent(node).addTo(map!);
    return node;
  }

  async function weatherPopup(lng: number, lat: number, rain?: number | null) {
    // radar read-out of the Orbis composites: available even if the weather request fails
    const radarLine =
      rain != null ? `<div class="pop-sub">Radar: <b>${escapeHtml(rain >= 0.05 ? `${rainLabel(rain)}, ${fmt.num(rain, rain < 1 ? 1 : 0)} mm/h` : 'kein Niederschlag')}</b></div>` : '';
    const loadingHtml = `<div class="pop"><div class="pop-sub">${fmt.coords(lat, lng)}</div>${radarLine}<div class="pop-loading">Lade Wetter …</div></div>`;
    let node: HTMLElement;
    if (hud?.layout() === 'portrait') {
      // phone: the place weather fills the bottom sheet instead of a pop-up
      popup?.remove();
      node = document.createElement('div');
      node.innerHTML = loadingHtml;
      hud.showPlace(node);
      setData('marker', [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } as Point, properties: {} }]);
    } else node = openPopup({ lng, lat }, loadingHtml);
    try {
      const w = await getCurrent(lat, lng);
      const c = w.current;
      node.innerHTML = `<div class="pop">
        <div class="pop-sub">${fmt.coords(lat, lng)} · ${Math.round(w.elevation)} m</div>
        ${radarLine}
        <div class="pop-wx">${weatherIcon(c.weather_code, c.is_day === 1, 52)}
          <div><div class="pop-temp">${fmt.temp(c.temperature_2m, 1)}</div><div>${escapeHtml(describe(c.weather_code))}</div></div></div>
        <div class="pop-grid">
          <span>Gefühlt</span><b>${fmt.temp(c.apparent_temperature)}</b>
          <span>Wind</span><b>${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)}</b>
          <span>Böen</span><b>${Math.round(c.wind_gusts_10m)} km/h</b>
          <span>Feuchte</span><b>${Math.round(c.relative_humidity_2m)} %</b>
          <span>Wolken</span><b>${Math.round(c.cloud_cover)} %</b>
          <span>Druck</span><b>${Math.round(c.pressure_msl)} hPa</b>
        </div>
        <button class="btn small wide" data-wx="open">Vorhersage öffnen →</button>
      </div>`;
      node.querySelector('[data-wx=open]')!.addEventListener('click', async () => {
        onOpenForecast(await reverseGeocodePoint(lat, lng));
      });
    } catch {
      node.querySelector('.pop-loading')!.textContent = 'Wetterdaten nicht verfügbar.';
    }
  }

  // ----- map lifecycle -----------------------------------------------------
  function focusPlace(lat: number, lon: number, zoom = 6, mark = false) {
    if (!map || !ready) {
      pendingFocus = { lat, lon, zoom };
      return;
    }
    map.flyTo({ center: [lon, lat], zoom, speed: 1.4, essential: true });
    if (mark) {
      setData('marker', [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] } as Point, properties: {} }]);
    }
  }

  function initMap() {
    registerFieldProtocol();
    const fireDate = gibsDate(new Date().getUTCHours() < 12 ? 1 : 0);
    map = new MlMap({
      container: el.querySelector<HTMLElement>('#map')!,
      style: buildStyle(gibsDate(1), fireDate, state.projection),
      center: state.center,
      zoom: state.zoom,
      maxPitch: 60,
      minZoom: 0.3, // below this the 3D globe hands over to the solar system view
      attributionControl: { compact: true },
      transformRequest: tileRecorder(() => map),
    });
    // bottom right, stacked from the bottom up: zoom/compass, 2D/3D, locate (later controls sit on top)
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right');
    el.querySelector('.maplibregl-ctrl-zoom-in')?.parentElement?.classList.add('nav-ctl');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    // zoom level next to the scale bar
    const zoomEl = document.createElement('div');
    zoomEl.className = 'maplibregl-ctrl zoom-ctrl';
    const showZoom = () => (zoomEl.textContent = `Zoom ${map!.getZoom().toFixed(1)}`);
    map.addControl({ onAdd: () => { showZoom(); map!.on('zoom', showZoom); return zoomEl; }, onRemove: () => { map?.off('zoom', showZoom); zoomEl.remove(); } }, 'bottom-left');

    // phones: the attribution stays collapsed until the "i" button is tapped (MapLibre opens it
    // by itself whenever new sources bring attributions)
    const attrib = el.querySelector<HTMLElement>('.maplibregl-ctrl-attrib');
    if (attrib) {
      let tapped = 0;
      attrib.addEventListener('click', () => (tapped = performance.now()), true);
      new MutationObserver(() => {
        if (hud?.layout() !== 'desktop' && attrib.classList.contains('maplibregl-compact-show') && performance.now() - tapped > 400) attrib.classList.remove('maplibregl-compact-show');
      }).observe(attrib, { attributes: true, attributeFilter: ['class'] });
    }

    // Locate button
    // 2D / 3D switch
    const projCtl = document.createElement('div');
    projCtl.className = 'maplibregl-ctrl maplibregl-ctrl-group proj-ctl';
    projCtl.setAttribute('role', 'group');
    projCtl.setAttribute('aria-label', 'Ansicht');
    renderProj = () => {
      projCtl.innerHTML =
        (['mercator', 'globe'] as const)
          .map(
            (p) =>
              `<button type="button" data-proj="${p}" class="${state.projection === p ? 'on' : ''}" aria-pressed="${state.projection === p}" title="${p === 'globe' ? '3D-Globus' : '2D-Karte'}">${p === 'globe' ? '3D' : '2D'}</button>`,
          )
          .join('') +
        `<button type="button" data-proj="space" title="Ins Sonnensystem" aria-label="Ins Sonnensystem"><svg viewBox="0 0 24 24" class="ctl-ic"><circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)"/></svg></button>`;
    };
    renderProj();
    projCtl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-proj]');
      if (!btn || !map) return;
      if (btn.dataset.proj === 'space') {
        const c = map.getCenter();
        onOpenSpace(c.lat, c.lng);
        return;
      }
      setProjection(btn.dataset.proj as GlobeState['projection']);
    });

    // Zooming further out of the 3D globe leaves Earth and enters the solar system.
    // A gesture (events less than 250 ms apart, incl. trackpad/free-spinning momentum) that reaches the minimum
    // zoom only stops there; a fresh gesture starting at minimum zoom is needed to actually leave.
    let lastWheel = 0;
    let gestureAtMin = false;
    let outDelta = 0;
    map.getContainer().addEventListener(
      'wheel',
      (e) => {
        if (!map || state.projection !== 'globe' || e.deltaY <= 0) {
          outDelta = 0;
          return;
        }
        const now = performance.now();
        if (now - lastWheel > 250) {
          gestureAtMin = map.getZoom() <= map.getMinZoom() + 0.05;
          outDelta = 0;
        }
        lastWheel = now;
        if (!gestureAtMin) return;
        outDelta += e.deltaY;
        if (outDelta >= 300) {
          outDelta = 0;
          gestureAtMin = false;
          const c = map.getCenter();
          onOpenSpace(c.lat, c.lng);
        }
      },
      { passive: true },
    );
    map.addControl({ onAdd: () => projCtl, onRemove: () => projCtl.remove() }, 'bottom-right');

    const locCtl = document.createElement('div');
    locCtl.className = 'maplibregl-ctrl maplibregl-ctrl-group loc-ctl';
    locCtl.innerHTML = `<button type="button" title="Mein Standort" aria-label="Mein Standort"><svg viewBox="0 0 24 24" class="ctl-ic"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>`;
    locCtl.querySelector('button')!.addEventListener('click', async () => {
      try {
        const { lat, lon } = await locate();
        store.setLastPlace({ name: '', lat, lon });
        focusPlace(lat, lon, 8, true);
      } catch {
        toast('Standort konnte nicht ermittelt werden.', 'error');
      }
    });
    map.addControl({ onAdd: () => locCtl, onRemove: () => locCtl.remove() }, 'bottom-right');

    map.on('load', () => {
      ready = true;
      registerEventIcons(map!);
      // NASA layer date = yesterday (today's swaths are still incomplete)
      (map!.getSource('nasa') as RasterTileSource).setTiles([gibsTrueColor(gibsDate(1))]);
      (map!.getSource('hotspots') as RasterTileSource).setTiles([gibsFires(fireDate)]);
      extras = new ExtraLayers(map!, { changed: updateBadges, toast: (m) => toast(m, 'error'), openLaunch: (l, lng, lat) => void openLaunchTracker(l, lng, lat) });
      extras.init();
      flightPanel = new FlightPanel(el, {
        info: (hex) => extras?.flightInfo(hex) ?? null,
        select: (hex) => extras?.selectFlight(hex),
        fit: (hex) => extras?.fitFlight(hex),
        map: () => map,
      });
      shipPanel = new ShipPanel(el, { info: (mmsi) => extras?.shipInfo(mmsi) ?? null, map: () => map });
      sondePanel = new SondePanel(el, { info: (serial) => extras?.sondeInfo(serial) ?? null, select: (serial) => extras?.selectSonde(serial), fit: (serial) => extras?.fitSonde(serial), map: () => map });
      launchPanel = new LaunchPanel(el, { map: () => map, live: (data) => extras?.setLaunchLive(data) });
      shipPanel.onOpen = () => {
        flightPanel?.close();
        sondePanel?.close();
        launchPanel?.close();
      };
      sondePanel.onOpen = () => flightPanel?.close();
      extras.setEnabled((Object.keys(state.extras) as ExtraId[]).filter((id) => state.extras[id]));
      extras.setTerrain(state.terrain3d);
      if (hud) applyLayerOptions(hud.current());
      applyPadding();
      applyBase();
      applyNight();
      applyGroups();
      applyOverlay();
      syncEventSources();
      ensureFeeds();
      if (pendingFocus) {
        focusPlace(pendingFocus.lat, pendingFocus.lon, pendingFocus.zoom, true);
        pendingFocus = null;
      }
    });

    // long-press (touch): only the value under the finger
    {
      const cont = map.getContainer();
      let lpTimer = 0;
      let lpStart: { x: number; y: number } | null = null;
      let lpShown = false;
      const lpClear = () => {
        clearTimeout(lpTimer);
        lpStart = null;
      };
      cont.addEventListener(
        'touchstart',
        (e) => {
          lpClear();
          lpShown = false;
          if (e.touches.length !== 1 || !map) return;
          const t = e.touches[0];
          lpStart = { x: t.clientX, y: t.clientY };
          lpTimer = window.setTimeout(() => {
            if (!lpStart || !map) return;
            const r = cont.getBoundingClientRect();
            const pt = { x: lpStart.x - r.left, y: lpStart.y - r.top };
            lpShown = true;
            longPressAt = performance.now();
            updateReadout(pt, map.unproject([pt.x, pt.y]), true);
          }, 450);
        },
        { passive: true },
      );
      cont.addEventListener(
        'touchmove',
        (e) => {
          const t = e.touches[0];
          if (lpStart && t && Math.hypot(t.clientX - lpStart.x, t.clientY - lpStart.y) > 10) lpClear();
        },
        { passive: true },
      );
      const lpEnd = () => {
        lpClear();
        if (lpShown) {
          longPressAt = performance.now();
          window.setTimeout(hideReadout, 1500);
        }
      };
      cont.addEventListener('touchend', lpEnd, { passive: true });
      cont.addEventListener('touchcancel', lpEnd, { passive: true });
    }

    // the compass appears only when the map is rotated or tilted
    const syncRotated = () => el.classList.toggle('rotated', !!map && (Math.abs(map.getBearing()) > 0.5 || map.getPitch() > 0.5));
    map.on('rotate', syncRotated);
    map.on('pitch', syncRotated);

    map.on('mousemove', (e) => updateReadout(e.point, e.lngLat));
    // pointer cursor over an aircraft's 3D trail / wall / model (MapLibre does not know those shapes)
    let flightHover = false;
    let lastFlightPick = 0;
    map.on('mousemove', (e) => {
      const now = performance.now();
      if (now - lastFlightPick < 40) return;
      lastFlightPick = now;
      const over = !!extras?.pickFlight(e.point.x, e.point.y);
      if (over) map!.getCanvas().style.cursor = 'pointer';
      else if (flightHover) map!.getCanvas().style.cursor = '';
      flightHover = over;
    });
    map.on('mouseout', hideReadout);
    map.on('movestart', hideReadout);
    map.on('moveend', () => {
      refreshDetail();
      extras?.onMoveEnd();
      const c = map!.getCenter();
      state.center = [+c.lng.toFixed(3), +c.lat.toFixed(3)];
      state.zoom = +map!.getZoom().toFixed(2);
      save();
    });

    const interactive = ['ev-circle', 'quakes', 'firms', 'nws-fill', ...EXTRA_CLICK_LAYERS];
    const areaLayers = ['nws-fill', 'dwd-warn-fill', 'cables'];
    map.on('click', (e) => {
      if (longPressAt && performance.now() - longPressAt < 700) return;
      if (hud?.placeOpen()) {
        // a second tap on the map closes the place sheet
        hud.clearPlace();
        return;
      }
      // the 3D ship models are picked by hand (their 2D icons are stale between two updates)
      const shipHit = extras?.pickShip(e.point.x, e.point.y, e.lngLat);
      // the same holds for the 3D train, tram, subway and bus models
      const vehHit = extras?.pickVehicle(e.point.x, e.point.y, e.lngLat);
      const ships3d = extras?.ships3dActive();
      const veh3d = extras?.vehicles3dActive();
      const layers = interactive.filter((l) => map!.getLayer(l) && !(ships3d && l === 'ships') && !(veh3d && (l === 'trains' || l === 'transit-veh')));
      // a few pixels of tolerance makes small/moving objects easier to hit
      const box: [[number, number], [number, number]] = [
        [e.point.x - 4, e.point.y - 4],
        [e.point.x + 4, e.point.y + 4],
      ];
      const hits = map!.queryRenderedFeatures(box, { layers });
      const hit = hits.find((h) => !areaLayers.includes(h.layer.id)) ?? hits[0];
      // an aircraft's 3D trail or the wall below it (MapLibre cannot pick those)
      const picked = hit || shipHit ? null : extras?.pickFlight(e.point.x, e.point.y);
      if (picked) {
        shipPanel?.close();
        launchPanel?.close();
        if (picked.startsWith('sonde:')) {
          flightPanel?.close();
          sondePanel?.open(picked.slice('sonde:'.length));
        } else {
          sondePanel?.close();
          flightPanel?.open(picked);
        }
        return;
      }
      extras?.clearSelection();
      const extraResult = shipHit ?? vehHit ?? (hit && EXTRA_CLICK_LAYERS.includes(hit.layer.id) ? extras?.click(hit, e.lngLat) : null);
      if (extraResult?.type === 'flight') {
        shipPanel?.close();
        launchPanel?.close();
        sondePanel?.close();
        flightPanel?.open(extraResult.hex);
      } else if (extraResult?.type === 'sonde') {
        shipPanel?.close();
        flightPanel?.close();
        launchPanel?.close();
        sondePanel?.open(extraResult.serial);
      } else if (extraResult?.type === 'ship') {
        flightPanel?.close();
        launchPanel?.close();
        shipPanel?.open(extraResult.mmsi);
      } else if (extraResult?.type === 'weather') {
        weatherPopup(extraResult.lng, extraResult.lat);
      } else if (extraResult) {
        const node = openPopup({ lng: extraResult.lng, lat: extraResult.lat }, extraResult.html);
        extraResult.after?.(node);
      } else if (hit && hit.layer.id === 'firms') {
        const p = hit.properties as { frp: number; conf: string; time: string };
        openPopup(e.lngLat, `<div class="pop"><div class="pop-head">${glyphSvg('fire', '#ff5a1f', 26)}<b>Feuer-Hotspot</b></div>
          <div class="pop-sub">Strahlungsleistung ${fmt.num(p.frp, 1)} MW · Konfidenz ${escapeHtml(p.conf)}</div>
          <div class="pop-sub">Erfasst ${escapeHtml(p.time)} UTC</div>
          <div class="pop-foot">Quelle: NASA FIRMS (VIIRS NOAA-20)</div></div>`);
      } else if (hit && hit.layer.id === 'nws-fill') {
        openPopup(e.lngLat, `<div class="pop"><div class="pop-head">${glyphSvg('tornado', String(hit.properties.color), 26)}<b>${escapeHtml(hit.properties.event)}</b></div>
          <div class="pop-sub">Warngebiet des National Weather Service</div>
          <div class="pop-foot">Quelle: NWS (USA)</div></div>`);
      } else if (hit && !EXTRA_CLICK_LAYERS.includes(hit.layer.id)) {
        openPopup(hit.geometry.type === 'Point' ? { lng: (hit.geometry as Point).coordinates[0], lat: (hit.geometry as Point).coordinates[1] } : e.lngLat, eventPopupHtml(hit));
      } else if (isWeatherKarte(curKarte)) {
        const { lng, lat } = e.lngLat;
        const byte = state.overlay === 'radar' ? radarGl?.sample(lng, lat) : null;
        weatherPopup(lng, lat, byte == null ? null : rainRate(byte));
      }
    });
    for (const l of interactive) {
      map.on('mouseenter', l, () => (map!.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', l, () => (map!.getCanvas().style.cursor = ''));
    }
  }

  // ----- the HUD ------------------------------------------------------------
  hud = createHud({
    apply: applyKarte,
    info: layerInfo,
    legend: legendInfo,
    events: eventList,
    families,
    view: (): KView => {
      const c = map?.getCenter();
      return { center: c ? [+c.lng.toFixed(3), +c.lat.toFixed(3)] : [...state.center], zoom: +(map?.getZoom() ?? state.zoom).toFixed(1) };
    },
    goTo(v) {
      if (map && ready) map.flyTo({ center: v.center, zoom: v.zoom, speed: 1.4, essential: true });
      else {
        state.center = [...v.center];
        state.zoom = v.zoom;
        if (map) pendingFocus = { lat: v.center[1], lon: v.center[0], zoom: v.zoom };
      }
    },
    async placeName(v) {
      // any point on the map: Nominatim (BigDataCloud may only be asked for the own position)
      const p = await reverseGeocodePoint(v.center[1], v.center[0]);
      return p.name && p.name !== 'Ausgewählter Ort' ? p.name : undefined;
    },
    onPlace(p) {
      store.setLastPlace(p);
      focusPlace(p.lat, p.lon, 7, true);
    },
    openSettings,
    layout: () => applyPadding(true),
    dock: () => dockEl,
    placeClosed: () => setData('marker', []),
  });
  el.appendChild(hud.el);
  mountRawDataLink(hud.el.querySelector<HTMLElement>('.hud-tr')!, 'button', { cls: 'hud-ibtn' });
  hud.relayout();
  {
    const k = hud.current();
    if (k.view) {
      state.center = [...k.view.center];
      state.zoom = k.view.zoom;
    }
    applyKarte(k);
  }

  return {
    el,
    activate(focus) {
      if (focus?.projection) {
        if (map) setProjection(focus.projection);
        else state.projection = focus.projection;
      }
      hud?.importShared(new URLSearchParams(location.hash.split('?')[1] ?? '').get('k'));
      if (!map) {
        initMap();
      } else {
        map.resize();
        if (state.wind && needsModel()) wind?.start();
        extras?.resume();
      }
      const hasPos = focus?.lat != null && focus?.lon != null;
      if (hasPos && focus?.fromSpace && map && ready) {
        // coming back from the solar system: start far out and dive in
        map.jumpTo({ center: [focus!.lon!, focus!.lat!], zoom: map.getMinZoom() });
        map.easeTo({ zoom: focus!.zoom ?? 2.2, duration: 1600 });
      } else if (hasPos) focusPlace(focus!.lat!, focus!.lon!, focus!.zoom ?? 6, !focus!.fromSpace);
      clearInterval(refreshTimer);
      refreshTimer = window.setInterval(() => {
        ensureFeeds(true);
        if (state.overlay === 'radar') ensureRadar();
      }, REFRESH_MS);
      // Live image layers: bust the tile cache so new scans appear (DWD radar: every 5 min)
      clearInterval(liveTimer);
      liveTimer = window.setInterval(() => {
        if (!map || document.hidden) return;
        if (state.overlay === 'sat-hd' && hdSat !== HD_SAT) void updateHdSource(); // NOAA-21 may be back
        const t = `&_t=${Math.floor(Date.now() / 300000)}`;
        // EUMETSAT layers get their own TIME parameter in the URL (newest published scan);
        // only static-URL sources need the generic cache buster.
        const live: Record<string, (() => string) | string> = {
          'dwd-radar': DWD_RADAR_WMS,
          'sat-ir': eumetsatIr,
          'sat-storm': eumetsatStorm,
          imerg: IMERG_WMS,
        };
        const url = live[state.overlay];
        if (url) (map.getSource(state.overlay) as RasterTileSource).setTiles([typeof url === 'function' ? url() : url + t]);
      }, 5 * 60000);
    },
    deactivate() {
      clearInterval(refreshTimer);
      clearInterval(liveTimer);
      stopAnimation();
      wind?.stop();
      extras?.stop();
      hideReadout();
      popup?.remove();
    },
  };
}
