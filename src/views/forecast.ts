import { getAlerts, type Alert } from '../api/alerts';
import { getAirQuality, getForecast, reverseGeocode, type AirQuality, type Forecast } from '../api/openmeteo';
import { renderHourlyChart } from '../chart';
import { createForecastMap, type ForecastMap } from './fcmap';
import { createSearch, locate } from '../search';
import { store, type Place } from '../store';
import { beaufort, compass, escapeHtml, fmt, tempColor, toast } from '../util';
import { aqiLabel, describe, pollenLabel, uvLabel, weatherIcon } from '../weather';

const CACHE_KEY = 'wg.fccache';
const CACHE_MAX_AGE = 6 * 3600000;
const CACHE_PLACES = 8;
type CacheEntry = { t: number; f: Forecast; aq: AirQuality | null };

const cacheId = (p: Place) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

function readCache(p: Place): CacheEntry | null {
  try {
    const e = (JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheEntry>)[cacheId(p)];
    return e && Date.now() - e.t < CACHE_MAX_AGE ? e : null;
  } catch {
    return null;
  }
}

function writeCache(p: Place, f: Forecast, aq: AirQuality | null) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheEntry>;
    all[cacheId(p)] = { t: Date.now(), f, aq };
    const keep = Object.entries(all).sort((a, b) => b[1].t - a[1].t).slice(0, CACHE_PLACES);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    /* storage full or unavailable */
  }
}

export interface ForecastView {
  el: HTMLElement;
  show(place?: Place): void;
}

