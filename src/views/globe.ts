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
  loadGdacs,
  loadNwsSevere,
  loadQuakes,
  loadRadarFrames,
  loadSpcTornadoReports,
  type EventFeature,
  type EventKind,
  type RadarFrames,
} from '../api/events';
import { getCurrent, getGlobalGrid, reverseGeocode, type Grid } from '../api/openmeteo';
import { glyphSvg, registerEventIcons } from '../globe/icons';
import { FIELDS, nightPolygon, registerFieldProtocol, setFieldGrid, WindParticles, type FieldId } from '../globe/overlay';
import { BASES, buildStyle, gibsDate, gibsFires, gibsTrueColor, type BaseId } from '../globe/style';
import { createSearch, locate } from '../search';
import { store, type Place } from '../store';
import { compass, escapeHtml, fmt, safeUrl, toast } from '../util';
import { describe, weatherIcon } from '../weather';

// ---------------------------------------------------------------------------
// Configuration

type OverlayId = 'none' | FieldId | 'radar' | `owm-${string}`;

const OWM_LAYERS: { id: string; label: string }[] = [
  { id: 'temp_new', label: 'Temperatur (OWM)' },
  { id: 'precipitation_new', label: 'Niederschlag (OWM)' },
  { id: 'clouds_new', label: 'Wolken (OWM)' },
  { id: 'wind_new', label: 'Wind (OWM)' },
  { id: 'pressure_new', label: 'Luftdruck (OWM)' },
];

type GroupId = 'fires' | 'hotspots' | 'storms' | 'tornado' | 'quakes' | 'volcanoes' | 'floods' | 'ice' | 'dwd';
type FeedId = 'eonet' | 'gdacs' | 'usgs' | 'nws' | 'spc' | 'firms';

const GROUPS: { id: GroupId; label: string; hint: string; icon: EventKind; feeds: FeedId[] }[] = [
  { id: 'fires', label: 'Waldbrände', hint: 'NASA EONET, GDACS', icon: 'fire', feeds: ['eonet', 'gdacs'] },
  { id: 'hotspots', label: 'Feuer-Hotspots', hint: 'NASA FIRMS Satellit (VIIRS)', icon: 'heat', feeds: [] },
  { id: 'storms', label: 'Stürme & Zyklone', hint: 'mit Zugbahnen – EONET, GDACS', icon: 'storm', feeds: ['eonet', 'gdacs'] },
  { id: 'tornado', label: 'Tornados & Unwetter (USA)', hint: 'NWS-Warnungen, SPC-Meldungen', icon: 'tornado', feeds: ['nws', 'spc'] },
  { id: 'quakes', label: 'Erdbeben', hint: 'USGS, letzte 7 Tage, ab M2.5', icon: 'quake', feeds: ['usgs'] },
  { id: 'volcanoes', label: 'Vulkane', hint: 'aktive Ausbrüche – EONET, GDACS', icon: 'volcano', feeds: ['eonet', 'gdacs'] },
  { id: 'floods', label: 'Fluten, Dürren & Erdrutsche', hint: 'GDACS, EONET', icon: 'flood', feeds: ['eonet', 'gdacs'] },
  { id: 'ice', label: 'Eis, Schnee, Staub & Hitze', hint: 'Eisberge, Sandstürme – EONET', icon: 'ice', feeds: ['eonet'] },
  { id: 'dwd', label: 'Unwetterwarnungen DE', hint: 'Deutscher Wetterdienst', icon: 'other', feeds: [] },
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
  wind: boolean;
  groups: Partial<Record<GroupId, boolean>>;
  projection: 'globe' | 'mercator';
  center: [number, number];
  zoom: number;
  panelOpen: boolean;
}

const DEFAULT_STATE: GlobeState = {
  base: 'satellite',
  labels: true,
  night: true,
  overlay: 'none',
  wind: false,
  groups: { fires: true, storms: true, tornado: true, quakes: true, volcanoes: true },
  projection: 'globe',
  center: [10, 30],
  zoom: 1.7,
  panelOpen: window.innerWidth > 720,
};

