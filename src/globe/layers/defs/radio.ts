import { defineExtra, type ExtraCtx } from '../types';
import { t } from '../../../i18n';
import type { FeatureCollection } from 'geojson';
import { empty } from '../shared/geo';
import { FONT_REGULAR } from '../../vector';
import { cardHtml } from '../../popup';
import { loadNearbyStations, loadTopStations } from '../../../api/radio';
import { playStation, radioPopupExtra } from '../../player';

type St = { top: FeatureCollection | null; near: FeatureCollection; key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('radio', () => ({ top: null, near: empty(), key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!st.top && !ctx.info('radio')?.loading) {
    ctx.set('radio', { loading: true });
    loadTopStations()
      .then((fc) => {
        st.top = fc;
        merge(ctx);
      })
      .catch((e) => {
        console.warn('Radio Browser', e);
        ctx.set('radio', { loading: false, note: t('layers.radio.noteFail') });
      });
  }
  const z = ctx.map.getZoom();
  if (z < 6) {
    ctx.set('radio', { note: t('layers.radio.noteStart') });
    return;
  }
  const c = ctx.map.getCenter();
  const b = ctx.map.getBounds();
  const km = Math.min(600, (Math.abs(b.getNorth() - b.getSouth()) * 111) / 1.4);
  const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${Math.round(km / 25)}`;
  if (key === st.key) return;
  st.key = key;
  loadNearbyStations(c.lat, c.lng, km)
    .then((fc) => {
      if (st.key !== key) return;
      st.near = fc;
      merge(ctx);
    })
    .catch((e) => {
      console.warn('Radio Browser nearby', e);
      st.key = '';
    });
}

function merge(ctx: ExtraCtx) {
  const st = getState(ctx);
  const seen = new Set<string>();
  const features = [...st.near.features, ...(st.top?.features ?? [])].filter((f) => {
    const id = String(f.properties?.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  ctx.setData('radio', { type: 'FeatureCollection', features });
  const playable = features.filter((f) => f.properties?.playable).length;
  ctx.set('radio', { loading: false, count: features.length, note: t('layers.radio.notePlayable', { count: playable }) });
}

export default defineExtra({
  id: 'radio',
  order: 680,
  section: 'cams',
  cat: 'medien',
  label: 'Radiosender',
  hint: 'über 50.000 Sender weltweit – direkt anhören (Radio Browser)',
  glyph: 'radio',
  icon: 'radio',
  color: '#ff4081',
  sources: { radio: 'Radiosender: <a href="https://www.radio-browser.info/">Radio Browser</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'radio',
        type: 'circle',
        source: 'radio',
        layout: { ...hidden, 'circle-sort-key': ['get', 'clicks'] },
        paint: {
          'circle-color': ['case', ['get', 'playable'], '#ff4081', '#b0789a'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['interpolate', ['linear'], ['get', 'clicks'], 0, 1.5, 5000, 4], 8, ['interpolate', ['linear'], ['get', 'clicks'], 0, 4, 5000, 8]],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.3, 8, 1.2],
          'circle-opacity': 0.9,
        },
      },
      'marker',
    );
    add(
      {
        id: 'radio-label',
        type: 'symbol',
        source: 'radio',
        minzoom: 8,
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 10, 'text-offset': [0, 1.0], 'text-anchor': 'top', 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'clicks']] },
        paint: { 'text-color': '#ffd1e3', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, pt }) {
    return {
      type: 'html',
      html: cardHtml({ glyph: 'radio', color: '#ff4081', title: p.name, source: 'Radio Browser', extra: radioPopupExtra(p) }),
      lng: pt[0],
      lat: pt[1],
      after: (node) =>
        node.querySelector('.rp-play')?.addEventListener('click', () =>
          playStation({ id: String(p.id), name: String(p.name), stream: String(p.stream), favicon: String(p.favicon ?? ''), place: String(p.place ?? '') }),
        ),
    };
  },
  layers: ['radio', 'radio-label'],
  clickLayers: ['radio'],
});
