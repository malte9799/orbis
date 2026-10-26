import { defineExtra } from '../types';
import { applyAir, getState, loadAircraftNow } from '../shared/air';
import { ExpressionSpecification } from 'maplibre-gl';
import { FONT_BOLD } from '../../vector';

const ALT_COLOR: ExpressionSpecification = [
  'case',
  ['get', 'ground'],
  '#9aa3b5',
  ['interpolate', ['linear'], ['get', 'altM'], 0, '#ffd23f', 3000, '#7bd389', 8000, '#4fc3f7', 12000, '#b388ff'],
];


export default defineExtra({
  id: 'aircraft',
  order: 350,
  section: 'air',
  cat: 'verkehr',
  label: 'Flugzeuge & Hubschrauber',
  hint: 'live, ADS-B – adsb.lol, adsb.fi, OpenSky',
  glyph: 'plane',
  icon: 'plane2',
  color: '#f2c94c',
  sources: { 'aircraft-rotor': '', aircraft: 'Flugdaten: <a href="https://adsb.lol/">adsb.lol</a> (ODbL), <a href="https://adsb.fi/">adsb.fi</a>, <a href="https://opensky-network.org/">OpenSky</a>' },
  addLayers(ctx) {
    const { add, hidden } = ctx;
    add(
      {
        id: 'aircraft',
        type: 'symbol',
        source: 'aircraft',
        filter: ['!=', ['get', 'kind'], 'vehicle'],
        layout: {
          ...hidden,
          'icon-image': ['concat', 'sil-', ['get', 'kind']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.3],
          'icon-rotate': ['case', ['==', ['get', 'kind'], 'balloon'], 0, ['get', 'track']],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 8, ['get', 'callsign']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['case', ['!=', ['get', 'emergency'], ''], '#ff2d55', ALT_COLOR],
          'icon-halo-color': 'rgba(0,0,0,0.75)',
          'icon-halo-width': 1,
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    // the rotor blades of helicopters: an own icon around the same centre, turned by a timer (see below)
    add(
      {
        id: 'aircraft-rotor',
        type: 'symbol',
        source: 'aircraft-rotor',
        layout: {
          ...hidden,
          'icon-image': 'sil-rotor',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.3],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': ['case', ['!=', ['get', 'emergency'], ''], '#ff2d55', ALT_COLOR],
          'icon-halo-color': 'rgba(0,0,0,0.75)',
          'icon-halo-width': 1,
        },
      },
      'marker',
    );
    // vehicles on the airfield (ADS-B category C1/C2): small car icon + callsign, clickable
    add(
      {
        id: 'aircraft-vehicle',
        type: 'symbol',
        source: 'aircraft',
        minzoom: 12,
        filter: ['==', ['get', 'kind'], 'vehicle'],
        layout: {
          ...hidden,
          'icon-image': 'sil-vehicle',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.55, 16, 0.85, 19, 1.1],
          'icon-rotate': ['get', 'track'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['step', ['zoom'], '', 13, ['get', 'callsign']],
          'text-font': FONT_BOLD,
          'text-size': 9,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
          'text-allow-overlap': false,
        },
        paint: {
          'icon-color': '#ffd23f',
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
          'text-color': '#ffd23f',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    const st = getState(ctx);
    // the blades turn: the (few) helicopter positions go into their own source with a changing angle
    window.setInterval(() => {
      if (document.hidden || !ctx.isOn('aircraft')) return;
      if (!st.heliFeatures.length && !st.rotorShown) return;
      const rot = (performance.now() * 0.3) % 360;
      st.rotorShown = st.heliFeatures.length > 0;
      ctx.setData('aircraft-rotor', { type: 'FeatureCollection', features: st.heliFeatures.map((f) => ({ ...f, properties: { ...f.properties, rot } })) });
    }, 90);
  },
  apply: applyAir,
  onMoveEnd: loadAircraftNow,
  enable(ctx) {
    loadAircraftNow(ctx);
    ctx.every('aircraft', 10000, () => loadAircraftNow(ctx));
  },
  click({ p, pt }) {
  return { type: 'flight', hex: String(p.hex), lng: pt[0], lat: pt[1] };
  },
  layers: ['aircraft', 'aircraft-rotor', 'aircraft-vehicle'],
  clickLayers: ['aircraft', 'aircraft-vehicle'],
});
