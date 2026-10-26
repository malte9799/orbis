/** Unit display options (settings panel → "Allgemein"). Base units are metric:
 *  temp °C, wind km/h, pressure hPa, rain mm/h, distance km, area km². */
import { beaufort, compass } from './util';
import { store, type AppOptions } from './store';

const de = 'de-DE';

type Opt<K extends keyof AppOptions> = NonNullable<AppOptions[K]>;

/** option as set in the settings panel */
export const opt = <K extends keyof AppOptions>(k: K): Opt<K> => store.getOptions()[k] as Opt<K>;
const num = (v: number, digits: number) => v.toLocaleString(de, { maximumFractionDigits: digits, minimumFractionDigits: digits });

// ---- Temperatur ------------------------------------------------------------
export const tempUnit = () => (opt('temp') === 'f' ? '°F' : '°C');
export const tempVal = (vC: number) => (opt('temp') === 'f' ? vC * 1.8 + 32 : vC);
export const tempTxt = (vC: number, digits = 1) => `${num(tempVal(vC), digits)} ${tempUnit()}`;

// ---- Wind -------------------------------------------------------------------
export type WindOpt = NonNullable<AppOptions['wind']>;
const WIND_UNIT: Record<WindOpt, string> = { kmh: 'km/h', ms: 'm/s', mph: 'mph', kn: 'Knoten', bft: 'Bft' };
export const windUnit = () => WIND_UNIT[opt('wind') ?? 'kmh'];
export const windVal = (kmh: number): number => {
  switch (opt('wind') ?? 'kmh') {
    case 'ms': return kmh / 3.6;
    case 'mph': return kmh * 0.621371;
    case 'kn': return kmh / 1.852;
    case 'bft': return beaufort(kmh);
    default: return kmh;
  }
};
export const windTxt = (kmh: number, digits = 0): string => `${num(windVal(kmh), digits)} ${windUnit()}`;
export const windDirTxt = (deg: number): string => (opt('windDir') === 'deg' ? `${Math.round(((deg % 360) + 360) % 360)}°` : compass(deg));

/** Zahl ohne Einheit für Karten-Legenden/Readouts (Einheit separat über *Unit()) */
export const windNum = (kmh: number): string => num(windVal(kmh), 0);
export const tempNum = (vC: number): string => num(tempVal(vC), 0);

// ---- Luftdruck ---------------------------------------------------------------
export type PressureOpt = NonNullable<AppOptions['pressure']>;
const PRESSURE_UNIT: Record<PressureOpt, string> = { hpa: 'hPa', mb: 'mb', mmhg: 'mmHg', inhg: 'inHg' };
export const pressureUnit = () => PRESSURE_UNIT[opt('pressure') ?? 'hpa'];
export const pressureVal = (hPa: number): number => {
  switch (opt('pressure') ?? 'hpa') {
    case 'mmhg': return hPa * 0.750062;
    case 'inhg': return hPa * 0.02953;
    default: return hPa; // mb is identical to hPa (1 hPa = 1 mbar)
  }
};
const pressureDigits = () => (opt('pressure') === 'inhg' ? 2 : 0);
export const pressureNum = (hPa: number): string => num(pressureVal(hPa), pressureDigits());
export const pressureTxt = (hPa: number, digits = pressureDigits()): string => `${num(pressureVal(hPa), digits)} ${pressureUnit()}`;

// ---- Niederschlag --------------------------------------------------------------
export const rainUnit = () => (opt('rain') ?? 'mm') === 'dbz' ? 'dBZ' : (opt('rain') ?? 'mm') === 'in' ? 'in/h' : 'mm/h';
export const rainVal = (mmH: number): number => {
  switch (opt('rain') ?? 'mm') {
    case 'in': return mmH * 0.0393701;
    case 'dbz':
      // Marshall–Palmer: Z = 200 · R^1.6, Z in mm⁶/m³ → dBZ = 10 log10 Z (the same anchors RainViewer uses)
      return 10 * Math.log10(200 * Math.pow(Math.max(mmH, 1e-3), 1.6));
    default: return mmH;
  }
};
export const rainNum = (mmH: number): string => num(rainVal(mmH), (opt('rain') ?? 'mm') === 'in' ? 2 : (opt('rain') ?? 'mm') === 'dbz' ? 0 : 1);
export const rainTxt = (mmH: number, digits = 1): string => `${num(rainVal(mmH), digits)} ${rainUnit()}`;

// ---- Niederschlagssumme (mm ↔ in; dBZ fällt auf mm zurück) ---------------------
export const precipSumUnit = () => ((opt('rain') ?? 'mm') === 'in' ? 'in' : 'mm');
export const precipSumTxt = (mm: number, digits = 1): string =>
  mm == null ? '–' : `${num(mm * ((opt('rain') ?? 'mm') === 'in' ? 0.0393701 : 1), digits)} ${precipSumUnit()}`;

