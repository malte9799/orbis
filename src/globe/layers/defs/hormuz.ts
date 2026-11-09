import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { hormuzFeatures } from '../shared/intel';
import { loadHormuz, type HormuzStatus } from '../../../api/hormuz';
import { escapeHtml } from '../../../util';

const COLOR = '#ffa726';
const SOURCE = 'hormuz.now (AIS-Positionen, Verkehrslage)';
const CAT_COLOR: Record<string, string> = { tanker: '#ef5350', cargo: '#42a5f5', passenger: '#ab47bc' };

let status: HormuzStatus['status'] | undefined;

export default defineExtra({
  id: 'hormuz',
  order: 440,
  section: 'infra',
  cat: 'verkehr',
  label: 'Straße von Hormuz: Schiffe',
  hint: 'Schiffe in und um die Straße von Hormuz nach AIS (hormuz.now), Farbe nach Schiffstyp; Klick zeigt Ziel und die aktuelle Verkehrslage der Meerenge.',
  glyph: 'vessel',
  icon: 'ship',
  color: COLOR,
  sources: { hormuz: 'Schiffe Straße von Hormuz: <a href="https://hormuz.now/">hormuz.now</a> (AIS)' },
  addLayers({ add, hidden, setData }) {
    setData('hormuz', empty());
    add(
      {
        id: 'hormuz',
        type: 'circle',
        source: 'hormuz',
        layout: hidden,
        paint: {
          'circle-color': ['match', ['get', 'cat'], 'tanker', CAT_COLOR.tanker, 'cargo', CAT_COLOR.cargo, 'passenger', CAT_COLOR.passenger, COLOR],
          'circle-opacity': 0.85,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2, 8, 4, 12, 7],
          'circle-stroke-color': '#1b1200',
          'circle-stroke-width': 0.5,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('hormuz', 10 * 60000, async () => {
      try {
        const d = await loadHormuz();
        status = d.status?.status;
        const fc = hormuzFeatures(d.snapshot);
        ctx.setData('hormuz', fc);
        const note = [status?.label, d.snapshot ? undefined : 'keine Schiffspositionen'].filter(Boolean).join(' · ');
        return { count: fc.features.length, note: note || undefined };
      } catch {
        ctx.setData('hormuz', empty());
        return { count: 0, note: 'Daten nicht erreichbar' };
      }
    });
  },
  click({ p, pt }) {
    const sub = [p.type, p.flag && p.flag !== '--' ? `Flagge ${p.flag}` : '', Number(p.len) > 0 ? `${p.len} m` : '', Number(p.speed) >= 0 ? `${p.speed} kn` : '', p.dest ? `Ziel ${p.dest}` : ''].filter(Boolean).join(' · ');
    const st = status?.label ? `<div class="pop-sub"><b>Lage Hormuz:</b> ${escapeHtml(status.label)}${status.sublabel ? ` – ${escapeHtml(status.sublabel)}` : ''}</div>` : '';
    return { type: 'html', html: cardHtml({ glyph: 'vessel', color: CAT_COLOR[String(p.cat)] ?? COLOR, title: p.name, subtitle: sub, source: SOURCE, url: 'https://hormuz.now/', extra: st }), lng: pt[0], lat: pt[1] };
  },
  layers: ['hormuz'],
  clickLayers: ['hormuz'],
});
