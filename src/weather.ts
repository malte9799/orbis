/** WMO weather interpretation codes (as used by Open-Meteo) → text (catalog) + icon kind. */
import { t, type MessageKey } from './i18n';

type IconKind =
  | 'clear'
  | 'mostlyClear'
  | 'partly'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavyRain'
  | 'freezing'
  | 'snow'
  | 'showers'
  | 'snowShowers'
  | 'thunder'
  | 'hail';

const CODES: { code: number; icon: IconKind; key: MessageKey }[] = [
  { code: 0, icon: 'clear', key: 'wx.code.0' },
  { code: 1, icon: 'mostlyClear', key: 'wx.code.1' },
  { code: 2, icon: 'partly', key: 'wx.code.2' },
  { code: 3, icon: 'overcast', key: 'wx.code.3' },
  { code: 45, icon: 'fog', key: 'wx.code.45' },
  { code: 48, icon: 'fog', key: 'wx.code.48' },
  { code: 51, icon: 'drizzle', key: 'wx.code.51' },
  { code: 53, icon: 'drizzle', key: 'wx.code.53' },
  { code: 55, icon: 'drizzle', key: 'wx.code.55' },
  { code: 56, icon: 'freezing', key: 'wx.code.56' },
  { code: 57, icon: 'freezing', key: 'wx.code.57' },
  { code: 61, icon: 'rain', key: 'wx.code.61' },
  { code: 63, icon: 'rain', key: 'wx.code.63' },
  { code: 65, icon: 'heavyRain', key: 'wx.code.65' },
  { code: 66, icon: 'freezing', key: 'wx.code.66' },
  { code: 67, icon: 'freezing', key: 'wx.code.67' },
  { code: 71, icon: 'snow', key: 'wx.code.71' },
  { code: 73, icon: 'snow', key: 'wx.code.73' },
  { code: 75, icon: 'snow', key: 'wx.code.75' },
  { code: 77, icon: 'snow', key: 'wx.code.77' },
  { code: 80, icon: 'showers', key: 'wx.code.80' },
  { code: 81, icon: 'showers', key: 'wx.code.81' },
  { code: 82, icon: 'heavyRain', key: 'wx.code.82' },
  { code: 85, icon: 'snowShowers', key: 'wx.code.85' },
  { code: 86, icon: 'snowShowers', key: 'wx.code.86' },
  { code: 95, icon: 'thunder', key: 'wx.code.95' },
  { code: 96, icon: 'hail', key: 'wx.code.96' },
  { code: 99, icon: 'hail', key: 'wx.code.99' },
];

const BY_CODE = new Map(CODES.map((c) => [c.code, c]));

export function describe(code: number | null | undefined): string {
  const e = BY_CODE.get(code ?? -1);
  return e ? t(e.key) : t('wx.unknown');
}

// ---------------------------------------------------------------------------
// Inline SVG icons (64×64), coloured, day/night aware.

const SUN = (cx: number, cy: number, r: number) => {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const r1 = r + 4;
    const r2 = r + 9;
    return `<line x1="${cx + Math.cos(a) * r1}" y1="${cy + Math.sin(a) * r1}" x2="${cx + Math.cos(a) * r2}" y2="${cy + Math.sin(a) * r2}"/>`;
  }).join('');
  return `<g class="i-sun"><g stroke="#ffc533" stroke-width="3.5" stroke-linecap="round">${rays}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffc533"/></g>`;
};
const MOON = (cx: number, cy: number, r: number) =>
  `<path fill="#d9def5" d="M${cx + r * 0.35} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.65} ${r * 1.6} a${r * 0.82} ${r * 0.82} 0 0 1 -${r * 0.65} -${r * 1.6}z"/>`;
const CLOUD = (dx = 0, dy = 0, fill = '#e8edf5', s = 1) =>
  `<path transform="translate(${dx} ${dy}) scale(${s})" fill="${fill}" d="M18 50h30a11 11 0 0 0 1.5-21.9A15 15 0 0 0 20.6 27 11.5 11.5 0 0 0 18 50z"/>`;
const DROPS = (n: number, color = '#4aa8ff') =>
  `<g stroke="${color}" stroke-width="3" stroke-linecap="round">${Array.from({ length: n }, (_, i) => {
    const x = 24 + i * (n === 1 ? 0 : 16 / (n - 1));
    return `<line x1="${x}" y1="53" x2="${x - 3}" y2="60"/>`;
  }).join('')}</g>`;
