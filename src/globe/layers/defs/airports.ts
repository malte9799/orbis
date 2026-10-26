import { defineExtra, type ExtraCtx } from '../types';
import { AIRPORT_ZOOM } from '../../airport3d';
import type { Feature, Point } from 'geojson';
import { FONT_BOLD } from '../../vector';
import { LayerSpecification } from 'maplibre-gl';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { loadAirportFlights } from '../../../api/transport';
import { staticAirports } from '../../../api/airport';
import { heightTxt, clockTxt } from '../../../units';

export const AIRPORT_FAR = ['airports-far-1', 'airports-far-2', 'airports-far-3'];

async function loadFarAirports(ctx: ExtraCtx) {
  const list = await staticAirports();
  const area = (b: number[]) => (b[2] - b[0]) * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180) * (b[3] - b[1]) * 111.32 ** 2; // km²
  const features: Feature<Point>[] = list
    .filter((a) => a.iata)
    .map((a) => {
      const km2 = area(a.bbox);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [(a.bbox[0] + a.bbox[2]) / 2, (a.bbox[1] + a.bbox[3]) / 2] },
        properties: { icao: a.icao, iata: a.iata, name: a.name, tier: km2 >= 45 ? 1 : km2 >= 30 ? 2 : 3 },
      };
    });
  ctx.setData('airports-far', { type: 'FeatureCollection', features });
}

export default defineExtra({
  id: 'airports',
  order: 380,
  section: 'air',
  cat: 'verkehr',
  label: 'Flughäfen',
  hint: 'mit Abflügen & Ankünften vom Vortag – OpenSky',
  glyph: 'airport',
  icon: 'plane2',
  color: '#90caf9',
  sources: { 'airports-far': '' },
  addLayers({ add, hidden }) {
    const airportLayer = (id: string, minzoom: number, classes: string[], textOverlap: boolean): LayerSpecification => ({
      id,
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'aerodrome_label',
      minzoom,
      filter: ['all', ['has', 'iata'], ['in', ['get', 'class'], ['literal', classes]]],
      layout: {
        ...hidden,
        'icon-image': 'glyph-airport',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 3, 1, 9, 1.3],
        'text-field': ['step', ['zoom'], '', 4, ['get', 'iata']],
        'text-font': FONT_BOLD,
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
        // icons and names stay visible at medium zoom (~50 km) and are not hidden by place labels of the base map
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': textOverlap,
      },
      paint: { 'text-color': '#cfe6ff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
    });
    add(airportLayer('airports', 1, ['international'], true), 'marker');
    // The map tiles only carry airports from zoom 8. The big ones (from our own airport list, by size) show up earlier:
    // the largest from zoom 5, then 6 and 7.
    AIRPORT_FAR.forEach((id, i) => {
      const spec = airportLayer(id, 5 + i, [], true);
      add({ ...spec, source: 'airports-far', 'source-layer': undefined, maxzoom: 8, filter: ['==', ['get', 'tier'], i + 1], layout: { ...spec.layout, 'text-field': ['get', 'iata'] } } as LayerSpecification, 'marker');
    });
    add(airportLayer('airports-minor', 5.5, ['public', 'regional', 'other', 'military', 'private'], false), 'marker');
  },
  apply(ctx) {
    // the airport symbols make room for the 3D airport once it is drawn
    const maxZoom = ctx.isOn('airport3d') ? AIRPORT_ZOOM : 24;
    for (const [id, min] of [['airports', 1], ['airports-minor', 5.5]] as const) if (ctx.map.getLayer(id)) ctx.map.setLayerZoomRange(id, min, maxZoom);
  },
  enable(ctx) {
    ctx.set('airports', { note: 'Klick auf einen Flughafen zeigt Abflüge & Ankünfte vom Vortag' });
    void loadFarAirports(ctx);
  },
  click({ p, pt }) {
    const icao = String(p.icao ?? '');
    const name = String(p['name:de'] ?? p.name ?? 'Flughafen');
    const code = [p.iata, icao].filter(Boolean).join(' / ');
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'airport',
        color: '#90caf9',
        title: name,
        subtitle: [code, p.ele != null ? `${heightTxt(Number(p.ele))} ü. NN` : ''].filter(Boolean).join(' · '),
        source: 'OpenStreetMap, OpenSky Network',
        url: icao ? `https://opensky-network.org/network/explorer?airport=${encodeURIComponent(icao)}` : undefined,
        extra: icao ? '<div class="pop-loading small">Flüge vom Vortag werden geladen …</div>' : '',
      }),
      lng: pt[0],
      lat: pt[1],
      after: (node) => {
        if (!icao) return;
        loadAirportFlights(icao)
          .then((r) => {
            const list = (l: { callsign: string; other: string; time: number }[], arrow: string) =>
              l
                .slice(0, 6)
                .map((f) => `<span>${escapeHtml(clockTxt(f.time))}</span><b>${escapeHtml(f.callsign || '–')} ${arrow} ${escapeHtml(f.other)}</b>`)
                .join('');
            const el = node.querySelector('.pop-loading');
            if (!el) return;
            el.outerHTML = r.departures.length + r.arrivals.length
              ? `<div class="small muted">Vortag: ${r.departures.length} Abflüge, ${r.arrivals.length} Ankünfte</div>
                 ${r.departures.length ? `<div class="pop-sub">Letzte Abflüge</div><div class="pop-grid two">${list(r.departures, '→')}</div>` : ''}
                 ${r.arrivals.length ? `<div class="pop-sub">Letzte Ankünfte</div><div class="pop-grid two">${list(r.arrivals, '←')}</div>` : ''}`
              : '<div class="small muted">Keine Flugdaten vom Vortag verfügbar.</div>';
          })
          .catch(() => {
            const el = node.querySelector('.pop-loading');
            if (el) el.textContent = 'OpenSky gerade nicht erreichbar (Tageskontingent ohne Konto begrenzt).';
          });
      },
    };
  },
  layers: ['airports', 'airports-minor', ...AIRPORT_FAR],
  clickLayers: ['airports', 'airports-minor', ...AIRPORT_FAR],
});