// ---- Distanz ----------------------------------------------------------------------
export type DistOpt = NonNullable<AppOptions['dist']>;
const DIST_UNIT: Record<DistOpt, string> = { km: 'km', mi: 'Meilen', nmi: 'Seemeilen' };
export const distUnit = () => DIST_UNIT[opt('dist') ?? 'km'];
export const distVal = (km: number): number => (opt('dist') === 'mi' ? km * 0.621371 : opt('dist') === 'nmi' ? km / 1.852 : km);
export const distTxt = (km: number, digits = 1): string => `${num(distVal(km), digits)} ${distUnit()}`;

/** Fahrzeug-/Strömungsgeschwindigkeit [km/h] – folgt der Distanz-Einstellung: km/h · mph · Knoten */
export const speedUnit = () => (opt('dist') === 'mi' ? 'mph' : opt('dist') === 'nmi' ? 'kn' : 'km/h');
export const speedVal = (kmh: number): number => (opt('dist') === 'mi' ? kmh * 0.621371 : opt('dist') === 'nmi' ? kmh / 1.852 : kmh);
export const speedTxt = (kmh: number, digits = 0): string => `${num(speedVal(kmh), digits)} ${speedUnit()}`;

// ---- Höhe / Tiefe / Wellenhöhe (m ↔ ft) -----------------------------------------------
export const heightUnit = () => (opt('height') === 'ft' ? 'ft' : 'm');
export const heightVal = (m: number): number => (opt('height') === 'ft' ? m * 3.28084 : m);
export const heightTxt = (m: number, digits = 0): string => `${num(heightVal(m), digits)} ${heightUnit()}`;
/** Zahl ohne Einheit (Karten-Labels) */
export const heightNum = (m: number, digits = 1): string => num(heightVal(m), opt('height') === 'ft' ? Math.max(0, digits - 1) : digits);
/** Steig-/Sinkrate [m/s] → m/s bzw. ft/min (Luftfahrt) */
export const climbUnit = () => (opt('height') === 'ft' ? 'ft/min' : 'm/s');
export const climbVal = (ms: number): number => (opt('height') === 'ft' ? ms * 196.8504 : ms);
export const climbTxt = (ms: number, digits = 1): string => `${num(climbVal(ms), opt('height') === 'ft' ? 0 : digits)} ${climbUnit()}`;
/** Schneehöhe [cm] → cm bzw. in */
export const snowUnit = () => (opt('height') === 'ft' ? 'in' : 'cm');
export const snowVal = (cm: number): number => (opt('height') === 'ft' ? cm / 2.54 : cm);

// ---- Fläche -------------------------------------------------------------------------
export type AreaOpt = NonNullable<AppOptions['area']>;
const AREA_UNIT: Record<AreaOpt, string> = { km2: 'km²', mi2: 'mi²', acre: 'Acre', ha: 'Hektar' };
export const areaUnit = (burned = false) => AREA_UNIT[(burned ? opt('burned') ?? 'km2' : opt('area') ?? 'km2')];
export const areaVal = (km2: number, burned = false): number => {
  const sel = burned ? opt('burned') ?? 'km2' : opt('area') ?? 'km2';
  switch (sel) {
    case 'mi2': return km2 * 0.386102;
    case 'acre': return km2 * 247.105;
    case 'ha': return km2 * 100;
    default: return km2;
  }
};
/** area/burned-area as formatted text ("12 km²") */
export const areaTxt = (km2: number, burned = false, digits = 1): string => `${num(areaVal(km2, burned), digits)} ${areaUnit(burned)}`;

/** Fläche aus Acre (US-Quellen) */
export const acresTxt = (acres: number, burned = true, digits = 1): string => areaTxt(acres * 0.00404686, burned, digits);

// ---- Koordinaten -----------------------------------------------------------------------
export const coordsDec = () => (opt('coords') ?? 'dec') === 'dec';
/** Dezimalgrade: 51.513° N · GMS: 51° 30′ 46″ N */
export function coordsTxt(lat: number, lon: number): string {
  const part = (v: number) => {
    const a = Math.abs(v);
    if (coordsDec()) return `${a.toLocaleString(de, { maximumFractionDigits: 3 })}°`;
    let deg = Math.floor(a);
    const mFull = (a - deg) * 60;
    let m = Math.floor(mFull);
    let sec = Math.round((mFull - m) * 60);
    if (sec === 60) { sec = 0; m += 1; }
    if (m === 60) { m = 0; deg += 1; }
    return `${deg}° ${m}′ ${sec}″`;
  };
  return `${part(lat)} ${lat >= 0 ? 'N' : 'S'}, ${part(lon)} ${lon >= 0 ? 'O' : 'W'}`;
}