const FLAKES = (n: number) =>
  `<g fill="#ffffff" stroke="#9cc9ff" stroke-width="1">${Array.from({ length: n }, (_, i) => {
    const x = 24 + i * (n === 1 ? 0 : 16 / (n - 1));
    return `<circle cx="${x}" cy="${56 + (i % 2) * 3}" r="2.6"/>`;
  }).join('')}</g>`;
const BOLT = `<path fill="#ffd23f" stroke="#e0a400" stroke-width="1" d="M33 44l-7 11h6l-3 9 10-13h-6l4-7z"/>`;
const FOG = `<g stroke="#c9d1dc" stroke-width="3.5" stroke-linecap="round"><line x1="12" y1="46" x2="52" y2="46"/><line x1="16" y1="53" x2="48" y2="53"/><line x1="20" y1="60" x2="44" y2="60"/></g>`;

export function weatherIcon(code: number | null | undefined, isDay = true, size = 48): string {
  const kind = BY_CODE.get(code ?? -1)?.icon ?? 'overcast';
  const celestial = (cx: number, cy: number, r: number) => (isDay ? SUN(cx, cy, r) : MOON(cx, cy, r + 2));
  let body: string;
  switch (kind) {
    case 'clear':
      body = isDay ? SUN(32, 32, 12) : MOON(30, 32, 15);
      break;
    case 'mostlyClear':
      body = celestial(26, 24, 10) + CLOUD(10, 10, '#e8edf5', 0.8);
      break;
    case 'partly':
      body = celestial(22, 22, 9) + CLOUD(4, 4);
      break;
    case 'overcast':
      body = CLOUD(-6, -6, '#aab4c3') + CLOUD(4, 2);
      break;
    case 'fog':
      body = CLOUD(0, -10, '#c2cad6') + FOG;
      break;
    case 'drizzle':
      body = CLOUD(0, -6) + DROPS(2, '#7cc0ff');
      break;
    case 'rain':
      body = CLOUD(0, -6, '#c8d0dc') + DROPS(3);
      break;
    case 'heavyRain':
      body = CLOUD(0, -6, '#9aa6b8') + DROPS(4, '#2f8cff');
      break;
    case 'freezing':
      body = CLOUD(0, -6, '#c8d0dc') + DROPS(2, '#8fe3ff') + FLAKES(1);
      break;
    case 'snow':
      body = CLOUD(0, -6) + FLAKES(3);
      break;
    case 'showers':
      body = celestial(20, 18, 8) + CLOUD(4, -2) + DROPS(3);
      break;
    case 'snowShowers':
      body = celestial(20, 18, 8) + CLOUD(4, -2) + FLAKES(3);
      break;
    case 'thunder':
      body = CLOUD(0, -8, '#8d98ab') + BOLT;
      break;
    case 'hail':
      body = CLOUD(0, -8, '#8d98ab') + BOLT + FLAKES(2);
      break;
  }
  return `<svg class="wx-icon" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}

// ---------------------------------------------------------------------------

export function aqiLabel(eaqi: number | null | undefined): { label: string; color: string } {
  if (eaqi == null) return { label: '–', color: '#8892a6' };
  if (eaqi <= 20) return { label: t('wx.aqi.good'), color: '#50c878' };
  if (eaqi <= 40) return { label: t('wx.aqi.fair'), color: '#a3d65c' };
  if (eaqi <= 60) return { label: t('wx.aqi.moderate'), color: '#f2c94c' };
  if (eaqi <= 80) return { label: t('wx.aqi.poor'), color: '#f2994a' };
  if (eaqi <= 100) return { label: t('wx.aqi.veryPoor'), color: '#eb5757' };
  return { label: t('wx.aqi.extremelyPoor'), color: '#9b51e0' };
}

export function uvLabel(uv: number | null | undefined): { label: string; color: string } {
  if (uv == null) return { label: '–', color: '#8892a6' };
  if (uv < 3) return { label: t('wx.uv.low'), color: '#50c878' };
  if (uv < 6) return { label: t('wx.uv.moderate'), color: '#f2c94c' };
  if (uv < 8) return { label: t('wx.uv.high'), color: '#f2994a' };
  if (uv < 11) return { label: t('wx.uv.veryHigh'), color: '#eb5757' };
  return { label: t('wx.uv.extreme'), color: '#9b51e0' };
}

export function pollenLabel(v: number | null | undefined): string {
  if (v == null) return '–';
  if (v < 1) return t('wx.pollen.none');
  if (v < 10) return t('wx.pollen.low');
  if (v < 50) return t('wx.pollen.moderate');
  if (v < 100) return t('wx.pollen.high');
  return t('wx.pollen.veryHigh');
}