export function createForecastView(onShowOnGlobe: (p: Place) => void): ForecastView {
  const el = document.createElement('main');
  el.className = 'view forecast-view';
  el.innerHTML = `
    <div class="fc-top">
      <div class="fc-search"></div>
      <button class="btn icon-btn" data-act="locate" title="Mein Standort" aria-label="Mein Standort">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
      </button>
    </div>
    <nav class="favs" aria-label="Favoriten"></nav>
    <div class="fc-body" aria-live="polite"></div>`;
  el.querySelector('.fc-search')!.appendChild(createSearch((p) => show(p)));

  const body = el.querySelector<HTMLDivElement>('.fc-body')!;
  const favs = el.querySelector<HTMLElement>('.favs')!;
  let current: Place = store.getLastPlace();
  let loadSeq = 0;
  let fcMap: ForecastMap | null = null;

  el.querySelector('[data-act=locate]')!.addEventListener('click', async () => {
    try {
      const { lat, lon } = await locate();
      show(await reverseGeocode(lat, lon));
    } catch {
      toast('Standort konnte nicht ermittelt werden.', 'error');
    }
  });

  function renderFavs() {
    const list = store.getFavorites();
    favs.innerHTML = list
      .map(
        (p, i) =>
          `<button class="chip ${Math.abs(p.lat - current.lat) < 0.01 && Math.abs(p.lon - current.lon) < 0.01 ? 'on' : ''}" data-i="${i}">${escapeHtml(p.name)}</button>`,
      )
      .join('');
    favs.hidden = list.length === 0;
    favs.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => show(list[Number(b.dataset.i)])),
    );
  }

  async function show(place?: Place) {
    if (place) current = place;
    store.setLastPlace(current);
    renderFavs();
    const my = ++loadSeq;
    fcMap?.destroy();
    fcMap = null;
    const cached = readCache(current);
    if (cached) {
      // stale-while-revalidate: show the last forecast at once, refresh in the background
      render(cached.f, cached.aq, []);
      staleNote(cached.t);
    } else body.innerHTML = skeleton();
    try {
      const [f, aq, alerts] = await Promise.all([
        getForecast(current.lat, current.lon),
        getAirQuality(current.lat, current.lon).catch(() => null),
        getAlerts(current.lat, current.lon, current.countryCode).catch((): Alert[] => []),
      ]);
      if (my !== loadSeq) return;
      writeCache(current, f, aq);
      render(f, aq, alerts);
    } catch (e) {
      if (my !== loadSeq) return;
      console.error(e);
      if (cached) {
        staleNote(cached.t, true);
        return;
      }
      body.innerHTML = `<div class="card error-card">
        <h2>Wetterdaten konnten nicht geladen werden</h2>
        <p>Bitte Internetverbindung prüfen und erneut versuchen.</p>
        <button class="btn" data-act="retry">Erneut versuchen</button></div>`;
      body.querySelector('[data-act=retry]')!.addEventListener('click', () => show());
    }
  }

  function staleNote(t: number, failed = false) {
    const at = new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    body.insertAdjacentHTML(
      'afterbegin',
      `<p class="muted small stale-note">${failed ? `Aktualisierung fehlgeschlagen – Stand ${at} Uhr` : `Stand ${at} Uhr – wird aktualisiert …`}</p>`,
    );
  }

  function render(f: Forecast, aq: AirQuality | null, alerts: Alert[]) {
    const c = f.current;
    const d = f.daily;
    const h = f.hourly;
    const hourIdx = Math.max(0, h.time.findIndex((t) => t >= c.time.slice(0, 13)));
    const uvNow = h.uv_index[hourIdx];
    const vis = h.visibility[hourIdx];
    const dew = h.dew_point_2m[hourIdx];
    const isFav = store.isFavorite(current);
    const uv = uvLabel(d.uv_index_max[0]);
    const air = aqiLabel(aq?.current.european_aqi);
    const pollen = aq
      ? (
          [
            ['Erle', aq.current.alder_pollen],
            ['Birke', aq.current.birch_pollen],
            ['Gräser', aq.current.grass_pollen],
            ['Beifuß', aq.current.mugwort_pollen],
            ['Ambrosia', aq.current.ragweed_pollen],
          ] as [string, number | null][]
        ).filter(([, v]) => v != null)
      : [];

    const localTime = new Date(Date.now() + f.utc_offset_seconds * 1000).toISOString().slice(11, 16);

    body.innerHTML = `
      ${alerts.length ? renderAlerts(alerts) : ''}
      <section class="card hero" style="--tc:${tempColor(c.temperature_2m)}">
        <div class="hero-head">
          <div>
            <h1 class="place">${escapeHtml(current.name)}</h1>
            <div class="muted">${escapeHtml([current.region, current.country].filter(Boolean).join(', '))}
              · ${localTime} Uhr Ortszeit · ${Math.round(f.elevation)} m ü. NN</div>
          </div>
          <div class="hero-actions">
            <button class="btn icon-btn ${isFav ? 'on' : ''}" data-act="fav" aria-pressed="${isFav}" title="${isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}">
              <svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>
            </button>
            <button class="btn" data-act="globe" title="Auf Karte zeigen" aria-label="Auf Karte zeigen">
              <svg viewBox="0 0 24 24" class="btn-ic"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>
              Auf Karte
            </button>
          </div>
        </div>
        <div class="hero-main">
          ${weatherIcon(c.weather_code, c.is_day === 1, 112)}
          <div class="hero-temp">${fmt.temp(c.temperature_2m)}</div>
          <div class="hero-desc">
            <div class="desc">${escapeHtml(describe(c.weather_code))}</div>
            <div>Gefühlt ${fmt.temp(c.apparent_temperature)}</div>
            <div class="hl"><span>H ${fmt.temp(d.temperature_2m_max[0])}</span> <span>T ${fmt.temp(d.temperature_2m_min[0])}</span></div>
          </div>
        </div>
      </section>

      <section class="details">
        ${tile('Wind', `<span class="wind-arrow" style="transform:rotate(${c.wind_direction_10m + 180}deg)">↑</span> ${Math.round(c.wind_speed_10m)} <small>km/h</small>`, `aus ${compass(c.wind_direction_10m)} · Bft ${beaufort(c.wind_speed_10m)}`)}
        ${tile('Böen', `${Math.round(c.wind_gusts_10m)} <small>km/h</small>`, `max. heute ${Math.round(d.wind_gusts_10m_max[0])} km/h`)}
        ${tile('Luftfeuchte', `${Math.round(c.relative_humidity_2m)} <small>%</small>`, `Taupunkt ${fmt.temp(dew)}`)}
        ${tile('Luftdruck', `${Math.round(c.pressure_msl)} <small>hPa</small>`, 'auf Meereshöhe')}
        ${tile('Niederschlag', `${fmt.num(d.precipitation_sum[0], 1)} <small>mm</small>`, `heute · ${d.precipitation_probability_max[0] ?? '–'} % Wahrsch.`)}
        ${tile('Bewölkung', `${Math.round(c.cloud_cover)} <small>%</small>`, vis != null ? `Sicht ${fmt.num(vis / 1000, vis < 10000 ? 1 : 0)} km` : '')}
        ${tile('UV-Index', `${fmt.num(uvNow, 0)} <small>jetzt</small>`, `<span class="dot" style="background:${uv.color}"></span>max. ${fmt.num(d.uv_index_max[0], 0)} · ${uv.label}`)}
        ${tile('Sonne', `${fmt.hour(d.sunrise[0])} <small>↑</small> ${fmt.hour(d.sunset[0])} <small>↓</small>`, daylight(d.sunrise[0], d.sunset[0]))}
        ${aq ? tile('Luftqualität', `${fmt.num(aq.current.european_aqi, 0)} <small>EAQI</small>`, `<span class="dot" style="background:${air.color}"></span>${air.label} · PM2.5 ${fmt.num(aq.current.pm2_5, 0)} µg/m³`) : ''}
        ${pollen.length ? tile('Pollen', pollen.filter(([, v]) => (v ?? 0) >= 1).map(([n]) => escapeHtml(n)).join(', ') || 'keine', pollen.map(([n, v]) => `${escapeHtml(n)}: ${pollenLabel(v)}`).join(' · '), 'wide') : ''}
      </section>

      <section class="card">
        <h2>Nächste 48 Stunden</h2>
        <div class="hourly-wrap"></div>
      </section>

      <section class="card fc-map-card"></section>

      <section class="card">
        <h2>14-Tage-Vorhersage</h2>
        ${renderDaily(f)}
      </section>`;

    renderHourlyChart(body.querySelector<HTMLElement>('.hourly-wrap')!, f);
    fcMap?.destroy();
    const mapCard = body.querySelector<HTMLElement>('.fc-map-card')!;
    try {
      fcMap = createForecastMap(mapCard, current, f);
    } catch (e) {
      // the map is optional: a broken map must not take the forecast down with it
      console.warn('Wetterkarte', e);
      fcMap = null;
      mapCard.innerHTML = '<h2>Wetterkarte</h2><p class="muted">Die Karte konnte nicht geladen werden.</p>';
    }

    body.querySelector('[data-act=fav]')!.addEventListener('click', (e) => {
      const on = store.toggleFavorite(current);
      const btn = e.currentTarget as HTMLButtonElement;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      renderFavs();
      toast(on ? `${current.name} zu Favoriten hinzugefügt` : `${current.name} aus Favoriten entfernt`);
    });
    body.querySelector('[data-act=globe]')!.addEventListener('click', () => onShowOnGlobe(current));
  }

  return { el, show };
}

