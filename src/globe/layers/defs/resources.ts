import { defineExtra, type ExtraCtx } from '../types';
import { t } from '../../../i18n';
import type { FeatureCollection } from 'geojson';
import { empty } from '../shared/geo';
import { FONT_REGULAR } from '../../vector';
import { cardHtml } from '../../popup';
import { isSuperseded } from '../../../api/overpass';
import { loadMrds, loadOsmResources, loadWikidataResources } from '../../../api/resources';
import { BGR_KOR250_TILES } from '../../../api/resources';

type St = { wd: FeatureCollection; mrds: FeatureCollection; osm: FeatureCollection; mrdsKey: string; osmKey: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('resources', () => ({ wd: empty(), mrds: empty(), osm: empty(), mrdsKey: '', osmKey: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const z = ctx.map.getZoom();
  if (z >= 7) {
    const b = ctx.viewBounds(4);
    const key = Object.values(b).join(',');
    if (key !== st.mrdsKey) {
      st.mrdsKey = key;
      loadMrds(b)
        .then((fc) => {
          if (st.mrdsKey !== key) return;
          st.mrds = fc;
          merge(ctx);
        })
        .catch((e) => {
          console.warn('USGS MRDS', e);
          st.mrdsKey = '';
        });
    }
  } else if (st.mrds.features.length) {
    st.mrds = empty();
    st.mrdsKey = '';
  }
  if (z >= 10) {
    const b = ctx.viewBounds(20);
    const key = Object.values(b).join(',');
    if (key !== st.osmKey) {
      st.osmKey = key;
      loadOsmResources(b)
        .then((fc) => {
          if (st.osmKey !== key) return;
          st.osm = fc;
          merge(ctx);
        })
        .catch((e) => {
          if (isSuperseded(e) || st.osmKey !== key) return;
          console.warn('Overpass resources', e);
          st.osmKey = '';
        });
    }
  } else if (st.osm.features.length) {
    st.osm = empty();
    st.osmKey = '';
  }
  merge(ctx);
}

function merge(ctx: ExtraCtx) {
  const st = getState(ctx);
  const features = [...st.wd.features, ...st.mrds.features, ...st.osm.features];
  ctx.setData('resources', { type: 'FeatureCollection', features });
  const z = ctx.map.getZoom();
  const level = z < 7 ? t('layers.resources.noteWorld') : z < 10 ? t('layers.resources.noteRegion') : t('layers.resources.noteLocal');
  if (features.length || !ctx.info('resources')?.loading) ctx.set('resources', { count: features.length, note: level });
}

export default defineExtra({
  id: 'resources',
  order: 120,
  section: 'earth',
  cat: 'erde',
  label: 'Rohstoffvorkommen',
  hint: 'Öl, Gas, Kohle, Erze, Steine – weltweit (Wikidata), genauer ab Zoom 7 (USGS, BGR) und 10 (OpenStreetMap)',
  glyph: 'plant',
  icon: 'pick',
  color: '#8d6e63',
  rasters: [
      {
        id: 'kor250',
        tiles: [BGR_KOR250_TILES],
        attribution: 'Rohstoffe DE: © BGR, KOR250',
        maxzoom: 18,
        opacity: 0.8,
        minzoom: 6,
        bounds: [5.5, 47, 15.5, 55.2],
      },
  ],
  sources: { resources: 'Rohstoffe: <a href="https://www.wikidata.org/">Wikidata</a>, <a href="https://mrdata.usgs.gov/mrds/">USGS MRDS</a>, © OpenStreetMap' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'resources',
        type: 'circle',
        source: 'resources',
        layout: { ...hidden, 'circle-sort-key': ['get', 'lvl'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'lvl'], 0, 2.4, 1.6], 8, ['match', ['get', 'lvl'], 0, 6, 4], 13, 7],
          'circle-stroke-color': ['case', ['==', ['get', 'cat'], 'oil'], '#ffb300', 'rgba(255,255,255,0.85)'],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 8, 1.2],
        },
      },
      'marker',
    );
    add(
      {
        id: 'resources-label',
        type: 'symbol',
        source: 'resources',
        minzoom: 9,
        layout: { ...hidden, 'text-field': ['get', 'title'], 'text-font': FONT_REGULAR, 'text-size': 10, 'text-offset': [0, 1.0], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#efebe9', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('resources', Infinity, async () => {
      getState(ctx).wd = await loadWikidataResources();
      merge(ctx);
      return {};
    });
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, pt }) {
    return { type: 'html', html: cardHtml({ glyph: 'plant', color: String(p.color), title: p.title, subtitle: [p.catLabel, p.subtitle].filter(Boolean).join(' · '), source: p.source, url: p.url }), lng: pt[0], lat: pt[1] };
  },
  layers: ['kor250', 'resources', 'resources-label'],
  clickLayers: ['resources'],
});
