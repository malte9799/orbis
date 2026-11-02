import type { Feature, Point } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { FONT_REGULAR } from '../../vector';
import { tile, category, graph } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { gazaFigures, type GazaFigures } from '../../../api/gaza';

// Zahlen und Verlauf für Gaza und das Westjordanland (Tech for Palestine, Public Domain): zwei
// Marker, Klick öffnet das rechte Detail-Panel mit Kennzahlen, Verlaufskurven seit 07.10.2023 und
// den Infrastruktur-Schäden. Die Gaza-Zahlen stammen vom Gesundheitsministerium in Gaza, die des
// Westjordanlands aus den UN-Meldungen – beide bilden Vermisste und Verschüttete nicht vollständig ab.

const COLOR = '#e0e0e0';
const GLYPH: GlyphId = 'witness';
const SITES = [
  { id: 'gaza', name: 'Gazastreifen', lng: 34.42, lat: 31.42 },
  { id: 'wb', name: 'Westjordanland', lng: 35.25, lat: 31.95 },
] as const;

const n0 = new Intl.NumberFormat('de-DE');
const num = (v: number | undefined | null) => (v == null ? '–' : n0.format(v));
const de = (d: string) => (d ? d.split('-').reverse().join('.') : '–');

/** höchstens ~120 Werte für die Kurve: jeder k-te und immer der letzte */
function thin(values: number[]): number[] {
  const k = Math.max(1, Math.ceil(values.length / 120));
  const out = values.filter((_, i) => i % k === 0);
  if ((values.length - 1) % k !== 0) out.push(values[values.length - 1]);
  return out;
}

/** Zeitreihe ohne Lücken: fehlende Tage übernehmen den letzten bekannten Wert */
const series = <T>(rows: T[], f: (r: T) => number | undefined | null) => {
  let last = 0;
  return thin(rows.map((r) => (last = f(r) ?? last)));
};

function gazaPanel(d: GazaFigures): DetailContent {
  const rows = d.gaza;
  const last = rows[rows.length - 1];
  const killed = (r: (typeof rows)[number]) => r.ext_killed_cum ?? r.killed_cum;
  const injured = (r: (typeof rows)[number]) => r.ext_injured_cum ?? r.injured_cum;
  const infra = d.infra[d.infra.length - 1];
  const known = d.known;
  const sh = (v: number | undefined) => (v != null && known ? `${num(v)} (${Math.round((v / known.records) * 100)} %)` : '–');
  return {
    glyph: GLYPH,
    color: COLOR,
    title: 'Gazastreifen: Zahlen und Verlauf',
    subtitle: `Meldungen seit 07.10.2023 · Stand ${de(last?.report_date ?? '')}`,
    body:
      `<div class="sp-tiles">${tile('Getötete', num(killed(last)))}${tile('Verletzte', num(injured(last)))}${tile('Kinder getötet', num(last?.ext_killed_children_cum))}</div>` +
      graph('Getötete (kumuliert)', series(rows, killed), '', '#e57373') +
      graph('Verletzte (kumuliert)', series(rows, injured), '', '#ffb74d') +
      graph('Kinder getötet (kumuliert)', series(rows, (r) => r.ext_killed_children_cum), '', '#ba68c8') +
      category(
        'groups',
        'Nach Gruppen (kumuliert)',
        [
          ['Frauen', num(last?.ext_killed_women_cum)],
          ['Medizinisches Personal', num(last?.ext_med_killed_cum)],
          ['Zivilschutz', num(last?.ext_civdef_killed_cum)],
          ['Presse', num(last?.ext_press_killed_cum)],
          ['Als Massaker gemeldet', num(last?.ext_massacres_cum)],
        ],
        new Set(['groups']),
      ) +
      (known
        ? category(
            'known',
            `Namensliste (${num(known.records)} Namen)`,
            [
              ['Männer, Erwachsene', sh(known.male.adult)],
              ['Männer, Senioren', sh(known.male.senior)],
              ['Jungen', sh(known.male.child)],
              ['Frauen, Erwachsene', sh(known.female.adult)],
              ['Frauen, Seniorinnen', sh(known.female.senior)],
              ['Mädchen', sh(known.female.child)],
              ['Stand der Liste', `bis ${de(known.includes_until)}`],
            ],
            new Set(['known']),
          )
        : '') +
      (infra
        ? category(
            'infra',
            `Zerstörte Gebäude (Stand ${de(infra.report_date)})`,
            [
              ['Wohneinheiten zerstört', num(infra.residential?.ext_destroyed)],
              ['Moscheen zerstört', num(infra.places_of_worship?.ext_mosques_destroyed)],
              ['Kirchen zerstört', num(infra.places_of_worship?.ext_churches_destroyed)],
              ['Bildungsgebäude zerstört', num(infra.educational_buildings?.ext_destroyed)],
              ['Bildungsgebäude beschädigt', num(infra.educational_buildings?.ext_damaged)],
              ['Öffentliche Gebäude zerstört', num(infra.civic_buildings?.ext_destroyed)],
            ],
            new Set(['infra']),
          )
        : '') +
      '<div class="muted small">Die Zahlen sind Meldungen des Gesundheitsministeriums in Gaza (kumuliert). Vermisste, Verschüttete und nicht Identifizierte sind nicht vollständig enthalten. Die Infrastruktur-Reihe wird seit Oktober 2025 nicht mehr fortgeführt.</div>',
    source: 'Tech for Palestine (Public Domain) – Zahlen des Gesundheitsministeriums Gaza',
    link: { url: 'https://data.techforpalestine.org/', label: 'Datenquelle öffnen' },
  };
}

