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
import { getCurrent, reverseGeocode } from '../api/openmeteo';
import { inEurope, loadEmsc } from '../api/europe';
import { EXTRA_CLICK_LAYERS, EXTRAS, ExtraLayers, type ExtraId } from '../globe/extras';
import { labelPaint } from '../globe/vector';
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
import { BASES, BLACK_MARBLE, BLUE_MARBLE, buildStyle, DWD_RADAR_WMS, EUMETSAT_IR, gibsDate, gibsFires, gibsTrueColor, IMERG_WMS, type BaseId } from '../globe/style';
import { createSearch, locate } from '../search';
import { builtInProxy } from '../api/proxy';
import { store, type Place } from '../store';
import { compass, debounce, escapeHtml, fmt, safeUrl, toast } from '../util';
import { describe, weatherIcon } from '../weather';

// ---------------------------------------------------------------------------
// Configuration

type LiveId = 'radar' | 'dwd-radar' | 'sat-ir' | 'imerg' | 'sst' | 'seaice';
type OverlayId = 'none' | FieldId | LiveId | `owm-${string}`;


type PanelTab = 'weather' | 'events' | 'traffic';

/** Weather layers grouped into families; families with several variants get a switcher. */
const WX_FAMILIES: { id: string; label: string; hint: string; variants: [OverlayId, string][]; swatch?: string }[] = [
  { id: 'radar', label: 'Radar', hint: 'Live-Niederschlagsradar', variants: [['radar', 'Weltweit'], ['dwd-radar', 'Deutschland (DWD)']], swatch: 'linear-gradient(135deg,#88ddee,#0077aa,#ffee00,#ff4400)' },
  { id: 'sat', label: 'Satellit', hint: 'Live-Satellitendaten', variants: [['sat-ir', 'Wolken (IR)'], ['imerg', 'Niederschlag']], swatch: 'linear-gradient(135deg,#111,#888,#fff)' },
  { id: 'wind', label: 'Wind', hint: 'Vorhersage, mit Windpartikeln', variants: [['wind', 'Mittelwind'], ['gusts', 'Böen']] },
  { id: 'temp', label: 'Temperatur', hint: 'Vorhersage', variants: [['temp', 'Luft'], ['feels', 'Gefühlt'], ['dewpoint', 'Taupunkt']] },
  { id: 'precip', label: 'Niederschlag', hint: 'Vorhersage (Modell)', variants: [['precip', '']] },
  { id: 'cloud', label: 'Wolken', hint: 'Vorhersage: Bewölkung', variants: [['cloud', '']] },
  { id: 'pressure', label: 'Luftdruck', hint: 'Vorhersage', variants: [['pressure', '']] },
  { id: 'humidity', label: 'Feuchte', hint: 'Vorhersage: relative Luftfeuchtigkeit', variants: [['humidity', '']] },
  { id: 'snow', label: 'Schnee', hint: 'Vorhersage: Schneehöhe', variants: [['snow', '']] },
  { id: 'ocean', label: 'Ozean', hint: 'Satellit (NASA, täglich): Meerestemperatur & Meereis', variants: [['sst', 'Meerestemperatur'], ['seaice', 'Meereis']], swatch: 'linear-gradient(135deg,#2b2f8f,#2aa8c8,#f6d743,#e2462f)' },
  { id: 'cape', label: 'Gewitter', hint: 'Vorhersage: Gewitterenergie (CAPE)', variants: [['cape', '']] },
];
const familyOf = (o: OverlayId) => WX_FAMILIES.find((f) => f.variants.some(([v]) => v === o));

const isField = (o: string): o is FieldId => o in FIELDS;
/** extra-layer sections shown on the "Ereignisse" tab (the others are on "Verkehr") */
const isEventSection = (s: string) => s === 'europe' || s === 'earth';

const OWM_LAYERS: { id: string; label: string }[] = [
  { id: 'temp_new', label: 'Temperatur (OWM)' },
  { id: 'precipitation_new', label: 'Niederschlag (OWM)' },
  { id: 'clouds_new', label: 'Wolken (OWM)' },
  { id: 'wind_new', label: 'Wind (OWM)' },
  { id: 'pressure_new', label: 'Luftdruck (OWM)' },
];

type GroupId = 'fires' | 'hotspots' | 'storms' | 'tornado' | 'quakes' | 'volcanoes' | 'floods' | 'ice';
type FeedId = 'eonet' | 'gdacs' | 'usgs' | 'emsc' | 'nws' | 'spc' | 'firms';

