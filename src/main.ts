import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { store, type Place } from './store';
import { createForecastView } from './views/forecast';
import { createGlobeView } from './views/globe';
type PlanetMapView = import('./views/planetmap').PlanetMapView;

// Bundlers move the library, so tell MapLibre explicitly where its worker lives.
setWorkerUrl(workerUrl);

const app = document.getElementById('app')!;

const forecast = createForecastView((p: Place) => {
  location.hash = `#/karte?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`;
});
const globe = createGlobeView(
  (p: Place) => {
    store.setLastPlace(p);
    location.hash = '#/';
  },
  (lat, lon) => {
    location.hash = `#/weltall?from=earth&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  },
);
app.append(forecast.el, globe.el);

// The 3D solar system (three.js) is loaded on demand.
type SpaceView = import('./space/view').SpaceView;
let space: SpaceView | null = null;
let spaceLoading: Promise<SpaceView> | null = null;
function loadSpace(): Promise<SpaceView> {
  spaceLoading ??= import('./space/view').then(({ createSpaceView }) => {
    space = createSpaceView(
      (lat, lon) => {
        location.hash = `#/karte?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&proj=globe&from=space`;
      },
      (body, lat, lon) => {
        location.hash = `#/planet?body=${body}&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&zoom=5.5`;
      },
    );
    app.append(space.el);
    return space;
  });
  return spaceLoading;
}

// 2D maps of the other planets (equirectangular tile pyramids), loaded on demand
let planet: PlanetMapView | null = null;
let planetLoading: Promise<PlanetMapView> | null = null;
function loadPlanet(): Promise<PlanetMapView> {
  planetLoading ??= import('./views/planetmap').then(({ createPlanetMapView }) => {
    planet = createPlanetMapView((body, lat, lon, focus, site) => {
      const q = site ? `&site=${site}` : '';
      location.hash = `#/weltall?focus=${focus ?? body}&from=${body}&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}${q}`;
    });
    app.append(planet.el);
    return planet;
  });
  return planetLoading;
}

let forecastLoaded = false;
let active: 'forecast' | 'globe' | 'space' | 'planet' | null = null;

function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);
  const next = path.startsWith('/planet') ? 'planet' : path.startsWith('/weltall') ? 'space' : path.startsWith('/karte') || path.startsWith('/globus') ? 'globe' : 'forecast';

  if (active === 'globe' && next !== 'globe') globe.deactivate();
  if (active === 'space' && next !== 'space') space?.deactivate();
  if (active === 'planet' && next !== 'planet') planet?.deactivate();
  forecast.el.hidden = next !== 'forecast';
  globe.el.hidden = next !== 'globe';
  if (space) space.el.hidden = next !== 'space';
  document.body.classList.toggle('mode-globe', next !== 'forecast');
  document.querySelectorAll<HTMLAnchorElement>('.tabs a').forEach((a) => {
    const on = a.dataset.route === (next === 'planet' ? 'space' : next);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (next === 'space') {
    const wasActive = active === 'space';
    loadSpace().then((v) => {
      if (active !== 'space') return;
      v.el.hidden = false;
      if (!wasActive) v.activate({ focus: params.get('focus') ?? params.get('from') ?? undefined, lat: hasPos ? lat : undefined, lon: hasPos ? lon : undefined, site: params.get('site') ?? undefined });
    });
  } else if (next === 'planet') {
    const z = parseFloat(params.get('zoom') ?? '');
    loadPlanet().then((v) => {
      if (active !== 'planet') return;
      v.activate({ body: params.get('body') ?? 'mars', lat: hasPos ? lat : undefined, lon: hasPos ? lon : undefined, zoom: Number.isFinite(z) ? z : undefined, focus: params.get('focus') ?? undefined });
    });
  } else if (next === 'globe') {
    const fromSpace = params.get('from') === 'space';
    const proj = params.get('proj') === 'globe' ? 'globe' : undefined;
    globe.activate(hasPos ? { lat, lon, zoom: fromSpace ? 2.2 : 6, projection: proj, fromSpace } : proj ? { projection: proj } : undefined);
  } else if (!forecastLoaded || active !== 'forecast') {
    forecastLoaded = true;
    forecast.show(store.getLastPlace());
  }
  active = next;
}

window.addEventListener('hashchange', route);
route();
