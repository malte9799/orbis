import { defineExtra } from '../types';
import type { Feature, Point } from 'geojson';
import { empty } from '../shared/geo';
import { escapeHtml as esc, safeUrl } from '../../../util';
import { tile, category } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { ukraineHarm, UKRAINE_HARM_SITE, type UkraineHarm, type UkraineHarmData } from '../../../api/ukraine';

// Zivile Schäden in der Ukraine (Bellingcat „Civilian Harm in Ukraine“): ein Punkt pro verortetem
// Vorfall, Klick öffnet das rechte Detail-Panel mit Datum, Ort, Auswirkung, Waffensystem,
// Beschreibung und den Beleg-Links (Originalposts). Es werden keine Medien kopiert oder eingebettet.

const COLOR = '#3f8efc';
const GLYPH: GlyphId = 'witness';

const de = (d: string) => (d ? d.split('-').reverse().join('.') : '–');
const hostname = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Quelle'; }
};

let cache: UkraineHarmData | null = null;

function detail(e: UkraineHarm): DetailContent {
  const rows: [string, string][] = (
    [
      ['Ort', e.l ? esc(e.l) : ''],
      ['Auswirkung', e.i?.length ? esc(e.i.join(' · ')) : ''],
      ['Waffensystem', e.w?.length ? esc(e.w.join(' · ')) : ''],
      ['ID', esc(e.id)],
    ] satisfies [string, string][]
  ).filter(([, v]) => v);
  const links: [string, string][] = e.s
    .filter((u) => safeUrl(u))
    .map((u, i) => [`Beleg ${i + 1}`, `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(hostname(u))} ↗</a>`]);
  const warn = e.g ? '<div class="muted small">Die Belege können drastische Inhalte zeigen (von Bellingcat markiert).</div>' : '';
  return {
    glyph: GLYPH,
    color: COLOR,
    title: e.l || 'Dokumentierter Vorfall',
    subtitle: `${de(e.d)}${e.i?.length ? ` · ${e.i.join(', ')}` : ''}`,
    body:
      `<div class="sp-tiles">${tile('Datum', de(e.d))}${tile('Belege', String(links.length))}</div>` +
      (e.t ? `<div class="sp-blurb">${esc(e.t)}</div>` : '') +
      warn +
      category('info', 'Angaben', rows, new Set(['info'])) +
      (links.length ? category('src', 'Belege (Originalposts)', links, new Set(['src'])) : ''),
    source: 'Bellingcat – Civilian Harm in Ukraine',
    link: { url: UKRAINE_HARM_SITE, label: 'Karte bei Bellingcat' },
  };
}

export default defineExtra({
  id: 'ukraineharm',
  order: 705,
  section: 'politik',
  cat: 'politik',
  label: 'Ukraine: zivile Schäden',
  hint: 'Verortete Vorfälle ziviler Schäden in der Ukraine seit 24.02.2022 (Bellingcat „Civilian Harm in Ukraine“): ein Punkt pro Vorfall, Klick zeigt Datum, Auswirkung, Waffensystem und die Beleg-Links zu den Originalposts.',
  glyph: GLYPH,
  icon: 'warn',
  color: COLOR,
  region: 'UA',
  sources: {
    ukraineharm: 'Vorfälle: <a href="https://ukraine.bellingcat.com/">Bellingcat – Civilian Harm in Ukraine</a> (Stand der Rohdaten siehe Layer-Notiz)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('ukraineharm', empty());
    add(
      {
        id: 'ukraineharm',
        type: 'circle',
        source: 'ukraineharm',
        minzoom: 3,
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.85,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 8, 4.5, 12, 7],
          'circle-stroke-color': '#0b2a55',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 12, 1.2],
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ukraineharm', 12 * 3600000, async () => {
      const d = await ukraineHarm();
      cache = d;
      const feats: Feature<Point>[] = d.events.map((e, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
        properties: { i },
      }));
      const last = d.events.reduce((m, e) => (e.d > m ? e.d : m), '');
      ctx.setData('ukraineharm', { type: 'FeatureCollection', features: feats });
      ctx.set('ukraineharm', { count: feats.length, note: `Vorfälle bis ${de(last)} · Snapshot ${d.built.slice(0, 10)}` });
      return {};
    });
  },
  click({ p, pt }) {
    const e = cache?.events[Number(p.i)];
    if (!e) return null;
    return { type: 'detail' as const, d: detail(e), lng: pt[0], lat: pt[1] };
  },
  layers: ['ukraineharm'],
  clickLayers: ['ukraineharm'],
});
