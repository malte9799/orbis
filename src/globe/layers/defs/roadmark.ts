import { defineExtra, type ExtraCtx } from '../types';
import type { ExpressionSpecification } from 'maplibre-gl';
import { isSuperseded } from '../../../api/overpass';
import { loadRoadMarkings } from '../../../api/roadmark';

// Straßenmarkierungen über der dunkel/hellen Basiskarte: dort sind Straßen nur einfarbige
// Linien. Der Layer zeichnet (1) abgeleitete Linien aus den Vektorkacheln (gestrichelte
// Mittellinie, Randleinien) und (2) die bei OpenStreetMap erfassten Markierungen per Overpass
// (Zebrastreifen, markierte Querungen, road_marking, Überholverbot, Verkehrsinseln).

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('roadmark', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const z = ctx.map.getZoom();
  if (z < 14) {
    ctx.set('roadmark', { note: 'ab Stadtzoom (Zoomstufe 14) – Daten aus OpenStreetMap' });
    return;
  }
  const b = ctx.viewBounds(25);
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('roadmark', { loading: true });
  loadRoadMarkings(b)
    .then((fc) => {
      if (st.key !== key) return;
      ctx.setData('rm-osm', fc);
      const zebras = fc.features.filter((f) => f.properties?.kind === 'zebra').length;
      const land = fc.features.filter((f) => f.properties?.kind === 'island').length;
      ctx.set('roadmark', { loading: false, count: fc.features.length, note: fc.features.length ? `${zebras} Zebrastreifen, ${land} Verkehrsinseln` : 'keine Markierungen im Ausschnitt erfasst' });
    })
    .catch((e) => {
      if (isSuperseded(e) || st.key !== key) return;
      console.warn('Overpass Markierungen', e);
      st.key = '';
      ctx.set('roadmark', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar oder überlastet – bitte erneut verschieben' });
    });
}

export default defineExtra({
  id: 'roadmark',
  order: 525,
  section: 'infra',
  cat: 'verkehr',
  label: 'Straßenmarkierungen',
  hint: 'Mittellinien, Straßenkanten, Zebrastreifen, Sperrlinien & Verkehrsinseln (ab Stadtzoom) – OpenStreetMap',
  glyph: 'markings',
  icon: 'road',
  color: '#b8b8b8',
  sources: { 'rm-osm': 'Markierungen: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)' },
  addLayers({ add, hidden }) {
    // ---- aus den Vektorkacheln abgeleitet (Abstandslinien an der Fahrbahnkante) ----
    const edgeOffset = (s: number): ExpressionSpecification => ['interpolate', ['linear'], ['zoom'], 15, 1.3 * s, 18, 3.4 * s];
    for (const side of [-1, 1]) {
      add(
        {
          id: side < 0 ? 'rm-edge-l' : 'rm-edge-r',
          type: 'line',
          source: 'ofm',
          'source-layer': 'transportation',
          minzoom: 15,
          filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'street']]],
          layout: { ...hidden, 'line-join': 'round' },
          paint: { 'line-color': '#e0e0e0', 'line-width': 0.9, 'line-offset': edgeOffset(side), 'line-opacity': 0.85 },
        },
        'anchor-weather',
      );
    }
    add(
      {
        id: 'rm-dash',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]],
        layout: { ...hidden },
        paint: { 'line-color': '#e0e0e0', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.7, 18, 1.6], 'line-dasharray': [1.6, 2.4], 'line-opacity': 0.85 },
      },
      'anchor-weather',
    );
    // ---- aus OpenStreetMap (Overpass): erfasste Markierungen ----
    add(
      {
        id: 'rm-island-fill',
        type: 'fill',
        source: 'rm-osm',
        minzoom: 14,
        filter: ['==', ['get', 'kind'], 'island'],
        layout: hidden,
        paint: { 'fill-color': '#cfd8dc', 'fill-opacity': 0.4 },
      },
      'anchor-weather',
    );
    add(
      {
        id: 'rm-island-line',
        type: 'line',
        source: 'rm-osm',
        filter: ['==', ['get', 'kind'], 'island'],
        minzoom: 14,
        layout: hidden,
        paint: { 'line-color': '#e0e0e0', 'line-width': 1, 'line-opacity': 0.7 },
      },
      'anchor-weather',
    );
    // Zebrastreifen: die Querungsgeometrie gerade über die Straße → weiße Balken quer zur Fahrbahn
    add(
      {
        id: 'rm-zebra',
        type: 'line',
        source: 'rm-osm',
        filter: ['==', ['get', 'kind'], 'zebra'],
        minzoom: 15,
        layout: hidden,
        paint: { 'line-color': '#e0e0e0', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 2.5, 19, 9], 'line-dasharray': [0.35, 1], 'line-opacity': 0.9 },
      },
      'anchor-weather',
    );
    add(
      {
        id: 'rm-cross',
        type: 'line',
        source: 'rm-osm',
        filter: ['==', ['get', 'kind'], 'cross'],
        minzoom: 15,
        layout: hidden,
        paint: { 'line-color': '#e0e0e0', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.2, 19, 3.2], 'line-dasharray': [2, 2.4], 'line-opacity': 0.8 },
      },
      'anchor-weather',
    );
    add(
      {
        id: 'rm-line',
        type: 'line',
        source: 'rm-osm',
        filter: ['all', ['in', ['get', 'kind'], ['literal', ['marking', 'over']]], ['!=', ['get', 'dash'], true]],
        minzoom: 14,
        layout: { ...hidden, 'line-cap': 'butt' },
        paint: { 'line-color': '#e0e0e0', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 18, 2], 'line-opacity': 0.9 },
      },
      'anchor-weather',
    );
    add(
      {
        id: 'rm-line-dash',
        type: 'line',
        source: 'rm-osm',
        filter: ['all', ['in', ['get', 'kind'], ['literal', ['marking', 'over']]], ['==', ['get', 'dash'], true]],
        minzoom: 14,
        layout: { ...hidden, 'line-cap': 'butt' },
        paint: { 'line-color': '#e0e0e0', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 18, 2], 'line-dasharray': [1.4, 1.7], 'line-opacity': 0.9 },
      },
      'anchor-weather',
    );
  },
  enable(ctx) {
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  layers: ['rm-edge-l', 'rm-edge-r', 'rm-dash', 'rm-island-fill', 'rm-island-line', 'rm-zebra', 'rm-cross', 'rm-line', 'rm-line-dash'],
});
