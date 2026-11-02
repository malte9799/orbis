import * as THREE from 'three';
import type { FeatureCollection } from 'geojson';
import type { Map as MlMap } from 'maplibre-gl';
import { arcPoints } from '../../geo3d/arc';
import type { GeoFrame } from '../../geo3d/frame';
import { GeoLine } from '../../geo3d/line';
import type { GeoFeature, GeoPart } from '../../geo3d/stage';
import { defineExtra, type ExtraCtx } from '../types';
import type { InfoPanelData } from '../../infopanel';
import { FONT_REGULAR } from '../../vector';
import { fetchJson } from '../../../util';

interface Country {
  name: string;
  lat: number;
  lon: number;
  notes: string[];
}
type Cls = 'money' | 'ordered' | 'ceiling' | 'structure';
interface Arc {
  from: string;
  to: string;
  cls: Cls;
  amounts?: { currency: string; amount: number }[];
  lines: number;
  label: string;
  text: string;
  board: string;
  sources: { id: string; title: string; url: string; locator: string }[];
}
interface Data {
  credit: string;
  countries: Country[];
  arcs: Arc[];
}

const COLOR = '#ef5350';
// colours and bulge of the arc classes (the board's own line classes); the bulge keeps arcs between the same two countries apart
const CLASS: Record<Cls, { color: string; bulge: number; lift: number; label: string; dash?: [number, number] }> = {
  money: { color: '#ffd54f', bulge: 0, lift: 0.12, label: 'Geld, laut Register geflossen' },
  ordered: { color: '#ffb74d', bulge: 2.5, lift: 0.16, label: 'Bestellt oder beauftragt', dash: [3, 2] },
  ceiling: { color: '#ba8f45', bulge: -2.5, lift: 0.2, label: 'Genehmigte Obergrenze (Maximum)', dash: [0.6, 2] },
  structure: { color: '#90a4ae', bulge: 5, lift: 0.24, label: 'Nationale Sektion, kein Geld', dash: [0.6, 2] },
};
const BASE_OPACITY = 0.9;
/** the bows have no map layer; this name leads a click to the handler of this layer */
const ARC_LAYER = 'geldfluesse-arc';
/** how close to a bow (CSS px) a click still hits it */
const PICK_PX = 6;
const SYMBOL: Record<string, string> = { CAD: 'C$', AUD: 'A$', GBP: '£', USD: '$', ILS: '₪' };
const MONEY = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** The bows: 3D on the globe, lying on the ground on the flat map. */
class FlowArcs implements GeoPart {
  readonly object = new THREE.Group();
  private arcs: { line: GeoLine; properties: Record<string, unknown> }[] = [];
  private factor = 1;

  constructor(private map: MlMap) {}

  build(d: Data) {
    const by = new Map(d.countries.map((c) => [c.name, c]));
    for (const a of d.arcs) {
      const f = by.get(a.from);
      const t = by.get(a.to);
      if (!f || !t) continue;
      const c = CLASS[a.cls];
      const line = new GeoLine(arcPoints([f.lon, f.lat], [t.lon, t.lat], { lift: c.lift, bulge: c.bulge }), { color: c.color, width: 2, opacity: BASE_OPACITY * this.factor, dash: c.dash, groundOnFlat: true });
      this.object.add(line.object);
      this.arcs.push({
        line,
        properties: { kind: 'arc', cls: a.cls, name: `${a.from} → ${a.to}`, amounts: JSON.stringify(a.amounts ?? []), lines: a.lines, label: a.label, text: a.text, board: a.board, sources: JSON.stringify(a.sources) },
      });
    }
    this.map.triggerRepaint();
  }

  update(frame: GeoFrame) {
    // the width of the old map layer: 1.8 px at zoom 1 up to 4 px at zoom 8
    const width = 1.8 + (Math.max(1, Math.min(8, this.map.getZoom())) - 1) * (2.2 / 7);
    for (const { line } of this.arcs) {
      line.setWidth(width);
      line.update(frame);
    }
  }

  setOpacity(f: number) {
    this.factor = f;
    for (const { line } of this.arcs) line.setOpacity(BASE_OPACITY * f);
    this.map.triggerRepaint();
  }

  featureAt(frame: GeoFrame, x: number, y: number): GeoFeature | null {
    let best: Record<string, unknown> | null = null;
    let bestD = PICK_PX;
    for (const { line, properties } of this.arcs) {
      const d = line.distanceTo(frame, x, y);
      if (d < bestD) {
        bestD = d;
        best = properties;
      }
    }
    return best && { layerId: ARC_LAYER, properties: best };
  }

  dispose() {
    for (const { line } of this.arcs) line.dispose();
  }
}

