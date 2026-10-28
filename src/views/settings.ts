/** Settings slide-over panel (Allgemein · Einheiten · API-Schlüssel · Entwickleroptionen). */
import { mountRawDataLink } from '../inspector/inspector';
import { KEY_DEFS, KEY_GROUPS, text, type KeyDef } from '../settings';
import { store, type AppOptions } from '../store';
import { debounce, escapeHtml, toast } from '../util';
import { tempUnit, windUnit, rainUnit, pressureUnit } from '../units';


const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const CHEV_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const INFO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';

type UnitRow = { key: keyof AppOptions; label: string; opts: [string, string][] };  const UNIT_SETS: UnitRow[] = [
  { key: 'tz', label: 'Zeitzone', opts: [['auto', 'Ortszeit'], ['utc', 'UTC']] },
  { key: 'hour12', label: 'Uhrzeit', opts: [['24h', '24 Std.'], ['12h', '12 Std. (AM/PM)']] },
  { key: 'temp', label: 'Temperatur', opts: [['c', '°C'], ['f', '°F']] },
  { key: 'wind', label: 'Wind', opts: [['kmh', 'km/h'], ['ms', 'm/s'], ['mph', 'mph'], ['kn', 'Knoten'], ['bft', 'Bft']] },
  { key: 'windDir', label: 'Windrichtung', opts: [['compass', 'Kompass'], ['deg', 'Grad']] },
  { key: 'rain', label: 'Niederschlag', opts: [['mm', 'mm/h'], ['in', 'in/h'], ['dbz', 'dBZ']] },
  { key: 'pressure', label: 'Luftdruck', opts: [['hpa', 'hPa'], ['mb', 'mb'], ['mmhg', 'mmHg'], ['inhg', 'inHg']] },
  { key: 'dist', label: 'Distanz', opts: [['km', 'km'], ['mi', 'Meilen'], ['nmi', 'Seemeilen']] },
  { key: 'height', label: 'Höhe, Tiefe & Wellen', opts: [['m', 'Meter'], ['ft', 'Fuß (ft)']] },
  { key: 'area', label: 'Fläche', opts: [['km2', 'km²'], ['mi2', 'mi²'], ['acre', 'Acre'], ['ha', 'Hektar']] },
  { key: 'burned', label: 'Verbrannte Fläche', opts: [['km2', 'km²'], ['mi2', 'mi²'], ['acre', 'Acre'], ['ha', 'Hektar']] },
  { key: 'coords', label: 'Koordinaten', opts: [['dec', 'Dezimalgrade'], ['gms', 'GMS']] },
];

/** compact summary of the active unit selection for the accordion badge */
const unitBadge = () =>
  ((store.getOptions().tz ?? 'auto') === 'utc' ? 'UTC' : 'Ortszeit') +
  ' · ' +
  ((store.getOptions().hour12 ?? '24h') === '12h' ? '12 Std.' : '24 Std.') +
  ' · ' +
  [tempUnit(), windUnit(), rainUnit(), pressureUnit()].join(' · ');

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export interface SettingsPanel {
  open(): void;
  close(): void;
}

/**
 * `hooks.onKeysSaved` runs after the API keys were stored (debounced while typing),
 * so the host can reload the feeds that depend on them.
 */
