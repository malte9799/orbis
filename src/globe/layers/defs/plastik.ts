import type { Feature, FeatureCollection } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import { assetUrl } from '../../../assets';
import { fetchJson, safeUrl } from '../../../util';
import type { InfoPanelData } from '../../infopanel';
import { FONT_REGULAR } from '../../vector';
import { LINE_STYLE, lineLegend, panelHtml, type History } from '../shared/plastikchart';
import { CORNERS_GLOBAL, CORNERS_GPGP, patchPolygon, SCALE_STOPS } from '../shared/plastikgeo';
import { MODEL_COLOR, MODEL_NOTE, areaMio, modelFilter, modelLabel } from '../shared/plastikmodell';
import { ERIKSEN_GYRES, MODEL_GYRES, drawnGyreFeatures, eriksenByRank, eriksenFilter, eriksenLabel, gpgpEriksenRows, gyreAreas, gyreArea, gyreModelFilter, gyreModelLabel, gyreSections, modelAreaText, type GyreContoursMeta, type GyreId, type GyreModelMeta } from '../shared/plastikwirbel';
import { plastikModelArea, plastikYear, setPlastikYears, subscribePlastik, type ModelYear } from '../shared/plastiktime';
import { globalTowsColor, globalTowsSort, towsFilter, towsOpacity, towsRadius, towsSort, towsStrokeOpacity, towsStrokeWidth } from '../shared/plastiktows';
import { globalTowPanel, type GlobalTowsMeta } from '../shared/plastiktowspanel';
import { defineExtra, type ExtraCtx } from '../types';

// Plastic in the sea: Eriksen 2014 global density picture, Lebreton 2018 density picture of the Great Pacific Garbage
// Patch (GPGP) with its contour lines, markers of the gyres and the net tows 1972-2024 (time slider in the timeline; GPGP tows by mass, global tows by count). All files are static studies prepared by
// scripts/plastik-build.py (public/data/plastik), loaded through assetUrl and only once the layer is switched on.

const ID = 'plastik';
const COLOR = '#f98e09';
const SRC_POINTS = 'plastik';
const SRC_CONTOURS = 'plastik-contours';
const SRC_TOWS = 'plastik-tows';
const SRC_TOWS_GLOBAL = 'plastik-tows-global';
const SRC_MODEL = 'plastik-model';
const SRC_GYRE_LINES = 'plastik-gyre-lines';
const SRC_GYRE_MODEL = 'plastik-gyre-model';
const IMG_GLOBAL = 'plastik-global';
const IMG_GPGP = 'plastik-gpgp';
const L_AREA = 'plastik-area';
const L_LINES = 'plastik-lines';
const L_BOUNDARY = 'plastik-boundary';
const L_BOUNDARY_LABEL = 'plastik-boundary-label';
const L_LINES_LABEL = 'plastik-lines-label';
const L_TOWS = 'plastik-tows';
const L_TOWS_GLOBAL = 'plastik-tows-global';
const L_MODEL = 'plastik-model-outline';
const L_MODEL_LABEL = 'plastik-model-outline-label';
const L_GYRE_LINES = 'plastik-gyre-lines';
const L_GYRE_LINES_LABEL = 'plastik-gyre-lines-label';
const L_GYRE_MODEL = 'plastik-gyre-model-outline';
const L_GYRE_MODEL_LABEL = 'plastik-gyre-model-outline-label';
const L_PT = 'plastik-pt';
const L_LABEL = 'plastik-label';
const ATTRIBUTION = 'Lebreton et al. 2018 · Eriksen et al. 2014 (CC BY 4.0)';
/** the GPGP picture and the contour lines show from here on; the global picture fades out meanwhile */
const GPGP_ZOOM = 2.5;
const DIR = 'data/plastik/';

interface Patch {
  id: string;
  name: string;
  lon: number;
  lat: number;
  metric: string;
  study: string;
  doi: string;
  doiUrl: string;
  dataUrl: string | null;
}
interface Origin {
  credit: string;
  collected: number;
  objects: number;
  withOrigin: number;
  countries: { code: string; name: string; n: number; share: number }[];
  other: number;
  fishing: { share: [number, number]; basis: string; source: string; verified: boolean };
  age: { dated: number; oldest: number; newest: number };
}
interface ModelMeta {
  tau_years: number;
  diffusivity: number;
  dt_days: number;
  source: string;
  sources: { rivers: string; fishing: string };
  production: string;
  current: string;
  calibration: { year: number; target_km2: number };
  plausibility: { distance_km: number; iou_2015: number; first_year: number | null };
}
interface State {
  /** unsubscribe from the time slider (set while the layer is on) */
  off?: () => void;
  /** image sources and their layers exist (created on first switch-on) */
  images: boolean;
  /** opacity chosen in the layer list (0..1) */
  factor: number;
  history?: History;
  origin?: Origin;
  model?: ModelMeta;
  /** sources, methods and study references of the global tows */
  towsMeta?: GlobalTowsMeta;
  patches: Patch[];
  /** Eriksen isoline meta, own gyre-model meta and the model area per gyre and year */
  gyreContours?: GyreContoursMeta;
  gyreModel?: GyreModelMeta;
  gyreAreas: Map<string, number>;
}

