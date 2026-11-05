import { heightTxt, opt, speedTxt } from '../units';

// Zahlen mit Einheit im Text eines Ereignisses richten sich nach den globalen Einstellungen (Maßeinheiten). Im Text steht der Rohwert
// als Platzhalter: {{ft:35000}} Fuß, {{kn:437}} Knoten, {{fpm:20000}} Fuß pro Minute, {{m:180}} Meter, {{d:3346}} Wassertiefe in Metern.
// Fuß werden immer mit angegeben (der Funk spricht in Fuß): bei Meter als "10.668 m (35.000 ft)", bei Fuß nur "35.000 ft".

const de = 'de-DE';
const FT = 0.3048;
const fmt = (v: number, digits = 0) => v.toLocaleString(de, { maximumFractionDigits: digits, minimumFractionDigits: digits }).replace('-', '−');
const feet = () => opt('height') === 'ft';

/** die Fuß-Angabe in Klammern: im Text klein (HTML), sonst schlicht in Klammern */
const paren = (v: string, html: boolean) => (html ? `<small class="ic-ft">(${v})</small>` : `(${v})`);

/** Höhe in Fuß: nach Einstellung (m oder ft), bei Meter Fuß in Klammern dabei; sind Fuß gewählt, nur Fuß */
export const altTxt = (ft: number, html = false): string => (feet() ? `${fmt(ft)} ft` : `${fmt(ft * FT)} m ${paren(`${fmt(ft)} ft`, html)}`);

/** Geschwindigkeit in Knoten: nach Einstellung (km/h, mph oder kn) */
export const kntTxt = (kn: number): string => speedTxt(kn * 1.852);

/** Steig-/Sinkrate in Fuß pro Minute: nach Einstellung (m/s oder ft/min), bei m/s ft/min in Klammern dabei */
export const climbFtTxt = (fpm: number, html = false): string => (feet() ? `${fmt(fpm)} ft/min` : `${fmt(fpm * FT / 60, 1)} m/s ${paren(`${fmt(fpm)} ft/min`, html)}`);

/** Wassertiefe in Metern (positiv): nach Einstellung m oder ft, bei Meter Fuß in Klammern dabei */
export const depthTxt = (m: number, html = false): string => (feet() ? `${fmt(m / FT)} ft` : `${fmt(m)} m ${paren(`${fmt(m / FT)} ft`, html)}`);

/** setzt die Platzhalter eines Textes nach den Einstellungen ein; `html`: der Text ist schon maskiert, die Fuß-Klammern werden klein */
export function localize(text: string, html = false): string {
  return text.replace(/\{\{(ft|kn|fpm|m|d):(-?[\d.]+)\}\}/g, (_all, kind: string, v: string) => {
    const n = Number(v);
    if (kind === 'ft') return altTxt(n, html);
    if (kind === 'kn') return kntTxt(n);
    if (kind === 'fpm') return climbFtTxt(n, html);
    if (kind === 'd') return depthTxt(n, html);
    return heightTxt(n);
  });
}
