// Heliocentric trajectories of the deep-space probes from NASA/JPL Horizons (SPICE kernels of the
// missions: past = reconstructed, future = planned). Horizons has no CORS headers, so the vectors
// are condensed here and shipped as a static file:
//   node scripts/spacecraft-trajectories.mjs public/data/spacecraft.json
//
// Output: { updated, craft: { [id]: number[] } } with 7 numbers per sample:
//   t [ms since epoch], x, y, z [AU, ecliptic J2000, Sun-centred], vx, vy, vz [AU/day]
// The app interpolates between the samples with cubic Hermite splines.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// id, Horizons target, start, stop (clamped to the available range), [from, step in days] pairs
const CRAFT = {
  voyager1: { cmd: '-31', start: '1977-09-06', stop: '2040-01-01', steps: [['1977-09-06', 30]] },
  voyager2: { cmd: '-32', start: '1977-08-21', stop: '2040-01-01', steps: [['1977-08-21', 30]] },
  pioneer10: { cmd: '-23', start: '1972-03-04', stop: '2040-01-01', steps: [['1972-03-04', 30]] },
  pioneer11: { cmd: '-24', start: '1973-04-07', stop: '2040-01-01', steps: [['1973-04-07', 30]] },
  newhorizons: { cmd: '-98', start: '2006-01-20', stop: '2040-01-01', steps: [['2006-01-20', 8]] },
  europaclipper: { cmd: '-159', start: '2024-10-15', stop: '2040-01-01', steps: [['2024-10-15', 2]] },
  juice: { cmd: '-28', start: '2023-04-15', stop: '2040-01-01', steps: [['2023-04-15', 2]] },
  bepicolombo: { cmd: '-121', start: '2018-10-21', stop: '2040-01-01', steps: [['2018-10-21', 2]] },
  parker: {
    cmd: '-96',
    start: '2018-08-13',
    stop: '2030-01-01',
    steps: [
      ['2018-08-13', 2],
      ['2023-01-01', 0.5],
    ],
  },
};

// Fly-bys / gravity assists: dense sampling (every 0.1 d) ±WINDOW days around the encounter
const WINDOW = 12;
const FLYBY_STEP = 0.1;
const FLYBYS = {
  voyager1: ['1979-03-05', '1980-11-12'],
  voyager2: ['1979-07-09', '1981-08-26', '1986-01-24', '1989-08-25'],
  pioneer10: ['1973-12-04'],
  pioneer11: ['1974-12-03', '1979-09-01'],
  newhorizons: ['2007-02-28', '2015-07-14'],
  europaclipper: ['2025-03-01', '2026-12-03'],
  juice: ['2024-08-20', '2025-08-31', '2026-09-29', '2029-01-18'],
  bepicolombo: ['2020-04-10', '2020-10-15', '2021-08-10', '2021-10-02', '2022-06-23', '2023-06-19', '2024-09-04', '2024-12-01', '2025-01-08'],
};

const DAY = 86400000;
const d = (s) => Date.parse(s + (s.length === 10 ? 'T00:00:00Z' : ''));
const fmtDate = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

async function request(cmd, startMs, stopMs, stepDays) {
  const minutes = Math.max(1, Math.round(stepDays * 1440));
  const q = new URLSearchParams({
    format: 'text',
    COMMAND: `'${cmd}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${fmtDate(startMs)}'`,
    STOP_TIME: `'${fmtDate(stopMs)}'`,
    STEP_SIZE: `'${minutes}m'`,
    REF_PLANE: "'ECLIPTIC'",
    VEC_TABLE: "'2'",
    OUT_UNITS: "'AU-D'",
    CSV_FORMAT: "'YES'",
  });
  const res = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

async function segment(cmd, from, to, step) {
  let stop = to;
  for (let attempt = 0; attempt < 4; attempt++) {
    const text = await request(cmd, from, stop, step);
    const rows = [];
    const a = text.indexOf('$$SOE');
    const b = text.indexOf('$$EOE');
    if (a >= 0 && b > a) {
      for (const line of text.slice(a + 5, b).trim().split('\n')) {
        const c = line.split(',').map((s) => s.trim());
        const jd = parseFloat(c[0]);
        const v = c.slice(2, 8).map(parseFloat);
        if (!isFinite(jd) || v.some((x) => !isFinite(x))) continue;
        rows.push([(jd - 2440587.5) * DAY, ...v]);
      }
      return rows;
    }
    // "…after A.D. 2034-JUN-01 …": retry up to the last available moment
    const m = text.match(/after A\.D\. (\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2})/);
    if (!m) throw new Error(text.split('\n').filter((l) => l.trim()).slice(0, 6).join(' | '));
    stop = Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]) - DAY;
    if (stop <= from) return [];
  }
  throw new Error('no data range');
}

const r = (v, p) => Number(v.toFixed(p));

async function main() {
  const out = { updated: new Date().toISOString(), craft: {} };
  for (const [id, c] of Object.entries(CRAFT)) {
    const flat = [];
    let last = -Infinity;
    const stop = d(c.stop);
    const segs = [];
    for (let i = 0; i < c.steps.length; i++) {
      segs.push({ from: d(c.steps[i][0]), to: i + 1 < c.steps.length ? d(c.steps[i + 1][0]) : stop, step: c.steps[i][1] });
    }
    // split the base segments around the dense fly-by windows
    const wins = (FLYBYS[id] ?? []).map((t) => [d(t) - WINDOW * DAY, d(t) + WINDOW * DAY]).sort((a, b) => a[0] - b[0]);
    const plan = [];
    for (const sg of segs) {
      let cur = sg.from;
      for (const [a, b] of wins) {
        if (b <= cur || a >= sg.to) continue;
        if (a > cur) plan.push({ from: cur, to: a, step: sg.step });
        plan.push({ from: Math.max(a, cur), to: Math.min(b, sg.to), step: FLYBY_STEP });
        cur = Math.min(b, sg.to);
      }
      if (cur < sg.to) plan.push({ from: cur, to: sg.to, step: sg.step });
    }
    for (const sg of plan) {
      for (const row of await segment(c.cmd, sg.from, sg.to, sg.step)) {
        if (row[0] <= last) continue;
        last = row[0];
        flat.push(Math.round(row[0]), r(row[1], 6), r(row[2], 6), r(row[3], 6), r(row[4], 7), r(row[5], 7), r(row[6], 7));
      }
    }
    out.craft[id] = flat;
    console.log(id, flat.length / 7, 'samples,', new Date(flat[0]).toISOString().slice(0, 10), '→', new Date(flat[flat.length - 2 * 0 - 7]).toISOString().slice(0, 10));
  }
  const file = process.argv[2] ?? 'public/data/spacecraft.json';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out));
  console.log('written', file);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
