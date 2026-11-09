import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { cyberFeatures } from '../shared/intel';
import { loadCyberServers } from '../../../api/cyber';

const COLOR = '#d500f9';
const SOURCE = 'Feodo Tracker (abuse.ch, CC0)';
const NO_DATA = 'keine Server mit Standort – die Quelle liefert Koordinaten nur über den Snapshot';

export default defineExtra({
  id: 'cyberc2',
  order: 820,
  section: 'konflikt',
  cat: 'netze',
  label: 'Botnet-C2-Server',
  hint: 'Befehlsserver (C2) bekannter Botnetze (z. B. QakBot, Emotet) laut Feodo Tracker; nur Einträge mit Standort. Der Standort der IP ist ungefähr.',
  glyph: 'radio',
  icon: 'warn',
  color: COLOR,
  sources: { cyberc2: 'Botnet-C2-Server: <a href="https://feodotracker.abuse.ch/">Feodo Tracker</a>, abuse.ch (CC0)' },
  addLayers({ add, hidden, setData }) {
    setData('cyberc2', empty());
    add(
      {
        id: 'cyberc2',
        type: 'circle',
        source: 'cyberc2',
        layout: hidden,
        paint: {
          'circle-color': ['match', ['get', 'status'], 'online', COLOR, '#8e6b99'],
          'circle-opacity': 0.8,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 8, 6, 12, 9],
          'circle-stroke-color': '#2a0033',
          'circle-stroke-width': 0.8,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('cyberc2', 3600000, async () => {
      try {
        const fc = cyberFeatures(await loadCyberServers());
        ctx.setData('cyberc2', fc);
        return { count: fc.features.length, note: fc.features.length ? undefined : NO_DATA };
      } catch {
        ctx.setData('cyberc2', empty());
        return { count: 0, note: 'Daten nicht erreichbar' };
      }
    });
  },
  click({ p, pt }) {
    const sub = [p.status, p.malware, p.country, p.as, `Port ${p.port}`, p.last ? `zuletzt online ${p.last}` : ''].filter(Boolean).join(' · ');
    return { type: 'html', html: cardHtml({ glyph: 'radio', color: COLOR, title: `C2-Server ${p.ip}`, subtitle: sub, source: SOURCE, url: 'https://feodotracker.abuse.ch/' }), lng: pt[0], lat: pt[1] };
  },
  layers: ['cyberc2'],
  clickLayers: ['cyberc2'],
});
