export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s) links from external feeds. */
export function safeUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const de = 'de-DE';

export const fmt = {
  temp: (t: number | null | undefined, digits = 0) => {
    if (t == null || Number.isNaN(t)) return '–';
    const s = t.toLocaleString(de, { maximumFractionDigits: digits, minimumFractionDigits: digits });
    return `${/^-0(,0*)?$/.test(s) ? s.slice(1) : s}°`;
  },
  num: (n: number | null | undefined, digits = 0) =>
    n == null || Number.isNaN(n) ? '–' : n.toLocaleString(de, { maximumFractionDigits: digits, minimumFractionDigits: digits }),
  /** Open-Meteo returns local wall-clock times without offset ("2026-10-12T14:00"). */
  hour: (iso: string) => iso.slice(11, 16),
  weekday: (isoDate: string, long = false) => {
    const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
    return d.toLocaleDateString(de, { weekday: long ? 'long' : 'short', timeZone: 'UTC' });
  },
  dayMonth: (isoDate: string) => {
    const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
    return d.toLocaleDateString(de, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  },
  dateTime: (date: Date | number | string) =>
    new Date(date).toLocaleString(de, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  relative: (date: Date | number | string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(de, { numeric: 'auto' });
    if (Math.abs(diff) < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (Math.abs(diff) < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    return rtf.format(-Math.round(diff / 86400), 'day');
  },
  coords: (lat: number, lon: number) =>
    `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'O' : 'W'}`,
};

const DIRS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function compass(deg: number | null | undefined): string {
  if (deg == null) return '–';
  return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

export function beaufort(kmh: number): number {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const i = limits.findIndex((l) => kmh < l);
  return i === -1 ? 12 : i;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (html) node.innerHTML = html;
  return node;
}

let toastTimer: number | undefined;
export function toast(message: string, kind: 'info' | 'error' = 'info') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(box);
  }
  box.textContent = message;
  box.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box!.classList.remove('show'), 4500);
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: number | undefined;
  return (...args: A) => {
    clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

/** Linear interpolation of a colour ramp: stops = [[value, '#rrggbb'], ...] sorted by value. */
export function rampColor(stops: [number, string][], v: number): [number, number, number] {
  if (v <= stops[0][0]) return hexToRgb(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [v0, c0] = stops[i - 1];
      const [v1, c1] = stops[i];
      const t = (v - v0) / (v1 - v0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return hexToRgb(stops[stops.length - 1][1]);
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Temperature colour scale (°C), shared by the forecast bars and the globe overlay. */
export const TEMP_STOPS: [number, string][] = [
  [-40, '#e3d4f5'],
  [-30, '#a77fd6'],
  [-20, '#5b4fc4'],
  [-10, '#2f7fd8'],
  [0, '#4fc3e8'],
  [8, '#5fd39a'],
  [15, '#c6e05a'],
  [22, '#f6c945'],
  [28, '#f28c38'],
  [34, '#e0462f'],
  [42, '#9e1a3a'],
];

export function tempColor(t: number): string {
  const [r, g, b] = rampColor(TEMP_STOPS, t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
