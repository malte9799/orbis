import { Map as MlMap, Marker, type GeoJSONSource, type LayerSpecification, type RasterTileSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { getRegionalModel, isLimitError, ModelSampler, nearestTimeIndex, regionBounds, type ModelGrid } from '../api/model';
import type { Forecast } from '../api/openmeteo';
import { FIELDS, PRECIP_STOPS, registerFieldProtocol, setActiveSampler, SNOWFALL_STOPS, WindParticles, type FieldId } from '../globe/overlay';
import { baseLayers, labelLayers, OFM_ATTR, OFM_GLYPHS, OFM_SOURCE } from '../globe/vector';
import { loadRadarFrames } from '../api/events';
import { LUT, rainviewerFrame } from '../globe/hdradar';
import { RadarGl } from '../globe/radargl';
import { escapeHtml, fmt, rampColor } from '../util';

// Compact regional weather map for the forecast page (rain/snow, temperature, wind, snow),
// in the spirit of the maps on classic weather sites. Uses a small regional model grid.

export type MapMode = 'radar' | 'precip' | 'temp' | 'wind' | 'snow';

const MODES: { id: MapMode; label: string; fields: FieldId[] }[] = [
  { id: 'radar', label: 'Radar', fields: [] },
  { id: 'precip', label: 'Niederschlag', fields: ['precipmix'] },
  { id: 'temp', label: 'Temperatur', fields: ['temp'] },
  { id: 'wind', label: 'Wind', fields: ['gusts'] },
  { id: 'snow', label: 'Schnee', fields: ['snow', 'snowfall'] },
];

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/** Pick the most relevant map for the next 24 hours: snow > storm > rain > precipitation map. */
export function preselect(f: Forecast): { mode: MapMode; reason: string } {
  const h = f.hourly;
  const start = Math.max(0, h.time.findIndex((t) => t >= f.current.time.slice(0, 13)));
  const idx = Array.from({ length: 24 }, (_, i) => start + i).filter((i) => i < h.time.length);
  if (idx.some((i) => SNOW_CODES.has(h.weather_code[i]))) return { mode: 'snow', reason: 'Schneefall erwartet' };
  const gust = Math.max(...idx.map((i) => h.wind_gusts_10m[i] ?? 0));
  if (gust >= 62) return { mode: 'wind', reason: `Sturmböen bis ${Math.round(gust)} km/h erwartet` };
  const rain = idx.reduce((s, i) => s + (h.precipitation[i] ?? 0), 0);
  if (rain >= 0.3) return { mode: 'precip', reason: `${fmt.num(rain, 1)} mm Niederschlag in 24 h erwartet` };
  return { mode: 'precip', reason: '' };
}

export interface ForecastMap {
  destroy(): void;
}

let seq = 0;

export function createForecastMap(host: HTMLElement, place: { lat: number; lon: number; name: string }, f: Forecast): ForecastMap {
  const key = `fc${++seq}`;
  const pre = preselect(f);
  let mode: MapMode = pre.mode;
  let grid: ModelGrid | null = null;
  let timeIdx = -1;
  let map: MlMap | null = null;
  let playing: number | null = null;
  let destroyed = false;
  let particles: WindParticles | null = null;
  let radarGl: RadarGl | null = null;
  let radarLoading = false;
  let curSampler: ModelSampler | null = null;

  host.innerHTML = `
    <div class="fcm-head">
      <h2>Wetterkarte</h2>
      <div class="fcm-modes" role="tablist">
        ${MODES.map((m) => `<button type="button" class="seg-chip ${m.id === mode ? 'on' : ''}" data-mode="${m.id}" role="tab" aria-selected="${m.id === mode}">${m.label}</button>`).join('')}
      </div>
    </div>
    ${pre.reason ? `<div class="fcm-hint">Vorauswahl: ${escapeHtml(pre.reason)}</div>` : ''}
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
    timeIdx = +slider.value;
    render();
  });
  playBtn.addEventListener('click', () => (playing ? stop() : play()));

  function play() {
    if (!grid) return;
    playBtn.classList.add('on');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    playing = window.setInterval(() => {
      timeIdx = timeIdx >= +slider.max ? +slider.min : timeIdx + 1;
      slider.value = String(timeIdx);
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
        sources: { ofm: { type: 'vector', url: OFM_SOURCE, attribution: OFM_ATTR }, f0: field('f0'), f1: field('f1'), points: empty },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
          ...baseLayers('dark').map(visible),
          { id: 'f0', type: 'raster', source: 'f0', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } },
          { id: 'f1', type: 'raster', source: 'f1', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } },
          ...labelLayers().filter((l) => l.id !== 'lbl-water').map(visible),
          {
            id: 'arrows',
            type: 'symbol',
            source: 'points',
            filter: ['has', 'dir'],
            layout: {
              'icon-image': 'fcm-arrow',
              'icon-rotate': ['get', 'dir'],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-size': ['interpolate', ['linear'], ['get', 'spd'], 0, 0.8, 50, 1.4],
            },
            paint: { 'icon-color': '#ffffff', 'icon-opacity': 0.85, 'icon-halo-color': 'rgba(0,0,0,0.6)', 'icon-halo-width': 1 },
          },
          {
            id: 'values',
            type: 'symbol',
            source: 'points',
            filter: ['has', 'label'],
            layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': false },
            paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.4 },
          },
        ],
      },
      center: [place.lon, place.lat],
      zoom: 5,
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
      map?.addImage('fcm-arrow', arrowImage(), { sdf: true, pixelRatio: 2 });
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
    if (!map || !grid || timeIdx < 0 || !map.isStyleLoaded()) return;
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
    map.setPaintProperty('f0', 'raster-opacity', mode === 'snow' ? 0.75 : 1);
    (map.getSource('points') as GeoJSONSource).setData(points(sampler));
    radarGl?.setVisible(mode === 'radar');
    if (mode === 'radar') void showRadar();
    const empty = host.querySelector<HTMLElement>('.fcm-empty')!;
    const msg = emptyMessage(grid, timeIdx);
    empty.hidden = !msg;
    empty.textContent = msg;
    whenEl.textContent = formatWhen(grid.times[timeIdx]);
  }

  /** Latest measured RainViewer frame as WebGL layer below the labels. */
  async function showRadar() {
    if (radarGl || radarLoading || !map) return;
    radarLoading = true;
    try {
      const r = await loadRadarFrames();
      const frames = r.frames.filter((f) => !f.nowcast && !f.hd);
      if (destroyed || !map || !frames.length) return;
      radarGl = new RadarGl(LUT);
      map.addLayer(radarGl, labelLayers().find((l) => l.id !== 'lbl-water')?.id);
      radarGl.setFrames(frames.map((f) => rainviewerFrame(r.host, f.path, f.time * 1000, 7)));
      radarGl.setTime(frames[frames.length - 1].time * 1000);
      radarGl.setVisible(mode === 'radar');
    } catch (e) {
      console.warn('Radar', e);
    } finally {
      radarLoading = false;
    }
  }

  /** Wind arrows at every grid point, temperature values on every other one. */
  function points(s: ModelSampler): FeatureCollection<Point> {
    const g = s.global;
    const features: Feature<Point>[] = [];
    for (let y = 0; y < g.ny; y++)
      for (let x = 0; x < g.nx; x++) {
        const lat = g.lat0 - y * g.dy;
        const lon = g.lon0 + x * g.dx;
        const i = (s.t * g.ny + y) * g.nx + x;
        if (mode === 'wind') {
          const dir = g.data.wind_direction_10m[i];
          const spd = g.data.wind_speed_10m[i];
          if (Number.isFinite(dir)) features.push({ type: 'Feature', properties: { dir: dir + 180, spd }, geometry: { type: 'Point', coordinates: [lon, lat] } });
        } else if (mode === 'temp' && x % 2 === 1 && y % 2 === 1) {
          const t = g.data.temperature_2m[i];
          if (Number.isFinite(t)) features.push({ type: 'Feature', properties: { label: fmt.temp(t) }, geometry: { type: 'Point', coordinates: [lon, lat] } });
        }
      }
    return { type: 'FeatureCollection', features };
  }

  /** Short note when the chosen map has nothing to show at this time step. */
  function emptyMessage(g: ModelGrid, t: number): string {
    if (mode !== 'precip' && mode !== 'snow') return '';
    const n = g.nx * g.ny;
    let rain = false;
    let snowfall = false;
    let cover = false;
    for (let i = t * n; i < (t + 1) * n; i++) {
      const p = g.data.precipitation[i] >= 0.1;
      const cold = g.data.temperature_2m[i] < 1;
      if (p && cold) snowfall = true;
      else if (p) rain = true;
      if (g.data.snow_depth[i] >= 0.01) cover = true;
    }
    if (mode === 'precip') return rain || snowfall ? '' : 'Kein Niederschlag im Kartenausschnitt';
    return snowfall || cover ? '' : 'Kein Schnee im Kartenausschnitt';
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
        : mode === 'snow'
          ? bar(def('snow').legend.stops.map(([v, c]) => [v * 100, c]), 'Schneehöhe', [1, 50, 100, 200, 300], 'cm') +
            bar(SNOWFALL_STOPS, 'Schneefall', [0.1, 1.5, 3, 6], 'mm/h')
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

/** Arrow pointing up (north), rendered as SDF so it can be tinted. */
function arrowImage(): ImageData {
  const S = 40;
  const c = new OffscreenCanvas(S, S).getContext('2d')!;
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(S / 2, 3);
  c.lineTo(S / 2 + 11, 17);
  c.lineTo(S / 2 + 4, 17);
  c.lineTo(S / 2 + 4, S - 3);
  c.lineTo(S / 2 - 4, S - 3);
  c.lineTo(S / 2 - 4, 17);
  c.lineTo(S / 2 - 11, 17);
  c.closePath();
  c.fill();
  return c.getImageData(0, 0, S, S);
}