function westBankPanel(d: GazaFigures): DetailContent {
  const rows = d.westBank;
  const last = rows[rows.length - 1];
  return {
    glyph: GLYPH,
    color: COLOR,
    title: 'Westjordanland: Zahlen und Verlauf',
    subtitle: `Meldungen seit 07.10.2023 · Stand ${de(last?.report_date ?? '')}`,
    body:
      `<div class="sp-tiles">${tile('Getötete', num(last?.killed_cum))}${tile('Verletzte', num(last?.injured_cum))}${tile('Siedlerangriffe', num(last?.settler_attacks_cum))}</div>` +
      graph('Getötete (kumuliert)', series(rows, (r) => r.killed_cum), '', '#e57373') +
      graph('Siedlerangriffe (kumuliert)', series(rows, (r) => r.settler_attacks_cum), '', '#ffb74d') +
      graph('Vertriebene Personen (kumuliert)', series(rows, (r) => r.displaced_persons_cum), '', '#64b5f6') +
      category(
        'kids',
        'Kinder',
        [
          ['Getötet', num(last?.killed_children_cum)],
          ['Verletzt', num(last?.injured_children_cum)],
          ['Vertrieben', num(last?.displaced_children_cum)],
        ],
        new Set(['kids']),
      ) +
      '<div class="muted small">Die Zahlen stammen aus den UN-Meldungen (OCHA) und sind kumuliert seit 07.10.2023.</div>',
    source: 'Tech for Palestine (Public Domain) – UN/OCHA-Meldungen',
    link: { url: 'https://data.techforpalestine.org/', label: 'Datenquelle öffnen' },
  };
}

let cache: GazaFigures | null = null;

export default defineExtra({
  id: 'gazazahlen',
  order: 701,
  section: 'politik',
  cat: 'politik',
  label: 'Gaza: Zahlen und Verlauf',
  hint: 'Kennzahlen und Verlaufskurven für den Gazastreifen und das Westjordanland seit 07.10.2023 (Tech for Palestine): Getötete, Verletzte, Kinder, Presse, Siedlerangriffe, zerstörte Gebäude. Klick auf einen Marker öffnet das Seitenpanel.',
  glyph: GLYPH,
  icon: 'warn',
  color: COLOR,
  region: 'PS',
  sources: {
    gazazahlen: 'Zahlen: <a href="https://data.techforpalestine.org/">Tech for Palestine</a> (Public Domain), Quelle: Gesundheitsministerium Gaza und UN-OCHA',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('gazazahlen', empty());
    add(
      {
        id: 'gazazahlen',
        type: 'circle',
        source: 'gazazahlen',
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': 9, 'circle-opacity': 0.9, 'circle-stroke-color': '#222', 'circle-stroke-width': 2 },
      },
      'marker',
    );
    add(
      {
        id: 'gazazahlen-label',
        type: 'symbol',
        source: 'gazazahlen',
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gazazahlen', 3 * 3600000, async () => {
      const d = await gazaFigures();
      cache = d;
      const feats: Feature<Point>[] = SITES.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: { id: s.id, name: s.name },
      }));
      ctx.setData('gazazahlen', { type: 'FeatureCollection', features: feats });
      const last = d.gaza[d.gaza.length - 1];
      ctx.set('gazazahlen', { count: feats.length, note: `Stand ${de(last?.report_date ?? '')} · Tech for Palestine` });
      return {};
    });
  },
  click({ p, pt }) {
    if (!cache) return null;
    const d = String(p.id) === 'wb' ? westBankPanel(cache) : gazaPanel(cache);
    return { type: 'detail' as const, d, lng: pt[0], lat: pt[1] };
  },
  layers: ['gazazahlen', 'gazazahlen-label'],
  clickLayers: ['gazazahlen'],
});
