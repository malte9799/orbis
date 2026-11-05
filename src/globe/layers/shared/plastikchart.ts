import { escapeHtml } from '../../../util';
import { MODEL_COLOR } from './plastikmodell';

// Small inline-SVG line chart for the plastic layer: mass per km² inside the Great Pacific Garbage Patch over the years,
// logarithmic y axis. Each series is drawn on its own (the series come from different methods and are never joined).

export interface HistoryPoint {
  year: number;
  value: number;
  median?: number;
  n?: number;
}
export interface HistorySeries {
  id: string;
  label: string;
  unit: string;
  method: string;
  note?: string;
  points: HistoryPoint[];
}
export interface History {
  credit: string;
  note: string;
  series: HistorySeries[];
}

export interface ChartSeries {
  id: string;
  label: string;
  method: string;
  note?: string;
  color: string;
  /** `line`: points joined within the series; `dots`: single survey values */
  style: 'line' | 'dots';
  points: { year: number; value: number }[];
}

/** which series of gpgp-history.json are shown (mass inside the patch) and how */
export const MASS_IN: { id: string; color: string; style: 'line' | 'dots' }[] = [
  { id: 'l18-mass-in', color: '#f98e09', style: 'line' },
  { id: 'l24-manta-mass-in', color: '#29b6f6', style: 'line' },
  { id: 'l24-aerial-mass-in', color: '#ec407a', style: 'dots' },
  { id: 'l24-cleanup-mass-in', color: '#66bb6a', style: 'dots' },
];

/** the mass-in series in a fixed order; unknown ids are skipped, values <= 0 cannot be drawn on a log axis */
export function massInSeries(h: History): ChartSeries[] {
  const out: ChartSeries[] = [];
  for (const m of MASS_IN) {
    const s = h.series.find((x) => x.id === m.id && x.unit === 'g/km²');
    if (!s) continue;
    const points = s.points.filter((p) => p.value > 0 && Number.isFinite(p.year)).map((p) => ({ year: p.year, value: p.value }));
    if (points.length) out.push({ id: s.id, label: s.label, method: s.method, note: s.note, color: m.color, style: m.style, points });
  }
  return out;
}

/** decade range [lo, hi] (exponents of 10) that contains every value */
export function logRange(values: number[]): [number, number] {
  const lo = Math.floor(Math.log10(Math.min(...values)));
  let hi = Math.ceil(Math.log10(Math.max(...values)));
  if (hi <= lo) hi = lo + 1;
  return [lo, hi];
}

const NUM = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const W = 320;
const H = 190;
const M = { l: 46, r: 10, t: 8, b: 22 };