// ---- Zeit ------------------------------------------------------------------------
export const is12 = () => (opt('hour12') ?? '24h') === '12h';
export const tzUtc = () => opt('tz') === 'utc';
/** Optionen für toLocale*String: 12/24 Std. und Zeitzone (Ortszeit/UTC) */
export const tzOpts = (): { hourCycle: 'h12' | 'h23'; timeZone?: string } => ({ hourCycle: is12() ? 'h12' : 'h23', timeZone: tzUtc() ? 'UTC' : undefined });
/** "14:00 Uhr" · "2:00 PM" · "14:00 UTC" – absolute Zeitpunkte nach Einstellung */
export function clockTxt(d: Date | number, seconds = false): string {
  const s = new Date(d).toLocaleTimeString(de, { hour: is12() ? 'numeric' : '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined, ...tzOpts() });
  return tzUtc() ? `${s} UTC` : is12() ? s : `${s} Uhr`;
}
/** Locale-String mit Zeitzone/12h-Einstellung (für Wochentag+Uhrzeit usw.) */
export const dateTimeTxt = (d: Date | number, o: Intl.DateTimeFormatOptions): string => new Date(d).toLocaleString(de, { ...o, ...tzOpts() });
/** "14:00" (Ortszeit des Ortes) → 2:00 PM */
export function hourTxt(hhmm: string): string {
  if (!is12()) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ---- Einheiten-Tokens in vorgefertigten Texten ---------------------------------------
// Texte, die beim Laden einer Ebene entstehen (Popup-Untertitel), tragen den Rohwert als Token
// und werden erst beim Anzeigen aufgelöst – so folgen sie der Einstellung ohne Neuladen.
type TokKind = 'level' | 'temp' | 'wind' | 'speed' | 'press' | 'dist' | 'height' | 'climb' | 'rain' | 'area' | 'acres';
const TOK: Record<TokKind, (v: number, d?: number) => string> = {
  temp: (v, d) => tempTxt(v, d),
  wind: (v, d) => windTxt(v, d),
  speed: (v, d) => speedTxt(v, d),
  press: (v, d) => pressureTxt(v, d),
  dist: (v, d) => distTxt(v, d),
  height: (v, d) => heightTxt(v, d),
  climb: (v, d) => climbTxt(v, d),
  rain: (v, d) => rainTxt(v, d),
  area: (v, d) => areaTxt(v, false, d),
  acres: (v, d) => acresTxt(v, true, d),
  level: (v) => (opt('height') === 'ft' ? `${num(v / 30.48, 1)} ft` : `${num(v, 0)} cm`),
};
/** `uTok('wind', 54)` → Platzhalter, den `resolveUnits` beim Anzeigen ersetzt */
export const uTok = (kind: TokKind, value: number, digits?: number): string => `[[u:${kind}:${value}${digits == null ? '' : `:${digits}`}]]`;
export const resolveUnits = (text: string): string =>
  text.includes('[[u:')
    ? text.replace(/\[\[u:(\w+):(-?[\d.eE+-]+)(?::(\d))?\]\]/g, (m, k: TokKind, v: string, d?: string) => (TOK[k] ? TOK[k](Number(v), d == null ? undefined : Number(d)) : m))
    : text;

// ---- Freitext mit festen Einheiten (Weltraum-Steckbriefe u. ä.) -----------------------------
const NUM = '[−+-]?\\d{1,3}(?:[  ]\\d{3})+(?:,\\d+)?|[−+-]?\\d+(?:,\\d+)?';
const TEXT_UNIT_RE = new RegExp(`((?:${NUM})(?:\\s*(?:×|bis|–)\\s*(?:${NUM}))*)\\s?(km²|km/h|km|°C|m)(?![\\w/²])`, 'g');
const parseDe = (s: string) => Number(s.replace(/[  ]/g, '').replace(',', '.').replace('−', '-'));
const fmtDe = (v: number): string => {
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return v.toLocaleString(de, { maximumFractionDigits: digits }).replace(/\./g, ' ').replace('-', '−');
};
/** wandelt "12 742 km", "−173 bis +427 °C", "34 × 11 × 11 km" nach Einstellung um (Standard: unverändert) */
export function localizeText(text: string): string {
  return text.replace(TEXT_UNIT_RE, (all, nums: string, unit: string) => {
    let f: (v: number) => number;
    let u: string;
    switch (unit) {
      case 'km': f = distVal; u = distUnit(); break;
      case 'km/h': f = speedVal; u = speedUnit(); break;
      case 'km²': f = (v) => areaVal(v); u = areaUnit(); break;
      case '°C': f = tempVal; u = tempUnit(); break;
      default: f = heightVal; u = heightUnit();
    }
    if (u === unit) return all;
    const out = nums.replace(new RegExp(NUM, 'g'), (n) => {
      const sign = /^\+/.test(n) ? '+' : '';
      return sign + fmtDe(f(parseDe(n)));
    });
    return `${out} ${u}`;
  });
}

/** "1.200 m (3.937 ft)" – gewählte Einheit zuerst, die andere in Klammern */
export const heightBoth = (m: number): string =>
  opt('height') === 'ft' ? `${num(m * 3.28084, 0)} ft (${num(m, 0)} m)` : `${num(m, 0)} m (${num(m * 3.28084, 0)} ft)`;