export function createSettingsPanel(panel: HTMLElement, scrim: HTMLElement, hooks: { onKeysSaved(): void }): SettingsPanel {
  /** accordion state survives closing/reopening the panel */
  const openSecs = new Set<string>(['general']);
  const secOpen = (id: string) => (openSecs.has(id) ? ' open' : '');
  let opener: HTMLElement | null = null;
  let built = false;

  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'sp-title');

  const updateUnitBadge = () => {
    const el = panel.querySelector<HTMLElement>('[data-unit-badge]');
    if (el) el.textContent = unitBadge();
  };

  const buildSettings = () => {
    const keys = store.getKeys();
    const opts = store.getOptions();
    const filled = Object.entries(keys).filter(([, v]) => !!v).length;
    const keyRow = (d: KeyDef) => {
      const opt = typeof d.optional === 'function' ? d.optional() : d.optional;
      return `
      <div class="krow">
        <span class="k-l"><span class="k-n">${escapeHtml(d.label)}${opt ? ' <span class="k-opt">(optional)</span>' : ''}</span><span class="k-tip" role="tooltip">${escapeHtml(text(d.tip))}</span><details class="ii"><summary aria-label="Kurzanleitung für ${escapeHtml(d.label)}">${INFO_ICON}</summary><span class="ii-t"><ol>${d.steps.map((st) => `<li>${st.u ? `<a href="${st.u}" target="_blank" rel="noopener">${escapeHtml(st.t)}</a>` : escapeHtml(st.t)}</li>`).join('')}</ol></span></details></span>
        <input type="${d.type ?? 'password'}" data-key="${d.id}" value="${escapeHtml(keys[d.id] ?? '')}" placeholder="${escapeHtml(text(d.placeholder))}" autocomplete="off" ${d.type === 'url' ? 'spellcheck="false"' : ''}/>
      </div>`;
    };
    panel.innerHTML = `
      <div class="sp-head">
        <h2 id="sp-title">Einstellungen</h2>
        <button type="button" class="sp-x" aria-label="Einstellungen schließen">${X_ICON}</button>
      </div>
      <div class="sp-body">
        <details class="sp-sec" data-sec="general"${secOpen('general')}>
          <summary>Allgemein<span class="chev">${CHEV_ICON}</span></summary>
          <div class="sp-inner">
            <div class="sp-row"><span class="sp-row-t">Wetter beim Kartenklick<small>Ein freier Klick zeigt das Wetter am geklickten Ort</small></span>
              <button type="button" class="sp-tog ${opts.clickWx ? 'on' : ''}" role="switch" aria-checked="${opts.clickWx}" aria-label="Wetter beim Kartenklick" data-opt="clickWx"></button></div>
          </div>
        </details>
        <details class="sp-sec" data-sec="units"${secOpen('units')}>
          <summary>Einheiten<span class="sub" data-unit-badge>${unitBadge()}</span><span class="chev">${CHEV_ICON}</span></summary>
          <div class="sp-inner">
            ${UNIT_SETS.map((s) => {
              const cur = String(opts[s.key] ?? s.opts[0][0]);
              return `<div class="sp-row"><span class="sp-row-t" id="u-${s.key}">${escapeHtml(s.label)}</span></div>
              <div class="sp-seg" role="radiogroup" aria-labelledby="u-${s.key}" style="grid-template-columns: repeat(${s.opts.length}, 1fr)">
                ${s.opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${cur === v}" tabindex="${cur === v ? 0 : -1}" data-u="${s.key}" data-v="${v}" class="${cur === v ? 'on' : ''}">${escapeHtml(t)}</button>`).join('')}
              </div>`;
            }).join('')}
          </div>
        </details>
        <details class="sp-sec" data-sec="keys"${secOpen('keys')}>
          <summary>API-Schlüssel<span class="sub" data-badge>${filled ? `${filled} aktiv` : 'optional'}</span><span class="chev">${CHEV_ICON}</span></summary>
          <div class="sp-inner">
            <p class="sp-note">Grundfunktionen laufen ohne Schlüssel. Kostenlose Schlüssel schalten zusätzliche Quellen frei – sie werden nur lokal in diesem Browser gespeichert.</p>
            ${KEY_GROUPS.map((g) => `<div class="ksub">${escapeHtml(g.label)}</div>${KEY_DEFS.filter((d) => d.group === g.id).map(keyRow).join('')}`).join('')}
          </div>
        </details>
        <details class="sp-sec" data-sec="dev"${secOpen('dev')}>
          <summary>Entwickleroptionen<span class="chev">${CHEV_ICON}</span></summary>
          <div class="sp-inner">
            <div data-rdi></div>
            <details class="sp-src">
              <summary>Alle Quellen mit Lizenzen</summary>
              <p class="small">Open-Meteo, RainViewer, DWD, EUMETSAT, NASA (GPM, EONET, GIBS, FIRMS), USGS, EMSC, NOAA/NWS, GDACS,
              PEGELONLINE, Copernicus CAMS, NOAA NDBC/CO-OPS, Open-Meteo Marine, GEBCO, EMODnet, Iowa Environmental Mesonet, Environment Canada, EOX Sentinel-2, OpenTopoMap, AWS Terrain Tiles, adsb.lol, adsb.fi, OpenSky Network, SondeHub, Fintraffic Digitraffic (Straße, Schiene, See), Windy Webcams, DeFlock/deflock-data, NOAA SWPC, Smithsonian GVP, NIFC, NOAA Tsunami, BfS ODL, Safecast,
              The Space Devs, aisstream.io, NGA World Port Index, Upply (UN/LOCODE), NASA GHRSST/AMSR2, Waymarked Trails, Wikidata, USGS MRDS, BGR, Macrostrat, ESA WorldCover, Radio Browser, TfL, Caltrans, Transitous, Amtraker, Entur, MBTA, SEPTA, TTC, data.gov.my, Transport Victoria, CTA, Trafiklab, OpenRailwayMap, Autobahn GmbH, NINA/BBK, CelesTrak, PeeringDB, WRI, OpenStreetMap/OpenFreeMap, Protomaps,
              Overpass API, Blitzortung.org, EURDEP (JRC), Japan Meteorological Agency, Finnish Meteorological Institute, NOAA MRMS, NOAA SPC, Esri World Imagery, NASA Blue/Black Marble,
              Bright Sky, BigDataCloud (Ortsname zum eigenen Standort), Nominatim/OpenStreetMap (Ortsname zum Kartenklick), Open-Meteo Geocoding/Flood (GloFAS), Global Shipping Lanes (P. Benden), PB2002 (Bird 2003), ALERTCalifornia, NYC DOT, DDOT,
              511 Ontario/Alberta, Transport Department HK, LTA Singapur, US National Park Service, Vegagerðin (Island), NZTA (Neuseeland), Transport for NSW, City of Calgary, DriveBC (British Columbia).
              Die genaue Quellenangabe steht unten rechts auf der Karte (ⓘ) bzw. im Popup.</p>
            </details>
            <p class="small sp-lic">Software-Lizenzen: <a href="./licenses/maplibre-gl.txt" target="_blank">MapLibre GL</a>, <a href="./licenses/three.txt" target="_blank">three.js</a>,
            <a href="./licenses/satellite.js.txt" target="_blank">satellite.js</a>, <a href="./licenses/draco.txt" target="_blank">Draco</a>, <a href="./licenses/flag-icons.txt" target="_blank">flag-icons</a>, <a href="./licenses/mapillary-js.txt" target="_blank">mapillary-js</a>.</p>
          </div>
        </details>
      </div>`;
    mountRawDataLink(panel.querySelector<HTMLElement>('[data-rdi]')!, 'row');
    updateKeyBadge();
    wireGuides();
  };

  /** ⓘ-guided guides open on hover (with a small close delay so the tooltip gap

  /** ⓘ-guided guides open on hover (with a small close delay so the tooltip gap
   *  can be crossed); on touch devices the click toggle stays as before. */
  const wireGuides = () => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    for (const d of panel.querySelectorAll<HTMLDetailsElement>('details.ii')) {
      let timer: number | undefined;
      d.addEventListener('mouseenter', () => {
        clearTimeout(timer);
        for (const other of panel.querySelectorAll<HTMLDetailsElement>('details.ii[open]')) if (other !== d) other.open = false;
        d.open = true;
      });
      d.addEventListener('mouseleave', () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => { d.open = false; }, 200);
      });
    }
  };

  const updateKeyBadge = () => {
    const sub = panel.querySelector<HTMLElement>('[data-badge]');
    if (!sub) return;
    const n = Object.values(store.getKeys()).filter(Boolean).length;
    sub.textContent = n ? `${n} aktiv` : 'optional';
  };

  /** keys are saved while typing; the host reacts like it did on the old modal */
  const persistSettings = debounce(() => {
    const next = { ...store.getKeys() };
    for (const d of KEY_DEFS) {
      const v = panel.querySelector<HTMLInputElement>(`input[data-key=${d.id}]`)?.value.trim() || undefined;
      next[d.id] = d.httpsOnly ? (v && /^https:\/\//.test(v) ? v : undefined) : v;
    }
    store.setKeys(next);
    hooks.onKeysSaved();
    updateKeyBadge();
    toast('Einstellungen gespeichert');
  }, 500);

  /** Esc closes, Tab stays inside the dialog */
  const onKey = (e: KeyboardEvent) => {
    if (panel.hidden) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  };

  function open() {
    if (!built) {
      buildSettings();
      built = true;
    }
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.hidden = false;
    scrim.hidden = false;
    document.addEventListener('keydown', onKey);
    panel.querySelector<HTMLElement>('.sp-x')!.focus();
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    scrim.hidden = true;
    document.removeEventListener('keydown', onKey);
    opener?.focus();
    opener = null;
  }

  scrim.addEventListener('click', close);
  // remember which accordions are open ('toggle' does not bubble → capture); only one info guide open at a time
  panel.addEventListener('toggle', (e) => {
    const d = e.target as HTMLDetailsElement;
    if (d.tagName !== 'DETAILS') return;
    if (d.dataset.sec) {
      if (d.open) openSecs.add(d.dataset.sec);
      else openSecs.delete(d.dataset.sec);
      return;
    }
    if (!d.open || !d.matches('.ii')) return;
    for (const other of panel.querySelectorAll<HTMLDetailsElement>('details.ii[open]')) if (other !== d) other.open = false;
  }, true);

  const selectUnit = (btn: HTMLButtonElement) => {
    const k = btn.dataset.u as keyof AppOptions;
    store.setOptions({ ...store.getOptions(), [k]: btn.dataset.v });
    for (const b of panel.querySelectorAll<HTMLButtonElement>(`button[data-u="${k}"]`)) {
      const on = b === btn;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    updateUnitBadge();
  };

  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.sp-x')) {
      close();
      return;
    }
    const unit = t.closest<HTMLButtonElement>('button[data-u]');
    if (unit) {
      selectUnit(unit);
      return;
    }
    const tog = t.closest<HTMLButtonElement>('button[data-opt]');
    if (tog) {
      const on = tog.classList.toggle('on');
      store.setOptions({ ...store.getOptions(), [tog.dataset.opt!]: on });
      tog.setAttribute('aria-checked', String(on));
    }
  });
  // radiogroup: arrow keys move between the options of one unit
  panel.addEventListener('keydown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-u]');
    if (!btn || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const group = [...(btn.parentElement?.querySelectorAll<HTMLButtonElement>('button[data-u]') ?? [])];
    const next = group[(group.indexOf(btn) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : group.length - 1)) % group.length];
    next.focus();
    selectUnit(next);
  });
  panel.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).matches?.('.sp-body input[data-key]')) persistSettings();
  });

  return { open, close };
}