const REFRESH_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------

export interface GlobeView {
  el: HTMLElement;
  activate(focus?: { lat: number; lon: number; zoom?: number }): void;
  deactivate(): void;
}

export function createGlobeView(onOpenForecast: (p: Place) => void): GlobeView {
  const state: GlobeState = { ...DEFAULT_STATE, ...store.getGlobeState<Partial<GlobeState>>({}) };
  state.groups = { ...state.groups };
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
    </div>
    <aside class="panel" ${state.panelOpen ? '' : 'hidden'}></aside>
    <div class="globe-bottom">
      <div class="legend" hidden></div>
      <div class="timeline" hidden>
        <button class="btn icon-btn tl-play" aria-label="Abspielen"><svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg></button>
        <input type="range" class="tl-range" min="0" max="0" value="0" aria-label="Radarzeit"/>
        <span class="tl-time"></span>
      </div>
    </div>`;

  const panel = el.querySelector<HTMLElement>('.panel')!;
  const legend = el.querySelector<HTMLElement>('.legend')!;
  const timeline = el.querySelector<HTMLElement>('.timeline')!;
  const panelToggle = el.querySelector<HTMLButtonElement>('.panel-toggle')!;

  el.querySelector('.globe-search')!.appendChild(
    createSearch((p) => focusPlace(p.lat, p.lon, 7, true), 'Ort suchen und hinfliegen …'),
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
  let grid: Grid | null = null;
  let gridPromise: Promise<Grid> | null = null;
  let wind: WindParticles | null = null;
  let nightTimer = 0;
  let refreshTimer = 0;
  let popup: Popup | null = null;

  // ----- feeds -------------------------------------------------------------
  const feedData: Record<FeedId, { at: number; loading: Promise<void> | null; error?: string }> = {
    eonet: { at: 0, loading: null },
    gdacs: { at: 0, loading: null },
    usgs: { at: 0, loading: null },
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
  let firmsCount = 0;

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
      if (!key) return;
      const fc = await loadFirms(key);
      firmsCount = fc.features.length;
      (map?.getSource('firms') as GeoJSONSource | undefined)?.setData(fc);
    },
  };
  const FEED_NAMES: Record<FeedId, string> = {
    eonet: 'NASA EONET',
    gdacs: 'GDACS',
    usgs: 'USGS Erdbeben',
    nws: 'NWS (USA)',
    spc: 'SPC Tornado-Meldungen',
    firms: 'NASA FIRMS',
  };

  function ensureFeeds(force = false) {
    const needed = new Set<FeedId>();
    for (const g of GROUPS) if (state.groups[g.id]) g.feeds.forEach((f) => needed.add(f));
    if (state.groups.hotspots && store.getKeys().firms) needed.add('firms');
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
    setData('quakes', quakePoints);
    setData('nws-poly', nwsPolys);
    setData('tracks', eonetTracks.filter((t) => t.properties.kind === 'storm'));
  }

  function setData(source: string, features: Feature[]) {
    (map?.getSource(source) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features } as FeatureCollection);
  }

  function groupCount(id: GroupId): number | null {
    switch (id) {
      case 'quakes':
        return feedData.usgs.at ? quakePoints.length : null;
      case 'tornado':
        return feedData.nws.at || feedData.spc.at ? nwsPoints.length + spcPoints.length : null;
      case 'hotspots':
        return firmsCount || null;
      case 'dwd':
        return null;
      default: {
        if (!feedData.eonet.at && !feedData.gdacs.at) return null;
        return [...eonetPoints, ...gdacsPoints].filter((f) => KIND_GROUP[f.properties.kind] === id).length;
      }
    }
  }

  // ----- panel -------------------------------------------------------------
  function renderPanel() {
    const keys = store.getKeys();
    const overlays: { id: OverlayId; label: string }[] = [
      { id: 'none', label: 'Keine' },
      { id: 'radar', label: 'Regenradar (live)' },
      { id: 'temp', label: 'Temperatur' },
      { id: 'cloud', label: 'Bewölkung' },
      { id: 'precip', label: 'Niederschlag (Modell)' },
      { id: 'pressure', label: 'Luftdruck' },
      ...(keys.owm ? OWM_LAYERS.map((l) => ({ id: `owm-${l.id}` as OverlayId, label: l.label })) : []),
    ];
    const loading = (g: (typeof GROUPS)[number]) => g.feeds.some((f) => feedData[f].loading);
    panel.innerHTML = `
      <div class="panel-scroll">
        <h3>Karte</h3>
        <div class="seg" role="radiogroup" aria-label="Grundkarte">
          ${BASES.map((b) => `<label class="seg-btn ${state.base === b.id ? 'on' : ''}"><input type="radio" name="base" value="${b.id}" ${state.base === b.id ? 'checked' : ''}/>${b.label}</label>`).join('')}
        </div>
        <label class="row"><input type="checkbox" data-opt="labels" ${state.labels ? 'checked' : ''}/> Ortsnamen & Grenzen</label>
        <label class="row"><input type="checkbox" data-opt="night" ${state.night ? 'checked' : ''}/> Tag/Nacht-Grenze</label>
        <label class="row"><input type="checkbox" data-opt="projection" ${state.projection === 'globe' ? 'checked' : ''}/> 3D-Globus</label>

        <h3>Wetter</h3>
        <div class="radio-list" role="radiogroup" aria-label="Wetterebene">
          ${overlays.map((o) => `<label class="row"><input type="radio" name="overlay" value="${o.id}" ${state.overlay === o.id ? 'checked' : ''}/> ${escapeHtml(o.label)}</label>`).join('')}
        </div>
        <label class="row"><input type="checkbox" data-opt="wind" ${state.wind ? 'checked' : ''}/> Wind-Animation</label>
        ${grid ? `<p class="small muted">Modellstand: ${escapeHtml(fmt.dateTime(`${grid.time}Z`))}</p>` : ''}

        <h3>Ereignisse</h3>
        ${GROUPS.map((g) => {
          const count = groupCount(g.id);
          const color = g.id === 'dwd' ? '#e8384f' : kindColor(g.icon);
          return `<label class="row ev-row">
            <input type="checkbox" data-group="${g.id}" ${state.groups[g.id] ? 'checked' : ''}/>
            ${glyphSvg(g.icon, color)}
            <span class="ev-text"><span>${escapeHtml(g.label)}</span><small>${escapeHtml(g.hint)}</small></span>
            <span class="badge">${state.groups[g.id] && loading(g) ? '…' : count != null ? count : ''}</span>
          </label>`;
        }).join('')}

        <details class="keys">
          <summary>Erweitert: API-Schlüssel (optional)</summary>
          <p class="small muted">Alle Grundfunktionen laufen ohne Schlüssel. Mit kostenlosen Schlüsseln werden zusätzliche Quellen freigeschaltet.
          Schlüssel werden nur lokal im Browser gespeichert.</p>
          <label class="field-label">OpenWeatherMap <small>(hochauflösende Wetterkarten)</small>
            <input type="password" data-key="owm" value="${escapeHtml(keys.owm ?? '')}" placeholder="appid" autocomplete="off"/></label>
          <label class="field-label">NASA FIRMS MAP_KEY <small>(einzelne Feuer-Hotspots als Punkte)</small>
            <input type="password" data-key="firms" value="${escapeHtml(keys.firms ?? '')}" placeholder="MAP_KEY" autocomplete="off"/></label>
          <button class="btn small" data-act="save-keys">Speichern</button>
        </details>

        <p class="small muted attribution-note">Klick auf den Globus zeigt das aktuelle Wetter an diesem Ort.
        Daten: Open-Meteo, RainViewer, NASA (EONET, GIBS, FIRMS), USGS, NOAA/NWS, GDACS, DWD.</p>
      </div>`;

    panel.querySelectorAll<HTMLInputElement>('input[name=base]').forEach((i) =>
      i.addEventListener('change', () => {
        state.base = i.value as BaseId;
        applyBase();
        renderPanel();
        save();
      }),
    );
    panel.querySelectorAll<HTMLInputElement>('input[name=overlay]').forEach((i) =>
      i.addEventListener('change', () => {
        state.overlay = i.value as OverlayId;
        applyOverlay();
        save();
      }),
    );
    panel.querySelectorAll<HTMLInputElement>('input[data-opt]').forEach((i) =>
      i.addEventListener('change', () => {
        const opt = i.dataset.opt!;
        if (opt === 'projection') {
          state.projection = i.checked ? 'globe' : 'mercator';
          map?.setProjection({ type: state.projection });
        } else if (opt === 'labels' || opt === 'night' || opt === 'wind') {
          state[opt] = i.checked;
          if (opt === 'labels') applyBase();
          if (opt === 'night') applyNight();
          if (opt === 'wind') applyWind();
        }
        save();
      }),
    );
    panel.querySelectorAll<HTMLInputElement>('input[data-group]').forEach((i) =>
      i.addEventListener('change', () => {
        state.groups[i.dataset.group as GroupId] = i.checked;
        applyGroups();
        ensureFeeds();
        save();
      }),
    );
    panel.querySelector('[data-act=save-keys]')!.addEventListener('click', () => {
      const get = (k: string) => panel.querySelector<HTMLInputElement>(`input[data-key=${k}]`)!.value.trim() || undefined;
      store.setKeys({ owm: get('owm'), firms: get('firms') });
      feedData.firms.at = 0;
      if (state.overlay.startsWith('owm-') && !get('owm')) state.overlay = 'none';
      applyOverlay();
      applyGroups();
      ensureFeeds();
      toast('Schlüssel gespeichert');
    });
  }

  // ----- apply state to map -----------------------------------------------
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

  function applyBase() {
    for (const b of BASES) vis(`base-${b.id}`, state.base === b.id);
    vis('labels-dark', state.labels && state.base !== 'light');
    vis('labels-light', state.labels && state.base === 'light');
  }

  function applyNight() {
    clearInterval(nightTimer);
    vis('night', state.night);
    if (!state.night) return;
    const update = () => (map?.getSource('night') as GeoJSONSource | undefined)?.setData(nightPolygon());
    update();
    nightTimer = window.setInterval(update, 60000);
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
    vis('dwd', !!state.groups.dwd);
    const firmsKey = !!store.getKeys().firms;
    vis('firms', !!state.groups.hotspots && firmsKey);
    vis('hotspots', !!state.groups.hotspots && !firmsKey);
  }

  async function loadGrid(): Promise<Grid> {
    if (grid) return grid;
    gridPromise ??= getGlobalGrid().then((g) => {
      grid = g;
      setFieldGrid(g);
      renderPanel();
      return g;
    });
    try {
      return await gridPromise;
    } catch (e) {
      gridPromise = null;
      throw e;
    }
  }

  async function applyOverlay() {
    if (!map) return;
    const o = state.overlay;
    vis('field', false);
    setRadarVisible(o === 'radar');
    for (const l of OWM_LAYERS) vis(`owm-${l.id}`, false);
    renderLegend();

    if (o === 'temp' || o === 'cloud' || o === 'precip' || o === 'pressure') {
      try {
        await loadGrid();
      } catch {
        toast('Modelldaten (Open-Meteo) konnten nicht geladen werden.', 'error');
        return;
      }
      if (state.overlay !== o) return;
      (map.getSource('field') as RasterTileSource).setTiles([`wxfield://${o}/${grid!.time.replace(/\D/g, '')}/{z}/{x}/{y}`]);
      vis('field', true);
      renderLegend();
    } else if (o.startsWith('owm-')) {
      const layer = o.slice(4);
      const key = store.getKeys().owm;
      if (!key) return;
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
    } else if (o === 'radar') {
      await ensureRadar();
    }
  }

  async function applyWind() {
    if (!map) return;
    if (!state.wind) {
      wind?.stop();
      return;
    }
    try {
      await loadGrid();
    } catch {
      toast('Winddaten konnten nicht geladen werden.', 'error');
      return;
    }
    if (!state.wind) return;
    wind ??= new WindParticles(map, () => grid);
    wind.start();
  }

  // ----- radar -------------------------------------------------------------
  let radar: RadarFrames | null = null;
  let radarAt = 0;
  let radarIdx = 0;
  let radarTimer = 0;
  const rangeEl = timeline.querySelector<HTMLInputElement>('.tl-range')!;
  const timeEl = timeline.querySelector<HTMLSpanElement>('.tl-time')!;
  const playBtn = timeline.querySelector<HTMLButtonElement>('.tl-play')!;

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
    rangeEl.max = String(radar.frames.length - 1);
    const lastPast = radar.frames.filter((f) => !f.nowcast).length - 1;
    showRadarFrame(Math.max(0, lastPast));
    setRadarVisible(true);
  }

  function setRadarVisible(on: boolean) {
    timeline.hidden = !on || !radar;
    if (!radar || !map) return;
    for (const f of radar.frames) vis(`radar-${f.time}`, on);
    if (!on) stopRadarAnimation();
  }

  function showRadarFrame(i: number) {
    if (!radar || !map) return;
    radarIdx = i;
    radar.frames.forEach((f, k) => {
      if (map!.getLayer(`radar-${f.time}`)) map!.setPaintProperty(`radar-${f.time}`, 'raster-opacity', k === i ? 0.8 : 0);
    });
    const f = radar.frames[i];
    rangeEl.value = String(i);
    timeEl.textContent = `${new Date(f.time * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${f.nowcast ? ' (Prognose)' : ''}`;
  }

  function stopRadarAnimation() {
    clearInterval(radarTimer);
    radarTimer = 0;
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
    playBtn.setAttribute('aria-label', 'Abspielen');
  }

  rangeEl.addEventListener('input', () => {
    stopRadarAnimation();
    showRadarFrame(Number(rangeEl.value));
  });
  playBtn.addEventListener('click', () => {
    if (radarTimer) return stopRadarAnimation();
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    playBtn.setAttribute('aria-label', 'Pause');
    radarTimer = window.setInterval(() => {
      if (!radar) return;
      showRadarFrame((radarIdx + 1) % radar.frames.length);
    }, 700);
  });

  // ----- legend ------------------------------------------------------------
  function renderLegend() {
    const o = state.overlay;
    let html = '';
    if (o in FIELDS) {
      const def = FIELDS[o as FieldId];
      const { stops, ticks } = def.legend;
      const lo = stops[0][0];
      const hi = stops[stops.length - 1][0];
      const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
      const grad =
        o === 'cloud'
          ? 'linear-gradient(90deg, rgba(255,255,255,0), #fff)'
          : `linear-gradient(90deg, ${stops.map(([v, c]) => `${c} ${pct(v).toFixed(1)}%`).join(', ')})`;
      html = `<div class="legend-title">${escapeHtml(def.label)} <small>${def.unit}</small></div>
        <div class="legend-bar" style="background:${grad}"></div>
        <div class="legend-ticks">${ticks.map((t) => `<span style="left:${pct(t)}%">${t}</span>`).join('')}</div>`;
    } else if (o === 'radar') {
      html = `<div class="legend-title">Niederschlagsradar</div>
        <div class="legend-bar" style="background:linear-gradient(90deg,#88ddee,#0099cc,#0077aa,#005588,#ffee00,#ffaa00,#ff4400,#c10000,#ffaaff)"></div>
        <div class="legend-ticks"><span style="left:0">leicht</span><span style="left:50%">mäßig</span><span style="left:100%">stark</span></div>`;
    }
    legend.innerHTML = html;
    legend.hidden = !html;
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
      style: buildStyle(gibsDate(1), fireDate),
      center: state.center,
      zoom: state.zoom,
      maxPitch: 60,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    // Locate button
    const locCtl = document.createElement('div');
    locCtl.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    locCtl.innerHTML = `<button type="button" title="Mein Standort" aria-label="Mein Standort"><svg viewBox="0 0 24 24" class="ctl-ic"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>`;
    locCtl.querySelector('button')!.addEventListener('click', async () => {
      try {
        const { lat, lon } = await locate();
        focusPlace(lat, lon, 8, true);
      } catch {
        toast('Standort konnte nicht ermittelt werden.', 'error');
      }
    });
    map.addControl({ onAdd: () => locCtl, onRemove: () => locCtl.remove() }, 'top-right');

    map.on('load', () => {
      ready = true;
      registerEventIcons(map!);
      if (state.projection !== 'globe') map!.setProjection({ type: state.projection });
      // NASA layer date = yesterday (today's swaths are still incomplete)
      (map!.getSource('nasa') as RasterTileSource).setTiles([gibsTrueColor(gibsDate(1))]);
      (map!.getSource('hotspots') as RasterTileSource).setTiles([gibsFires(fireDate)]);
      applyPadding();
      applyBase();
      applyNight();
      applyGroups();
      applyOverlay();
      applyWind();
      syncEventSources();
      ensureFeeds();
      if (pendingFocus) {
        focusPlace(pendingFocus.lat, pendingFocus.lon, pendingFocus.zoom, true);
        pendingFocus = null;
      }
    });

    map.on('moveend', () => {
      const c = map!.getCenter();
      state.center = [+c.lng.toFixed(3), +c.lat.toFixed(3)];
      state.zoom = +map!.getZoom().toFixed(2);
      save();
    });

    const interactive = ['ev-circle', 'quakes', 'firms', 'nws-fill'];
    map.on('click', (e) => {
      const layers = interactive.filter((l) => map!.getLayer(l));
      const hits = map!.queryRenderedFeatures(e.point, { layers });
      const hit = hits.find((h) => h.layer.id !== 'nws-fill') ?? hits[0];
      if (hit && hit.layer.id === 'firms') {
        const p = hit.properties as { frp: number; conf: string; time: string };
        openPopup(e.lngLat, `<div class="pop"><div class="pop-head">${glyphSvg('fire', '#ff5a1f', 26)}<b>Feuer-Hotspot</b></div>
          <div class="pop-sub">Strahlungsleistung ${fmt.num(p.frp, 1)} MW · Konfidenz ${escapeHtml(p.conf)}</div>
          <div class="pop-sub">Erfasst ${escapeHtml(p.time)} UTC</div>
          <div class="pop-foot">Quelle: NASA FIRMS (VIIRS NOAA-20)</div></div>`);
      } else if (hit && hit.layer.id === 'nws-fill') {
        openPopup(e.lngLat, `<div class="pop"><div class="pop-head">${glyphSvg('tornado', String(hit.properties.color), 26)}<b>${escapeHtml(hit.properties.event)}</b></div>
          <div class="pop-sub">Warngebiet des National Weather Service</div>
          <div class="pop-foot">Quelle: NWS (USA)</div></div>`);
      } else if (hit) {
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
      if (!map) {
        renderPanel();
        initMap();
      } else {
        map.resize();
        if (state.wind) wind?.start();
      }
      if (focus) focusPlace(focus.lat, focus.lon, focus.zoom ?? 6, true);
      clearInterval(refreshTimer);
      refreshTimer = window.setInterval(() => {
        ensureFeeds(true);
        if (state.overlay === 'radar') ensureRadar();
      }, REFRESH_MS);
    },
    deactivate() {
      clearInterval(refreshTimer);
      stopRadarAnimation();
      wind?.stop();
      popup?.remove();
    },
  };
}