const state = (ctx: ExtraCtx) => ctx.state<State>(ID, () => ({ images: false, factor: 1, patches: [], gyreAreas: new Map() }));

const PCT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const pct = (share: number) => `${PCT.format(share * 100)} %`;

/** raster-opacity: `base` below GPGP_ZOOM, ending at `end` at zoom 4.5 (the picture underneath fades) */
const globalOpacity = (f: number) => ['interpolate', ['linear'], ['zoom'], 2, 0.7 * f, GPGP_ZOOM, 0.1 * f, GPGP_ZOOM + 1, 0];
const gpgpOpacity = (f: number) => ['interpolate', ['linear'], ['zoom'], GPGP_ZOOM, 0, GPGP_ZOOM + 0.5, 0.88 * f];

/** colour by log10 mass (same scale as the GPGP picture); no mass or 0 g/km²: grey */
const towsColor = [
  'case',
  ['>', ['coalesce', ['get', 'm'], 0], 0],
  ['interpolate', ['linear'], ['log10', ['get', 'm']], ...SCALE_STOPS.flat()],
  '#8d949c',
];
const TOW_METHOD: Record<string, string> = {
  N: 'Neuston-Netz (historische Studien, Lebreton 2018)',
  M: 'Manta-Netz (historische Studien, Lebreton 2018)',
  O: 'anderes Netz (Ovoid-Plankton, Seston oder Ringnetz; Lebreton 2018)',
  U: 'Netz, Typ nicht angegeben (Lebreton 2018)',
  T: 'Manta-Trawl 2015 bis 2022 (Lebreton 2024)',
};
const NUM = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 3 });

/** Image sources and raster layers: created on first use so that nothing is fetched while the layer is off. */
function addImages(ctx: ExtraCtx) {
  const s = state(ctx);
  if (s.images) return;
  s.images = true;
  const m = ctx.map;
  if (!m.getSource(IMG_GLOBAL)) m.addSource(IMG_GLOBAL, { type: 'image', url: assetUrl(`${DIR}global-density.png`), coordinates: CORNERS_GLOBAL });
  if (!m.getSource(IMG_GPGP)) m.addSource(IMG_GPGP, { type: 'image', url: assetUrl(`${DIR}gpgp-density.png`), coordinates: CORNERS_GPGP });
  // below the contour lines, which come first among the layers of this entry
  const layer = (id: string, opacity: unknown, minzoom?: number) =>
    ({ id, type: 'raster', source: id, ...(minzoom != null ? { minzoom } : {}), paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }) as LayerSpecification;
  ctx.add(layer(IMG_GLOBAL, globalOpacity(s.factor)), L_AREA);
  ctx.add(layer(IMG_GPGP, gpgpOpacity(s.factor), GPGP_ZOOM), L_AREA);
}

