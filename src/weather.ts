/** WMO weather interpretation codes (as used by Open-Meteo) → German text + icon kind. */
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

const CODES: Record<number, [string, IconKind]> = {
  0: ['Klar', 'clear'],
  1: ['Überwiegend klar', 'mostlyClear'],
  2: ['Teilweise bewölkt', 'partly'],
  3: ['Bedeckt', 'overcast'],
  45: ['Nebel', 'fog'],
  48: ['Reifnebel', 'fog'],
  51: ['Leichter Nieselregen', 'drizzle'],
  53: ['Nieselregen', 'drizzle'],
  55: ['Starker Nieselregen', 'drizzle'],
  56: ['Gefrierender Nieselregen', 'freezing'],
  57: ['Starker gefrierender Nieselregen', 'freezing'],
  61: ['Leichter Regen', 'rain'],
  63: ['Regen', 'rain'],
  65: ['Starker Regen', 'heavyRain'],
  66: ['Gefrierender Regen', 'freezing'],
  67: ['Starker gefrierender Regen', 'freezing'],
  71: ['Leichter Schneefall', 'snow'],
  73: ['Schneefall', 'snow'],
  75: ['Starker Schneefall', 'snow'],
  77: ['Schneegriesel', 'snow'],
  80: ['Leichte Regenschauer', 'showers'],
  81: ['Regenschauer', 'showers'],
  82: ['Heftige Regenschauer', 'heavyRain'],
  85: ['Schneeschauer', 'snowShowers'],
  86: ['Starke Schneeschauer', 'snowShowers'],
  95: ['Gewitter', 'thunder'],
  96: ['Gewitter mit Hagel', 'hail'],
  99: ['Schweres Gewitter mit Hagel', 'hail'],
};

export function describe(code: number | null | undefined): string {
  return CODES[code ?? -1]?.[0] ?? 'Unbekannt';
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
  const kind = CODES[code ?? -1]?.[1] ?? 'overcast';
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
  if (eaqi <= 20) return { label: 'Gut', color: '#50c878' };
  if (eaqi <= 40) return { label: 'Ordentlich', color: '#a3d65c' };
  if (eaqi <= 60) return { label: 'Mäßig', color: '#f2c94c' };
  if (eaqi <= 80) return { label: 'Schlecht', color: '#f2994a' };
  if (eaqi <= 100) return { label: 'Sehr schlecht', color: '#eb5757' };
  return { label: 'Extrem schlecht', color: '#9b51e0' };
}

export function uvLabel(uv: number | null | undefined): { label: string; color: string } {
  if (uv == null) return { label: '–', color: '#8892a6' };
  if (uv < 3) return { label: 'Niedrig', color: '#50c878' };
  if (uv < 6) return { label: 'Mäßig', color: '#f2c94c' };
  if (uv < 8) return { label: 'Hoch', color: '#f2994a' };
  if (uv < 11) return { label: 'Sehr hoch', color: '#eb5757' };
  return { label: 'Extrem', color: '#9b51e0' };
}

export function pollenLabel(v: number | null | undefined): string {
  if (v == null) return '–';
  if (v < 1) return 'keine';
  if (v < 10) return 'gering';
  if (v < 50) return 'mäßig';
  if (v < 100) return 'hoch';
  return 'sehr hoch';
}
