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

let forecastLoaded = false;
let active: 'forecast' | 'globe' | 'space' | 'planet' | 'games' | null = null;

const nav = document.querySelector<HTMLElement>('.tabs')!;
const knob = nav.querySelector<HTMLAnchorElement>('.space-knob')!;

// Topbar in der Weltall-Ansicht: standardmäßig die NASA-Eyes-Gruppe zeigen,
// per „Weltall“-Knopf zwischen Eyes-Auswahl und den übrigen Ansichts-Links umschalten.
let eyesMode = false;
function setEyesMode(on: boolean) {
  eyesMode = on;
  nav.classList.toggle('mode-eyes', on);
  knob?.setAttribute('aria-expanded', String(on));
  document.querySelector('.eyes-group')?.toggleAttribute('hidden', !on);
}
knob?.addEventListener('click', (e) => {
  e.preventDefault();
  setEyesMode(!eyesMode);
  if (eyesMode && active !== 'space') location.hash = '#/weltall';
});
// In der Weltall-Ansicht schaltet der normale „Weltall“-Tab die Eyes-Gruppe wieder ein,
// in der Planeten-Ansicht holt er die Trek-Leiste zurück
const spaceTab = nav.querySelector<HTMLAnchorElement>('a[data-route="space"]');
spaceTab?.addEventListener('click', (e) => {
  if (active === 'space' && !eyesMode) {
    e.preventDefault();
    setEyesMode(true);
    return;
  }
  if (active === 'planet' && !trekMode) {
    e.preventDefault();
    setTrekMode(true);
  }
});

// Trek-Kategorien (Planeten-Ansicht): Dropdown schließt bei Auswahl und Klick außerhalb
const trekGroup = nav.querySelector<HTMLElement>('.trek-group')!;
nav.querySelectorAll<HTMLAnchorElement>('.trek-group a').forEach((a) =>
  a.addEventListener('click', () => a.closest('details')?.removeAttribute('open')),
);
document.addEventListener('click', (e) => {
  const dd = (e.target as HTMLElement).closest?.('.trek-dd');
  nav.querySelectorAll<HTMLDetailsElement>('.trek-dd[open]').forEach((d) => {
    if (d !== dd) d.removeAttribute('open');
  });
});

// Topbar in der Planeten-Ansicht: die Trek-Kategorien stehen standardmäßig,
// per „Planeten“-Knopf (wie „Weltall“ in der Weltall-Ansicht) kehrt man zur normalen Leiste zurück
let trekMode = false;
function setTrekMode(on: boolean) {
  trekMode = on;
  nav.classList.toggle('mode-trek', on);
  trekGroup.toggleAttribute('hidden', !on);
  worldLink?.setAttribute('aria-expanded', String(on));
}
const worldLink = nav.querySelector<HTMLAnchorElement>('a.world-link')!;
worldLink.addEventListener('click', (e) => {
  if (active !== 'planet') return; // sonst: normale Navigation zur Planeten-Karte
  e.preventDefault();
  setTrekMode(!trekMode);
});

function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);
  const next = path.startsWith('/spiele') ? 'games' : path.startsWith('/planet') ? 'planet' : path.startsWith('/weltall') ? 'space' : path.startsWith('/karte') || path.startsWith('/globus') ? 'globe' : path.startsWith('/vorhersage') ? 'forecast' : 'globe';

  if (active === 'globe' && next !== 'globe') globe.deactivate();
  if (active === 'space' && next !== 'space') space?.deactivate();
  if (active === 'planet' && next !== 'planet') planet?.deactivate();
  if (active === 'games' && next !== 'games') games?.deactivate();
  forecast.el.hidden = next !== 'forecast';
  globe.el.hidden = next !== 'globe';
  if (space) space.el.hidden = next !== 'space';
  if (games) games.el.hidden = next !== 'games';
  document.body.classList.toggle('mode-globe', next !== 'forecast');
  document.body.classList.toggle('mode-map', next === 'globe');
  document.body.classList.toggle('mode-space', next === 'space');
  document.body.classList.toggle('mode-planet', next === 'planet');
  document.querySelectorAll<HTMLAnchorElement>('.tabs a[data-route]').forEach((a) => {
    const on = a.dataset.route === (next === 'planet' ? 'space' : next);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  // Eyes-Auswahl: beim Betreten der Weltall-Ansicht standardmäßig die Eyes-Gruppe zeigen,
  // außer innerhalb der Ansicht wurde per Knopf umgeschaltet
  const eyes = params.get('eyes');
  if (next === 'space') {
    if (active !== 'space') setEyesMode(true);
  } else if (eyesMode) {
    setEyesMode(false);
  }
  document.querySelectorAll<HTMLAnchorElement>('.eyes-group a').forEach((a) => {
    a.classList.toggle('active', eyesMode && a.dataset.eyes === (eyes ?? 'earth'));
  });
  // Trek-Kategorien nur in der Planeten-Ansicht (beim Betreten standardmäßig an); der aktuelle
  // Körper ist markiert, der Titel seiner Kategorie zeigt den Körpernamen (z. B. „Mars“ statt
  // „Planeten“), rechts zeigt „Planeten“ die aktive Ansicht
  if (next === 'planet') {
    if (active !== 'planet') setTrekMode(true);
  } else if (trekMode) {
    setTrekMode(false);
  }
  const bodyParam = params.get('body') ?? 'mars';
  document.querySelectorAll<HTMLAnchorElement>('.trek-group a').forEach((a) => {
    a.classList.toggle('active', next === 'planet' && a.dataset.body === bodyParam);
  });
  nav.querySelectorAll<HTMLDetailsElement>('.trek-dd').forEach((dd) => {
    const sum = dd.querySelector<HTMLElement>('summary')!;
    const chosen = dd.querySelector<HTMLAnchorElement>(`a[data-body="${CSS.escape(bodyParam)}"]`);
    sum.textContent = chosen?.textContent ?? sum.dataset.cat ?? '';
    // die Kategorie des gewählten Körpers ist hervorgehoben
    sum.classList.toggle('active', !!chosen);
  });
  nav.querySelector<HTMLAnchorElement>('a.world-link')?.classList.toggle('active', next === 'planet');

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