/** applies the year of the time slider to the tow layers */
function applyYear(ctx: ExtraCtx) {
  const m = ctx.map;
  const year = plastikYear();
  if (m.getLayer(L_MODEL)) m.setFilter(L_MODEL, modelFilter(year) as never);
  if (m.getLayer(L_MODEL_LABEL)) {
    m.setFilter(L_MODEL_LABEL, modelFilter(year) as never);
    m.setLayoutProperty(L_MODEL_LABEL, 'text-field', modelLabel(year));
  }
  // the model outlines of the other gyres (each layer on its own)
  if (m.getLayer(L_GYRE_MODEL)) m.setFilter(L_GYRE_MODEL, gyreModelFilter(year) as never);
  if (m.getLayer(L_GYRE_MODEL_LABEL)) {
    m.setFilter(L_GYRE_MODEL_LABEL, gyreModelFilter(year) as never);
    m.setLayoutProperty(L_GYRE_MODEL_LABEL, 'text-field', gyreModelLabel(year));
  }
  const f = state(ctx).factor;
  if (m.getLayer(L_TOWS_GLOBAL)) {
    m.setFilter(L_TOWS_GLOBAL, towsFilter(year) as never);
    m.setPaintProperty(L_TOWS_GLOBAL, 'circle-opacity', towsOpacity(year, f) as never);
    m.setPaintProperty(L_TOWS_GLOBAL, 'circle-radius', towsRadius(year) as never);
    m.setPaintProperty(L_TOWS_GLOBAL, 'circle-stroke-width', towsStrokeWidth(year) as never);
    m.setPaintProperty(L_TOWS_GLOBAL, 'circle-stroke-opacity', towsStrokeOpacity(year, f) as never);
    m.setLayoutProperty(L_TOWS_GLOBAL, 'circle-sort-key', globalTowsSort(year) as never);
  }
  if (!m.getLayer(L_TOWS)) return;
  m.setFilter(L_TOWS, towsFilter(year) as never);
  m.setPaintProperty(L_TOWS, 'circle-opacity', towsOpacity(year, f) as never);
  m.setPaintProperty(L_TOWS, 'circle-radius', towsRadius(year) as never);
  m.setPaintProperty(L_TOWS, 'circle-stroke-width', towsStrokeWidth(year) as never);
  m.setPaintProperty(L_TOWS, 'circle-stroke-opacity', towsStrokeOpacity(year, f) as never);
  m.setLayoutProperty(L_TOWS, 'circle-sort-key', towsSort(year) as never);
}

function towPanel(p: Record<string, unknown>): InfoPanelData {
  const y = Number(p.y);
  const m = p.m != null ? Number(p.m) : null;
  const n = p.n != null ? Number(p.n) : null;
  const old = p.s !== 'T';
  return {
    glyph: 'tsunami',
    color: COLOR,
    title: `Netzfang ${y}`,
    subtitle: 'Messpunkt, Plastik an der Meeresoberfläche',
    tiles: [
      ['Masse', m != null ? `${NUM.format(m)} g/km²` : 'keine Angabe'],
      ['Teile', n != null ? `${NUM.format(n)}/km²` : 'keine Angabe'],
    ],
    sections: [
      {
        key: 'tow',
        title: 'Messung',
        open: true,
        rows: [
          { k: 'Jahr', v: String(y) },
          { k: 'Methode', v: TOW_METHOD[String(p.s)] ?? 'Netzfang' },
          {
            k: 'Quelle',
            v: old ? 'Lebreton et al. 2018, Historical Dataset (CC BY 4.0)' : 'Lebreton et al. 2024, Manta trawl (CC BY 4.0)',
            href: old ? 'https://doi.org/10.6084/m9.figshare.5873142' : 'https://doi.org/10.6084/m9.figshare.25674120',
          },
        ],
      },
    ],
    note: old
      ? 'Rohwerte eines Netzfangs (Maschenweite 150 bis 505 µm). Die Fänge von 2015 bis 2022 (Lebreton 2024) erfassen Teile von 0,5 bis 500 mm mit Korrektur für die Durchmischung und sind mit diesem Wert nicht direkt vergleichbar. Grau: Masse 0 g/km².'
      : 'Teile von 0,5 bis 500 mm (Summe der Größenklassen 1 bis 6), mit Korrektur für die vertikale Durchmischung. Die älteren Fänge (Lebreton 2018) sind Rohwerte und mit diesem Wert nicht direkt vergleichbar.',
  };
}