/** The chart as an SVG string (all text escaped). Empty string when there is nothing to draw. */
export function chartSvg(series: ChartSeries[]): string {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return '';
  const [e0, e1] = logRange(all.map((p) => p.value));
  const years = all.map((p) => p.year);
  const x0 = Math.floor(Math.min(...years) / 10) * 10;
  const x1 = Math.max(x0 + 10, Math.ceil(Math.max(...years) / 5) * 5);
  const px = (y: number) => M.l + ((y - x0) / (x1 - x0)) * (W - M.l - M.r);
  const py = (v: number) => M.t + (1 - (Math.log10(v) - e0) / (e1 - e0)) * (H - M.t - M.b);
  const r = (n: number) => Math.round(n * 10) / 10;

  let grid = '';
  for (let e = e0; e <= e1; e++) {
    const y = r(py(10 ** e));
    grid += `<line x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}" style="stroke:var(--border,#8884)" stroke-width="0.6"/>`;
    grid += `<text x="${M.l - 4}" y="${y + 3}" text-anchor="end" font-size="9" style="fill:var(--muted,#999)">${escapeHtml(NUM.format(10 ** e))}</text>`;
  }
  for (let y = x0; y <= x1; y += 10) {
    grid += `<text x="${r(px(y))}" y="${H - 7}" text-anchor="middle" font-size="9" style="fill:var(--muted,#999)">${y}</text>`;
  }

  let marks = '';
  for (const s of series) {
    const pts = s.points.slice().sort((a, b) => a.year - b.year);
    if (s.style === 'line' && pts.length > 1) {
      marks += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${r(px(p.year))} ${r(py(p.value))}`).join(' ')}" fill="none" stroke="${escapeHtml(s.color)}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
    for (const p of pts) {
      marks += `<circle cx="${r(px(p.year))}" cy="${r(py(p.value))}" r="${s.style === 'dots' ? 3.4 : 2.2}" fill="${escapeHtml(s.color)}"><title>${escapeHtml(`${s.label}: ${p.year}, ${NUM.format(p.value)} g/km²`)}</title></circle>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Masse in g/km² im Müllstrudel nach Jahr, logarithmische Achse" style="display:block">${grid}${marks}</svg>`;
}

/** Map line styles, shared by the layer paint (defs/plastik.ts) and the legend so they cannot drift apart. */
export const LINE_STYLE = {
  /** contour lines by level in g/km² (10 kg/km² is the boundary, drawn separately) */
  edge: { color: '#ffffff', width: 1, opacity: 0.55 },
  core: { color: '#ffffff', width: 1.4, opacity: 0.85 },
  /** other, unlabelled contour levels */
  other: { width: 1, opacity: 0.6 },
  boundary: { color: '#fcffa4', width: 2.4, opacity: 1 },
  model: { color: MODEL_COLOR, width: 1.8, opacity: 0.95, dash: [2, 1.5] as [number, number] },
  /** Eriksen 2014 isolines of the other gyres: thin, light blue, dotted; stronger from outer to core */
  eriksenOuter: { color: '#cfe8ff', width: 0.9, opacity: 0.4, dash: [1, 2.5] as [number, number] },
  eriksenMid: { color: '#cfe8ff', width: 1.2, opacity: 0.65, dash: [1, 2.5] as [number, number] },
  eriksenCore: { color: '#e8f4ff', width: 1.6, opacity: 0.95, dash: [1, 2.5] as [number, number] },
};

const LINE_LEGEND: { s: { color: string; width: number; opacity: number; dash?: number[] }; text: string }[] = [
  { s: LINE_STYLE.edge, text: '1 kg/km² – Randzone (Lebreton 2018, Stand 2015)' },
  { s: LINE_STYLE.boundary, text: '10 kg/km² – Patch-Grenze nach Lebreton 2018 (Stand 2015)' },
  { s: LINE_STYLE.core, text: '100 kg/km² – Kern mit der höchsten Dichte (Stand 2015)' },
  { s: LINE_STYLE.model, text: 'Modell-Umriss des gewählten Jahres – experimentell, keine Messung' },
];

const ERIKSEN_LEGEND: typeof LINE_LEGEND = [
  { s: LINE_STYLE.eriksenOuter, text: '10.000 Teile/km² – Außenzone (Eriksen 2014, Stand ~2013)' },
  { s: LINE_STYLE.eriksenMid, text: '30.000 Teile/km² – Innenbereich (Eriksen 2014)' },
  { s: LINE_STYLE.eriksenCore, text: '100.000 Teile/km² – Kern (Eriksen 2014, nicht überall vorhanden)' },
];
const MODEL_ENTRY = LINE_LEGEND[3];

/**
 * Legend of the map lines with a small line swatch per entry. No argument or 'gpgp': the four lines of the GPGP (Lebreton + model);
 * another gyre: the three Eriksen levels, plus the model outline when `hasModel` (not for the South Pacific and the Mediterranean).
 */
export function lineLegendEntries(gyre?: string, hasModel = true): typeof LINE_LEGEND {
  if (!gyre || gyre === 'gpgp') return LINE_LEGEND;
  return hasModel ? [...ERIKSEN_LEGEND, MODEL_ENTRY] : ERIKSEN_LEGEND;
}

export function lineLegend(gyre?: string, hasModel = true): string {
  const other = !!gyre && gyre !== 'gpgp';
  const items = lineLegendEntries(gyre, hasModel).map(({ s, text }) => {
    const dash = s.dash ? ` stroke-dasharray="${s.dash.map((d) => d * s.width).join(' ')}"` : '';
    const sw =
      `<svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" style="vertical-align:middle;margin-right:6px">` +
      `<line x1="1" x2="21" y1="4" y2="4" stroke="${escapeHtml(s.color)}" stroke-opacity="${s.opacity}" stroke-width="${s.width}"${dash} stroke-linecap="butt"/></svg>`;
    return `<li style="margin:4px 0">${sw}${escapeHtml(text)}</li>`;
  }).join('');
  return (
    `<div class="pl-lines" style="margin:10px 0">` +
    `<div style="font-weight:600;margin-bottom:4px">Linien auf der Karte</div>` +
    `<ul style="list-style:none;padding:0;margin:0;font-size:11px;line-height:1.35;color:var(--text-2,inherit)">${items}</ul>` +
    `<div style="font-size:11px;opacity:.75;margin-top:6px">${
      other
        ? 'Die Isolinien beruhen auf dem Modellraster von Eriksen et al. 2014 (CC BY 4.0, Zählung, Stand ~2013); sie enden offen, wo sie den Rand des Rasterausschnitts erreichen.'
        : 'Die Isolinien beruhen auf dem Modellraster von Lebreton 2018; der Messausschnitt endet im Westen bei etwa 160° W (159,9° W), dort enden die Linien offen.'
    }</div></div>`
  );
}

/** Chart block for the info panel: title, chart, legend with method and note per series, general remark. */
export function chartBlock(h: History): string {
  const series = massInSeries(h);
  const svg = chartSvg(series);
  if (!svg) return '';
  return chartOnly(h, series, svg) + lineLegend();
}

/** Panel HTML: chart block (when history is available) followed by the map-line legend. */
export function panelHtml(h: History | undefined): string {
  return (h ? chartBlock(h) : lineLegend());
}

function chartOnly(h: History, series: ChartSeries[], svg: string): string {
  const legend = series
    .map(
      (s) =>
        `<li style="margin:4px 0"><span style="display:inline-block;width:9px;height:9px;border-radius:${s.style === 'dots' ? '50%' : '2px'};background:${escapeHtml(s.color)};margin-right:6px"></span>` +
        `<b>${escapeHtml(s.label)}</b> · ${escapeHtml(s.method)}${s.note ? `<div style="opacity:.75;margin-left:15px">${escapeHtml(s.note)}</div>` : ''}</li>`,
    )
    .join('');
  return (
    `<div class="pl-chart" style="margin:10px 0">` +
    `<div style="font-weight:600;margin-bottom:4px">Masse im Patch (g/km², logarithmisch)</div>${svg}` +
    `<ul style="list-style:none;padding:0;margin:6px 0 0;font-size:11px;line-height:1.35;color:var(--text-2,inherit)">${legend}</ul>` +
    `<div style="font-size:11px;opacity:.75;margin-top:6px">${escapeHtml(h.note)} ${escapeHtml(h.credit)}</div></div>`
  );
}
