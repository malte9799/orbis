import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { store, type Place } from './store';
import { createForecastView } from './views/forecast';
import { createGlobeView } from './views/globe';

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

// The 3D solar system (three.js) is loaded on demand. The same renderer also draws the 3D
// planet maps (planet mode: just that body, with its close-up tiles and rover models).
type SpaceView = import('./space/view').SpaceView;
type PlanetMapView = import('./views/planetmap').PlanetMapView;
let space: SpaceView | null = null;
let spaceLoading: Promise<SpaceView> | null = null;
let spaceOn = false;

const planetHash = (body: string, view: '2d' | '3d', lat: number, lon: number, o: { focus?: string; site?: string } = {}) =>
  `#/planet?body=${body}&view=${view}&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}${o.focus ? `&focus=${o.focus}` : ''}${o.site ? `&site=${o.site}` : ''}`;

function loadSpace(): Promise<SpaceView> {
  spaceLoading ??= import('./space/view').then(({ createSpaceView }) => {
    space = createSpaceView({
      earthMap(lat, lon) {
        location.hash = `#/karte?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&proj=globe&from=space`;
      },
      planet(body, lat, lon, o) {
        location.hash = planetHash(body, '3d', lat, lon, o);
      },
      solar(body) {
        location.hash = `#/weltall?focus=${body}`;
      },
    });
    app.append(space.el);
    return space;
  });
  return spaceLoading;
}

// 2D planet map + controls of the planet views, created on first use
let planet: PlanetMapView | null = null;
let planetLoading: Promise<PlanetMapView> | null = null;
function loadPlanet(): Promise<PlanetMapView> {
  planetLoading ??= import('./views/planetmap').then(({ createPlanetMapView }) => {
    planet = createPlanetMapView({
      go(body, view, lat, lon, o) {
        location.hash = planetHash(body, view, lat, lon, o);
      },
      solar(body) {
        location.hash = `#/weltall?focus=${body}`;
      },
      three: {
        setLayer: (id) => space?.setMapLayer(id),
        setOverlays: (o) => space?.setOverlays(o),
        center: () => space?.center() ?? null,
        zoomBy: (f) => space?.zoomBy(f),
      },
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
  const view: '2d' | '3d' = params.get('view') === '2d' ? '2d' : '3d';
  const spaceWanted = next === 'space' || (next === 'planet' && view === '3d');

  if (active === 'globe' && next !== 'globe') globe.deactivate();
  if (spaceOn && !spaceWanted) {
    space?.deactivate();
    spaceOn = false;
  }
  if (active === 'planet' && next !== 'planet') planet?.deactivate();
  forecast.el.hidden = next !== 'forecast';
  globe.el.hidden = next !== 'globe';
  if (space) space.el.hidden = !spaceWanted;
  document.body.classList.toggle('mode-globe', next !== 'forecast');
  document.querySelectorAll<HTMLAnchorElement>('.tabs a').forEach((a) => {
    const on = a.dataset.route === (next === 'planet' ? 'space' : next);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (next === 'space') {
    loadSpace().then((v) => {
      if (active !== 'space') return;
      v.el.hidden = false;
      spaceOn = true;
      v.activate({ focus: params.get('focus') ?? params.get('from') ?? undefined, lat: hasPos ? lat : undefined, lon: hasPos ? lon : undefined, site: params.get('site') ?? undefined });
    });
  } else if (next === 'planet') {
    const body = params.get('body') ?? 'mars';
    const z = parseFloat(params.get('zoom') ?? '');
    Promise.all([loadSpace(), loadPlanet()]).then(([sp, pl]) => {
      if (active !== 'planet') return;
      if (app.lastElementChild !== pl.el) app.append(pl.el); // controls above the 3D canvas
      const pos = { lat: hasPos ? lat : undefined, lon: hasPos ? lon : undefined };
      if (view === '3d') {
        sp.el.hidden = false;
        spaceOn = true;
        sp.activate({ planet: body, focus: params.get('focus') ?? undefined, site: params.get('site') ?? undefined, ...pos });
      }
      pl.activate({ body, view, ...pos, zoom: Number.isFinite(z) ? z : undefined, focus: params.get('focus') ?? undefined, site: params.get('site') ?? undefined });
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