/** click on the modelled outline: year, area and the assumptions of the model (EXPERIMENTAL, no measurement) */
function modelPanel(p: Record<string, unknown>, s: State): InfoPanelData {
  const y = Number(p.y);
  const a = plastikModelArea(y) ?? Number(p.a);
  const mm = s.model;
  const sections: NonNullable<InfoPanelData['sections']> = [
    {
      key: 'model',
      title: 'Modellannahmen',
      open: true,
      rows: mm
        ? [
            { k: 'Strömung', v: 'mittleres Feld, NOAA/AOML-Drifter-Klimatologie (Laurindo et al. 2017, CC BY 4.0); Partikel, RK2, Diffusion ' + NUM.format(mm.diffusivity) + ' m²/s, Stranden an der Küste' },
            { k: 'Eintrag', v: mm.sources.rivers + '; Fischerei: ' + mm.sources.fishing },
            { k: 'Menge je Jahr', v: 'proportional zur weltweiten Plastikproduktion (Geyer et al. 2017 via Our World in Data, CC BY; nach 2019 linear fortgeschrieben)' },
            { k: 'Verlust', v: `Absinken und Zerfall: e-Faltungszeit ${mm.tau_years} Jahre (Annahme)` },
            { k: 'Kalibrierung', v: `feste Dichteschwelle für alle Jahre, so gewählt, dass die Fläche ${mm.calibration.year} ${areaMio(mm.calibration.target_km2)} beträgt (Lebreton et al. 2018)` },
            { k: 'Abgleich 2015', v: `Mitte ${NUM.format(mm.plausibility.distance_km)} km von der Lebreton-Mitte, Überdeckung (IoU) mit der 10-kg-Fläche ${PCT.format(mm.plausibility.iou_2015)}` },
          ]
        : [{ k: 'Modell', v: 'Parameter nicht geladen' }],
    },
  ];
  return {
    glyph: 'tsunami',
    color: MODEL_COLOR,
    title: `Modell-Umriss ${y}`,
    subtitle: 'Experimentelles Modell, keine Messung',
    tiles: [
      ['Fläche', areaMio(a) ?? 'noch keine zusammenhängende Fläche'],
      ['Jahr', String(y)],
    ],
    sections,
    note: 'Es gibt keine gemessenen historischen Umrisse des Müllstrudels. Dieser Umriss ist eine eigene, stark vereinfachte Modellrechnung (Eintrag und Strömung wie oben, ohne Wind, Wellen, Jahreszeiten und ohne Fischerei als eigene Quelle) und nur auf die Fläche von 2015 abgestimmt. Die Entwicklung davor und danach ist eine Annahme des Modells. ' + MODEL_NOTE + '.',
    link: { label: 'Lebreton et al. 2018 (Scientific Reports)', url: 'https://doi.org/10.1038/s41598-018-22939-w' },
  };
}

/** click on the model outline of another gyre: year, area, plausibility against Eriksen */
function gyreModelPanel(p: Record<string, unknown>, s: State): InfoPanelData {
  const g = String(p.g) as GyreId;
  const y = Number(p.y);
  const name = s.patches.find((x) => x.id === g)?.name ?? g;
  return {
    glyph: 'tsunami',
    color: MODEL_COLOR,
    title: `Modell-Umriss ${y}: ${name}`,
    subtitle: 'Experimentelles Modell, keine Messung',
    tiles: [
      ['Fläche', modelAreaText(g, gyreArea(s.gyreAreas, g, y), y)],
      ['Jahr', String(y)],
    ],
    html: lineLegend(g, true),
    sections: gyreSections(g, y, s.gyreAreas, s.gyreContours, s.gyreModel),
    note: 'Eigene, stark vereinfachte Modellrechnung (Eintrag und Strömung wie beim Nordpazifik, feste Dichteschwelle, nur auf die Fläche des Nordpazifik-Patches 2015 abgestimmt, für diesen Wirbel nicht angepasst). ' + MODEL_NOTE + '. Die Lage kann von den Eriksen-Isolinien abweichen.',
  };
}

