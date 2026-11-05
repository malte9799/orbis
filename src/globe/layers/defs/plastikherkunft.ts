import * as THREE from 'three';
import type { FeatureCollection } from 'geojson';
import type { Map as MlMap } from 'maplibre-gl';
import { assetUrl } from '../../../assets';
import { fetchJson } from '../../../util';
import { arcPoints } from '../../geo3d/arc';
import type { GeoFrame } from '../../geo3d/frame';
import { GeoLine } from '../../geo3d/line';
import type { GeoFeature, GeoPart } from '../../geo3d/stage';
import type { InfoPanelData } from '../../infopanel';
import { FONT_REGULAR } from '../../vector';
import { ANCHORS, arcWidth, summarize, type OriginCountry, type OriginSummary } from '../shared/plastikherkunft';
import { defineExtra, type ExtraCtx } from '../types';

// Origin of the plastic in the Great Pacific Garbage Patch: bows from the main countries of origin (Lebreton et al. 2022,
// 232 of 354 recovered objects with a recognisable origin, sample 2019) to the middle of the patch (patches.json). Width
// by share. The data are static files (public/data/plastik), loaded through assetUrl and only once the layer is switched on.
// The bows are GeoStage parts (state per map, no module variables).

const ID = 'plastikherkunft';
const COLOR = '#fb8c00';
const ARC_COLOR = '#ffa726';
const L_PT = 'plastikherkunft-pt';
const L_LABEL = 'plastikherkunft-label';
const L_TARGET = 'plastikherkunft-target';
const L_TARGET_LABEL = 'plastikherkunft-target-label';
/** the bows have no map layer; this name leads a click to the handler of this layer */
const ARC_LAYER = 'plastikherkunft-arc';
/** how close to a bow (CSS px) a click still hits it */
const PICK_PX = 8;
const BASE_OPACITY = 0.85;
const DIR = 'data/plastik/';
const PAPER = 'https://doi.org/10.1038/s41598-022-16529-0';
const DATA = 'https://doi.org/10.6084/m9.figshare.20202131';
const TSUNAMI = 'https://repository.library.noaa.gov/view/noaa/17534';
const ATTRIBUTION = 'Lebreton et al. 2022 (CC BY 4.0)';

interface Origin {
  credit: string;
  collected: number;
  objects: number;
  withOrigin: number;
  countries: OriginCountry[];
  fishing: { share: [number, number]; basis: string; source: string; verified: boolean };
}
interface Patch {
  id: string;
  name: string;
  lon: number;
  lat: number;
}
interface Data {
  origin: Origin;
  target: Patch;
  summary: OriginSummary;
}

const PCT = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const PCT0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const pct = (share: number) => `${PCT.format(share * 100)} %`;

/** The bows: 3D on the globe, lying on the ground on the flat map. */
class OriginArcs implements GeoPart {
  readonly object = new THREE.Group();
  private arcs: { line: GeoLine; share: number; properties: Record<string, unknown> }[] = [];
  private factor = 1;
  data?: Data;

  constructor(private map: MlMap) {}

  build(d: Data) {
    this.data = d;
    const maxShare = d.summary.anchored[0]?.share ?? 0;
    for (const c of d.summary.anchored) {
      const a = ANCHORS[c.code];
      // arcPoints runs on from the longitude of the start: the end of an Asian bow lies at 219° and not at -141°, so it crosses the date line the short way
      const line = new GeoLine(arcPoints([a.lon, a.lat], [d.target.lon, d.target.lat], { lift: 0.1 }), {
        color: ARC_COLOR,
        width: arcWidth(c.share, maxShare),
        opacity: BASE_OPACITY * this.factor,
        groundOnFlat: true,
      });
      this.object.add(line.object);
      this.arcs.push({ line, share: c.share, properties: { kind: 'country', code: c.code, name: c.name } });
    }
    this.map.triggerRepaint();
  }

