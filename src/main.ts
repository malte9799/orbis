import 'maplibre-gl/dist/maplibre-gl.css';
import './styles';
import './hud/hud.css';
import './inspector/inspector.css';
import { installCapture } from './inspector/capture';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { store, type Place } from './store';
import { createForecastView } from './views/forecast';
import { createGlobeView } from './views/globe';
import { createNavMenu, type NavRoute } from './nav';
import { createSettingsPanel } from './views/settings';

installCapture();

// Bundlers move the library, so tell MapLibre explicitly where its worker lives.
setWorkerUrl(workerUrl);

const app = document.getElementById('app')!;

const forecast = createForecastView((p: Place) => {
  location.hash = `#/karte?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`;
});
// Vollbild-Knopf der Vorhersage-Karte: nahtlos in die große Karte wechseln
window.addEventListener('orbis:fc-fullscreen', ((e: CustomEvent<{ lat: number; lon: number; zoom: number; done: (p: Promise<void>) => void }>) => {
  const { lat, lon, zoom, done } = e.detail;
  location.hash = `#/karte?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=${zoom.toFixed(2)}&jump=1`;
  done(globe.settled());
}) as EventListener);
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

// Sterne-Ansicht: Blick aus der Mitte der Himmelskugel auf die NASA Deep Star Maps – geladen auf Abruf
type StarsView = import('./views/stars').StarsView;
let stars: StarsView | null = null;
let starsLoading: Promise<StarsView> | null = null;
function loadStars(): Promise<StarsView> {
  starsLoading ??= import('./views/stars').then(({ createStarsView }) => {
    stars = createStarsView();
    app.append(stars.el);
    return stars;
  });
  return starsLoading;
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

// Fahrplan (connection search + departure boards), loaded on demand
type FahrplanView = import('./views/fahrplan').FahrplanView;
let fahrplan: FahrplanView | null = null;
let fahrplanLoading: Promise<FahrplanView> | null = null;
function loadFahrplan(): Promise<FahrplanView> {
  fahrplanLoading ??= import('./views/fahrplan').then(({ createFahrplanView }) => {
    fahrplan = createFahrplanView();
    app.append(fahrplan.el);
    return fahrplan;
  });
  return fahrplanLoading;
}

let forecastLoaded = false;
let active: NavRoute | null = null;

// Settings: one global slide-over panel, opened from the Orbis menu
const settingsScrim = document.createElement('div');
settingsScrim.className = 'settings-scrim';
settingsScrim.hidden = true;
const settingsEl = document.createElement('aside');
settingsEl.className = 'settings-panel';
settingsEl.hidden = true;
document.body.append(settingsScrim, settingsEl);
const settingsPanel = createSettingsPanel(settingsEl, settingsScrim, {
  onKeysSaved: () => document.dispatchEvent(new CustomEvent('orbis:keys-saved')),
});
document.addEventListener('orbis:settings', () => settingsPanel.open());
const navMenu = createNavMenu(() => settingsPanel.open());

function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);
  const next = path.startsWith('/fahrplan') ? 'fahrplan' : path.startsWith('/spiele') ? 'games' : path.startsWith('/planet') ? 'planet' : path.startsWith('/weltall') ? 'space' : path.startsWith('/sterne') ? 'stars' : path.startsWith('/karte') || path.startsWith('/globus') ? 'globe' : path.startsWith('/vorhersage') ? 'forecast' : 'globe';

  if (active === 'globe' && next !== 'globe') globe.deactivate();
  if (active === 'space' && next !== 'space') space?.deactivate();
  if (active === 'planet' && next !== 'planet') planet?.deactivate();
  if (active === 'stars' && next !== 'stars') stars?.deactivate();
  if (active === 'fahrplan' && next !== 'fahrplan') fahrplan?.deactivate();
  if (active === 'games' && next !== 'games') games?.deactivate();
  forecast.el.hidden = next !== 'forecast';
  globe.el.hidden = next !== 'globe';
  if (space) space.el.hidden = next !== 'space';
  if (planet) planet.el.hidden = next !== 'planet';
  if (stars) stars.el.hidden = next !== 'stars';
  if (games) games.el.hidden = next !== 'games';
  if (fahrplan) fahrplan.el.hidden = next !== 'fahrplan';
  document.body.classList.toggle('mode-globe', next !== 'forecast' && next !== 'fahrplan');
  document.body.classList.toggle('mode-map', next === 'globe');
  document.body.classList.toggle('mode-space', next === 'space');
  document.body.classList.toggle('mode-planet', next === 'planet');
  document.body.classList.toggle('mode-stars', next === 'stars');
  const eyes = params.get('eyes');
  navMenu.update(next, eyes, params.get('body'));
  settingsPanel.close();

  if (next === 'fahrplan') {
    loadFahrplan().then((v) => {
      if (active !== 'fahrplan') return;
      v.activate();
    });
  } else if (next === 'games') {
    loadGames().then((v) => {
      if (active !== 'games') return;
      v.el.hidden = false;
      v.activate();
    });
  } else if (next === 'stars') {
    loadStars().then((v) => {
      if (active !== 'stars') return;
      v.el.hidden = false;
      const ra = parseFloat(params.get('ra') ?? '');
      const dec = parseFloat(params.get('dec') ?? '');
      const f = parseFloat(params.get('fov') ?? '');
      const ansicht = params.get('ansicht');
      const quelle = params.get('quelle');
      const detail = params.get('detail');
      v.activate({
        survey: quelle ?? undefined,
        detail: detail ?? undefined,
        mode: ansicht === 'kugel' || ansicht === 'karte' || ansicht === 'allsky' || ansicht === 'himmel' ? ansicht : undefined,
        ra: Number.isFinite(ra) ? ra : undefined,
        dec: Number.isFinite(dec) ? dec : undefined,
        fov: Number.isFinite(f) ? f : undefined,
      });
    });
  } else if (next === 'space') {
    loadSpace().then((v) => {
      if (active !== 'space') return;
      v.el.hidden = false;
      v.activate({ eyes: eyes ?? undefined, focus: params.get('focus') ?? params.get('from') ?? undefined, lat: hasPos ? lat : undefined, lon: hasPos ? lon : undefined, site: params.get('site') ?? undefined });
    });
  } else if (next === 'planet') {
    const z = parseFloat(params.get('zoom') ?? '');
    loadPlanet().then((v) => {
      if (active !== 'planet') return;
      v.activate({
        body: params.get('body') ?? 'mars',
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
    const zoomP = parseFloat(params.get('zoom') ?? '');
    const jump = params.get('jump') === '1';
    globe.activate(hasPos ? { lat, lon, zoom: Number.isFinite(zoomP) ? zoomP : fromSpace ? 2.2 : 6, fromSpace, jump } : undefined);
  } else if (!forecastLoaded || active !== 'forecast') {
    forecastLoaded = true;
    forecast.show(store.getLastPlace());
  }
  active = next;
}

// remember the last page (forecast / map / space / planet / games) and reopen it on the next start
const LAST_ROUTE_KEY = 'orbis.lastRoute';
if (!location.hash || location.hash === '#' || location.hash === '#/') {
  try {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved && saved.startsWith('#/')) history.replaceState(null, '', saved);
  } catch {}
}
function saveRoute() {
  try {
    localStorage.setItem(LAST_ROUTE_KEY, location.hash || '#/');
  } catch {}
}
window.addEventListener('hashchange', () => {
  route();
  saveRoute();
});
route();
saveRoute();

// launch reminders (browser notifications for tracked rockets) run independently of the active view
import('./launch/tracker')
  .then((m) => m.initLaunchReminders())
  .catch(() => {});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