function patchPanel(p: Record<string, unknown>, s: State): InfoPanelData {
  const gpgp = p.id === 'gpgp';
  const doiUrl = safeUrl(p.doiUrl);
  const dataUrl = safeUrl(p.dataUrl);
  const name = String(p.name);
  if (!gpgp) {
    const g = String(p.id) as GyreId;
    const known = ERIKSEN_GYRES.includes(g);
    return {
      glyph: 'tsunami',
      color: COLOR,
      title: name,
      subtitle: 'Müllstrudel, Messwert einer Studie',
      html: known ? lineLegend(g, MODEL_GYRES.includes(g)) : undefined,
      sections: [
        {
          key: 'val',
          title: 'Messwert',
          open: true,
          rows: [
            { k: 'Kennzahl', v: String(p.metric) },
            { k: 'Studie', v: String(p.study), href: doiUrl ?? undefined },
            { k: 'Rohdaten', v: dataUrl ? 'offen verfügbar' : 'keine offenen Rohdaten', href: dataUrl ?? undefined },
          ],
        },
        ...(known ? gyreSections(g, plastikYear(), s.gyreAreas, s.gyreContours, s.gyreModel) : []),
      ],
      note: 'Die Werte stammen aus unterschiedlichen Studien, Methoden und Zeiträumen und sind nicht direkt vergleichbar.',
    };
  }
  const o = s.origin;
  const rows: { k: string; v: string; href?: string }[] = [];
  if (o) {
    const top = o.countries.slice(0, 5);
    const rest = 1 - top.reduce((a, c) => a + c.share, 0);
    for (const c of top) rows.push({ k: c.name, v: pct(c.share) });
    rows.push({ k: 'andere', v: pct(rest) });
  }
  const sections: NonNullable<InfoPanelData['sections']> = [];
  if (o) {
    sections.push({
      key: 'origin',
      title: 'Herkunft der Objekte',
      open: true,
      rows: [
        ...rows,
        { k: 'Grundlage', v: `Anteil an den ${o.withOrigin} von ${o.objects} geborgenen Objekten mit erkennbarer Herkunft (Lebreton et al. 2022, Probe ${o.collected})` },
      ],
    });
    sections.push({
      key: 'facts',
      title: 'Weitere Angaben',
      open: true,
      rows: [
        { k: 'Fischerei', v: `${Math.round(o.fishing.share[0] * 100)}–${Math.round(o.fishing.share[1] * 100)} % der Masse (Studienangabe)` },
        { k: 'Ältestes datiertes Objekt', v: `${o.age.oldest} produziert (von ${o.age.dated} datierbaren Objekten)` },
      ],
    });
  }
  sections.push({
    key: 'src',
    title: 'Quellen',
    open: true,
    rows: [
      { k: 'Paper', v: 'Lebreton et al. 2018 (Scientific Reports)', href: 'https://doi.org/10.1038/s41598-018-22939-w' },
      { k: 'Daten', v: 'figshare, Lebreton et al. 2018 (CC BY 4.0)', href: 'https://doi.org/10.6084/m9.figshare.5873142' },
      ...(o ? [{ k: 'Herkunft', v: 'Lebreton et al. 2022', href: 'https://doi.org/10.1038/s41598-022-16529-0' }] : []),
    ],
  });
  const eri = gpgpEriksenRows(s.gyreContours);
  if (eri.length) sections.push({ key: 'eriksen', title: 'Vergleich mit Eriksen 2014', open: true, rows: eri });
  return {
    glyph: 'tsunami',
    color: COLOR,
    title: name,
    subtitle: 'Größter bekannter Müllstrudel im Meer',
    tiles: [
      ['Fläche', '~1,6 Mio. km²'],
      ['Schwimmendes Plastik', '~79.000 t'],
    ],
    html: panelHtml(s.history),
    sections,
    note: 'Fläche und Masse sind Studienwerte (Lebreton et al. 2018), nicht die Fläche des gezeigten Rasters (dessen Ausschnitt endet bei 160° W; der Patch reicht nach Westen darüber hinaus). Das Dichtebild zeigt Modellwerte. ' + ATTRIBUTION,
    link: { label: 'Strömungsmodell als Video (NASA SVS 4174)', url: 'https://svs.gsfc.nasa.gov/4174' },
  };
}

