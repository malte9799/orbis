import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import './hud/hud.css';
import './inspector/inspector.css';
import { installCapture } from './inspector/capture';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { store, type Place } from './store';
import { createForecastView } from './views/forecast';
import { createGlobeView } from './views/globe';

installCapture();

// Bundlers move the library, so tell MapLibre explicitly where its worker lives.
setWorkerUrl(workerUrl);

const app = document.getElementById('app')!;

const forecast = createForecastView((p: Place) => {
  location.hash = `#/karte?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`;
});
const globe = createGlobeView(
  (p: Place) => {
    store.setLastPlace(p);
    location.hash = '#/vorhersage';
  },
  (lat, lon) => {
    location.hash = `#/weltall?from=earth&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  },
);
app.append(forecast.el, globe.el);

// TEST: Weltall-Ansicht testweise durch NASA Eyes (iframes) ersetzt – eigenes three.js-System ausgehängt.
// Zum Zurückkehren: stattdessen import('./space/view') + createSpaceView(latLon, bodyPick) verwenden (siehe git history).
type SpaceView = import('./space/nasa-eyes').NasaEyesView;
type PlanetMapView = import('./views/planetmap').PlanetMapView;
let space: SpaceView | null = null;
let spaceLoading: Promise<SpaceView> | null = null;
function loadSpace(): Promise<SpaceView> {
  spaceLoading ??= import('./space/nasa-eyes').then(({ createNasaEyesView }) => {
    space = createNasaEyesView();
    app.append(space.el);
    return space;
  });
  return spaceLoading;
}

// Maps of the other planets (MapLibre, like the Earth map), loaded on demand
let planet: PlanetMapView | null = null;
let planetLoading: Promise<PlanetMapView> | null = null;
function loadPlanet(): Promise<PlanetMapView> {
  planetLoading ??= import('./views/planetmap').then(({ createPlanetMapView }) => {
    planet = createPlanetMapView({
      onOpenSpace(body, lat, lon) {
        location.hash = `#/weltall?focus=${body}&from=${body}&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
      },
    });
    app.append(planet.el);
    return planet;
  });
  return planetLoading;
}

// Games (own map, separate from the layer drawer), loaded on demand
type GamesView = import('./views/games').GamesView;
let games: GamesView | null = null;
let gamesLoading: Promise<GamesView> | null = null;
function loadGames(): Promise<GamesView> {
  gamesLoading ??= import('./views/games').then(({ createGamesView }) => {
    games = createGamesView();
    app.append(games.el);
    return games;
  });
  return gamesLoading;
}

// NASA Solar System Treks (Mond, Mars, …) – Eigenansicht mit Trek-WMTS-Tiles (OpenLayers, EPSG:4326)
type TreksView = import('./space/treks').TreksView;
let treks: TreksView | null = null;
let treksLoading: Promise<TreksView> | null = null;
function loadTreks(): Promise<TreksView> {
  treksLoading ??= import('./space/treks').then(({ createTreksView }) => {
    treks = createTreksView();
    app.append(treks.el);
    return treks;
  });
  return treksLoading;
}

let forecastLoaded = false;
let active: 'forecast' | 'globe' | 'space' | 'treks' | 'planet' | 'games' | null = null;

const nav = document.querySelector<HTMLElement>('.tabs')!;
const eyesGroup = nav.querySelector<HTMLElement>('.eyes-group')!;
const trekGroup = nav.querySelector<HTMLElement>('.trek-group')!;

function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);
  const next = path.startsWith('/spiele') ? 'games' : path.startsWith('/planeten') ? 'treks' : path.startsWith('/planet') ? 'planet' : path.startsWith('/weltall') ? 'space' : path.startsWith('/karte') || path.startsWith('/globus') ? 'globe' : path.startsWith('/vorhersage') ? 'forecast' : 'globe';

  if (active === 'globe' && next !== 'globe') globe.deactivate();
  if (active === 'space' && next !== 'space') space?.deactivate();
  if (active === 'treks' && next !== 'treks') treks?.deactivate();
  if (active === 'planet' && next !== 'planet') planet?.deactivate();
  if (active === 'games' && next !== 'games') games?.deactivate();
  forecast.el.hidden = next !== 'forecast';
  globe.el.hidden = next !== 'globe';
  if (space) space.el.hidden = next !== 'space';
  if (treks) treks.el.hidden = next !== 'treks';
  if (games) games.el.hidden = next !== 'games';
  document.body.classList.toggle('mode-globe', next !== 'forecast');
  document.body.classList.toggle('mode-map', next === 'globe');
  document.body.classList.toggle('mode-space', next === 'space');
  document.body.classList.toggle('mode-world', next === 'space' || next === 'treks');
  document.querySelectorAll<HTMLAnchorElement>('.tabs a[data-route]').forEach((a) => {
    const on = a.dataset.route === (next === 'planet' ? 'space' : next);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  // Weltall-/Planeten-Leiste: linke Gruppe nur in der jeweils passenden Ansicht
  const eyes = params.get('eyes');
  eyesGroup.toggleAttribute('hidden', next !== 'space');
  trekGroup.toggleAttribute('hidden', next !== 'treks');
  document.querySelectorAll<HTMLAnchorElement>('.eyes-group a').forEach((a) => {
    a.classList.toggle('active', next === 'space' && a.dataset.eyes === (eyes ?? 'earth'));
  });
  const trek = params.get('trek') ?? undefined;
  document.querySelectorAll<HTMLAnchorElement>('.trek-group a').forEach((a) => {
    a.classList.toggle('active', next === 'treks' && a.dataset.trek === (trek ?? 'moon'));
  });

  if (next === 'games') {
    loadGames().then((v) => {
      if (active !== 'games') return;
      v.el.hidden = false;
      v.activate();
    });
  } else if (next === 'space') {
    loadSpace().then((v) => {
      if (active !== 'space') return;
      v.el.hidden = false;
      v.activate({ eyes: eyes ?? undefined, focus: params.get('focus') ?? params.get('from') ?? undefined, lat: hasPos ? lat : undefined, lon: hasPos ? lon : undefined, site: params.get('site') ?? undefined });
    });
  } else if (next === 'treks') {
    loadTreks().then((v) => {
      if (active !== 'treks') return;
      v.el.hidden = false;
      v.activate({ trek });
    });
  } else if (next === 'planet') {
    const z = parseFloat(params.get('zoom') ?? '');
    loadPlanet().then((v) => {
      if (active !== 'planet') return;
      v.activate({
        body: params.get('body') ?? 'mars',
        projection: params.get('view') === '2d' ? 'mercator' : 'globe',
        lat: hasPos ? lat : undefined,
        lon: hasPos ? lon : undefined,
        zoom: Number.isFinite(z) ? z : undefined,
        focus: params.get('focus') ?? undefined,
        site: params.get('site') ?? undefined,
        fromSpace: params.get('from') === 'space',
      });
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

// launch reminders (browser notifications for tracked rockets) run independently of the active view
import('./launch/tracker')
  .then((m) => m.initLaunchReminders())
  .catch(() => {});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