  update(frame: GeoFrame) {
    const maxShare = this.data?.summary.anchored[0]?.share ?? 0;
    // a little thinner when zoomed out, a little thicker when zoomed in
    const zoom = 0.8 + ((Math.max(1, Math.min(8, this.map.getZoom())) - 1) / 7) * 0.5;
    for (const { line, share } of this.arcs) {
      line.setWidth(arcWidth(share, maxShare) * zoom);
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
  ctx.state<OriginArcs>(ID, () => {
    const part = new OriginArcs(ctx.map);
    part.object.visible = false;
    ctx.stage.add(part);
    return part;
  });

function toGeoJson(d: Data): FeatureCollection {
  const features: FeatureCollection['features'] = d.summary.anchored.map((c) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [ANCHORS[c.code].lon, ANCHORS[c.code].lat] },
    properties: { kind: 'country', code: c.code, name: c.name, share: c.share, label: `${c.name} ${PCT0.format(c.share * 100)} %` },
  }));
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [d.target.lon, d.target.lat] },
    properties: { kind: 'target', name: 'Müllstrudel Nordpazifik (GPGP)' },
  });
  return { type: 'FeatureCollection', features };
}

const BASIS = (o: Origin) =>
  `Anteil an den ${o.withOrigin} von ${o.objects} geborgenen Objekten mit erkennbarer Herkunft, z. B. Marken, Schrift, Sprache – Probe ${o.collected}`;
const fishing = (o: Origin) => `Fischerei ${Math.round(o.fishing.share[0] * 100)}–${Math.round(o.fishing.share[1] * 100)} % der Masse (Studienangabe)`;
const SOURCES = [
  { k: 'Studie', v: 'Lebreton et al. 2022 (Scientific Reports)', href: PAPER },
  { k: 'Daten', v: 'figshare, Lebreton et al. 2022 (CC BY 4.0)', href: DATA },
];
const NOTE = (o: Origin) => `Herkunft = Herstellungs- bzw. Kennzeichnungsland, nicht zwingend der Ort, an dem das Plastik ins Meer gelangte. ${fishing(o)}. ${ATTRIBUTION}`;

function countryPanel(d: Data, code: string): InfoPanelData | null {
  const c = d.origin.countries.find((x) => x.code === code);
  if (!c) return null;
  const a = ANCHORS[code];
  const rows: { k: string; v: string; href?: string }[] = [
    { k: 'Anteil', v: pct(c.share) },
    { k: 'Objekte', v: `${c.n} von ${d.origin.withOrigin}` },
    { k: 'Grundlage', v: BASIS(d.origin) },
    ...(a ? [{ k: 'Startpunkt des Bogens', v: `${a.place} (Ankerpunkt, nicht der Ort des Eintrags)` }] : []),
  ];
  const sections: NonNullable<InfoPanelData['sections']> = [
    { key: 'share', title: 'Anteil an der Herkunft', open: true, rows },
    { key: 'hint', title: 'Einordnung', open: true, rows: [{ k: 'Herkunft', v: 'Herstellungs- bzw. Kennzeichnungsland, nicht zwingend Eintragsort' }, { k: 'Fischerei', v: fishing(d.origin).replace('Fischerei ', '') }] },
  ];
  if (code === 'JP') {
    sections.push({
      key: 'tsunami',
      title: 'Tsunami 2011',
      open: true,
      rows: [{ k: 'Hinweis', v: 'Ein Teil kann vom Tsunami 2011 stammen (NOAA-Bericht)', href: TSUNAMI }],
    });
  }
  sections.push({ key: 'src', title: 'Quellen', open: true, rows: SOURCES });
  return {
    glyph: 'tsunami',
    color: COLOR,
    title: c.name,
    subtitle: 'Herkunft des Plastiks im Müllstrudel Nordpazifik',
    tiles: [
      ['Anteil', pct(c.share)],
      ['Objekte', String(c.n)],
    ],
    sections,
    note: NOTE(d.origin),
    link: { label: 'Studie: Lebreton et al. 2022', url: PAPER },
  };
}

