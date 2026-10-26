import type { Feature, Point } from 'geojson';
import { defineExtra, type ExtraCtx } from '../types';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { bikeSystemPoints, bikeSystemsInView, loadBikeStations } from '../../../api/bikeshare';
import { FONT_BOLD } from '../../vector';

const COLOR = '#66bb6a';
/** stations are loaded and drawn from this zoom on; below it one point per system */
const STATION_ZOOM = 11;
const REFRESH_MS = 60000;

type St = { systems: Map<string, { at: number; features: Feature<Point>[] }>; loading: Set<string>; errors: Set<string>; overview: boolean };
const getState = (ctx: ExtraCtx) => ctx.state<St>('bikeshare', () => ({ systems: new Map(), loading: new Set(), errors: new Set(), overview: false }));

function merge(ctx: ExtraCtx) {
  const st = getState(ctx);
  const features = [...st.systems.values()].flatMap((s) => s.features);
  ctx.setData('bikeshare', { type: 'FeatureCollection', features });
  const zoomedOut = ctx.map.getZoom() < STATION_ZOOM;
  ctx.set('bikeshare', {
    loading: st.loading.size > 0,
    count: zoomedOut ? undefined : features.length || undefined,
    note: zoomedOut ? 'Reinzoomen (Stadt) für Stationen mit freien Rädern' : st.errors.size ? `${[...st.errors].join(', ')} gerade nicht erreichbar` : undefined,
  });
}

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (ctx.map.getZoom() < STATION_ZOOM) return merge(ctx);
  const b = ctx.map.getBounds();
  for (const sys of bikeSystemsInView({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() })) {
    const [id, city] = sys;
    const prev = st.systems.get(id);
    if (st.loading.has(id) || (prev && Date.now() - prev.at < REFRESH_MS - 5000)) continue;
    st.loading.add(id);
    loadBikeStations(sys)
      .then((features) => {
        st.systems.set(id, { at: Date.now(), features });
        st.errors.delete(city);
      })
      .catch((e) => {
        console.warn('Leihräder', id, e);
        st.systems.set(id, { at: Date.now(), features: prev?.features ?? [] });
        st.errors.add(city);
      })
      .finally(() => {
        st.loading.delete(id);
        merge(ctx);
      });
  }
  merge(ctx);
}

export default defineExtra({
  id: 'bikeshare',
  order: 455,
  section: 'infra',
  cat: 'verkehr',
  label: 'Leihräder',
  hint: 'Stationen mit freien Rädern und Plätzen, live – 61 Systeme in Nord- und Südamerika, Norwegen und Spanien (offene GBFS-Feeds der Betreiber)',
  glyph: 'bike',
  icon: 'bike',
  color: COLOR,
  sources: {
    // operator credits as required by the feeds (list after God's Eye View's data credits)
    bikeshare:
      'Leihräder: offene <a href="https://gbfs.org/">GBFS</a>-Feeds der Betreiber (Lyft, BCycle, PBSC, Tembici, nextbike u. a.); ' +
      'BiciMAD: <a href="https://www.emtmadrid.es">Powered by EMT de Madrid</a>; Bicing: Ajuntament de Barcelona (B:SM); AMBici: Àrea Metropolitana de Barcelona; ' +
      'Norwegen: enthält Daten unter der <a href="https://data.norge.no/nlod/en/2.0">NLOD</a> von Oslo, Bergen und Trondheim Bysykkel sowie Entur (Kolumbus, Farte Bysykkel); ' +
      'JCDecaux (Lillestrøm, Valenbisi, Sevici): <a href="https://developer.jcdecaux.com/files/Open-Licence-fr.pdf">Licence Ouverte</a>',
    'bikeshare-systems': '',
  },
  addLayers({ add, hidden }) {
    // overview: one point per system
    add(
      {
        id: 'bikeshare-systems',
        type: 'circle',
        source: 'bikeshare-systems',
        maxzoom: STATION_ZOOM,
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: 'bikeshare-systems-label',
        type: 'symbol',
        source: 'bikeshare-systems',
        minzoom: 4,
        maxzoom: STATION_ZOOM,
        layout: { ...hidden, 'text-field': ['get', 'provider'], 'text-font': FONT_BOLD, 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#c8e6c9', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    // stations: colour by free bikes (none: red, few: orange), grey when not renting
    add(
      {
        id: 'bikeshare',
        type: 'circle',
        source: 'bikeshare',
        minzoom: STATION_ZOOM,
        layout: hidden,
        paint: {
          'circle-color': ['case', ['get', 'off'], '#9e9e9e', ['==', ['get', 'bikes'], 0], '#e53935', ['<', ['get', 'bikes'], 3], '#fb8c00', COLOR],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], STATION_ZOOM, 3, 14, 7, 17, 11],
          'circle-stroke-color': '#0b1a0b',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'bikeshare-count',
        type: 'symbol',
        source: 'bikeshare',
        minzoom: 14,
        layout: { ...hidden, 'text-field': ['to-string', ['get', 'bikes']], 'text-font': FONT_BOLD, 'text-size': 10, 'text-allow-overlap': true },
        paint: { 'text-color': '#000000' },
      },
      'marker',
    );
  },
  enable(ctx) {
    const st = getState(ctx);
    if (!st.overview) {
      st.overview = true;
      ctx.setData('bikeshare-systems', bikeSystemPoints());
    }
    loadNow(ctx);
    ctx.every('bikeshare', REFRESH_MS, () => loadNow(ctx));
  },
  onMoveEnd: loadNow,
  click({ ctx, p, pt, layerId }) {
    if (layerId === 'bikeshare-systems') {
      // jump into the city: the stations appear from STATION_ZOOM on
      ctx.map.easeTo({ center: [pt[0], pt[1]], zoom: STATION_ZOOM + 1.5 });
      return null;
    }
    const rows: [string, string][] = [
      ['Freie Räder', p.off ? 'Station außer Betrieb' : `${p.bikes}${p.ebikes != null ? ` (davon ${p.ebikes} E-Bikes)` : ''}`],
      ['Freie Plätze', p.docks != null ? String(p.docks) : '–'],
    ];
    if (p.capacity != null) rows.push(['Stellplätze', String(p.capacity)]);
    const extra = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
    return { type: 'html', html: cardHtml({ glyph: 'bike', color: COLOR, title: p.name, subtitle: p.sys, date: p.updated || undefined, source: String(p.sys).split(' · ')[0], extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['bikeshare-systems', 'bikeshare-systems-label', 'bikeshare', 'bikeshare-count'],
  clickLayers: ['bikeshare-systems', 'bikeshare'],
});
