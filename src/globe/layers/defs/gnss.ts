import { defineExtra } from '../types';
import { loadAircraftNow } from '../shared/air';
import { renderGnss } from '../shared/gnss';

const COLOR = '#ff9800';

export default defineExtra({
  id: 'gnss',
  order: 355,
  section: 'air',
  cat: 'verkehr',
  label: 'GPS-Störungen',
  hint: 'vermutetes Jamming/Spoofing aus der Navigationsgenauigkeit der Flugzeuge (ab Zoom 5, sammelt 30 min) – adsb.lol',
  glyph: 'satellite',
  icon: 'sat',
  color: COLOR,
  sources: { 'gnss-ac': '', gnss: 'GPS-Störungen: Flugdaten <a href="https://adsb.lol/">adsb.lol</a> (ODbL), Methode nach <a href="https://gpsjam.org/">gpsjam.org</a>' },
  addLayers({ add, hidden }) {
    const fill = ['match', ['get', 'level'], 'high', '#ff3b30', 'medium', '#ffb300', '#4caf50'];
    add(
      {
        id: 'gnss-fill',
        type: 'fill',
        source: 'gnss',
        layout: hidden,
        paint: { 'fill-color': fill as never, 'fill-opacity': ['match', ['get', 'level'], 'low', 0.18, 0.45] },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'gnss-line',
        type: 'line',
        source: 'gnss',
        layout: hidden,
        filter: ['!=', ['get', 'level'], 'low'],
        paint: { 'line-color': fill as never, 'line-width': 0.8, 'line-opacity': 0.8 },
      },
      'lbl-border-country',
    );
    // aircraft that report bad navigation right now (lost GPS: at the last good position)
    add(
      {
        id: 'gnss-ac',
        type: 'circle',
        source: 'gnss-ac',
        layout: hidden,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 7, 10, 13],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': ['case', ['get', 'lost'], '#ff3b30', '#ffb300'],
          'circle-stroke-width': 2,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    // the aircraft layer already loads the live data on its own timer; feeding the cells happens in shared/air.ts
    const tick = () => {
      if (!ctx.isOn('aircraft')) loadAircraftNow(ctx);
      const { cells, anomalies, badNow } = renderGnss(ctx);
      const zoomedOut = ctx.map.getZoom() < 5;
      ctx.set('gnss', {
        loading: false,
        count: anomalies,
        note: zoomedOut
          ? `${cells} Zellen gesammelt – ab Zoom 5 kommen neue Messungen dazu`
          : `${badNow} Flugzeuge melden gerade ungenaue Navigation (Ring) · ${anomalies} von ${cells} Zellen auffällig – Zellen füllen sich über 30 min`,
      });
    };
    tick();
    ctx.every('gnss', 15000, tick);
  },
  onMoveEnd(ctx) {
    if (!ctx.isOn('aircraft')) loadAircraftNow(ctx);
  },
  click({ at, html }) {
    return { type: 'html', html: html('satellite', COLOR), lng: at.lng, lat: at.lat };
  },
  layers: ['gnss-fill', 'gnss-line', 'gnss-ac'],
  clickLayers: ['gnss-fill'],
});