const arcs = (ctx: ExtraCtx) =>
  ctx.state<FlowArcs>('geldfluesse', () => {
    const part = new FlowArcs(ctx.map);
    part.object.visible = false;
    ctx.stage.add(part);
    return part;
  });

function toGeoJson(d: Data): FeatureCollection {
  const features: FeatureCollection['features'] = d.countries.map((c) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
    properties: { kind: 'country', name: c.name, notes: c.notes.join('\n') },
  }));
  return { type: 'FeatureCollection', features };
}

export default defineExtra({
  id: 'geldfluesse',
  order: 570,
  section: 'networks',
  cat: 'netze',
  label: 'Geldflüsse',
  hint: 'Bögen von Land zu Land: Geld laut Registern, Bestellungen, Obergrenzen, Sektionen – Who Funded Genocide (CC BY 4.0)',
  glyph: 'cable',
  icon: 'cable',
  color: COLOR,
  sources: { geldfluesse: 'Geldflüsse: <a href="https://whofundedgenocide.com/map/">Who Funded Genocide – The Entire Network</a>, Research mit Wallface (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'geldfluesse-pt',
        type: 'circle',
        source: 'geldfluesse',
        filter: ['==', ['get', 'kind'], 'country'],
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': 5, 'circle-stroke-color': '#1b0000', 'circle-stroke-width': 1 },
      },
      'marker',
    );
    add(
      {
        id: 'geldfluesse-label',
        type: 'symbol',
        source: 'geldfluesse',
        filter: ['==', ['get', 'kind'], 'country'],
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffcdd2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  setOpacity(ctx, f) {
    arcs(ctx).setOpacity(f);
  },
  apply(ctx) {
    // the first apply comes before anyone switched it on: no stage for a layer that stays off
    if (ctx.isOn('geldfluesse')) arcs(ctx).object.visible = true;
    else if (ctx.hasState('geldfluesse')) arcs(ctx).object.visible = false;
  },
  enable(ctx) {
    ctx.loadOnce('geldfluesse', Infinity, async () => {
      const d = await fetchJson<Data>(`${import.meta.env.BASE_URL}data/geldfluesse.json`);
      ctx.setData('geldfluesse', toGeoJson(d));
      arcs(ctx).build(d);
      return { count: d.arcs.length, note: 'Durchgezogen: Geld · gestrichelt: bestellt · gepunktet: Obergrenze / kein Geld · Währungen werden nie addiert' };
    });
  },
  click({ p, at }) {
    const link = { label: 'Mehr Details auf whofundedgenocide.com', url: 'https://whofundedgenocide.com/map/' };
    const credit = '„The Entire Network“, Who Funded Genocide, Research mit Wallface (CC BY 4.0). Ein Registereintrag ist keine Anschuldigung gegen die genannten Stellen; eine Obergrenze ist kein ausgegebenes Geld.';
    let data: InfoPanelData;
    if (p.kind === 'arc') {
      const amounts = JSON.parse(String(p.amounts)) as { currency: string; amount: number }[];
      const srcs = JSON.parse(String(p.sources)) as Arc['sources'];
      const c = CLASS[p.cls as Cls];
      const [from, to] = String(p.name).split(' → ');
      data = {
        glyph: 'cable',
        color: c.color,
        title: String(p.name),
        subtitle: c.label,
        hero: { from, to, note: String(p.label) },
        tiles: [...amounts.map((m): [string, string] => [m.currency, `${SYMBOL[m.currency] ?? ''}${MONEY.format(m.amount)}`]), ['Zeilen', MONEY.format(Number(p.lines))]],
        sections: [
          { key: 'what', title: 'Was der Eintrag sagt', open: true, rows: [{ k: 'Art', v: c.label }, { k: 'Beschreibung', v: String(p.text) }] },
          { key: 'src', title: `Quellen (${srcs.length})`, open: true, rows: srcs.map((r) => ({ k: r.id, v: r.title, href: r.url })) },
        ],
        note: credit,
        link: { ...link, url: `https://whofundedgenocide.com/map/#${String(p.board)}` },
      };
    } else {
      data = {
        glyph: 'cable',
        color: COLOR,
        title: String(p.name),
        subtitle: 'Land im Datensatz',
        sections: [{ key: 'notes', title: 'Was die Register zu diesem Land führen', open: true, rows: String(p.notes).split('\n').map((n) => ({ k: '', v: n })) }],
        note: credit,
        link,
      };
    }
    return { type: 'panel', data, lng: at.lng, lat: at.lat };
  },
  layers: ['geldfluesse-pt', 'geldfluesse-label'],
  clickLayers: [ARC_LAYER, 'geldfluesse-pt'],
});
