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
  location.hash = `#/globus?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`;
});
const globe = createGlobeView((p: Place) => {
  store.setLastPlace(p);
  location.hash = '#/';
});
app.append(forecast.el, globe.el);

let forecastLoaded = false;
let active: 'forecast' | 'globe' | null = null;

function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);
  const next = path.startsWith('/globus') ? 'globe' : 'forecast';

  if (active === 'globe' && next !== 'globe') globe.deactivate();
  forecast.el.hidden = next !== 'forecast';
  globe.el.hidden = next !== 'globe';
  document.body.classList.toggle('mode-globe', next === 'globe');
  document.querySelectorAll<HTMLAnchorElement>('.tabs a').forEach((a) => {
    const on = a.dataset.route === next;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (next === 'globe') {
    globe.activate(hasPos ? { lat, lon, zoom: 6 } : undefined);
  } else if (!forecastLoaded || active !== 'forecast') {
    forecastLoaded = true;
    forecast.show(store.getLastPlace());
  }
  active = next;
}

window.addEventListener('hashchange', route);
route();
