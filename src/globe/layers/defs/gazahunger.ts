import type { Feature } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { FONT_REGULAR } from '../../vector';
import { tile, category, graph } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { ipcGaza, type IpcArea, type IpcData } from '../../../api/gaza';

// Hunger im Gazastreifen nach Governorate (IPC – Integrated Food Security Phase Classification,
// HDX, CC0): Gebiete färben sich nach der Phase der aktuellen Analyse (1 minimal bis 5 Katastrophe).
// Klick zeigt die Anteile je Phase und den Verlauf der Anteile in Phase 3+ und Phase 5.

const COLOR = '#e67800';
const GLYPH: GlyphId = 'crowd';
/** IPC-Standardfarben der Phasen 1–5 */
const PHASE = ['#cdfacd', '#fae61e', '#e67800', '#c80000', '#640000'];
const PHASE_NAME = ['Minimal', 'Angespannt', 'Krise', 'Notlage', 'Katastrophe/Hungersnot'];

const pct = (v: number) => `${Math.round(v * 100)} %`;
const n0 = new Intl.NumberFormat('de-DE');
const de = (d: string) => (d ? d.split('-').reverse().join('.') : '–');

let cache: IpcData | null = null;

function detail(a: IpcArea): DetailContent {
  // nur abgeschlossene Analysen (aktuell/Prognose) in zeitlicher Reihenfolge
  const hist = a.history.filter((h) => h.p['3+'] != null);
  const last = hist[hist.length - 1];
  return {
    glyph: GLYPH,
    color: PHASE[Math.max(0, a.phase - 1)] ?? COLOR,
    title: `${a.name}: Ernährungslage`,
    subtitle: `Phase ${a.phase} (${PHASE_NAME[a.phase - 1] ?? '–'}) · Zeitraum ${a.period === 'C' ? 'aktuell' : a.period}`,
    body:
      `<div class="sp-tiles">${tile('Phase', String(a.phase))}${tile('Phase 3+', pct(a.shares[2] + a.shares[3] + a.shares[4]))}${tile('Bevölkerung', n0.format(a.pop))}</div>` +
      category(
        'phases',
        'Anteil der Bevölkerung je Phase',
        a.shares.map((s, i) => [`Phase ${i + 1} · ${PHASE_NAME[i]}`, `${pct(s)} · ${n0.format(a.people[i])}`] as [string, string]),
        new Set(['phases']),
      ) +
      graph('Anteil Phase 3+ (Krise oder schlimmer)', hist.map((h) => Math.round((h.p['3+'] ?? 0) * 100)), '%', '#e67800') +
      graph('Anteil Phase 5 (Katastrophe)', hist.map((h) => Math.round((h.p['5'] ?? 0) * 100)), '%', '#c80000') +
      (last ? `<div class="muted small">Verlauf der IPC-Analysen von ${de(hist[0].from)} bis ${de(last.to)} (je Analysezeitraum ein Wert, einschließlich Prognosen).</div>` : ''),
    source: 'IPC – Integrated Food Security Phase Classification (HDX, CC0)',
    link: { url: 'https://www.ipcinfo.org/ipc-country-analysis/details-map/en/c/1157440/', label: 'IPC Gaza öffnen' },
  };
}

export default defineExtra({
  id: 'gazahunger',
  order: 702,
  section: 'politik',
  cat: 'politik',
  label: 'Gaza: Hunger (IPC)',
  hint: 'Ernährungslage im Gazastreifen nach Governorate (IPC-Phasen 1–5, HDX, CC0): Gebiete färben sich nach der aktuellen Phase, Klick zeigt Anteile und Verlauf der Analysen seit Dezember 2023.',
  glyph: GLYPH,
  icon: 'crowd',
  color: COLOR,
  region: 'PS',
  sources: {
    gazahunger: 'Hunger: <a href="https://www.ipcinfo.org/">IPC</a> über <a href="https://data.humdata.org/">HDX</a> (CC0)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('gazahunger', empty());
    add(
      {
        id: 'gazahunger',
        type: 'fill',
        source: 'gazahunger',
        layout: hidden,
        paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.55 },
      },
      'marker',
    );
    add(
      {
        id: 'gazahunger-line',
        type: 'line',
        source: 'gazahunger',
        layout: hidden,
        paint: { 'line-color': '#222222', 'line-width': 1.2, 'line-opacity': 0.8 },
      },
      'marker',
    );
    add(
      {
        id: 'gazahunger-label',
        type: 'symbol',
        source: 'gazahunger',
        layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gazahunger', 12 * 3600000, async () => {
      const d = await ipcGaza();
      cache = d;
      const feats: Feature[] = d.areas.map((a, i) => ({
        type: 'Feature' as const,
        geometry: a.geometry,
        properties: { i, c: PHASE[Math.max(0, a.phase - 1)] ?? PHASE[0], label: `${a.name}\nPhase ${a.phase}` },
      }));
      ctx.setData('gazahunger', { type: 'FeatureCollection', features: feats });
      ctx.set('gazahunger', { count: feats.length, note: `IPC-Analyse ${d.areas[0]?.history.at(-1)?.analysis ?? ''} · Snapshot ${d.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ p, pt }) {
    const a = cache?.areas[Number(p.i)];
    if (!a) return null;
    return { type: 'detail' as const, d: detail(a), lng: pt[0], lat: pt[1] };
  },
  layers: ['gazahunger', 'gazahunger-line', 'gazahunger-label'],
  clickLayers: ['gazahunger'],
});
