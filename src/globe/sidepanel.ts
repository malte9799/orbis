import { escapeHtml } from '../util';
import { clockTxt, tzOpts } from '../units';

// Building blocks shared by the flight panel and the ship panel (right-hand side, design B):
// route hero, profile line, value tiles and collapsible detail categories.

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function distKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "ca. 14:05", with the date ("24.10.") when it is not today. */
export function clock(t: number): string {
  const d = new Date(t);
  const time = clockTxt(d);
  const date = d.toDateString() === new Date().toDateString() ? '' : `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', ...tzOpts() })}. `;
  return `ca. ${date}${time}`;
}

/** "28 min" / "1 h 05 min" */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export interface Hero {
  from: { code: string; sub: string; time?: string };
  to: { code: string; sub: string; time?: string };
  /** 0..1 */
  progress: number;
  /** markup of the moving symbol (pointing right) */
  mark: string;
  color: string;
  note: string;
}

/** Large start and end codes with a progress line between them. */
export function routeHero(h: Hero): string {
  const pct = Math.round(Math.min(1, Math.max(0, h.progress)) * 100);
  const end = (e: { code: string; sub: string; time?: string }, cls = '') =>
    `<div class="sp-end ${cls}"><b>${escapeHtml(e.code)}</b><small>${escapeHtml(e.sub)}</small>${e.time ? `<small class="sp-time">${escapeHtml(e.time)}</small>` : ''}</div>`;
  return `<div class="sp-route" style="--c:${h.color}">
    ${end(h.from)}
    <div class="sp-line"><i class="sp-rest"></i><i class="sp-done" style="width:${pct}%"></i><span class="sp-mark" style="left:${pct}%">${h.mark}</span></div>
    ${end(h.to, 'r')}
  </div><div class="sp-note">${h.note}</div>`;
}

/** A value tile; with `metric` it can be clicked to show its graph (`on`: the graph is shown). */
export const tile = (label: string, value: string, o: { metric?: string; on?: boolean } = {}) =>
  o.metric
    ? `<button type="button" class="sp-tile click${o.on ? ' on' : ''}" data-metric="${o.metric}" aria-pressed="${!!o.on}"><span>${label}</span><b>${value}</b></button>`
    : `<div class="sp-tile"><span>${label}</span><b>${value}</b></div>`;

/** Line chart of the values of the reports seen so far, the last one marked. */
export function graph(title: string, values: number[], unit: string, color: string): string {
  const head = `<div class="sp-k"><span>${title}</span>${values.length > 1 ? `<span>${fmtNum(Math.min(...values))} bis ${fmtNum(Math.max(...values))} ${unit}</span>` : ''}</div>`;
  if (values.length < 3) return `<div class="sp-chart">${head}<div class="sp-empty">Der Verlauf entsteht, sobald weitere Meldungen eintreffen.</div></div>`;
  const W = 280;
  const H = 56;
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - lo) / span) * (H - 12)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<div class="sp-chart">${head}<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${title}"><path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><i class="sp-dot" style="top:${((last[1] / H) * 100).toFixed(1)}%;background:${color}"></i></div>`;
}

const fmtNum = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(n) < 10 ? 1 : 0 });

/** A collapsible category; `open` keys are remembered by the panel across the live updates. */
export function category(key: string, title: string, rows: [string, string][], open: Set<string>): string {
  const body = rows.map(([k, v]) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`).join('');
  return `<details data-key="${key}" ${open.has(key) ? 'open' : ''}><summary>${title}</summary><div class="sp-rows">${body}</div></details>`;
}
