// Erzeugt die beiden Spuren der Titan-Rekonstruktion (src/incidents/defs/titan-2023-06-18.ts):
//   src/incidents/data/titan-2023-06-18/track.json  Tauchboot Titan, "Höhe" = Tiefe in m (negativ)
//   src/incidents/data/titan-2023-06-18/ship.json   Polar Prince: St. John's → Tauchplatz
// Veröffentlicht sind nur wenige Eckwerte (siehe dataNotes in der Definition); alles dazwischen ist berechnet und
// im JSON mit einem 7. Feld (1) markiert. Aufruf: node scripts/titan-track.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const dir = 'src/incidents/data/titan-2023-06-18';
mkdirSync(dir, { recursive: true });
const U = (iso) => Math.floor(Date.parse(iso) / 1000);
const R = Math.PI / 180;

// Zeiten: Ortszeit Neufundland (NDT = UTC−2:30) laut Bericht der US-Küstenwache, hier in UTC
const DEPART = U('2023-06-16T12:01:00Z'); // 9:31 NDT, St. John's
const ARRIVE = U('2023-06-18T07:45:00Z'); // 5:15 NDT, Tauchplatz
const DIVE = U('2023-06-18T11:44:00Z'); // 9:14 NDT, Titan löst sich
const LAST_TEXT = U('2023-06-18T13:17:02Z'); // 10:47:02 NDT, "dropped two wts", 3.341 m
const LAST_PING = U('2023-06-18T13:17:08Z'); // 10:47:08 NDT, letzter Ping, 3.346 m
const IMPLODE = U('2023-06-18T13:17:09Z'); // ~10:47:09 NDT, 3.346,28 m

const HARBOUR = [47.5615, -52.7126]; // Hafeneinfahrt St. John's (The Narrows), Näherung
const SITE = [41.7365, -49.944]; // Annahme: Polar Prince beim Tauchgang (Position nicht veröffentlicht)
const PING = [41 + 44 / 60 + 4 / 3600, -(49 + 56 / 60 + 33 / 3600)]; // letzte Pingposition 41°44′04″N 49°56′33″W

const bearing = (a, b) => ((Math.atan2(Math.sin((b[1] - a[1]) * R) * Math.cos(b[0] * R), Math.cos(a[0] * R) * Math.sin(b[0] * R) - Math.sin(a[0] * R) * Math.cos(b[0] * R) * Math.cos((b[1] - a[1]) * R)) / R) + 360) % 360;
const metres = (a, b) => Math.hypot((b[1] - a[1]) * Math.cos(a[0] * R) * 111320, (b[0] - a[0]) * 110540);
const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

// Polar Prince: gleichmäßige Fahrt auf dem Großkreis, danach liegt sie am Tauchplatz
{
  const pts = [];
  const hours = (ARRIVE - DEPART) / 3600;
  const total = metres(HARBOUR, SITE);
  const kn = total / 1852 / hours;
  const trk = bearing(HARBOUR, SITE);
  for (let t = DEPART; t < ARRIVE; t += 1800) {
    const p = lerp(HARBOUR, SITE, (t - DEPART) / (ARRIVE - DEPART));
    pts.push([t, +p[0].toFixed(5), +p[1].toFixed(5), 0, +kn.toFixed(1), Math.round(trk), 1]);
  }
  pts.push([ARRIVE, SITE[0], SITE[1], 0, 0, Math.round(trk), 1]);
  pts.push([LAST_PING + 3600, SITE[0], SITE[1], 0, 0, Math.round(trk), 1]);
  writeFileSync(`${dir}/ship.json`, JSON.stringify({ units: { alt: 'm', speed: 'kt', track: 'deg' }, cols: ['t', 'lat', 'lon', 'alt', 'gs', 'trk'], pts }));
  console.log(`Polar Prince: ${(total / 1852).toFixed(0)} sm, ${kn.toFixed(1)} kn, ${pts.length} Punkte`);
}

// Titan: gleichmäßiges Sinken bis 3.341 m, dann die drei veröffentlichten Endwerte
{
  const pts = [];
  const D1 = -3341;
  const trk = Math.round(bearing(SITE, PING));
  const dist = metres(SITE, PING);
  const frac = (t) => (t - DIVE) / (LAST_TEXT - DIVE);
  for (let t = DIVE; t < LAST_TEXT; t += 60) {
    const f = frac(t);
    const p = lerp(SITE, PING, f);
    pts.push([t, +p[0].toFixed(6), +p[1].toFixed(6), +(D1 * f).toFixed(1), +((dist / (LAST_TEXT - DIVE)) / 0.5144).toFixed(2), trk, 1]);
  }
  pts.push([LAST_TEXT, +lerp(SITE, PING, 1)[0].toFixed(6), +lerp(SITE, PING, 1)[1].toFixed(6), D1, 0.4, trk, 1]);
  pts.push([LAST_PING, +PING[0].toFixed(6), +PING[1].toFixed(6), -3346, 0.4, trk]);
  pts.push([IMPLODE, +PING[0].toFixed(6), +PING[1].toFixed(6), -3346.28, 0, trk]);
  writeFileSync(`${dir}/track.json`, JSON.stringify({ units: { alt: 'm', speed: 'kt', track: 'deg' }, cols: ['t', 'lat', 'lon', 'alt', 'gs', 'trk'], pts }));
  console.log(`Titan: ${pts.length} Punkte, ${(-D1 / ((LAST_TEXT - DIVE) / 60)).toFixed(1)} m/min, Weg ${dist.toFixed(0)} m`);
}
console.log({ DEPART, ARRIVE, DIVE, LAST_TEXT, LAST_PING, IMPLODE });
