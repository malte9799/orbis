// Positions of solar-system bodies. Heliocentric ecliptic J2000 coordinates in AU.
// Planets: JPL "Approximate Positions of the Planets" (E. M. Standish), valid 1800–2050 with
// errors of a few arcminutes – plenty for visualisation, extrapolated outside that range.

export type Vec3 = [number, number, number];

export const AU_KM = 149_597_870.7;
const RAD = Math.PI / 180;

export function julianDate(ms: number) {
  return ms / 86400000 + 2440587.5;
}
/** Julian centuries since J2000.0 */
export function centuries(ms: number) {
  return (julianDate(ms) - 2451545.0) / 36525;
}

type Elements = [number, number, number, number, number, number];
// a [AU], e, I [deg], L [deg], long. perihelion [deg], long. ascending node [deg] + rates per century
const ELEMENTS: Record<string, [Elements, Elements]> = {
  mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  emb: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
  uranus: [
    [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  ],
  neptune: [
    [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  ],
  pluto: [
    [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
    [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
  ],
};

export const PLANET_KEYS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;

function solveKepler(Mdeg: number, e: number) {
  const M = (((Mdeg % 360) + 540) % 360) - 180;
  const Mr = M * RAD;
  let E = Mr + e * Math.sin(Mr);
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

function elementsAt(key: string, T: number) {
  const [el, rate] = ELEMENTS[key];
  const [a, e, I, L, wbar, node] = el.map((v, i) => v + rate[i] * T);
  return { a, e, I, L, wbar, node };
}

/** Position from orbital elements (ecliptic J2000, AU). */
function fromElements(a: number, e: number, I: number, wbar: number, node: number, E: number): Vec3 {
  const w = (wbar - node) * RAD;
  const O = node * RAD;
  const i = I * RAD;
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  return [
    (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

function keplerPosition(key: string, T: number): Vec3 {
  const { a, e, I, L, wbar, node } = elementsAt(key, T);
  return fromElements(a, e, I, wbar, node, solveKepler(L - wbar, e));
}

/** Points along the current orbit (for drawing orbit lines). */
export function orbitPath(key: string, ms: number, n = 360): Vec3[] {
  const k = key === 'earth' ? 'emb' : key;
  const { a, e, I, wbar, node } = elementsAt(k, centuries(ms));
  return Array.from({ length: n + 1 }, (_, j) => fromElements(a, e, I, wbar, node, (j / n) * 2 * Math.PI));
}

export function orbitalPeriodDays(key: string) {
  const a = ELEMENTS[key === 'earth' ? 'emb' : key][0][0];
  return 365.256 * Math.pow(a, 1.5);
}

// ---------------------------------------------------------------------------
// Moon (geocentric, low precision formula of the Astronomical Almanac, ~0.3° accuracy)

export function moonGeocentric(ms: number): Vec3 {
  const T = centuries(ms);
  const s = (d: number) => Math.sin(d * RAD);
  const c = (d: number) => Math.cos(d * RAD);
  const lambda =
    218.32 + 481267.881 * T + 6.29 * s(134.9 + 477198.85 * T) - 1.27 * s(259.2 - 413335.38 * T) + 0.66 * s(235.7 + 890534.23 * T) +
    0.21 * s(269.9 + 954397.7 * T) - 0.19 * s(357.5 + 35999.05 * T) - 0.11 * s(186.6 + 966404.05 * T);
  const beta = 5.13 * s(93.3 + 483202.03 * T) + 0.28 * s(228.2 + 960400.87 * T) - 0.28 * s(318.3 + 6003.18 * T) - 0.17 * s(217.6 - 407332.2 * T);
  const parallax =
    0.9508 + 0.0518 * c(134.9 + 477198.85 * T) + 0.0095 * c(259.2 - 413335.38 * T) + 0.0078 * c(235.7 + 890534.23 * T) + 0.0028 * c(269.9 + 954397.7 * T);
  const rKm = 6378.14 / Math.sin(parallax * RAD);
  const r = rKm / AU_KM;
  return [r * c(beta) * c(lambda), r * c(beta) * s(lambda), r * s(beta)];
}

// ---------------------------------------------------------------------------

export function planetPosition(key: string, ms: number): Vec3 {
  const T = centuries(ms);
  if (key === 'earth') {
    const emb = keplerPosition('emb', T);
    const m = moonGeocentric(ms);
    const f = 1 / 82.3; // Earth–Moon barycentre offset
    return [emb[0] - m[0] * f, emb[1] - m[1] * f, emb[2] - m[2] * f];
  }
  return keplerPosition(key, T);
}

/** Moons on circular orbits in their planet's equatorial plane (approximate phases). */
export interface MoonOrbit {
  parent: string;
  aKm: number;
  periodDays: number;
  /** mean longitude at JD 2443000.5 [deg] */
  l0: number;
  /** orbit inclination relative to the ecliptic [deg] (approx.) */
  incl: number;
}

export function satellitePosition(m: MoonOrbit, ms: number, parentPos: Vec3): Vec3 {
  const d = julianDate(ms) - 2443000.5;
  const l = (m.l0 + (360 / m.periodDays) * d) * RAD;
  const r = m.aKm / AU_KM;
  const i = m.incl * RAD;
  return [parentPos[0] + r * Math.cos(l), parentPos[1] + r * Math.sin(l) * Math.cos(i), parentPos[2] + r * Math.sin(l) * Math.sin(i)];
}

/** Greenwich mean sidereal time [rad] */
export function gmst(ms: number) {
  const d = julianDate(ms) - 2451545.0;
  return ((((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360) * RAD;
}

export const OBLIQUITY = 23.4393 * RAD;

/** Equatorial (ECI) km → ecliptic AU */
export function eciToEcliptic([x, y, z]: Vec3): Vec3 {
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  return [x / AU_KM, (y * c + z * s) / AU_KM, (-y * s + z * c) / AU_KM];
}

export const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, f: number): Vec3 => [a[0] * f, a[1] * f, a[2] * f];
export function fromSpherical(lonDeg: number, latDeg: number, r: number): Vec3 {
  const lo = lonDeg * RAD;
  const la = latDeg * RAD;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)];
}
