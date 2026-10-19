import { Map as MlMap, Marker, type GeoJSONSource, type LayerSpecification, type RasterTileSource } from 'maplibre-gl';
import { getRegionalModel, isLimitError, ModelSampler, nearestTimeIndex, regionBounds, type ModelGrid } from '../api/model';
import type { Forecast } from '../api/openmeteo';
import { FIELDS, PRECIP_STOPS, registerFieldProtocol, setActiveSampler, SNOWFALL_STOPS, WindParticles, type FieldId } from '../globe/overlay';
import { baseLayers, FONT_BOLD, FONT_REGULAR, labelLayers, OFM_ATTR, OFM_GLYPHS, OFM_SOURCE } from '../globe/vector';
import { loadRadarFrames } from '../api/events';
import { LUT, rainviewerFrame } from '../globe/hdradar';
import { RadarGl } from '../globe/radargl';
import { loadCityWeather } from '../api/europe';
import { ensureWeatherIcons } from '../globe/icons';
import { weatherIcon } from '../weather';
import { fmt, rampColor } from '../util';

// Compact regional weather map for the forecast page (radar, rain/snow, temperature, wind, city weather),
// in the spirit of the maps on classic weather sites. Uses a small regional model grid.

export type MapMode = 'radar' | 'precip' | 'temp' | 'wind';

const MODES: { id: MapMode; label: string; fields: FieldId[] }[] = [
  { id: 'radar', label: 'Radar', fields: [] },
  { id: 'precip', label: 'Niederschlag', fields: ['precipmix'] },
  { id: 'temp', label: 'Temperatur', fields: ['temp'] },
  { id: 'wind', label: 'Wind', fields: ['gusts'] },
];

export interface ForecastMap {
  destroy(): void;
}

let seq = 0;

