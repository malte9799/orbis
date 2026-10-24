import { escapeHtml } from '../util';

// Building blocks shared by the flight panel and the ship panel (right-hand side, design B):
// route hero, profile line, value tiles and collapsible detail categories.

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function distKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "28 min" / "1 h 05 min" */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export interface Hero {
  from: { code: string; sub: string };
  to: { code: string; sub: string };
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
  const end = (e: { code: string; sub: string }, cls = '') => `<div class="sp-end ${cls}"><b>${escapeHtml(e.code)}</b><small>${escapeHtml(e.sub)}</small></div>`;
  return `<div class="sp-route" style="--c:${h.color}">
    ${end(h.from)}
    <div class="sp-line"><i class="sp-rest"></i><i class="sp-done" style="width:${pct}%"></i><span class="sp-mark" style="left:${pct}%">${h.mark}</span></div>
    ${end(h.to, 'r')}
  </div><div class="sp-note">${h.note}</div>`;
}

export const tile = (label: string, value: string, extra = '') => `<div class="sp-tile"><span>${label}</span><b>${value}</b>${extra}</div>`;

/** A collapsible category; `open` keys are remembered by the panel across the live updates. */
export function category(key: string, title: string, rows: [string, string][], open: Set<string>): string {
  const body = rows.map(([k, v]) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`).join('');
  return `<details data-key="${key}" ${open.has(key) ? 'open' : ''}><summary>${title}</summary><div class="sp-rows">${body}</div></details>`;
}
