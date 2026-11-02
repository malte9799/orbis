import { defineExtra } from '../types';
import type { Feature, Point } from 'geojson';
import { empty } from '../shared/geo';
import { tile, category } from '../../sidepanel';
import { escapeHtml as esc } from '../../../util';
import type { DetailContent } from '../../detailpanel';
import type { GlyphId } from '../../icons';
import { ccc, CCC_DATAVERSE, type CccData, type CccEvent } from '../../../api/ccc';

// US-Protestevents des Crowd Counting Consortiums (Harvard/UConn, CC0 1.0): handcodierter
// Datensatz der Märsche, Rallies und Demonstrationen (2017–heute, Snapshot = Phase 3).
// Kreisgröße √ geschätzter Teilnehmerzahl (size_mean), grau ohne Schätzung. Klick öffnet das
// rechte Detail-Panel mit Datum, Anliegen, Polizei-Maßnungen und Belegen.

const COLOR = '#8f7bff';
const GLYPH: GlyphId = 'crowd';

const dfmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
const num = (v: number | undefined) => (v == null ? '' : new Intl.NumberFormat('de-DE').format(v));

/** Basisradius √ Teilnehmer, gedämpft und mit Boden (ohne Schätzung: klein und blass) */
const radius = (e: CccEvent) => (e.s ? Math.max(2.2, Math.sqrt(e.s) / 42) : 1.8);

/** der im `enable` geladene Snapshot (die Popups brauchen die vollen Entrys) */
let cache: CccData | null = null;

/** first source: link, if it is an URL, otherwise plain text */
const sourceCell = (u: string | undefined) => {
  if (!u) return '–';
  return /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.length > 42 ? `${u.slice(0, 40)}…` : u)}</a>` : esc(u);
};

function detail(e: CccEvent): DetailContent {
  const range = e.slo != null || e.shi != null;
  const sizeTxt = range
    ? `${e.slo != null ? num(e.slo) : '?'}–${num(e.shi)} Teiln. (Reichweite)`
    : e.s
      ? `${num(e.s)} Teiln. (Schätzung)`
      : '';
  const rows: [string, string][] = (
    [
      ['Stadt', e.city ? esc(e.city) : ''],
      ['Bundesstaat', e.st ? esc(e.st) : ''],
      ['Typ', e.ty ? esc(e.ty) : ''],
      ['Größe', e.s ? `${num(e.s)}${e.sb ? ` (${esc(e.sb)})` : ''}` : e.sb ? esc(e.sb) : ''],
      ['Festnahmen', e.ar != null ? (e.ar === 0 ? 'keine' : num(e.ar)) : ''],
      ['Sachschaden', e.dmg ? esc(e.dmg) : ''],
      ['Verletzte (Teiln.)', e.pi ? esc(e.pi) : ''],
      ['Verletzte (Polizei)', e.poi ? esc(e.poi) : ''],
      ['Todesopfer (Teiln.)', e.pd ? esc(e.pd) : ''],
      ['Todesopfer (Polizei)', e.pod ? esc(e.pod) : ''],
      ['Themen', e.is ? esc(e.is) : ''],
      ['Weitere Quelle', e.so2 ? sourceCell(e.so2) : ''],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const body =
    `<div class="sp-tiles">${tile('Datum', dfmt.format(new Date(`${e.d}T12:00:00`)))}${tile('Größe', sizeTxt || 'ohne Schätzung')}</div>` +
    (e.cl ? `<details data-key="cl" open><summary>Anliegen</summary><div class="sp-blurb">${esc(e.cl)}</div></details>` : '') +
    (rows.length ? category('info', 'Details', rows, new Set(['info'])) : '') +
    category('q', 'Belege', [['Quelle', sourceCell(e.so)], ['Dataset', `<a href="${esc(CCC_DATAVERSE)}" target="_blank" rel="noopener noreferrer">Harvard Dataverse (CC0)</a>`]], new Set(['q']));
  return {
    glyph: GLYPH,
    color: e.s ? COLOR : '#6d75a0',
    title: e.t || 'Protest',
    subtitle: `${dfmt.format(new Date(`${e.d}T12:00:00`))}${e.city ? ` · ${e.city}${e.st ? `, ${e.st}` : ''}` : e.st ? ` · ${e.st}` : ''}`,
    body,
    source: 'Crowd Counting Consortium, Harvard/UConn (CC0 1.0) – monatlicher Snapshot',
    link: { url: CCC_DATAVERSE, label: 'Dataset (CC0)' },
  };
}

export default defineExtra({
  id: 'usprotests',
  order: 680,
  section: 'politik',
  cat: 'politik',
  label: 'US-Proteste (CCC)',
  hint: 'Ereignisse von Demonstrationen, Märschen und Rallies in den USA (Crowd Counting Consortium, Harvard/UConn, CC0): Kreisgröße nach geschätzter Teilnehmerzahl, Klick zeigt Datum, Themen und Beleg.',
  glyph: GLYPH,
  icon: 'crowd',
  color: COLOR,
  region: 'US',
  sources: {
    usprotests: 'US-Protestevents nach <a href="https://dataverse.harvard.edu/dataverse/crowdcountingconsortium">Crowd Counting Consortium</a> (Harvard Kennedy School / UConn) – <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('usprotests', empty());
    add(
      {
        id: 'usprotests-halo',
        type: 'circle',
        source: 'usprotests',
        minzoom: 2.5,
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-blur': 1,
          'circle-opacity': 0.22,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.5, ['*', 0.4, ['get', 'r']], 8, ['*', 2.2, ['get', 'r']]],
        },
      },
      'marker',
    );
    add(
      {
        id: 'usprotests',
        type: 'circle',
        source: 'usprotests',
        minzoom: 2.5,
        layout: hidden,
        paint: {
          'circle-color': ['case', ['has', 's'], COLOR, '#6d75a0'],
          'circle-opacity': ['case', ['has', 's'], 0.55, 0.4],
          'circle-stroke-color': COLOR,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 2.5, 0.4, 8, 1.1],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.5, ['*', 0.16, ['get', 'r']], 8, ['*', 1.5, ['get', 'r']]],
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('usprotests', 24 * 3600000, async () => {
      const d = await ccc();
      cache = d;
      const feats: Feature<Point>[] = [];
      for (const e of d.events) {
        feats.push({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [e.lon, e.lat] },
          properties: { i: feats.length, r: radius(e) },
        });
      }
      ctx.setData('usprotests', { type: 'FeatureCollection', features: feats });
      const spans = d.events.reduce<{ a: string; z: string }>((x, e) => {
        if (!x.a || e.d < x.a) x.a = e.d;
        if (!x.z || e.d > x.z) x.z = e.d;
        return x;
      }, {} as { a: string; z: string });
      ctx.set('usprotests', {
        count: feats.length,
        note: `${spans.a} – ${spans.z} (monatlicher Dataverse-Snapshot) · CC0 1.0`,
      });
      return {};
    });
  },
  click({ p, pt }) {
    const e = cache?.events[Number(p.i)];
    if (!e) return null;
    return { type: 'detail' as const, d: detail(e), lng: pt[0], lat: pt[1] };
  },
  layers: ['usprotests-halo', 'usprotests'],
  clickLayers: ['usprotests'],
});
