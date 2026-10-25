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
export const pressureTxt = (hPa: number, digits = 0): string => `${num(pressureVal(hPa), digits)} ${pressureUnit()}`;

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

// ---- Koordinaten -----------------------------------------------------------------------
export const coordsDec = () => (opt('coords') ?? 'dec') === 'dec';
/** Dezimalgrade: 51.513° N · GMS: 51° 30′ 46″ N */
export function coordsTxt(lat: number, lon: number): string {
  const part = (v: number) => {
    const a = Math.abs(v);
    if (coordsDec()) return `${a.toLocaleString(de, { maximumFractionDigits: 3 })}°`;
    const deg = Math.floor(a);
    const mFull = (a - deg) * 60;
    const min = Math.floor(mFull);
    let sec = Math.round((mFull - min) * 60);
    let m = min;
    if (sec === 60) { sec = 0; m += 1; }
    return `${deg}° ${m}′ ${sec}″`;
  };
  return `${part(lat)} ${lat >= 0 ? 'N' : 'S'}, ${part(lon)} ${lon >= 0 ? 'O' : 'W'}`;
}

// ---- Zeit ------------------------------------------------------------------------
export const is12 = () => (opt('hour12') ?? '24h') === '12h';
export const tzUtc = () => opt('tz') === 'utc';
/** "14:00" (Ortszeit des Ortes) → 2:00 PM */
export function hourTxt(hhmm: string): string {
  if (!is12()) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