function targetPanel(d: Data): InfoPanelData {
  const top = d.summary.anchored;
  const o = d.summary.other;
  const rows: { k: string; v: string }[] = top.map((c) => ({ k: c.name, v: `${pct(c.share)} (${c.n})` }));
  rows.push({ k: `andere (${o.count} Länder)`, v: `${pct(o.share)} (${o.n})` });
  return {
    glyph: 'tsunami',
    color: COLOR,
    title: d.target.name,
    subtitle: 'Woher das geborgene Plastik stammt',
    sections: [
      { key: 'all', title: 'Herkunftsländer', open: true, rows: [...rows, { k: 'Grundlage', v: BASIS(d.origin) }] },
      { key: 'src', title: 'Quellen', open: true, rows: SOURCES },
    ],
    note: NOTE(d.origin),
    link: { label: 'Studie: Lebreton et al. 2022', url: PAPER },
  };
}

export default defineExtra({
  id: ID,
  order: 254,
  section: 'ocean',
  cat: 'meer',
  label: 'Herkunft des GPGP-Plastiks',
  hint: 'Bögen von den Herkunftsländern (Japan, China, Südkorea …) zum Großen Pazifikmüllstrudel, Breite nach Anteil – Lebreton et al. 2022',
  glyph: 'tsunami',
  icon: 'ocean',
  color: COLOR,
  sources: { [ID]: `Herkunft: <a href="${PAPER}">Lebreton et al. 2022</a> (CC BY 4.0)` },
  addLayers({ add, hidden }) {
    add(
      {
        id: L_PT,
        type: 'circle',
        source: ID,
        filter: ['==', ['get', 'kind'], 'country'],
        layout: hidden,
        paint: { 'circle-color': ARC_COLOR, 'circle-radius': 5, 'circle-stroke-color': '#3e1f00', 'circle-stroke-width': 1 },
      },
      'marker',
    );
    add(
      {
        id: L_LABEL,
        type: 'symbol',
        source: ID,
        filter: ['==', ['get', 'kind'], 'country'],
        layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffe0b2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: L_TARGET,
        type: 'circle',
        source: ID,
        filter: ['==', ['get', 'kind'], 'target'],
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
      },
      'marker',
    );
    add(
      {
        id: L_TARGET_LABEL,
        type: 'symbol',
        source: ID,
        filter: ['==', ['get', 'kind'], 'target'],
        layout: { ...hidden, 'text-field': 'GPGP', 'text-font': FONT_REGULAR, 'text-size': 12, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  setOpacity(ctx, f) {
    arcs(ctx).setOpacity(f);
  },
  apply(ctx) {
    // the first apply comes before anyone switched it on: no stage for a layer that stays off
    if (ctx.isOn(ID)) arcs(ctx).object.visible = true;
    else if (ctx.hasState(ID)) arcs(ctx).object.visible = false;
  },
  enable(ctx) {
    ctx.loadOnce(ID, Infinity, async () => {
      const get = <T>(f: string) => fetchJson<T>(assetUrl(DIR + f));
      const [origin, patches] = await Promise.all([get<Origin>('gpgp-origin.json'), get<{ patches: Patch[] }>('patches.json')]);
      const target = patches.patches.find((p) => p.id === 'gpgp');
      if (!target) throw new Error('patches.json: GPGP fehlt');
      const d: Data = { origin, target, summary: summarize(origin.countries, origin.withOrigin) };
      ctx.setData(ID, toGeoJson(d));
      arcs(ctx).build(d);
      return { count: d.summary.anchored.length, note: 'Bogenbreite nach Anteil an den 232 Objekten mit erkennbarer Herkunft · Klick auf Bogen oder Land: Anteil und Einordnung · Klick auf GPGP: alle Länder' };
    });
  },
  click({ ctx, layerId, p, pt, at }) {
    const d = arcs(ctx).data;
    if (!d) return null;
    if (layerId === L_TARGET || p.kind === 'target') return { type: 'panel', data: targetPanel(d), lng: pt[0], lat: pt[1] };
    const data = countryPanel(d, String(p.code));
    if (!data) return null;
    // a bow has no point of its own: the card goes to the click
    const onArc = layerId === ARC_LAYER;
    return { type: 'panel', data, lng: onArc ? at.lng : pt[0], lat: onArc ? at.lat : pt[1] };
  },
  layers: [L_PT, L_LABEL, L_TARGET, L_TARGET_LABEL],
  clickLayers: [ARC_LAYER, L_PT, L_TARGET],
});