const GROUPS: { id: GroupId; label: string; hint: string; icon: EventKind; feeds: FeedId[] }[] = [
  { id: 'fires', label: 'Waldbrände', hint: 'NASA EONET, GDACS', icon: 'fire', feeds: ['eonet', 'gdacs'] },
  { id: 'hotspots', label: 'Feuer-Hotspots', hint: 'NASA FIRMS Satellit (VIIRS)', icon: 'heat', feeds: [] },
  { id: 'storms', label: 'Stürme & Zyklone', hint: 'mit Zugbahnen – EONET, GDACS', icon: 'storm', feeds: ['eonet', 'gdacs'] },
  { id: 'tornado', label: 'Tornados & Unwetter (USA)', hint: 'NWS-Warnungen, SPC-Meldungen', icon: 'tornado', feeds: ['nws', 'spc'] },
  { id: 'quakes', label: 'Erdbeben', hint: '7 Tage – Europa ab M1.5 (EMSC), weltweit ab M2.5 (USGS)', icon: 'quake', feeds: ['usgs', 'emsc'] },
  { id: 'volcanoes', label: 'Vulkane', hint: 'aktive Ausbrüche – EONET, GDACS', icon: 'volcano', feeds: ['eonet', 'gdacs'] },
  { id: 'floods', label: 'Fluten, Dürren & Erdrutsche', hint: 'GDACS, EONET', icon: 'flood', feeds: ['eonet', 'gdacs'] },
  { id: 'ice', label: 'Eis, Schnee, Staub & Hitze', hint: 'Eisberge, Sandstürme – EONET', icon: 'ice', feeds: ['eonet'] },
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

interface GlobeState {
  base: BaseId;
  labels: boolean;
  night: boolean;
  overlay: OverlayId;
  /** wind particle animation */
  wind: boolean;
  isobars: boolean;
  extras: Partial<Record<ExtraId, boolean>>;
  groups: Partial<Record<GroupId, boolean>>;
  projection: 'globe' | 'mercator';
  center: [number, number];
  zoom: number;
  panelOpen: boolean;
  panelTab?: PanelTab;
  /** last chosen variant per weather family (e.g. temp → feels) */
  variants?: Partial<Record<string, OverlayId>>;
  version?: number;
}

const DEFAULT_STATE: GlobeState = {
  base: 'satellite',
  labels: true,
  night: true,
  overlay: 'wind',
  wind: true,
  isobars: false,
  extras: { cities: true, dwdwarn: true },
  groups: { fires: true, storms: true, tornado: true, quakes: true, volcanoes: true },
  projection: 'mercator',
  center: [store.getLastPlace().lon, store.getLastPlace().lat],
  zoom: 5,
  panelOpen: window.innerWidth > 720,
};

const REFRESH_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------

export interface GlobeView {
  el: HTMLElement;
  activate(focus?: { lat?: number; lon?: number; zoom?: number; projection?: 'globe' | 'mercator'; fromSpace?: boolean }): void;
  deactivate(): void;
}

export function createGlobeView(onOpenForecast: (p: Place) => void, onOpenSpace: (lat: number, lon: number) => void): GlobeView {
  const STATE_VERSION = 3;
  const saved = store.getGlobeState<Partial<GlobeState>>({});
  // v2: 2D map became the default view – reset the projection of older saved states once.
  if ((saved.version ?? 1) < 2) Object.assign(saved, { projection: 'mercator', overlay: 'wind', wind: true });
  // v3: European data & infrastructure layers – enable city weather and DWD warnings once.
  if ((saved.version ?? 1) < 3) {
    const oldDwd = (saved.groups as Record<string, boolean> | undefined)?.dwd;
    saved.extras = { cities: true, dwdwarn: oldDwd ?? true, ...saved.extras };
  }
  saved.version = STATE_VERSION;
  const state: GlobeState = { ...DEFAULT_STATE, ...saved };
  state.groups = { ...state.groups };
  state.extras = { ...state.extras };
  // "Feuer" combines wildfires and satellite hotspots
  if (state.groups.fires && state.groups.hotspots === undefined) state.groups.hotspots = true;
  const save = () => store.setGlobeState(state);

  const el = document.createElement('main');
  el.className = 'view globe-view';
  el.innerHTML = `
    <div class="map" id="map"></div>
    <div class="globe-top">
      <button class="btn icon-btn panel-toggle" aria-label="Ebenen" title="Ebenen" aria-expanded="${state.panelOpen}">
        <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>
      </button>
      <div class="globe-search"></div>
      <button class="btn icon-btn settings-btn" aria-label="Einstellungen" title="Einstellungen">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
      </button>
    </div>
    <aside class="panel" ${state.panelOpen ? '' : 'hidden'}></aside>
    <div class="base-switch"></div>
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

  const panel = el.querySelector<HTMLElement>('.panel')!;
  const legend = el.querySelector<HTMLElement>('.legend')!;
  const timeline = el.querySelector<HTMLElement>('.timeline')!;
  const panelToggle = el.querySelector<HTMLButtonElement>('.panel-toggle')!;

  el.querySelector('.globe-search')!.appendChild(
    createSearch((p) => { store.setLastPlace(p); focusPlace(p.lat, p.lon, 7, true); }, 'Ort suchen und hinfliegen …'),
  );
  panelToggle.addEventListener('click', () => {
    state.panelOpen = panel.hidden;
    panel.hidden = !state.panelOpen;
    panelToggle.setAttribute('aria-expanded', String(state.panelOpen));
    applyPadding(true);
    save();
  });

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
          syncEventSources();
          renderPanel();
        });
    }
    renderPanel();
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
    switch (id) {
      case 'quakes':
        return feedData.usgs.at || feedData.emsc.at
          ? emscPoints.length + quakePoints.filter((q) => !emscPoints.length || !inEurope(q.geometry.coordinates[0], q.geometry.coordinates[1])).length
          : null;
      case 'tornado':
        return feedData.nws.at || feedData.spc.at ? nwsPoints.length + spcPoints.length : null;
      case 'hotspots':
        return firmsCount || null;
      default: {
        if (!feedData.eonet.at && !feedData.gdacs.at) return null;
        return [...eonetPoints, ...gdacsPoints].filter((f) => KIND_GROUP[f.properties.kind] === id).length;
      }
    }
  }

  // ----- panel -------------------------------------------------------------
  function renderPanel() {
    const scrollTop = panel.querySelector('.panel-scroll')?.scrollTop ?? 0;
    const tab: PanelTab = state.panelTab ?? 'weather';
    const keys = store.getKeys();
    const fieldSwatch = (f: FieldId) => {
      const { stops, gradient } = FIELDS[f].legend;
      return gradient ?? `linear-gradient(135deg, ${stops.map(([, c]) => c).join(', ')})`;
    };
    const famSwatch = (f: (typeof WX_FAMILIES)[number]) => f.swatch ?? fieldSwatch(f.variants[0][0] as FieldId);
    const activeFam = familyOf(state.overlay);
    const loading = (g: (typeof GROUPS)[number]) => g.feeds.some((f) => feedData[f].loading);

    // counts of active layers per tab (shown on the tab buttons)
    const groupOn = (id: GroupId) => !!state.groups[id];
    const extraOn = (id: ExtraId) => !!state.extras[id];
    const evCount = GROUPS.filter((g) => g.id !== 'hotspots' && groupOn(g.id)).length + EXTRAS.filter((d) => isEventSection(d.section) && extraOn(d.id)).length;
    const trCount = EXTRAS.filter((d) => !isEventSection(d.section) && extraOn(d.id)).length;
    const wxCount = (state.overlay !== 'none' ? 1 : 0) + (state.wind && !FIELDS[state.overlay as FieldId]?.particles ? 1 : 0) + (state.isobars ? 1 : 0);

    const tile = (attrs: string, on: boolean, icon: string, label: string, title: string, badge = '') =>
      `<button type="button" class="ltile ${on ? 'on' : ''}" ${attrs} aria-pressed="${on}" title="${escapeHtml(title)}">
        ${icon}<span class="ltile-label">${escapeHtml(label)}</span>${badge}</button>`;

    // ----- Wetter
    const weather = `
      <div class="tile-grid three">
        ${WX_FAMILIES.map((f) =>
          tile(`data-fam="${f.id}"`, activeFam?.id === f.id, `<span class="swatch" style="background:${famSwatch(f)}"></span>`, f.label, f.hint),
        ).join('')}
        ${keys.owm ? tile('data-fam="owm"', state.overlay.startsWith('owm-'), '<span class="swatch" style="background:linear-gradient(135deg,#556,#99a)"></span>', 'OWM', 'OpenWeatherMap-Karten') : ''}
      </div>
      ${
        activeFam && activeFam.variants.length > 1
          ? `<div class="seg-row" role="radiogroup" aria-label="Variante">${activeFam.variants
              .map(([v, l]) => `<button type="button" class="seg-chip ${state.overlay === v ? 'on' : ''}" data-variant="${v}">${escapeHtml(l)}</button>`)
              .join('')}</div>`
          : state.overlay.startsWith('owm-')
            ? `<div class="seg-row">${OWM_LAYERS.map((l) => `<button type="button" class="seg-chip ${state.overlay === `owm-${l.id}` ? 'on' : ''}" data-variant="owm-${l.id}">${escapeHtml(l.label.replace(' (OWM)', ''))}</button>`).join('')}</div>`
            : ''
      }
      <div class="seg-row extras-row">
        <button type="button" class="seg-chip toggle ${state.wind ? 'on' : ''}" data-toggle="wind" aria-pressed="${state.wind}">Windpartikel</button>
        <button type="button" class="seg-chip toggle ${state.isobars ? 'on' : ''}" data-toggle="isobars" aria-pressed="${state.isobars}">Isobaren</button>
      </div>
      <p class="small muted panel-meta">${
        modelLoading ? 'Vorhersagedaten werden geladen …' : globalModel ? 'Vorhersage bis +5 Tage – Zeitleiste unten' : ''
      }</p>
      ${modelErrorText && !globalModel ? `<p class="small panel-error">${escapeHtml(modelErrorText)}</p>` : ''}`;

    // ----- Ereignisse (incl. Europe)
    const groupTiles = GROUPS.filter((g) => g.id !== 'hotspots')
      .map((g) => {
        const on = groupOn(g.id);
        const count = groupCount(g.id);
        const label = g.id === 'fires' ? 'Feuer' : g.label.replace(' & Zyklone', '').replace(' & Unwetter (USA)', ' (USA)').replace(', Dürren & Erdrutsche', ' & Dürren').replace(', Schnee, Staub & Hitze', ' & Staub');
        const hint = g.id === 'fires' ? 'Waldbrände (EONET, GDACS) und Satelliten-Hotspots (NASA FIRMS)' : `${g.label} – ${g.hint}`;
        const badge = `<span class="ltile-badge">${on && loading(g) ? '…' : on && count != null ? count : ''}</span>`;
        return tile(`data-group="${g.id}"`, on, glyphSvg(g.icon, kindColor(g.icon), 20), label, hint, badge);
      })
      .join('');
    const extraTiles = (sec: string) =>
      EXTRAS.filter((d) => d.section === sec)
        .map((d) => tile(`data-extra="${d.id}"`, extraOn(d.id), glyphSvg(d.glyph, d.color, 20), d.label, `${d.label} – ${d.hint}`, `<span class="ltile-badge" data-badge-for="${d.id}">${extras?.badge(d.id) ?? ''}</span>`))
        .join('');
    const events = `
      <h3>Naturereignisse</h3>
      <div class="tile-grid">${groupTiles}</div>
      <h3>Europa & Messwerte</h3>
      <div class="tile-grid">${extraTiles('europe')}</div>
      <h3>Erde & Umwelt</h3>
      <div class="tile-grid">${extraTiles('earth')}</div>`;
    const traffic = `
      <h3>Luftraum & Weltraum</h3>
      <div class="tile-grid">${extraTiles('air')}</div>
      <h3>Verkehr & Infrastruktur</h3>
      <div class="tile-grid">${extraTiles('infra')}</div>
      <h3>Verkehrsnetze</h3>
      <div class="tile-grid">${extraTiles('networks')}</div>
      <h3>Kameras &amp; Radio</h3>
      <div class="tile-grid">${extraTiles('cams')}</div>`;

    const tabBtn = (id: PanelTab, label: string, n: number) =>
      `<button type="button" role="tab" class="ptab ${tab === id ? 'on' : ''}" data-tab="${id}" aria-selected="${tab === id}">${label}${n ? `<span class="ptab-n">${n}</span>` : ''}</button>`;

    panel.innerHTML = `
      <div class="ptabs" role="tablist">
        ${tabBtn('weather', 'Wetter', wxCount)}${tabBtn('events', 'Ereignisse', evCount)}${tabBtn('traffic', 'Verkehr', trCount)}
      </div>
      <div class="panel-scroll">
        ${tab === 'weather' ? weather : tab === 'events' ? events : traffic}
        <div class="panel-notes"></div>
      </div>`;
    panel.querySelector('.panel-scroll')!.scrollTop = scrollTop;
    updateBadges();

    panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        state.panelTab = b.dataset.tab as PanelTab;
        panel.querySelector('.panel-scroll')!.scrollTop = 0;
        renderPanel();
        save();
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-fam]').forEach((b) =>
      b.addEventListener('click', () => {
        const fam = b.dataset.fam!;
        if (fam === 'owm') setOverlay(state.overlay.startsWith('owm-') ? 'none' : (`owm-${OWM_LAYERS[0].id}` as OverlayId));
        else if (activeFam?.id === fam) setOverlay('none');
        else {
          const f = WX_FAMILIES.find((x) => x.id === fam)!;
          setOverlay(state.variants?.[fam] ?? f.variants[0][0]);
        }
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach((b) =>
      b.addEventListener('click', () => setOverlay(b.dataset.variant as OverlayId)),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => {
        const opt = b.dataset.toggle as 'wind' | 'isobars';
        state[opt] = !state[opt];
        applyModelLayers();
        renderPanel();
        save();
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-group]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.group as GroupId;
        const on = !state.groups[id];
        state.groups[id] = on;
        if (id === 'fires') state.groups.hotspots = on; // "Feuer" = Waldbrände + Hotspots
        applyGroups();
        ensureFeeds();
        renderPanel();
        save();
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-extra]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.extra as ExtraId;
        const on = !state.extras[id];
        state.extras[id] = on;
        extras?.toggle(id, on);
        renderPanel();
        save();
      }),
    );
  }

  function setOverlay(next: OverlayId) {
    const prev = state.overlay;
    state.overlay = next;
    const fam = familyOf(next);
    if (fam) state.variants = { ...state.variants, [fam.id]: next };
    // Wind layers bring their particles along (like zoom.earth); leaving them removes them again.
    const windy = (o: OverlayId) => isField(o) && !!FIELDS[o].particles;
    if (windy(next) && !windy(prev)) state.wind = true;
    else if (!windy(next) && windy(prev)) state.wind = false;
    applyOverlay();
    renderPanel();
    save();
  }

  // ----- base map switcher (Google-Maps style) ------------------------------
  const baseSwitch = el.querySelector<HTMLDivElement>('.base-switch')!;
  const BASE_THUMB: Record<BaseId, string> = {
    satellite: `<img alt="" loading="lazy" src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/4"/>`,
    nasa: `<img alt="" loading="lazy" src="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${gibsDate(1)}/GoogleMapsCompatible_Level9/3/2/4.jpg"/>`,
    blue: `<img alt="" loading="lazy" src="${BLUE_MARBLE.replace('{z}/{y}/{x}', '3/2/4')}"/>`,
    night: `<img alt="" loading="lazy" src="${BLACK_MARBLE.replace('{z}/{y}/{x}', '3/2/4')}"/>`,
    dark: miniMap('#111827', '#0b1a2e', '#3a4767', '#56638a'),
    light: miniMap('#f3f0ea', '#a9cce9', '#f7d9a0', '#9c87b5'),
  };
  function miniMap(land: string, water: string, road: string, border: string) {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${water}"/>
      <path d="M0 10 C10 6 18 12 26 9 S40 4 46 12 S56 22 64 18 V64 H34 C30 56 22 58 18 50 S6 46 0 50Z" fill="${land}"/>
      <path d="M44 40 C50 36 58 40 60 46 S52 58 46 54 S40 44 44 40Z" fill="${water}"/>
      <path d="M6 30 L24 26 L38 34 L58 30 M20 14 L28 40 L24 62" stroke="${road}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M2 40 C14 36 20 42 30 38 S44 24 52 26" stroke="${border}" stroke-width="1" stroke-dasharray="3 2" fill="none"/></svg>`;
  }
  function renderBaseSwitch(open = false) {
    const cur = state.base;
    baseSwitch.innerHTML = `
      <button type="button" class="base-current" aria-expanded="${open}" title="Kartentyp wählen">
        <span class="thumb">${BASE_THUMB[cur]}</span>
        <span class="base-current-label"><svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>Karte</span>
      </button>
      <div class="base-pop" ${open ? '' : 'hidden'}>
        <div class="base-options">
          ${BASES.map(
            (b) => `<button type="button" class="base-opt ${cur === b.id ? 'on' : ''}" data-base="${b.id}" aria-pressed="${cur === b.id}">
              <span class="thumb">${BASE_THUMB[b.id]}</span><span>${b.label}</span></button>`,
          ).join('')}
        </div>
        <div class="base-toggles">
          <label><input type="checkbox" data-opt="labels" ${state.labels ? 'checked' : ''}/> Ortsnamen & Grenzen</label>
          <label><input type="checkbox" data-opt="night" ${state.night ? 'checked' : ''}/> Tag/Nacht</label>
        </div>
      </div>`;
    const pop = baseSwitch.querySelector<HTMLDivElement>('.base-pop')!;
    const btn = baseSwitch.querySelector<HTMLButtonElement>('.base-current')!;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      btn.setAttribute('aria-expanded', String(!pop.hidden));
    });
    baseSwitch.querySelectorAll<HTMLButtonElement>('[data-base]').forEach((b) =>
      b.addEventListener('click', () => {
        state.base = b.dataset.base as BaseId;
        applyBase();
        renderBaseSwitch(true);
        save();
      }),
    );
    baseSwitch.querySelectorAll<HTMLInputElement>('input[data-opt]').forEach((i) =>
      i.addEventListener('change', () => {
        const opt = i.dataset.opt as 'labels' | 'night';
        state[opt] = i.checked;
        if (opt === 'labels') applyBase();
        else applyNight();
        save();
      }),
    );
  }
  renderBaseSwitch();
  document.addEventListener('click', (e) => {
    if (!baseSwitch.contains(e.target as Node)) {
      const pop = baseSwitch.querySelector<HTMLDivElement>('.base-pop');
      if (pop && !pop.hidden) renderBaseSwitch(false);
    }
  });

  // ----- settings dialog (API keys, sources) --------------------------------
  const settings = el.querySelector<HTMLDialogElement>('.settings-dialog')!;
  el.querySelector('.settings-btn')!.addEventListener('click', () => {
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
        <h3>Nahverkehr live (optional)</h3>
        <label class="field-label">Transport Victoria <small>(KeyId von opendata.transport.vic.gov.au – Melbourne: Züge, Trams, Busse)</small>
          <input type="password" data-key="victoria" value="${escapeHtml(keys.victoria ?? '')}" placeholder="KeyId" autocomplete="off"/></label>
        <label class="field-label">CTA Train Tracker <small>(Chicago „L“-Bahnen)</small>
          <input type="password" data-key="cta" value="${escapeHtml(keys.cta ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">Trafiklab <small>(„GTFS Regional Realtime“ – Busse & Bahnen in Schweden)</small>
          <input type="password" data-key="trafiklab" value="${escapeHtml(keys.trafiklab ?? '')}" placeholder="API-Key" autocomplete="off"/></label>
        <label class="field-label">Daten-Proxy <small>(Cloudflare Worker für Flugdaten & OpenStreetMap – Anleitung im README${builtInProxy() ? '; leer lassen = eingebauter Proxy' : ''})</small>
          <input type="url" data-key="adsbProxy" value="${escapeHtml(keys.adsbProxy ?? '')}" placeholder="${escapeHtml(builtInProxy() || 'https://mein-proxy.workers.dev/')}" autocomplete="off"/></label>
        <h3>Datenquellen</h3>
        <p class="small muted">Open-Meteo, RainViewer, DWD, EUMETSAT, NASA (GPM, EONET, GIBS, FIRMS), USGS, EMSC, NOAA/NWS, GDACS,
        PEGELONLINE, Copernicus CAMS, adsb.lol, adsb.fi, airplanes.live, OpenSky Network, SondeHub, Fintraffic Digitraffic (Straße, Schiene, See), Windy Webcams, DeFlock/deflock-data, NOAA SWPC, Smithsonian GVP, NIFC, NOAA Tsunami, BfS ODL, Safecast,
        The Space Devs, aisstream.io, NASA GHRSST/AMSR2, Waymarked Trails, Wikidata, USGS MRDS, BGR, Macrostrat, ESA WorldCover, Radio Browser, TfL, Caltrans, Transitous, Amtraker, Entur, MBTA, SEPTA, TTC, data.gov.my, Transport Victoria, CTA, Trafiklab, OpenRailwayMap, Autobahn GmbH, NINA/BBK, CelesTrak, TeleGeography, PeeringDB, WRI, OpenStreetMap/OpenFreeMap.
        Ein Klick auf die Karte zeigt das aktuelle Wetter an dieser Stelle.</p>
        <div class="dialog-actions">
          <button class="btn small" value="cancel" formnovalidate>Abbrechen</button>
          <button class="btn small primary" value="save">Speichern</button>
        </div>
      </form>`;
    settings.showModal();
    settings.querySelector('form')!.addEventListener('submit', (e) => {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value !== 'save') return;
      const get = (k: string) => settings.querySelector<HTMLInputElement>(`input[data-key=${k}]`)!.value.trim() || undefined;
      const proxy = get('adsbProxy');
      store.setKeys({ owm: get('owm'), firms: get('firms'), windy: get('windy'), aisstream: get('aisstream'), victoria: get('victoria'), cta: get('cta'), trafiklab: get('trafiklab'), nps: get('nps'), adsbProxy: proxy && /^https:\/\//.test(proxy) ? proxy : undefined });
      feedData.firms.at = 0;
      firmsOk = false;
      if (state.overlay.startsWith('owm-') && !get('owm')) state.overlay = 'none';
      applyOverlay();
      applyGroups();
      ensureFeeds();
      extras?.resume();
      renderPanel();
      toast('Einstellungen gespeichert');
    });
  });

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

  /** Keep the globe centred in the free area next to the layer panel on wide screens. */
  function applyPadding(animate = false) {
    if (!map) return;
    const left = state.panelOpen && window.innerWidth > 720 ? panel.offsetWidth + 12 : 0;
    if (animate) map.easeTo({ padding: { left, top: 0, right: 0, bottom: 0 }, duration: 300 });
    else map.setPadding({ left, top: 0, right: 0, bottom: 0 });
  }

  const vis = (id: string, on: boolean) => {
    if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  };

  /** Update counts/notes of the extra layers without re-rendering the whole panel. */
  function updateBadges() {
    if (!extras) return;
    for (const d of EXTRAS) {
      const badge = panel.querySelector(`[data-badge-for="${d.id}"]`);
      if (badge) badge.textContent = extras.badge(d.id);
    }
    // hints like "zoom in to see aircraft" for the layers on the current tab
    const tab = state.panelTab ?? 'weather';
    const notes = EXTRAS.filter((d) => (tab === 'events' ? isEventSection(d.section) : tab === 'traffic' ? !isEventSection(d.section) : false))
      .map((d) => [d.label, extras!.note(d.id)] as const)
      .filter(([, n]) => n);
    const box = panel.querySelector('.panel-notes');
    if (box) box.innerHTML = notes.map(([l, n]) => `<p class="small note">${escapeHtml(l)}: ${escapeHtml(n!)}</p>`).join('');
  }

  function applyBase() {
    if (!map) return;
    for (const b of BASES) vis(`base-${b.id}`, state.base === b.id);
    const layers = map.getStyle().layers;
    for (const l of layers) {
      if (l.id.startsWith('vbase-dark-')) vis(l.id, state.base === 'dark');
      else if (l.id.startsWith('vbase-light-')) vis(l.id, state.base === 'light');
      else if (l.id.startsWith('lbl-')) vis(l.id, state.labels);
    }
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
    vis('hotspots', !!state.groups.hotspots && !firmsOk);
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
    renderPanel();
    renderLegend();
  }

  async function ensureModel(): Promise<boolean> {
    modelLoading = !globalModel;
    if (modelLoading) {
      renderPanel();
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
        renderPanel();
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

  function setGeo(source: string, data: FeatureCollection) {
    (map?.getSource(source) as GeoJSONSource | undefined)?.setData(data);
  }

  async function applyOverlay() {
    if (!map) return;
    const o = state.overlay;
    stopAnimation();
    vis('field', false);
    vis('sat-ir', o === 'sat-ir');
    vis('dwd-radar', o === 'dwd-radar');
    vis('imerg', o === 'imerg');
    vis('sst', o === 'sst');
    vis('seaice', o === 'seaice');
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
        const old = radar;
        radar = await loadRadarFrames();
        radarAt = Date.now();
        old?.frames.forEach((f) => {
          if (map!.getLayer(`radar-${f.time}`)) map!.removeLayer(`radar-${f.time}`);
          if (map!.getSource(`radar-${f.time}`)) map!.removeSource(`radar-${f.time}`);
        });
      } catch {
        toast('Regenradar (RainViewer) konnte nicht geladen werden.', 'error');
        return;
      }
    }
    if (state.overlay !== 'radar' || !radar.frames.length) return;
    for (const f of radar.frames) {
      const id = `radar-${f.time}`;
      if (map.getSource(id)) continue;
      map.addSource(id, {
        type: 'raster',
        tiles: [`${radar.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`],
        tileSize: 256,
        maxzoom: 7,
        attribution: 'Radar © <a href="https://www.rainviewer.com/">RainViewer</a>',
      });
      map.addLayer(
        { id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } },
        'anchor-weather',
      );
    }
    showRadarFrame(lastPastRadarFrame());
    setRadarVisible(true);
  }

  const lastPastRadarFrame = () => Math.max(0, (radar?.frames.filter((f) => !f.nowcast).length ?? 1) - 1);

  function setRadarVisible(on: boolean) {
    if (!radar || !map) return;
    for (const f of radar.frames) vis(`radar-${f.time}`, on);
  }

  function showRadarFrame(i: number) {
    if (!radar || !map) return;
    radarIdx = i;
    radar.frames.forEach((f, k) => {
      if (map!.getLayer(`radar-${f.time}`)) map!.setPaintProperty(`radar-${f.time}`, 'raster-opacity', k === i ? 0.8 : 0);
    });
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
    timeline.hidden = mode === 'none';
    if (mode === 'none') return;
    const times = mode === 'radar' ? radar!.frames.map((f) => f.time * 1000) : globalModel!.times;
    const idx = mode === 'radar' ? radarIdx : timeIdx;
    rangeEl.max = String(times.length - 1);
    rangeEl.value = String(idx);
    const t = times[idx];
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
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
    playBtn.setAttribute('aria-label', 'Abspielen');
  }

  rangeEl.addEventListener('input', () => {
    stopAnimation();
    setTimeIndex(Number(rangeEl.value));
  });
  nowBtn.addEventListener('click', () => {
    stopAnimation();
    if (timelineMode() === 'radar') showRadarFrame(lastPastRadarFrame());
    else if (globalModel) setTimeIndex(nearestTimeIndex(globalModel.times));
  });
  playBtn.addEventListener('click', () => {
    if (playTimer) return stopAnimation();
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    playBtn.setAttribute('aria-label', 'Pause');
    const radarMode = timelineMode() === 'radar';
    playTimer = window.setInterval(() => {
      const n = Number(rangeEl.max) + 1;
      setTimeIndex(((radarMode ? radarIdx : timeIdx) + 1) % n);
    }, radarMode ? 700 : 1100);
  });

  // ----- legend & readout --------------------------------------------------
  function renderLegend() {
    const o = state.overlay;
    let html = '';
    if (isField(o)) {
      const def = FIELDS[o];
      const { stops, ticks, gradient } = def.legend;
      const lo = stops[0][0];
      const hi = stops[stops.length - 1][0];
      const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
      const grad = gradient ?? `linear-gradient(90deg, ${stops.map(([v, c]) => `${c} ${pct(v).toFixed(1)}%`).join(', ')})`;
      html = `<div class="legend-title">${escapeHtml(def.label)} <small>${def.unit}${
        sampler ? ` · ${escapeHtml(timeLabel(sampler.time))}` : modelLoading ? ' · lädt …' : modelErrorText ? ` · ${escapeHtml(modelErrorText)}` : ''
      }</small></div>
        <div class="legend-bar" style="background:${grad}"></div>
        <div class="legend-ticks">${ticks.map((t) => `<span style="left:${pct(t)}%">${def.format(t)}</span>`).join('')}</div>`;
    } else if (o === 'radar') {
      html = `<div class="legend-title">Niederschlagsradar <small>live</small></div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#88ddee,#0099cc,#0077aa,#005588,#ffee00,#ffaa00,#ff4400,#c10000,#ffaaff)"></div>
        <div class="legend-ticks"><span style="left:0">leicht</span><span style="left:50%">mäßig</span><span style="left:100%">stark</span></div>`;
    } else if (o === 'dwd-radar') {
      html = `<div class="legend-title">Radar Deutschland <small>DWD · letzte Messung, alle 5 min aktualisiert</small></div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#a0e6ff,#4fb0ff,#2f6fe0,#2bd46f,#ffe14d,#ff8c1a,#e8384f,#b03ad6)"></div>
        <div class="legend-ticks"><span style="left:0">leicht</span><span style="left:50%">mäßig</span><span style="left:100%">Unwetter</span></div>`;
    } else if (o === 'sat-ir') {
      html = `<div class="legend-title">Satellit Infrarot <small>live · hohe, kalte Wolken erscheinen hell</small></div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#111,#777,#fff)"></div>
        <div class="legend-ticks"><span style="left:0">warm/tief</span><span style="left:100%">kalt/hoch</span></div>`;
    } else if (o === 'sst') {
      html = `<div class="legend-title">Meerestemperatur <small>NASA GHRSST MUR · Tagesmittel vor 2 Tagen · °C</small></div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#2b0f6b,#2b2f8f,#2a6fc8,#2aa8c8,#5fd0a0,#f6d743,#f39c33,#e2462f,#9e1a3a)"></div>
        <div class="legend-ticks"><span style="left:0">−2</span><span style="left:35%">10</span><span style="left:65%">20</span><span style="left:100%">32</span></div>`;
    } else if (o === 'seaice') {
      html = `<div class="legend-title">Meereis-Konzentration <small>NASA AMSR2 · vor 2 Tagen</small></div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#0b2a5b,#2d5f9a,#7fa8d6,#d7e6f5,#ffffff)"></div>
        <div class="legend-ticks"><span style="left:0">15 %</span><span style="left:50%">60 %</span><span style="left:100%">100 %</span></div>`;
    } else if (o === 'imerg') {
      html = `<div class="legend-title">Niederschlag Satellit <small>NASA IMERG · mm/h</small></div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#b4e3ff,#3c8fff,#28c76f,#ffe14d,#ff8c1a,#e8384f)"></div>
        <div class="legend-ticks"><span style="left:0">0,1</span><span style="left:50%">5</span><span style="left:100%">50+</span></div>`;
    }
    legend.innerHTML = html;
    legend.hidden = !html;
  }

  const readout = el.querySelector<HTMLDivElement>('.readout')!;
  const hideReadout = () => {
    readout.hidden = true;
  };
  function updateReadout(point: { x: number; y: number }, lngLat: { lng: number; lat: number }) {
    const o = state.overlay;
    if (!isField(o) || !sampler || !matchMedia('(pointer: fine)').matches) return hideReadout();
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
    readout.style.transform = `translate(${point.x + 14}px, ${point.y + 14}px)`;
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

  function openPopup(lngLat: { lng: number; lat: number }, html: string) {
    popup?.remove();
    const node = document.createElement('div');
    node.innerHTML = html;
    popup = new Popup({ maxWidth: '320px', className: 'wx-popup' }).setLngLat(lngLat).setDOMContent(node).addTo(map!);
    return node;
  }

  async function weatherPopup(lng: number, lat: number) {
    const node = openPopup({ lng, lat }, `<div class="pop"><div class="pop-sub">${fmt.coords(lat, lng)}</div><div class="pop-loading">Lade Wetter …</div></div>`);
    try {
      const w = await getCurrent(lat, lng);
      const c = w.current;
      node.innerHTML = `<div class="pop">
        <div class="pop-sub">${fmt.coords(lat, lng)} · ${Math.round(w.elevation)} m</div>
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
        <button class="btn small wide" data-act="open">Vorhersage öffnen →</button>
      </div>`;
      node.querySelector('[data-act=open]')!.addEventListener('click', async () => {
        onOpenForecast(await reverseGeocode(lat, lng));
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
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

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
    let outTicks = 0;
    let outTimer = 0;
    map.getContainer().addEventListener(
      'wheel',
      (e) => {
        if (!map || state.projection !== 'globe' || e.deltaY <= 0 || map.getZoom() > map.getMinZoom() + 0.05) {
          outTicks = 0;
          return;
        }
        clearTimeout(outTimer);
        outTimer = window.setTimeout(() => (outTicks = 0), 900);
        if (++outTicks >= 4) {
          outTicks = 0;
          const c = map.getCenter();
          onOpenSpace(c.lat, c.lng);
        }
      },
      { passive: true },
    );
    map.addControl({ onAdd: () => projCtl, onRemove: () => projCtl.remove() }, 'top-right');

    const locCtl = document.createElement('div');
    locCtl.className = 'maplibregl-ctrl maplibregl-ctrl-group';
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
    map.addControl({ onAdd: () => locCtl, onRemove: () => locCtl.remove() }, 'top-right');

    map.on('load', () => {
      ready = true;
      registerEventIcons(map!);
      // NASA layer date = yesterday (today's swaths are still incomplete)
      (map!.getSource('nasa') as RasterTileSource).setTiles([gibsTrueColor(gibsDate(1))]);
      (map!.getSource('hotspots') as RasterTileSource).setTiles([gibsFires(fireDate)]);
      extras = new ExtraLayers(map!, { changed: updateBadges, toast: (m) => toast(m, 'error') });
      extras.init();
      extras.setEnabled((Object.keys(state.extras) as ExtraId[]).filter((id) => state.extras[id]));
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

    map.on('mousemove', (e) => updateReadout(e.point, e.lngLat));
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
      const layers = interactive.filter((l) => map!.getLayer(l));
      // a few pixels of tolerance makes small/moving objects easier to hit
      const box: [[number, number], [number, number]] = [
        [e.point.x - 4, e.point.y - 4],
        [e.point.x + 4, e.point.y + 4],
      ];
      const hits = map!.queryRenderedFeatures(box, { layers });
      const hit = hits.find((h) => !areaLayers.includes(h.layer.id)) ?? hits[0];
      extras?.clearSelection();
      const extraResult = hit && EXTRA_CLICK_LAYERS.includes(hit.layer.id) ? extras?.click(hit, e.lngLat) : null;
      if (extraResult?.type === 'weather') {
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
      } else {
        weatherPopup(e.lngLat.lng, e.lngLat.lat);
      }
    });
    for (const l of interactive) {
      map.on('mouseenter', l, () => (map!.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', l, () => (map!.getCanvas().style.cursor = ''));
    }
  }

  return {
    el,
    activate(focus) {
      if (focus?.projection) {
        if (map) setProjection(focus.projection);
        else state.projection = focus.projection;
      }
      if (!map) {
        renderPanel();
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
        const t = `&_t=${Math.floor(Date.now() / 300000)}`;
        const live: Record<string, string> = { 'dwd-radar': DWD_RADAR_WMS, 'sat-ir': EUMETSAT_IR, imerg: IMERG_WMS };
        const url = live[state.overlay];
        if (url) (map.getSource(state.overlay) as RasterTileSource).setTiles([url + t]);
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
