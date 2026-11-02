import type { Feature, Point } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { FONT_REGULAR } from '../../vector';
import { tile, category, graph } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { ukraineOblast, type UkraineOblastData } from '../../../api/ukraine';

// Angriffe auf das Gesundheitswesen in der Ukraine seit 24.02.2022 (WHO Surveillance System for
// Attacks on Health Care, CC BY, über HDX): die Meldungen tragen keine Ortsangabe, deshalb ein
// einziger Marker mit Verlaufskurven je Monat (Angriffe, Getötete, Verletzte).

const COLOR = '#f06292';
const GLYPH: GlyphId = 'cross';
const n0 = new Intl.NumberFormat('de-DE');

let cache: UkraineOblastData | null = null;

function detail(d: UkraineOblastData): DetailContent {
  const months = Object.keys(d.who).sort();
  const sum = (k: 'attacks' | 'killed' | 'injured') => months.reduce((s, m) => s + d.who[m][k], 0);
  const lastM = months[months.length - 1] ?? '';
  return {
    glyph: GLYPH,
    color: COLOR,
    title: 'Ukraine: Angriffe aufs Gesundheitswesen',
    subtitle: `WHO SSA · ${months[0] ?? ''} bis ${lastM}`,
    body:
      `<div class="sp-tiles">${tile('Angriffe', n0.format(sum('attacks')))}${tile('Getötete', n0.format(sum('killed')))}${tile('Verletzte', n0.format(sum('injured')))}</div>` +
      graph('Angriffe je Monat', months.map((m) => d.who[m].attacks), '', '#f06292') +
      graph('Getötete je Monat', months.map((m) => d.who[m].killed), '', '#e57373') +
      graph('Verletzte je Monat', months.map((m) => d.who[m].injured), '', '#ffb74d') +
      category(
        'last',
        `Letzter Monat (${lastM})`,
        [
          ['Angriffe', n0.format(d.who[lastM]?.attacks ?? 0)],
          ['Getötete', n0.format(d.who[lastM]?.killed ?? 0)],
          ['Verletzte', n0.format(d.who[lastM]?.injured ?? 0)],
        ],
        new Set(['last']),
      ) +
      '<div class="muted small">Gezählt werden die von der WHO erfassten Angriffe (Surveillance System for Attacks on Health Care). Die Meldungen haben keine Ortsangabe; die Summen gelten für die ganze Ukraine.</div>',
    source: 'WHO – Surveillance System for Attacks on Health Care (CC BY, über HDX)',
    link: { url: 'https://extranet.who.int/ssa/Index.aspx', label: 'WHO-Dashboard öffnen' },
  };
}

export default defineExtra({
  id: 'ukrainezahlen',
  order: 708,
  section: 'politik',
  cat: 'politik',
  label: 'Ukraine: Angriffe aufs Gesundheitswesen',
  hint: 'Angriffe auf das Gesundheitswesen in der Ukraine seit 24.02.2022 (WHO SSA, CC BY): Verlaufskurven je Monat für Angriffe, Getötete und Verletzte. Die Meldungen haben keinen Ort, der Marker steht in Kiew.',
  glyph: GLYPH,
  icon: 'warn',
  color: COLOR,
  region: 'UA',
  sources: {
    ukrainezahlen: 'Angriffe: <a href="https://extranet.who.int/ssa/Index.aspx">WHO SSA</a> über <a href="https://data.humdata.org/">HDX</a> (CC BY)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('ukrainezahlen', empty());
    add({ id: 'ukrainezahlen', type: 'circle', source: 'ukrainezahlen', layout: hidden, paint: { 'circle-color': COLOR, 'circle-radius': 9, 'circle-opacity': 0.9, 'circle-stroke-color': '#3a0d1f', 'circle-stroke-width': 2 } }, 'marker');
    add(
      {
        id: 'ukrainezahlen-label',
        type: 'symbol',
        source: 'ukrainezahlen',
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ukrainezahlen', 12 * 3600000, async () => {
      cache = await ukraineOblast();
      const feats: Feature<Point>[] = [{ type: 'Feature', geometry: { type: 'Point', coordinates: [30.52, 50.45] }, properties: { name: 'Ukraine: Gesundheitswesen' } }];
      ctx.setData('ukrainezahlen', { type: 'FeatureCollection', features: feats });
      const total = Object.values(cache.who).reduce((s, m) => s + m.attacks, 0);
      ctx.set('ukrainezahlen', { count: total, note: `${n0.format(total)} Angriffe seit 2022 · Snapshot ${cache.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ pt }) {
    if (!cache) return null;
    return { type: 'detail' as const, d: detail(cache), lng: pt[0], lat: pt[1] };
  },
  layers: ['ukrainezahlen', 'ukrainezahlen-label'],
  clickLayers: ['ukrainezahlen'],
});