export default defineExtra({
  id: ID,
  order: 252,
  section: 'ocean',
  cat: 'meer',
  label: 'Plastik im Meer',
  hint: 'Plastikdichte weltweit und im Großen Pazifikmüllstrudel (GPGP), Müllstrudel mit Studienwerten – Lebreton 2018, Eriksen 2014',
  glyph: 'tsunami',
  icon: 'ocean',
  color: COLOR,
  sources: {
    [SRC_POINTS]: 'Plastik: <a href="https://doi.org/10.1038/s41598-018-22939-w">Lebreton et al. 2018</a>, <a href="https://doi.org/10.1371/journal.pone.0111913">Eriksen et al. 2014</a> (CC BY 4.0)',
    [SRC_CONTOURS]: 'Plastik: Lebreton et al. 2018 (CC BY 4.0)',
    [SRC_TOWS]: 'Netzfänge: Lebreton et al. 2018 und 2024 (CC BY 4.0)',
    [SRC_TOWS_GLOBAL]: 'Netzfänge weltweit: <a href="https://www.ncei.noaa.gov/products/microplastics">NOAA NCEI</a> (CC0), Cózar et al. 2015, Pedrotti et al. 2016 (CC BY 3.0), Leistenschneider 2023 (CC BY 4.0)',
    [SRC_GYRE_LINES]: 'Isolinien: <a href="https://doi.org/10.1371/journal.pone.0111913">Eriksen et al. 2014</a> (CC BY 4.0), eigene Ableitung',
    [SRC_GYRE_MODEL]: 'Modell-Umrisse der Wirbel: eigene Modellrechnung (experimentell), Strömung NOAA/AOML (CC BY 4.0), Mündungen Meijer et al. 2021, Produktion Geyer et al. 2017 via Our World in Data (CC BY)',
    [SRC_MODEL]: 'Modell-Umriss: eigene Modellrechnung (experimentell), Strömung NOAA/AOML (CC BY 4.0), Mündungen Meijer et al. 2021, Produktion Geyer et al. 2017 via Our World in Data (CC BY)',
  },
  addLayers({ add, hidden }) {
    // the images (global-density, gpgp-density) are added later, below L_AREA
    add({ id: L_AREA, type: 'fill', source: SRC_POINTS, minzoom: GPGP_ZOOM - 0.5, filter: ['==', ['geometry-type'], 'Polygon'], layout: hidden, paint: { 'fill-color': COLOR, 'fill-opacity': 0.01 } }, 'marker');
    add(
      {
        id: L_LINES,
        type: 'line',
        source: SRC_CONTOURS,
        minzoom: GPGP_ZOOM,
        filter: ['!', ['to-boolean', ['get', 'boundary']]],
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          'line-color': LINE_STYLE.edge.color,
          'line-width': ['match', ['get', 'level'], 1000, LINE_STYLE.edge.width, 100000, LINE_STYLE.core.width, LINE_STYLE.other.width],
          'line-opacity': ['match', ['get', 'level'], 1000, LINE_STYLE.edge.opacity, 100000, LINE_STYLE.core.opacity, LINE_STYLE.other.opacity],
        },
      },
      'marker',
    );
    add(
      {
        id: L_LINES_LABEL,
        type: 'symbol',
        source: SRC_CONTOURS,
        minzoom: GPGP_ZOOM + 1,
        filter: ['!', ['to-boolean', ['get', 'boundary']]],
        layout: {
          ...hidden,
          'symbol-placement': 'line',
          'symbol-spacing': 520,
          'text-field': ['match', ['get', 'level'], 1000, '1 kg/km²', 100000, '100 kg/km²', ['concat', ['to-string', ['/', ['get', 'level'], 1000]], ' kg/km²']],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-keep-upright': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: L_BOUNDARY,
        type: 'line',
        source: SRC_CONTOURS,
        minzoom: GPGP_ZOOM,
        filter: ['to-boolean', ['get', 'boundary']],
        layout: { ...hidden, 'line-join': 'round' },
        paint: { 'line-color': LINE_STYLE.boundary.color, 'line-width': LINE_STYLE.boundary.width, 'line-opacity': LINE_STYLE.boundary.opacity },
      },
      'marker',
    );
    add(
      {
        id: L_BOUNDARY_LABEL,
        type: 'symbol',
        source: SRC_CONTOURS,
        minzoom: GPGP_ZOOM + 0.5,
        filter: ['to-boolean', ['get', 'boundary']],
        layout: { ...hidden, 'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': '10 kg/km² – Patch-Grenze', 'text-font': FONT_REGULAR, 'text-size': 11, 'text-keep-upright': true },
        paint: { 'text-color': '#fcffa4', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
    add(
      {
        id: L_MODEL,
        type: 'line',
        source: SRC_MODEL,
        filter: modelFilter(null) as never,
        layout: { ...hidden, 'line-join': 'round' },
        paint: { 'line-color': LINE_STYLE.model.color, 'line-width': LINE_STYLE.model.width, 'line-dasharray': LINE_STYLE.model.dash, 'line-opacity': LINE_STYLE.model.opacity },
      },
      'marker',
    );
    add(
      {
        id: L_MODEL_LABEL,
        type: 'symbol',
        source: SRC_MODEL,
        minzoom: 3,
        filter: modelFilter(null) as never,
        layout: { ...hidden, 'symbol-placement': 'line', 'symbol-spacing': 520, 'text-field': modelLabel(null), 'text-font': FONT_REGULAR, 'text-size': 11, 'text-keep-upright': true },
        paint: { 'text-color': MODEL_COLOR, 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
    // Eriksen 2014 isolines of the other gyres: thin dotted light-blue lines, stronger from outer to core (never on the GPGP)
    add(
      {
        id: L_GYRE_LINES,
        type: 'line',
        source: SRC_GYRE_LINES,
        minzoom: 1.5,
        filter: eriksenFilter() as never,
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          'line-color': eriksenByRank(LINE_STYLE.eriksenOuter.color, LINE_STYLE.eriksenMid.color, LINE_STYLE.eriksenCore.color) as never,
          'line-width': eriksenByRank(LINE_STYLE.eriksenOuter.width, LINE_STYLE.eriksenMid.width, LINE_STYLE.eriksenCore.width) as never,
          'line-opacity': eriksenByRank(LINE_STYLE.eriksenOuter.opacity, LINE_STYLE.eriksenMid.opacity, LINE_STYLE.eriksenCore.opacity) as never,
          'line-dasharray': LINE_STYLE.eriksenMid.dash,
        },
      },
      'marker',
    );
    add(
      {
        id: L_GYRE_LINES_LABEL,
        type: 'symbol',
        source: SRC_GYRE_LINES,
        minzoom: 3,
        filter: eriksenFilter() as never,
        layout: { ...hidden, 'symbol-placement': 'line', 'symbol-spacing': 520, 'text-field': eriksenLabel() as never, 'text-font': FONT_REGULAR, 'text-size': 10, 'text-keep-upright': true },
        paint: { 'text-color': '#cfe8ff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: L_GYRE_MODEL,
        type: 'line',
        source: SRC_GYRE_MODEL,
        filter: gyreModelFilter(null) as never,
        layout: { ...hidden, 'line-join': 'round' },
        paint: { 'line-color': LINE_STYLE.model.color, 'line-width': LINE_STYLE.model.width, 'line-dasharray': LINE_STYLE.model.dash, 'line-opacity': LINE_STYLE.model.opacity },
      },
      'marker',
    );
    add(
      {
        id: L_GYRE_MODEL_LABEL,
        type: 'symbol',
        source: SRC_GYRE_MODEL,
        minzoom: 3,
        filter: gyreModelFilter(null) as never,
        layout: { ...hidden, 'symbol-placement': 'line', 'symbol-spacing': 520, 'text-field': gyreModelLabel(null), 'text-font': FONT_REGULAR, 'text-size': 11, 'text-keep-upright': true },
        paint: { 'text-color': MODEL_COLOR, 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
    // global tows below the GPGP tows (which have their own mass scale and sit on top)
    add(
      {
        id: L_TOWS_GLOBAL,
        type: 'circle',
        source: SRC_TOWS_GLOBAL,
        filter: towsFilter(null) as never,
        layout: { ...hidden, 'circle-sort-key': globalTowsSort(null) as never },
        paint: {
          'circle-color': globalTowsColor(SCALE_STOPS) as never,
          'circle-radius': towsRadius(null) as never,
          'circle-opacity': towsOpacity(null, 1) as never,
          'circle-stroke-color': 'rgba(0,0,0,0.7)',
          'circle-stroke-width': towsStrokeWidth(null) as never,
          'circle-stroke-opacity': towsStrokeOpacity(null, 1) as never,
        },
      },
      'marker',
    );
    add(
      {
        id: L_TOWS,
        type: 'circle',
        source: SRC_TOWS,
        filter: towsFilter(null) as never,
        layout: { ...hidden, 'circle-sort-key': towsSort(null) as never },
        paint: {
          'circle-color': towsColor as never,
          'circle-radius': towsRadius(null) as never,
          'circle-opacity': towsOpacity(null, 1) as never,
          'circle-stroke-color': 'rgba(0,0,0,0.7)',
          'circle-stroke-width': towsStrokeWidth(null) as never,
          'circle-stroke-opacity': towsStrokeOpacity(null, 1) as never,
        },
      },
      'marker',
    );
    add(
      {
        id: L_PT,
        type: 'circle',
        source: SRC_POINTS,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: hidden,
        paint: { 'circle-color': COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 6, 7], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
      },
      'marker',
    );
    add(
      {
        id: L_LABEL,
        type: 'symbol',
        source: SRC_POINTS,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 9 },
        paint: { 'text-color': '#ffe0b2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  setOpacity(ctx, f) {
    // zoom-dependent opacities are not scaled by the generic opacity handling: do it here
    const s = state(ctx);
    s.factor = f;
    if (!s.images) {
      applyYear(ctx);
      return;
    }
    if (ctx.map.getLayer(IMG_GLOBAL)) ctx.map.setPaintProperty(IMG_GLOBAL, 'raster-opacity', globalOpacity(f) as never);
    if (ctx.map.getLayer(IMG_GPGP)) ctx.map.setPaintProperty(IMG_GPGP, 'raster-opacity', gpgpOpacity(f) as never);
    applyYear(ctx);
  },
  disable(ctx) {
    const s = state(ctx);
    s.off?.();
    s.off = undefined;
  },
  enable(ctx) {
    addImages(ctx);
    const s0 = state(ctx);
    // the slider moves: show the tows up to its year
    if (!s0.off) s0.off = subscribePlastik(() => applyYear(ctx));
    applyYear(ctx);
    ctx.loadOnce(ID, Infinity, async () => {
      const s = state(ctx);
      const get = <T>(f: string) => fetchJson<T>(assetUrl(DIR + f));
      const [patches, contours, history, origin, tows, towsGlobal, model, modelMeta, gyreLines, gyreLinesMeta, gyreModel, gyreModelMeta] = await Promise.all([
        get<{ patches: Patch[] }>('patches.json'),
        get<FeatureCollection>('gpgp-contours.geojson'),
        get<History>('gpgp-history.json').catch(() => undefined),
        get<Origin>('gpgp-origin.json').catch(() => undefined),
        get<FeatureCollection>('gpgp-tows.geojson').catch(() => undefined),
        get<FeatureCollection & GlobalTowsMeta>('tows-global.geojson').catch(() => undefined),
        get<FeatureCollection>('gpgp-model-outlines.geojson').catch(() => undefined),
        get<ModelMeta>('gpgp-model-meta.json').catch(() => undefined),
        get<FeatureCollection>('gyre-contours.geojson').catch(() => undefined),
        get<GyreContoursMeta>('gyre-contours.json').catch(() => undefined),
        get<FeatureCollection>('gyre-model-outlines.geojson').catch(() => undefined),
        get<GyreModelMeta>('gyre-model-meta.json').catch(() => undefined),
      ]);
      s.patches = patches.patches;
      s.history = history;
      s.origin = origin;
      const area = patchPolygon(contours);
      ctx.setData(SRC_CONTOURS, contours);
      s.model = modelMeta;
      if (model) ctx.setData(SRC_MODEL, model);
      s.gyreContours = gyreLinesMeta;
      s.gyreModel = gyreModelMeta;
      if (gyreLines) ctx.setData(SRC_GYRE_LINES, gyreLines);
      if (gyreModel) {
        s.gyreAreas = gyreAreas(gyreModel.features);
        ctx.setData(SRC_GYRE_MODEL, { ...gyreModel, features: drawnGyreFeatures(gyreModel.features) });
      }
      if (towsGlobal) {
        s.towsMeta = towsGlobal;
        ctx.setData(SRC_TOWS_GLOBAL, towsGlobal);
      }
      if (tows || towsGlobal || model) {
        if (tows) ctx.setData(SRC_TOWS, tows);
        const modelYears: ModelYear[] = (model?.features ?? []).map((f) => ({ y: Number(f.properties?.y), a: Number(f.properties?.a) })).filter((m) => Number.isFinite(m.y) && Number.isFinite(m.a));
        setPlastikYears([...(tows?.features ?? []), ...(towsGlobal?.features ?? [])].map((f) => Number(f.properties?.y)).filter(Number.isFinite), modelYears);
        applyYear(ctx);
      }
      ctx.setData(SRC_POINTS, {
        type: 'FeatureCollection',
        features: [
          ...(area ? [area] : []),
          ...patches.patches.map((p): Feature => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { ...p } })),
        ],
      });
      return { count: patches.patches.length, note: 'Klick auf einen Müllstrudel zeigt die Studienwerte; ab Zoom 2,5 Detailbild und Isolinien des Nordpazifik-Patches; Netzfänge mit Zeitregler; gestrichelter Modell-Umriss pro Jahr (experimentell); Eriksen-Isolinien und Modell-Umrisse der übrigen Müllstrudel' };
    });
  },
  click({ ctx, layerId, p, pt, at }) {
    const s = state(ctx);
    if (layerId === L_TOWS_GLOBAL) return { type: 'panel', data: globalTowPanel(p, s.towsMeta, COLOR), lng: pt[0], lat: pt[1] };
    if (layerId === L_TOWS) return { type: 'panel', data: towPanel(p), lng: pt[0], lat: pt[1] };
    if (layerId === L_GYRE_MODEL) return { type: 'panel', data: gyreModelPanel(p, s), lng: at.lng, lat: at.lat };
    if (layerId === L_MODEL) return { type: 'panel', data: modelPanel(p, s), lng: at.lng, lat: at.lat };
    const patch = s.patches.find((x) => x.id === p.id);
    const data = patchPanel(patch ? ({ ...patch } as unknown as Record<string, unknown>) : p, s);
    // a click into the patch area has no point of its own: place the card at the click
    const lng = p.kind === 'area' ? at.lng : pt[0];
    const lat = p.kind === 'area' ? at.lat : pt[1];
    return { type: 'panel', data, lng, lat };
  },
  layers: [IMG_GLOBAL, IMG_GPGP, L_AREA, L_LINES, L_LINES_LABEL, L_BOUNDARY, L_BOUNDARY_LABEL, L_MODEL, L_MODEL_LABEL, L_GYRE_LINES, L_GYRE_LINES_LABEL, L_GYRE_MODEL, L_GYRE_MODEL_LABEL, L_TOWS_GLOBAL, L_TOWS, L_PT, L_LABEL],
  clickLayers: [L_TOWS, L_TOWS_GLOBAL, L_MODEL, L_GYRE_MODEL, L_PT, L_AREA],
});
