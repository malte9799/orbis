import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { GEM_COLORS, GEM_GROUP_LABEL, gemFeatures, type GemGroup } from '../shared/intel';
import { loadGem, GEM_ATTRIBUTION } from '../../../api/energy';
import { escapeHtml } from '../../../util';

const COLOR = '#9ccc65';

export default defineExtra({
  id: 'gem',
  order: 580,
  section: 'infra',
  cat: 'netze',
  label: 'Energieanlagen (GEM)',
  hint: 'Energieanlagen weltweit aus dem Global Energy Monitor (Minen, Kraftwerke, Terminals …), Farbe nach Brennstoff. Eigenständige Ebene neben Kohle, Gas und Öl; Ausschnitt des Snapshots.',
  glyph: 'plant',
  icon: 'power',
  color: COLOR,
  sources: { gem: `Energieanlagen: ${GEM_ATTRIBUTION}, <a href="https://globalenergymonitor.org/">globalenergymonitor.org</a>` },
  addLayers({ add, hidden, setData }) {
    setData('gem', empty());
    add(
      {
        id: 'gem',
        type: 'circle',
        source: 'gem',
        layout: { ...hidden, 'circle-sort-key': ['get', 'cap'] },
        paint: {
          'circle-color': ['coalesce', ['get', 'color'], COLOR],
          'circle-opacity': 0.8,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['interpolate', ['linear'], ['get', 'cap'], -1, 2, 100, 3, 2000, 6], 10, ['interpolate', ['linear'], ['get', 'cap'], -1, 4, 100, 6, 2000, 11]],
          'circle-stroke-color': '#0d1a08',
          'circle-stroke-width': 0.6,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gem', Infinity, async () => {
      const d = await loadGem();
      const fc = gemFeatures(d.assets);
      ctx.setData('gem', fc);
      const note = d.total > d.assets.length ? `${fc.features.length.toLocaleString('de-DE')} von ${d.total.toLocaleString('de-DE')} Anlagen (Ausschnitt)` : undefined;
      return { count: fc.features.length, note };
    });
  },
  click({ p, pt }) {
    const g = (String(p.group) in GEM_COLORS ? String(p.group) : 'other') as GemGroup;
    const cap = Number(p.cap);
    const bits = [String(p.type || GEM_GROUP_LABEL[g]), cap >= 0 ? `${cap.toLocaleString('de-DE')} ${String(p.unit || '')}`.trim() : '', String(p.status || ''), [p.region, p.country].filter(Boolean).join(', ')].filter(Boolean);
    const wiki = typeof p.wiki === 'string' && p.wiki ? p.wiki : undefined;
    return { type: 'html', html: cardHtml({ glyph: 'plant', color: GEM_COLORS[g], title: p.name, subtitle: bits.join(' · '), source: GEM_ATTRIBUTION, url: wiki, extra: `<div class="pop-sub">${escapeHtml(GEM_GROUP_LABEL[g])}</div>` }), lng: pt[0], lat: pt[1] };
  },
  layers: ['gem'],
  clickLayers: ['gem'],
});