function tile(label: string, value: string, sub = '', cls = '') {
  return `<div class="card tile ${cls}"><div class="tile-label">${label}</div><div class="tile-value">${value}</div><div class="tile-sub">${sub}</div></div>`;
}

function daylight(rise: string, set: string) {
  const mins = (Date.parse(`${set}Z`) - Date.parse(`${rise}Z`)) / 60000;
  if (!Number.isFinite(mins)) return '';
  return `Tageslänge ${Math.floor(mins / 60)} h ${Math.round(mins % 60)} min`;
}

const SEVERITY_DE: Record<Alert['severity'], string> = {
  minor: 'Gering',
  moderate: 'Markant',
  severe: 'Unwetter',
  extreme: 'Extremes Unwetter',
  unknown: 'Hinweis',
};

function renderAlerts(alerts: Alert[]) {
  return `<section class="alerts">${alerts
    .map(
      (a) => `
      <details class="alert sev-${a.severity}">
        <summary>
          <span class="alert-badge">${SEVERITY_DE[a.severity]}</span>
          <span class="alert-title">${escapeHtml(a.headline || a.event)}</span>
          ${a.expires ? `<span class="alert-time">bis ${escapeHtml(fmt.dateTime(a.expires))}</span>` : ''}
        </summary>
        <p>${escapeHtml(a.description)}</p>
        ${a.instruction ? `<p class="instruction">${escapeHtml(a.instruction)}</p>` : ''}
        <p class="muted small">Quelle: ${escapeHtml(a.source)}</p>
      </details>`,
    )
    .join('')}</section>`;
}

function renderDaily(f: Forecast) {
  const d = f.daily;
  const lo = Math.min(...d.temperature_2m_min);
  const hi = Math.max(...d.temperature_2m_max);
  const span = hi - lo || 1;
  return `<ol class="daily">${d.time
    .map((t, i) => {
      const min = d.temperature_2m_min[i];
      const max = d.temperature_2m_max[i];
      const left = ((min - lo) / span) * 100;
      const width = Math.max(4, ((max - min) / span) * 100);
      const prob = d.precipitation_probability_max[i];
      return `<li>
        <span class="d-day"><b>${i === 0 ? 'Heute' : escapeHtml(fmt.weekday(t))}</b> <small>${escapeHtml(fmt.dayMonth(t))}</small></span>
        <span class="d-icon" title="${escapeHtml(describe(d.weather_code[i]))}">${weatherIcon(d.weather_code[i], true, 34)}</span>
        <span class="d-prec ${prob != null && prob >= 30 ? 'wet' : ''}">${prob != null ? `${prob} %` : ''}<small>${d.precipitation_sum[i] > 0 ? `${fmt.num(d.precipitation_sum[i], 1)} mm` : ''}</small></span>
        <span class="d-min">${fmt.temp(min)}</span>
        <span class="d-bar"><span style="left:${left}%;width:${width}%;background:linear-gradient(90deg, ${tempColor(min)}, ${tempColor(max)})"></span></span>
        <span class="d-max">${fmt.temp(max)}</span>
        <span class="d-wind"><span class="wind-arrow" style="transform:rotate(${d.wind_direction_10m_dominant[i] + 180}deg)">↑</span> ${Math.round(d.wind_speed_10m_max[i])} km/h</span>
      </li>`;
    })
    .join('')}</ol>`;
}

function skeleton() {
  return `<div class="card hero skeleton"></div>
    <div class="details">${'<div class="card tile skeleton"></div>'.repeat(8)}</div>
    <div class="card skeleton tall"></div>`;
}
