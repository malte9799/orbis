// Flightradar24-CSV (Timestamp,UTC,Callsign,Position,Altitude,Speed,Direction) -> kompaktes Track-JSON
// für die Ereignis-Rekonstruktion (src/incidents). Aufruf:
//   node scripts/incident-track.mjs <in.csv> <out.json> [--from <unix>] [--altEnd <unix>]
// --from    Punkte davor werden verworfen (z. B. ein alter Bodenpunkt)
// --altEnd  ab dem ersten Punkt NACH diesem Zeitpunkt wird die Höhe als unbekannt (null) gespeichert
// --impact "lat,lon": hängt den Einschlagsort als letzten Punkt (Höhe 0) an und ersetzt alles nach dem letzten Höhenwert durch eine
//           berechnete Kurve. Alles daran ist berechnet, keine Messung, und im JSON mit einem 7. Feld (1) markiert.
// --impactAt Unix-Sekunde, zu der der Einschlagsort erreicht wird (ohne Angabe: Dauer so, dass die letzte Sinkrate den Boden trifft)
// --endAngle Bahnwinkel am Einschlagsort in ° (Standard 80)
//   Höhe: gleichbleibende Sinkrate (Höhe / Dauer) bis genau 0 am Einschlagsort, kein Abflachen.
//   Weg: der gemessene Weg (letzter Höhenpunkt → gemessene Positionen → Einschlagsort); die Geschwindigkeit über Grund fällt
//   quadratisch ab, sodass der Bahnwinkel stetig auf --endAngle steigt und der Weg genau in der Dauer zurückgelegt wird.
import { readFileSync, writeFileSync } from 'node:fs';

const [inp, out, ...rest] = process.argv.slice(2);
const opt = (k) => { const i = rest.indexOf(k); return i < 0 ? null : Number(rest[i + 1]); };
const from = opt('--from') ?? 0;
const altEnd = opt('--altEnd') ?? Infinity;
const impactAtArg = opt('--impactAt');
const endAngle = opt('--endAngle') ?? 80;
const impactArg = rest.indexOf('--impact') < 0 ? null : rest[rest.indexOf('--impact') + 1].split(',').map(Number);
if (!inp || !out) { console.error('Aufruf: node scripts/incident-track.mjs <in.csv> <out.json> [--from <unix>] [--altEnd <unix>]'); process.exit(1); }

const lines = readFileSync(inp, 'utf8').trim().split(/\r?\n/).slice(1);
const pts = [];
for (const l of lines) {
  const m = /^(\d+),[^,]*,[^,]*,"([-\d.]+),([-\d.]+)",(-?\d+),(-?\d+),(-?\d+)/.exec(l);
  if (!m) throw new Error('Zeile nicht lesbar: ' + l);
  const t = +m[1];
  if (t < from) continue;
  // [Unix-s, lat, lon, Höhe ft | null, Groundspeed kt, Kurs °]
  pts.push([t, +m[2], +m[3], t > altEnd ? null : +m[4], +m[5], +m[6]]);
}
if (impactArg) {
  const FT = 0.3048;
  const R = Math.PI / 180;
  const kIdx = pts.findLastIndex((p) => p[3] != null);
  const k = pts[kIdx];
  const prev = pts.findLast((p, i) => i < kIdx && p[3] != null);
  const v0 = ((prev[3] - k[3]) / (k[0] - prev[0])) * FT; // letzte gemessene Sinkrate m/s (positiv: sinkt)
  if (!(v0 > 0)) throw new Error('die letzte bekannte Sinkrate ist nicht negativ');
  const A = k[3] * FT;
  const T = impactAtArg != null ? impactAtArg - k[0] : A / v0;
  const [ilat, ilon] = impactArg;
  const lastGs = pts.at(-1)[4];
  const poly = [k, ...pts.slice(kIdx + 1), [0, ilat, ilon, 0, lastGs, 0]];
  const m = (a, b) => Math.hypot((b[2] - a[2]) * Math.cos(a[1] * R) * 111320, (b[1] - a[1]) * 110540);
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + m(poly[i - 1], poly[i]));
  const L = cum.at(-1);
  const vz = A / T;
  const vhEnd = vz / Math.tan(endAngle * R);
  const vhStart = (3 * L / T - vhEnd) / 2;
  if (!(vhStart > vhEnd)) throw new Error('Weg zu kurz für diesen Endwinkel');
  const at = (sArc) => {
    let i = 1;
    while (i < poly.length - 1 && cum[i] < sArc) i++;
    const f = Math.min(1, Math.max(0, (sArc - cum[i - 1]) / (cum[i] - cum[i - 1])));
    return [poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * f, poly[i - 1][2] + (poly[i][2] - poly[i - 1][2]) * f];
  };
  const tail = [];
  const STEP = 0.25;
  const n = Math.ceil(T / STEP);
  for (let j = 1; j <= n; j++) {
    const tau = Math.min(T, j * STEP);
    const u = tau / T;
    const sArc = vhStart * tau + ((vhEnd - vhStart) * tau * u * u) / 3;
    const [lat, lon] = j === n ? [ilat, ilon] : at(sArc);
    const vh = vhStart + (vhEnd - vhStart) * u * u;
    tail.push([+(k[0] + tau).toFixed(2), +lat.toFixed(6), +lon.toFixed(6), j === n ? 0 : Math.round((A - vz * tau) / FT), Math.round(vh / 0.514444), 0, 1]);
  }
  // Kurs = Richtung zum nächsten Punkt (am Ende wie davor)
  const all = [k, ...tail];
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1];
    const b = all[Math.min(i + 1, all.length - 1)];
    const c = all[i];
    const ref = i === all.length - 1 ? [a, c] : [c, b];
    c[5] = Math.round(((Math.atan2((ref[1][2] - ref[0][2]) * Math.cos(ref[0][1] * R), ref[1][1] - ref[0][1]) / R) + 360) % 360);
  }
  pts.length = kIdx + 1;
  pts.push(...tail);
  console.log(`Ende nach ${T.toFixed(1)} s, Weg ${L.toFixed(0)} m, Sinkrate ${(vz / FT * 60).toFixed(0)} ft/min (gemessen ${(v0 / FT * 60).toFixed(0)}), Geschwindigkeit über Grund ${(vhStart / 0.514444).toFixed(0)} -> ${(vhEnd / 0.514444).toFixed(0)} kn, Winkel ${(Math.atan2(vz, vhStart) / R).toFixed(0)}° -> ${endAngle}°`);
}
writeFileSync(out, JSON.stringify({ units: { alt: 'ft', speed: 'kt', track: 'deg' }, cols: ['t', 'lat', 'lon', 'alt', 'gs', 'trk'], pts }));
console.log(`${pts.length} Punkte, ${pts[0][0]}..${pts.at(-1)[0]}`);
