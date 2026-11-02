import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { FONT_REGULAR } from '../../vector';
import { tile, category, graph } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { oblastKey, ukraineOblast, type UkraineOblastData, type UkraineRegion } from '../../../api/ukraine';

// Lage in der Ukraine nach Oblast: Vorfälle mit Explosivwaffen gegen Zivile (Insecurity Insight,
// CC BY-SA), Luftalarm-Stunden (offizielle Alarme, MIT) – die Fläche färbt sich nach der Zahl der
// Vorfälle. Die Orte der Einzelvorfälle sind in den Quelldaten gelöscht, daher nur Regionen.

const COLOR = '#ef6c4d';
const GLYPH: GlyphId = 'witness';
const SECTOR: Record<string, string> = { 'Health Care': 'Gesundheit', Education: 'Bildung', 'Food Systems': 'Nahrungssysteme', 'Aid Operations': 'Hilfseinsätze', 'Water Systems': 'Wasser' };
const n0 = new Intl.NumberFormat('de-DE');
const de = (d: string) => (d ? d.split('-').reverse().join('.') : '–');

interface Area { name: string; key: string }
let cache: { data: UkraineOblastData; areas: Area[] } | null = null;

const top = (o: Record<string, number>, map: Record<string, string> = {}, n = 8): [string, string][] =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => [map[k] ?? k, n0.format(v)]);

function detail(a: Area, r: UkraineRegion | undefined, d: UkraineOblastData): DetailContent {
  const hours = r ? Object.values(r.air).reduce((s, v) => s + v, 0) : 0;
  const months = r ? Object.keys(r.air).sort() : [];
  const years = r ? Object.entries(r.year).sort() : [];
  return {
    glyph: GLYPH,
    color: COLOR,
    title: a.name,
    subtitle: r ? `${n0.format(r.ew)} Vorfälle · zuletzt ${de(r.last)}` : 'Keine Daten',
    body: r
      ? `<div class="sp-tiles">${tile('Vorfälle', n0.format(r.ew))}${tile('Alarmstunden', n0.format(Math.round(hours)))}${tile('Zuletzt', de(r.last))}</div>` +
        graph('Luftalarm-Stunden je Monat', months.map((m) => Math.round(r.air[m])), 'h', '#ffb74d') +
        category('year', 'Vorfälle je Jahr', years.map(([y, v]) => [y, n0.format(v)] as [string, string]), new Set(['year'])) +
        category('sector', 'Betroffene Sektoren', top(r.sector, SECTOR), new Set(['sector'])) +
        category('weapon', 'Waffenart', top(r.weapon), new Set()) +
        category(
          'killed',
          'Getötete (laut Datensatz)',
          [
            ['Helfer', n0.format(r.killed.aid ?? 0)],
            ['Gesundheitspersonal', n0.format(r.killed.health ?? 0)],
            ['Lehrkräfte', n0.format(r.killed.educators ?? 0)],
            ['Schüler/Studierende', n0.format(r.killed.students ?? 0)],
          ],
          new Set(),
        ) +
        `<div class="muted small">Zählt Vorfälle mit Explosivwaffen gegen Gesundheit, Bildung, Wasser, Nahrung und Hilfe (Insecurity Insight); ${n0.format(d.unresolved)} Vorfälle ließen sich keiner Region zuordnen. Die Orte der Einzelvorfälle sind im Datensatz entfernt.</div>`
      : '<div class="muted small">Für diese Region liegen keine Daten vor.</div>',
    source: 'Insecurity Insight (CC BY-SA) · Luftalarme: Vadimkin-Datensatz (MIT)',
    link: { url: 'https://data.humdata.org/dataset/f21002e5-4e00-4c95-bff1-ecd698bf9ff4', label: 'Datensatz bei HDX' },
  };
}

export default defineExtra({
  id: 'ukrainelage',
  order: 707,
  section: 'politik',
  cat: 'politik',
  label: 'Ukraine: Lage nach Oblast',
  hint: 'Vorfälle mit Explosivwaffen gegen Zivile und Luftalarm-Stunden nach Oblast (Insecurity Insight, offizielle Alarme): die Fläche färbt sich nach der Zahl der Vorfälle seit 2020, Klick zeigt Verlauf, Sektoren und Waffenarten.',
  glyph: GLYPH,
  icon: 'warn',
  color: COLOR,
  region: 'UA',
  sources: {
    ukrainelage: 'Vorfälle: <a href="https://insecurityinsight.org/">Insecurity Insight</a> über <a href="https://data.humdata.org/">HDX</a> (CC BY-SA); Luftalarme: <a href="https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset">Vadimkin</a> (MIT)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('ukrainelage', empty());
    add(
      {
        id: 'ukrainelage',
        type: 'fill',
        source: 'ukrainelage',
        layout: hidden,
        paint: {
          'fill-color': ['interpolate', ['linear'], ['get', 'n'], 0, '#3a2a28', 20, '#7a3b2e', 100, '#b94d33', 400, '#e8663d', 1000, '#ffb347'],
          'fill-opacity': 0.6,
        },
      },
      'marker',
    );
    add({ id: 'ukrainelage-line', type: 'line', source: 'ukrainelage', layout: hidden, paint: { 'line-color': '#1a1210', 'line-width': 1, 'line-opacity': 0.8 } }, 'marker');
    add(
      {
        id: 'ukrainelage-label',
        type: 'symbol',
        source: 'ukrainelage',
        layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ukrainelage', 12 * 3600000, async () => {
      const [data, geo] = await Promise.all([
        ukraineOblast(),
        fetch(`${import.meta.env?.BASE_URL ?? '/'}data/games/admin1/UA.json`).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} – UA.json`);
          return r.json() as Promise<FeatureCollection<Geometry, { en: string; type: string }>>;
        }),
      ]);
      const areas: Area[] = [];
      const feats: Feature[] = geo.features.map((f, i) => {
        const key = oblastKey(f.properties.en, f.properties.type);
        areas.push({ name: f.properties.type === 'Municipality' ? 'Kiew (Stadt)' : f.properties.en, key });
        const n = data.regions[key]?.ew ?? 0;
        return { type: 'Feature' as const, geometry: f.geometry, properties: { i, n, label: `${areas[i].name}\n${n0.format(n)}` } };
      });
      cache = { data, areas };
      ctx.setData('ukrainelage', { type: 'FeatureCollection', features: feats });
      const total = Object.values(data.regions).reduce((s, r) => s + r.ew, 0);
      ctx.set('ukrainelage', { count: total, note: `${n0.format(total)} Vorfälle seit 2020 · Snapshot ${data.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ p, pt }) {
    const a = cache?.areas[Number(p.i)];
    if (!a || !cache) return null;
    return { type: 'detail' as const, d: detail(a, cache.data.regions[a.key], cache.data), lng: pt[0], lat: pt[1] };
  },
  layers: ['ukrainelage', 'ukrainelage-line', 'ukrainelage-label'],
  clickLayers: ['ukrainelage'],
});
