import { escapeHtml } from '../util';
import { store } from '../store';
import { mountRawDataLink } from '../inspector/inspector';
import type { KeyDef } from './types';

const modules = import.meta.glob<{ default: KeyDef }>('./keys/*.ts', { eager: true });

export const KEY_DEFS: KeyDef[] = Object.entries(modules)
  .map(([path, m]) => {
    const file = path.slice(path.lastIndexOf('/') + 1, -3);
    if (m.default.id !== file) throw new Error(`settings/keys/${file}.ts defines '${m.default.id}' – file name and id must match`);
    return m.default;
  })
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

const text = (v: string | (() => string)) => (typeof v === 'function' ? v() : v);

const field = (d: KeyDef, value: string) =>
  `<label class="field-label">${escapeHtml(d.label)} <small>(${escapeHtml(text(d.hint))})</small>
          <input type="${d.type ?? 'password'}" data-key="${d.id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(text(d.placeholder))}" autocomplete="off"/></label>`;

/**
 * The settings dialog (API keys, sources). `onSaved` runs after the keys were stored, so the caller
 * can reload what depends on them.
 */
export function openSettings(dialog: HTMLDialogElement, onSaved: () => void) {
  const keys = store.getKeys();
  const section = (s: KeyDef['section']) => KEY_DEFS.filter((d) => d.section === s).map((d) => field(d, keys[d.id] ?? '')).join('\n        ');
  dialog.innerHTML = `
      <form method="dialog" class="keys-form" autocomplete="off">
        <h2>Einstellungen</h2>
        <h3>API-Schlüssel (optional)</h3>
        <p class="small muted">Alle Grundfunktionen laufen ohne Schlüssel. Mit kostenlosen Schlüsseln werden zusätzliche Quellen
        freigeschaltet. Schlüssel werden nur lokal in diesem Browser gespeichert.</p>
        ${section('keys')}
        <h3>Nahverkehr live (optional)</h3>
        ${section('transit')}
        <h3>Datenquellen</h3>
        <div data-rdi></div>
        <p class="small muted">Open-Meteo, RainViewer, DWD, EUMETSAT, NASA (GPM, EONET, GIBS, FIRMS), USGS, EMSC, NOAA/NWS, GDACS,
        PEGELONLINE, Copernicus CAMS, NOAA NDBC/CO-OPS, Open-Meteo Marine, GEBCO, EMODnet, Iowa Environmental Mesonet, Environment Canada, EOX Sentinel-2, OpenTopoMap, AWS Terrain Tiles, adsb.lol, adsb.fi, OpenSky Network, SondeHub, Fintraffic Digitraffic (Straße, Schiene, See), Windy Webcams, DeFlock/deflock-data, NOAA SWPC, Smithsonian GVP, NIFC, NOAA Tsunami, BfS ODL, Safecast,
        The Space Devs, aisstream.io, NGA World Port Index, Upply (UN/LOCODE), NASA GHRSST/AMSR2, Waymarked Trails, Wikidata, USGS MRDS, BGR, Macrostrat, ESA WorldCover, Radio Browser, TfL, Caltrans, Transitous, Amtraker, Entur, MBTA, SEPTA, TTC, data.gov.my, Transport Victoria, CTA, Trafiklab, OpenRailwayMap, Autobahn GmbH, NINA/BBK, CelesTrak, PeeringDB, WRI, OpenStreetMap/OpenFreeMap,
        Overpass API, Blitzortung.org, EURDEP (JRC), Japan Meteorological Agency, Finnish Meteorological Institute, NOAA MRMS, NOAA SPC, Esri World Imagery, NASA Blue/Black Marble,
        Bright Sky, BigDataCloud (Ortsname zum eigenen Standort), Nominatim/OpenStreetMap (Ortsname zum Kartenklick), Open-Meteo Geocoding/Flood (GloFAS), Global Shipping Lanes (P. Benden), PB2002 (Bird 2003), ALERTCalifornia, NYC DOT, DDOT,
        511 Ontario/Alberta, Transport Department HK, LTA Singapur, US National Park Service, Vegagerðin (Island), NZTA (Neuseeland), Transport for NSW, City of Calgary, DriveBC (British Columbia).
        Die genaue Quellenangabe steht unten rechts auf der Karte (ⓘ) bzw. im Popup.
        <a href="https://github.com/malte9799/orbis/blob/main/docs/DATENQUELLEN.md" target="_blank" rel="noopener">Alle Quellen mit Lizenzen</a> ·
        Software-Lizenzen: <a href="./licenses/maplibre-gl.txt" target="_blank">MapLibre GL</a>, <a href="./licenses/three.txt" target="_blank">three.js</a>,
        <a href="./licenses/satellite.js.txt" target="_blank">satellite.js</a>, <a href="./licenses/draco.txt" target="_blank">Draco</a>, <a href="./licenses/flag-icons.txt" target="_blank">flag-icons</a>, <a href="./licenses/mapillary-js.txt" target="_blank">mapillary-js</a>.
        Ein Klick auf die Karte zeigt das aktuelle Wetter an dieser Stelle.</p>
        <div class="dialog-actions">
          <button class="btn small" value="cancel" formnovalidate>Abbrechen</button>
          <button class="btn small primary" value="save">Speichern</button>
        </div>
      </form>`;
  mountRawDataLink(dialog.querySelector<HTMLElement>('[data-rdi]')!, 'row', { beforeOpen: () => dialog.close() });
  dialog.showModal();
  dialog.querySelector('form')!.addEventListener('submit', (e) => {
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value !== 'save') return;
    const next = { ...store.getKeys() };
    for (const d of KEY_DEFS) {
      const v = dialog.querySelector<HTMLInputElement>(`input[data-key=${d.id}]`)!.value.trim() || undefined;
      next[d.id] = d.httpsOnly ? (v && /^https:\/\//.test(v) ? v : undefined) : v;
    }
    store.setKeys(next);
    onSaved();
  });
}
