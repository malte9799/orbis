import { defineExtra } from '../types';
import type { Feature, Point } from 'geojson';
import { empty } from '../shared/geo';
import { cardHtml } from '../../popup';
import { escapeHtml as esc } from '../../../util';
import type { GlyphId } from '../../icons';
import { moneyflow, type MoneyMember } from '../../../api/moneyflow';

// Geldflüsse der pro-israelischen PACs in den Kongress (Datenquelle FEC, aufbereitet von
// whofundedgenocide.com): ein Kreis pro Wahlbezirk, Größe ∝ erfassten Geldwerten (direkte
// PAC-Beiträge + für und gegen dieses Mitglied ausgegebene Kampagnenwerbung). Klick zeigt
// Name, Partei, Beträge und die beteiligten PACs. Senatoren sind bewusst nicht verortet,
// weil ihr Mandat dem ganzen Staat gilt.

const COLOR = '#d4a800';
const GLYPH: GlyphId = 'money';

const usd = (v: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

/** Basisradius in px: Wurzel der Summe, gedämpft und mit Boden */
const baseRadius = (m: MoneyMember) => Math.max(1.4, Math.sqrt(m.don + m.ie) / 95);

function popup(p: Record<string, unknown>, lng: number, lat: number) {
  const m = members.find((x) => x.n === String(p.n));
  if (!m) return null;
  const rows = [
    `Direkte PAC-Beiträge: <b>${usd(m.don)}</b>`,
    m.aipac > 0 ? `davon über AIPAC: ${usd(m.aipac)}` : '',
    m.ie > 0 ? `Kampagnenwerbung für/gegen: <b>${usd(m.ie)}</b>` : '',
    m.backers?.length ? `Beteiligte PACs: ${esc(m.backers.join(', '))}` : '',
  ].filter(Boolean);
  return {
    type: 'html' as const,
    html: cardHtml({
      glyph: GLYPH,
      color: COLOR,
      title: String(m.n),
      subtitle: `${m.p} · Bezirk ${m.d} · Kreis am Bezirks-Mittelpunkt`,
      source: 'whofundedgenocide.com – FEC-Bulkdaten (Privatanschriften entfernt)',
      url: 'https://whofundedgenocide.com/de/',
      extra: `<ul class="pop-list">${rows.map((r) => `<li>${r}</li>`).join('')}</ul><div class="pop-sub">Senatoren (Staatsmandat) sind nicht verortet.</div>`,
    }),
    lng,
    lat,
  };
}

let members: MoneyMember[] = [];

export default defineExtra({
  id: 'moneyflow',
  order: 710,
  section: 'politik',
  cat: 'politik',
  label: 'Geldflüsse US-Kongress',
  hint: 'Die Geldflüsse der pro-israelischen PACs in den Kongress: ein Kreis pro Wahlbezirk, Größe nach erfasster Summe (FEC-Daten über whofundedgenocide.com). Klick zeigt Abgeordnete und Beträge. Senatoren sind bewusst nicht verortet.',
  glyph: GLYPH,
  icon: 'list',
  color: COLOR,
  region: 'US',
  sources: {
    moneyflow: 'Geldflüsse von <a href="https://whofundedgenocide.com/">whofundedgenocide.com</a> (FEC-Bulkdaten); Bezirkslage nach unitedstates/districts (US Census)',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('moneyflow', empty());
    add(
      {
        id: 'moneyflow-halo',
        type: 'circle',
        source: 'moneyflow',
        minzoom: 2.5,
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-blur': 1,
          'circle-opacity': 0.25,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.5, ['*', 0.45, ['get', 'r']], 9, ['*', 2.4, ['get', 'r']]],
        },
      },
      'marker',
    );
    add(
      {
        id: 'moneyflow',
        type: 'circle',
        source: 'moneyflow',
        minzoom: 2.5,
        layout: hidden,
        paint: {
          'circle-color': ['match', ['get', 'p'], 'GOP', '#e0574a', 'DEM', '#4aa3df', COLOR],
          'circle-opacity': 0.5,
          'circle-stroke-color': COLOR,
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 2.5, 0.5, 8, 1.2],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2.5, ['*', 0.18, ['get', 'r']], 9, ['*', 1.6, ['get', 'r']]],
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('moneyflow', 24 * 3600000, async () => {
      const d = await moneyflow();
      members = d.members;
      const feats: Feature<Point>[] = [];
      for (const m of members) {
        const sum = m.don + m.ie;
        if (sum <= 0 || !Number.isFinite(m.lon) || !Number.isFinite(m.lat)) continue;
        feats.push({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [m.lon, m.lat] },
          properties: { n: m.n, d: m.d, p: m.p, sum, r: baseRadius(m) },
        });
      }
      ctx.setData('moneyflow', { type: 'FeatureCollection', features: feats });
      const total = members.reduce((s, m) => s + m.don + m.ie, 0);
      ctx.set('moneyflow', {
        count: feats.length,
        note: `${usd(total)} bei Hausabgeordneten erfasst · Stand ${d.built} · Senatoren nicht verortet`,
      });
      return {};
    });
  },
  click({ p, pt }) {
    return popup(p, pt[0], pt[1]);
  },
  layers: ['moneyflow-halo', 'moneyflow'],
  clickLayers: ['moneyflow'],
});
