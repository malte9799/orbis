import type { Feature, Point } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { escapeHtml as esc, safeUrl } from '../../../util';
import { category } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { palestineHealthsites, type HealthData, type HealthPlace } from '../../../api/gaza';

// Gesundheitseinrichtungen in Gaza und im Westjordanland (Healthsites / OpenStreetMap, ODbL, über
// HDX): Krankenhäuser, Kliniken, Arztpraxen, Apotheken. Das ist der kartierte Bestand, nicht der
// heutige Betriebszustand – zusammen mit der Schadenskarte zeigt er, was verloren ist.

const COLOR = '#26c6a2';
const GLYPH: GlyphId = 'cross';
const KIND: Record<string, string> = { hospital: 'Krankenhaus', clinic: 'Klinik', doctors: 'Arztpraxis', pharmacy: 'Apotheke', dentist: 'Zahnarzt' };

let cache: HealthData | null = null;

function detail(p: HealthPlace): DetailContent {
  const rows: [string, string][] = (
    [
      ['Art', esc(KIND[p.a] ?? (p.a || 'Einrichtung'))],
      ['Betreiber', p.o ? esc(p.o) : ''],
    ] satisfies [string, string][]
  ).filter(([, v]) => v);
  const link = safeUrl(p.u);
  return {
    glyph: GLYPH,
    color: COLOR,
    title: p.n || KIND[p.a] || 'Gesundheitseinrichtung',
    subtitle: KIND[p.a] ?? 'Gesundheitseinrichtung',
    body:
      category('info', 'Angaben', rows, new Set(['info'])) +
      '<div class="muted small">Kartierter Bestand aus OpenStreetMap; der heutige Betriebs- oder Zerstörungszustand ist hier nicht enthalten.</div>',
    source: 'Healthsites.io / OpenStreetMap-Mitwirkende (ODbL), über HDX',
    link: link ? { url: link, label: 'In OpenStreetMap öffnen' } : undefined,
  };
}

export default defineExtra({
  id: 'gazagesundheit',
  order: 704,
  section: 'politik',
  cat: 'politik',
  label: 'Gaza & Westjordanland: Gesundheitseinrichtungen',
  hint: 'Kartierte Krankenhäuser, Kliniken, Arztpraxen und Apotheken (Healthsites/OpenStreetMap über HDX, ODbL): der Bestand als Bezug für Schäden und Angriffe auf das Gesundheitswesen.',
  glyph: GLYPH,
  icon: 'warn',
  color: COLOR,
  region: 'PS',
  sources: {
    gazagesundheit: 'Einrichtungen: <a href="https://healthsites.io/">Healthsites.io</a> / OpenStreetMap-Mitwirkende (ODbL) über <a href="https://data.humdata.org/">HDX</a>',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('gazagesundheit', empty());
    add(
      {
        id: 'gazagesundheit',
        type: 'circle',
        source: 'gazagesundheit',
        minzoom: 7,
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.85,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, ['case', ['==', ['get', 'a'], 'hospital'], 3.5, 1.8], 13, ['case', ['==', ['get', 'a'], 'hospital'], 8, 4.5]],
          'circle-stroke-color': '#06382d',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gazagesundheit', 24 * 3600000, async () => {
      const d = await palestineHealthsites();
      cache = d;
      const feats: Feature<Point>[] = d.places.map((p, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: { i, a: p.a },
      }));
      const hospitals = d.places.filter((p) => p.a === 'hospital').length;
      ctx.setData('gazagesundheit', { type: 'FeatureCollection', features: feats });
      ctx.set('gazagesundheit', { count: feats.length, note: `${hospitals.toLocaleString('de-DE')} Krankenhäuser · Snapshot ${d.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ p, pt }) {
    const h = cache?.places[Number(p.i)];
    if (!h) return null;
    return { type: 'detail' as const, d: detail(h), lng: pt[0], lat: pt[1] };
  },
  layers: ['gazagesundheit'],
  clickLayers: ['gazagesundheit'],
});