export function createForecastMap(host: HTMLElement, place: { lat: number; lon: number; name: string }, _f?: Forecast): ForecastMap {
  const key = `fc${++seq}`;
  let mode: MapMode = 'radar';
  let grid: ModelGrid | null = null;
  let timeIdx = -1;
  let map: MlMap | null = null;
  let playing: number | null = null;
  let destroyed = false;
  let particles: WindParticles | null = null;
  let radarGl: RadarGl | null = null;
  let radarLoading = false;
  let citiesLoaded = false;
  let radarFrames: number[] = [];
  let radarIdx = 0;
  let modelMin = 0;
  let curSampler: ModelSampler | null = null;

  host.innerHTML = `
    <div class="fcm-head">
      <h2>Wetterkarte</h2>
      <div class="fcm-modes" role="tablist">
        ${MODES.map((m) => `<button type="button" class="seg-chip ${m.id === mode ? 'on' : ''}" data-mode="${m.id}" role="tab" aria-selected="${m.id === mode}">${m.label}</button>`).join('')}
      </div>
    </div>
    <div class="fcm-map"><div class="fcm-status">Karte wird geladen …</div><div class="fcm-empty" hidden></div></div>
    <div class="fcm-legend"></div>
    <div class="fcm-time">
      <button type="button" class="btn icon-btn fcm-play" aria-label="Abspielen" title="Abspielen">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <input type="range" min="0" max="0" value="0" aria-label="Zeitpunkt" disabled>
      <span class="fcm-when">–</span>
    </div>
    <p class="muted small fcm-src">Modelldaten: Open-Meteo · Karte: OpenFreeMap © OpenStreetMap</p>`;

  const mapEl = host.querySelector<HTMLElement>('.fcm-map')!;
  const statusEl = host.querySelector<HTMLElement>('.fcm-status')!;
  const slider = host.querySelector<HTMLInputElement>('input[type=range]')!;
  const whenEl = host.querySelector<HTMLElement>('.fcm-when')!;
  const playBtn = host.querySelector<HTMLButtonElement>('.fcm-play')!;
  const legendEl = host.querySelector<HTMLElement>('.fcm-legend')!;

  host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      stop();
      mode = b.dataset.mode as MapMode;
      host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((o) => {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-selected', String(o === b));
      });
      render();
    }),
  );
  slider.addEventListener('input', () => {
    stop();
    if (mode === 'radar') radarIdx = +slider.value;
    else timeIdx = +slider.value;
    render();
  });
  playBtn.addEventListener('click', () => (playing ? stop() : play()));

  function play() {
    if (mode === 'radar' ? radarFrames.length < 2 : !grid) return;
    playBtn.classList.add('on');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    playing = window.setInterval(() => {
      const next = (+slider.value >= +slider.max ? +slider.min : +slider.value + 1);
      if (mode === 'radar') radarIdx = next;
      else timeIdx = next;
      slider.value = String(next);
      render();
    }, 900);
  }
  function stop() {
    if (playing) clearInterval(playing);
    playing = null;
    playBtn.classList.remove('on');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  }

  // Load lazily once the card scrolls into view – the regional grid costs ~120 API calls.
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      init();
    },
    { rootMargin: '300px' },
  );
  io.observe(host);

  function init() {
    const b = regionBounds(place.lat, place.lon);
    registerFieldProtocol();
    const visible = (l: LayerSpecification) => ({ ...l, layout: { ...(l as { layout?: object }).layout, visibility: 'visible' } }) as LayerSpecification;
    const empty = { type: 'geojson' as const, data: { type: 'FeatureCollection' as const, features: [] } };
    const field = (id: string) => ({
      type: 'raster' as const,
      tiles: [`wxfield://temp/${key}~0/{z}/{x}/{y}`],
      tileSize: 256,
      maxzoom: 7,
      bounds: [b.west, b.south, b.east, b.north] as [number, number, number, number],
      ...(id === 'f0' ? { attribution: 'Modell: <a href="https://open-meteo.com/">Open-Meteo</a>' } : {}),
    });
    map = new MlMap({
      container: mapEl,
      style: {
        version: 8,
        glyphs: OFM_GLYPHS,
        sources: { ofm: { type: 'vector', url: OFM_SOURCE, attribution: OFM_ATTR }, f0: field('f0'), f1: field('f1'), cities: empty },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
          ...baseLayers('dark').map(visible),
          { id: 'f0', type: 'raster', source: 'f0', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } },
          { id: 'f1', type: 'raster', source: 'f1', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } },
          ...labelLayers().filter((l) => l.id !== 'lbl-water').map(visible),
          {
            id: 'cities',
            type: 'symbol',
            source: 'cities',
            layout: {
              visibility: 'none',
              'icon-image': ['get', 'icon'],
              'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.75, 7, 1],
              'text-field': ['format', ['get', 'temp'], { 'font-scale': 1.1, 'text-font': ['literal', FONT_BOLD] }, '\n', {}, ['get', 'name'], { 'font-scale': 0.8 }],
              'text-font': FONT_REGULAR,
              'text-size': 12,
              'text-anchor': 'left',
              'text-offset': [1.3, 0],
              'text-justify': 'left',
              'symbol-sort-key': ['get', 'rank'],
              'icon-padding': 4,
            },
            paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.3 },
          },
        ],
      },
      center: [place.lon, place.lat],
      zoom: 6.5,
      minZoom: 3,
      maxZoom: 9,
      maxBounds: [
        [b.west, b.south],
        [b.east, b.north],
      ],
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: true,
      attributionControl: false,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen',
        'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen',
        'CooperativeGesturesHandler.MobileHelpText': 'Mit zwei Fingern bewegen',
      },
    });
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      render();
    });
    const el = document.createElement('div');
    el.className = 'fcm-marker';
    el.title = place.name;
    new Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(map);

    getRegionalModel(place.lat, place.lon)
      .then((g) => {
        if (destroyed) return;
        grid = g;
        // only the future: start at the current time step
        const now = nearestTimeIndex(g.times);
        modelMin = now;
        slider.min = String(now);
        slider.max = String(g.times.length - 1);
        timeIdx = now;
        slider.value = String(now);
        slider.disabled = false;
        statusEl.remove();
        render();
      })
      .catch((e) => {
        if (destroyed) return;
        console.warn('Regionalraster', e);
        statusEl.textContent = isLimitError(e)
          ? 'Kostenloses Abrufkontingent von Open-Meteo gerade ausgeschöpft – bitte in ein paar Minuten erneut versuchen.'
          : 'Kartendaten konnten nicht geladen werden.';
      });
  }

  function render() {
    renderLegend();
    if (!map || !map.isStyleLoaded()) return;
    syncSlider();
    void showCities();
    if (mode === 'radar') {
      particles?.stop();
      ['f0', 'f1'].forEach((id) => map!.setLayoutProperty(id, 'visibility', 'none'));
      host.querySelector<HTMLElement>('.fcm-empty')!.hidden = true;
      radarGl?.setVisible(true);
      if (radarFrames.length) {
        radarGl?.setTime(radarFrames[radarIdx]);
        whenEl.textContent = formatWhen(radarFrames[radarIdx]);
      } else {
        whenEl.textContent = 'Radar wird geladen …';
        void showRadar();
      }
      return;
    }
    radarGl?.setVisible(false);
    if (!grid || timeIdx < 0) return;
    const sampler = new ModelSampler(grid, null, timeIdx);
    curSampler = sampler;
    particles ??= new WindParticles(map, () => curSampler);
    if (mode === 'wind') particles.start();
    else particles.stop();
    setActiveSampler(sampler, key);
    const fields = MODES.find((m) => m.id === mode)!.fields;
    ['f0', 'f1'].forEach((id, i) => {
      const fid = fields[i];
      map!.setLayoutProperty(id, 'visibility', fid ? 'visible' : 'none');
      if (fid) (map!.getSource(id) as RasterTileSource).setTiles([`wxfield://${fid}/${key}~${grid!.times[0]}-${timeIdx}/{z}/{x}/{y}`]);
    });
    map.setPaintProperty('f0', 'raster-opacity', mode === 'temp' || mode === 'wind' ? 0.8 : 1);
    const empty = host.querySelector<HTMLElement>('.fcm-empty')!;
    const msg = emptyMessage(grid, timeIdx);
    empty.hidden = !msg;
    empty.textContent = msg;
    whenEl.textContent = formatWhen(grid.times[timeIdx]);
  }

  /** Städtewetter on the temperature map: current weather of the big cities (same data as the globe layer). */
  async function showCities() {
    if (!map) return;
    if (map.getLayer('cities')) map.setLayoutProperty('cities', 'visibility', mode === 'temp' ? 'visible' : 'none');
    if (mode !== 'temp' || citiesLoaded) return;
    citiesLoaded = true;
    try {
      const list = await loadCityWeather();
      if (destroyed || !map) return;
      await ensureWeatherIcons(map, list.map((c) => ({ code: c.code, isDay: c.isDay })), (code, isDay) => weatherIcon(code, isDay, 64));
      if (destroyed || !map) return;
      (map.getSource('cities') as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: list.map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: { name: c.name, temp: `${Math.round(c.temp)}°`, icon: `wx-${c.code}-${c.isDay ? 'd' : 'n'}`, rank: c.rank },
        })),
      });
    } catch (e) {
      citiesLoaded = false;
      console.warn('Städtewetter', e);
    }
  }

  /** The slider belongs to the radar (last 2 h) or to the model run, depending on the layer. */
  function syncSlider() {
    if (mode === 'radar') {
      slider.min = '0';
      slider.max = String(Math.max(0, radarFrames.length - 1));
      slider.value = String(radarIdx);
      slider.disabled = radarFrames.length < 2;
    } else if (grid) {
      slider.min = String(modelMin);
      slider.max = String(grid.times.length - 1);
      slider.value = String(timeIdx);
      slider.disabled = false;
    }
  }

  /** Measured RainViewer frames of the last 2 h as WebGL layer below the labels. */
  async function showRadar() {
    if (radarGl || radarLoading || !map) return;
    radarLoading = true;
    try {
      const r = await loadRadarFrames();
      let frames = r.frames.filter((f) => !f.nowcast && !f.hd);
      if (destroyed || !map || !frames.length) return;
      const last = frames[frames.length - 1].time;
      frames = frames.filter((f) => f.time >= last - 2 * 3600);
      radarFrames = frames.map((f) => f.time * 1000);
      radarIdx = frames.length - 1;
      radarGl = new RadarGl(LUT);
      map.addLayer(radarGl, labelLayers().find((l) => l.id !== 'lbl-water')?.id);
      radarGl.setFrames(frames.map((f) => rainviewerFrame(r.host, f.path, f.time * 1000, 7)));
      radarGl.setVisible(mode === 'radar');
      render();
    } catch (e) {
      console.warn('Radar', e);
    } finally {
      radarLoading = false;
    }
  }

  /** Short note when the chosen map has nothing to show at this time step. */
  function emptyMessage(g: ModelGrid, t: number): string {
    if (mode !== 'precip') return '';
    const n = g.nx * g.ny;
    let rain = false;
    let snowfall = false;
    for (let i = t * n; i < (t + 1) * n; i++) {
      const p = g.data.precipitation[i] >= 0.1;
      const cold = g.data.temperature_2m[i] < 1;
      if (p && cold) snowfall = true;
      else if (p) rain = true;
    }
    return rain || snowfall ? '' : 'Kein Niederschlag im Kartenausschnitt';
  }

  function renderLegend() {
    const bar = (stops: [number, string][], label: string, ticks: number[], unit: string) => {
      const min = stops[0][0];
      const max = stops[stops.length - 1][0];
      const grad = Array.from({ length: 12 }, (_, i) => {
        const v = min + ((max - min) * i) / 11;
        const [r, g, b] = rampColor(stops, v);
        return `rgb(${r},${g},${b}) ${((i / 11) * 100).toFixed(0)}%`;
      }).join(',');
      return `<div class="fcm-leg">
        <span class="fcm-leg-label">${label} <small>${unit}</small></span>
        <span class="fcm-leg-bar" style="background:linear-gradient(90deg,${grad})"></span>
        <span class="fcm-leg-ticks">${ticks.map((t) => `<span style="left:${(((t - min) / (max - min)) * 100).toFixed(1)}%">${fmt.num(t, t < 1 ? 1 : 0)}</span>`).join('')}</span>
      </div>`;
    };
    const def = (id: FieldId) => FIELDS[id];
    legendEl.innerHTML =
      mode === 'precip'
        ? bar(PRECIP_STOPS, 'Regen', [0.1, 3, 10, 20, 40], 'mm/h') + bar(SNOWFALL_STOPS, 'Schnee', [0.1, 1.5, 3, 6], 'mm/h')
        : mode === 'radar'
          ? ''
          : bar(def(mode === 'temp' ? 'temp' : 'gusts').legend.stops, mode === 'temp' ? 'Temperatur' : 'Windböen', def(mode === 'temp' ? 'temp' : 'gusts').legend.ticks, def(mode === 'temp' ? 'temp' : 'gusts').unit);
  }

  return {
    destroy() {
      destroyed = true;
      stop();
      particles?.stop();
      io.disconnect();
      setActiveSampler(null, key);
      map?.remove();
      map = null;
    },
  };
}

function formatWhen(ms: number) {
  const d = new Date(ms);
  const day = d.toLocaleDateString('de-DE', { weekday: 'short' });
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? 'Heute' : day}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
}
