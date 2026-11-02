import { defineExtra } from '../types';
import type { Feature, Point } from 'geojson';
import { empty } from '../shared/geo';
import { escapeHtml as esc } from '../../../util';
import { tile, category } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { demodata, DEMOS_SITE, type DemoData, type DemoEvent } from '../../../api/demos';

// Angemeldete Versammlungen in Deutschland, Österreich und der Schweiz (demonstrations.org /
// Demos Berlin e.V., CC BY-SA 4.0): die API spiegelt die Versammlungslisten der Behörden.
// Ein Punkt pro Treffpunkt; die Rolle entspricht AK/ZK/EK (Auftakt-/Zwischen-/Endkundgebung).
// Klick öffnet das rechte Detail-Panel (Zeit, Ort, Treffpunkte, Beschreibung, Route, Belege).

const COLOR = '#e8833a';
const GLYPH: GlyphId = 'placard';

const dtf = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const ROLE_LABEL: Record<string, string> = { start: 'Auftakt', waypoint: 'Zwischenkundgebung', rally: 'Kundgebung', end: 'Endkundgebung' };

/** der im `enable` geladene Snapshot (die Popups brauchen die vollen Entrys) */
let cache: DemoData | null = null;
/** die Routen-Tabelle des Snapshots (Hinweise `ri` zeigen hierauf) */
let cacheRoutes: number[][][] | null = null;

/** linkifying of pure text sources (only real URLs become links) */
const linkify = (u: string | undefined, label: string) =>
  u && /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : u ? esc(u) : '';

function detail(e: DemoEvent): DetailContent {
  const efmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const rows: [string, string][] = (
    [
      ['Treffpunkt', e.place ? esc(e.place) : ''],
      ['Veranstalter', e.org ? esc(e.org) : ''],
      ['Erwartet', e.est ? esc(e.est) : ''],
      ['Themen', e.topics?.length ? esc(e.topics.join(' · ')) : ''],
    ] satisfies [string, string][]
  ).filter(([, v]) => v);
  const kacheln = `<div class="sp-tiles">${tile('Beginn', dtf.format(new Date(e.s)))}${tile('Ende', e.e ? efmt.format(new Date(e.e)) : '–')}${tile('Land', e.c || '–')}${tile('Art', e.march ? 'Marsch' : 'Versammlung')}</div>`;
  const lcrows: [string, string][] | undefined = e.lc?.map((l, i) => [
    `${i + 1}. ${ROLE_LABEL[l.r ?? ''] ?? l.r ?? 'Punkt'}`,
    esc([l.a, l.y].filter(Boolean).join(', ') || '–'),
  ]);
  const categories =
    (lcrows && lcrows.length > 1 ? category('lc', 'Alle Treffpunkte', lcrows, new Set(['lc'])) : '') +
    (rows.length ? category('info', 'Angaben', rows, new Set(['info'])) : '') +
    (e.ds ? `<details data-key="ds" open><summary>Beschreibung</summary><div class="sp-blurb">${esc(e.ds)}</div></details>` : '') +
    category('q', 'Belege', [
      ['Amtliche Meldung', e.src ? linkify(e.src, hostname(e.src)) : '–'],
      ['Eintrag', `<a href="${esc(e.u ?? DEMOS_SITE)}" target="_blank" rel="noopener noreferrer">demonstrations.org</a>`],
    ], new Set(['q']));
  return {
    glyph: GLYPH,
    color: COLOR,
    title: e.n,
    subtitle: `${dtf.format(new Date(e.s))}${e.city ? ` · ${e.city}` : ''}${e.r ? ` · ${ROLE_LABEL[e.r] ?? e.r}` : ''}`,
    body: kacheln + categories,
    source: 'demonstrations.org – Versammlungslisten der Behörden (CC BY-SA 4.0)',
    link: { url: e.u ?? DEMOS_SITE, label: 'Eintrag öffnen' },
    route: e.ri != null ? cacheRoutes?.[e.ri] : undefined,
  };
}

const hostname = (u: string) => {
  try { return new URL(u).hostname; } catch { return 'Quelle'; }
};

export default defineExtra({
  id: 'demos',
  order: 690,
  section: 'politik',
  cat: 'politik',
  label: 'Versammlungen D/AT/CH',
  hint: 'Angemeldete Versammlungen und Warnstreiks der kommenden Tage (Behördenlisten über demonstrations.org, CC BY-SA 4.0): ein Punkt pro Treffpunkt, klick zeigt Zeit, Ort und Themen. Länder: DE, AT, CH.',
  glyph: GLYPH,
  icon: 'placard',
  color: COLOR,
  region: 'DE/AT/CH',
  sources: {
    demos: 'Angemeldete Versammlungen von <a href="https://demonstrations.org/">demonstrations.org</a> (Demos Berlin e.V.); Auszüge aus amtlichen Versammlungslisten – <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('demos', empty());
    add(
      {
        id: 'demos',
        type: 'circle',
        source: 'demos',
        minzoom: 2.8,
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.85,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.8, 2.5, 6, 4.5, 11, 6.5],
          'circle-stroke-color': '#3d1f00',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 2.8, 0.6, 11, 1.2],
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('demos', 6 * 3600000, async () => {
      const d = await demodata();
      cache = d;
      cacheRoutes = d.routes ?? [];
      const picked: DemoEvent[] = [];
      const seen = new Set<string>();
      const feats: Feature<Point>[] = [];
      for (const e of d.events) {
        const key = `${e.n}|${e.s}|${e.lon},${e.lat}`;
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(e);
        feats.push({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
          properties: { i: picked.length - 1 },
        });
      }
      ctx.setData('demos', { type: 'FeatureCollection', features: feats });
      ctx.set('demos', { count: feats.length, note: `Snapshot ${d.built.replace('T', ' ').slice(0, 16)} (15-min-Takt) · Lizenz CC BY-SA 4.0` });
      return {};
    });
  },
  click({ p, pt }) {
    const e = cache?.events[Number(p.i)];
    if (!e) return null;
    return { type: 'detail' as const, d: detail(e), lng: pt[0], lat: pt[1] };
  },
  layers: ['demos'],
  clickLayers: ['demos'],
});
