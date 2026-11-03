import type { Feature, Point } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { escapeHtml as esc } from '../../../util';
import { tile, category } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { gazaDisplacement, type DisplacementData, type DisplacementEvent } from '../../../api/gaza';

// Vertreibung in Gaza und im Westjordanland (IDMC Internal Displacement Updates, CC BY-IGO, über
// HDX): ein Punkt pro gemeldetem Ereignis auf Dorf- bzw. Stadtebene, Größe nach betroffenen
// Personen. Klick öffnet das Detail-Panel mit Ort, Art, Zahl, Meldestelle und Beschreibung.

const COLOR = '#64b5f6';
const GLYPH: GlyphId = 'crowd';
const n0 = new Intl.NumberFormat('de-DE');
const de = (d: string) => (d ? d.split('-').reverse().join('.') : '–');

let cache: DisplacementData | null = null;

function detail(e: DisplacementEvent): DetailContent {
  const place = e.l.split(',')[0] || 'Ort unbekannt';
  return {
    glyph: GLYPH,
    color: COLOR,
    title: place,
    subtitle: `${de(e.d)} · ${n0.format(e.f)} Personen vertrieben`,
    body:
      `<div class="sp-tiles">${tile('Datum', de(e.d))}${tile('Personen', n0.format(e.f))}</div>` +
      (e.x ? `<div class="sp-blurb">${esc(e.x)}</div>` : '') +
      category(
        'info',
        'Angaben',
        [
          ['Ort', esc(e.l)],
          ['Art', esc(e.t || '–')],
          ['Ursache', esc(e.k || '–')],
          ['Ereignis', esc(e.e || '–')],
          ['Meldende Stelle', esc(e.s || '–')],
        ],
        new Set(['info']),
      ),
    source: 'IDMC – Internal Displacement Updates (CC BY-IGO), über HDX',
    link: { url: 'https://data.humdata.org/dataset/a641dda7-9b19-4103-b811-76a3963d29d2', label: 'Datensatz bei HDX' },
  };
}

export default defineExtra({
  id: 'gazavertreibung',
  order: 703,
  section: 'politik',
  cat: 'politik',
  label: 'Gaza & Westjordanland: Vertreibung',
  hint: 'Gemeldete Vertreibungsereignisse seit 2025 (IDMC über HDX): ein Punkt pro Ereignis, Größe nach betroffenen Personen. Klick zeigt Ort, Art, Meldestelle und Beschreibung.',
  glyph: GLYPH,
  icon: 'crowd',
  color: COLOR,
  region: 'PS',
  sources: {
    gazavertreibung: 'Vertreibung: <a href="https://www.internal-displacement.org/">IDMC</a> über <a href="https://data.humdata.org/">HDX</a> (CC BY-IGO)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('gazavertreibung', empty());
    add(
      {
        id: 'gazavertreibung',
        type: 'circle',
        source: 'gazavertreibung',
        minzoom: 5,
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.75,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['+', 2, ['*', ['get', 'r'], 0.6]], 11, ['+', 4, ['*', ['get', 'r'], 1.6]]],
          'circle-stroke-color': '#0d2b4a',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gazavertreibung', 12 * 3600000, async () => {
      const d = await gazaDisplacement();
      cache = d;
      const feats: Feature<Point>[] = d.events.map((e, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        // Radius-Anteil 0–12 nach Wurzel der Personenzahl
        properties: { i, r: Math.min(12, Math.sqrt(e.f)) },
      }));
      const last = d.events.reduce((m, e) => (e.d > m ? e.d : m), '');
      ctx.setData('gazavertreibung', { type: 'FeatureCollection', features: feats });
      ctx.set('gazavertreibung', { count: feats.length, note: `Ereignisse bis ${de(last)} · Snapshot ${d.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ p, pt }) {
    const e = cache?.events[Number(p.i)];
    if (!e) return null;
    return { type: 'detail' as const, d: detail(e), lng: pt[0], lat: pt[1] };
  },
  layers: ['gazavertreibung'],
  clickLayers: ['gazavertreibung'],
});
