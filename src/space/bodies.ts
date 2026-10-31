import {
  add,
  fromSpherical,
  moonGeocentric,
  planetPosition,
  registerSmallBody,
  satellitePosition,
  smallBodyPosition,
  scale,
  type MoonOrbit,
  type SmallBodyElements,
  type Vec3,
} from './ephemeris';
import { getMarsTracks, heliAt, roverAt } from './mars';
import { trajectoryAt } from './trajectories';

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'craft';

export interface Body {
  id: string;
  name: string;
  kind: BodyKind;
  parent?: string;
  radiusKm: number;
  color: string;
  texture?: string;
  /** separate bump-map texture (greyscale height) */
  bumpMap?: string;
  bumpScale?: number;
  tiltDeg?: number;
  /** sidereal rotation period in hours (negative = retrograde) */
  rotationHours?: number;
  facts?: [string, string][];
  description?: string;
  /** heliocentric ecliptic position [AU] at time ms; null = not existing / unknown then */
  position(ms: number, ctx: PositionContext): Vec3 | null;
  /** position is a rough approximation (shown in the info panel) */
  approx?: boolean;
  /** draws an orbit line (planets) */
  orbit?: boolean;
  /** orbital period around the parent (moons) */
  periodDays?: number;
  /** stands on the surface of this body (kept upright, rotates along with it) */
  surface?: string;
  /** NASA 3D model (glTF), loaded on demand; sizeM = real largest dimension in metres */
  model?: { url: string; sizeM: number; note?: string; detailUrl?: string; detailRotY?: number; source?: string };
}

export type PositionContext = (id: string) => Vec3;

const tex = (f: string) => `./textures/${f}`;
const planet = (id: string) => (ms: number) => planetPosition(id, ms);

const moon = (o: MoonOrbit) => ({
  position: (ms: number, ctx: PositionContext) => satellitePosition(o, ms, ctx(o.parent)),
  periodDays: o.periodDays,
});


/** Osculating orbital elements (JPL Small-Body Database, epoch JD 2461200.5 unless noted). */
const SMALL_ORBITS: Record<string, SmallBodyElements> = {
  ceres: { a: 2.77, e: 0.0797, i: 10.6, om: 80.2, w: 73.3, ma: 274.0, epochJD: 2461200.5 },
  vesta: { a: 2.36, e: 0.0902, i: 7.14, om: 104.0, w: 151.0, ma: 81.2, epochJD: 2461200.5 },
  eris: { a: 67.9, e: 0.438, i: 43.9, om: 36.0, w: 151.0, ma: 212.0, epochJD: 2461200.5 },
  haumea: { a: 43.1, e: 0.194, i: 28.2, om: 122.0, w: 241.0, ma: 223.0, epochJD: 2461200.5 },
  makemake: { a: 45.6, e: 0.159, i: 29.0, om: 79.3, w: 297.0, ma: 170.0, epochJD: 2461200.5 },
  eros: { a: 1.46, e: 0.223, i: 10.8, om: 304.0, w: 179.0, ma: 62.5, epochJD: 2461200.5 },
  bennu: { a: 1.13, e: 0.204, i: 6.03, om: 2.06, w: 66.2, ma: 102.0, epochJD: 2455562.5 },
  itokawa: { a: 1.32, e: 0.28, i: 1.62, om: 69.1, w: 163.0, ma: 171.0, epochJD: 2461200.5 },
  kleopatra: { a: 2.8, e: 0.25, i: 13.1, om: 215.0, w: 180.0, ma: 260.0, epochJD: 2461200.5 },
  geographos: { a: 1.25, e: 0.336, i: 13.3, om: 337.0, w: 277.0, ma: 355.0, epochJD: 2461200.5 },
  toutatis: { a: 2.54, e: 0.625, i: 0.448, om: 125.0, w: 278.0, ma: 126.0, epochJD: 2461200.5 },
  mithra: { a: 2.21, e: 0.66, i: 3.03, om: 82.2, w: 169.0, ma: 336.0, epochJD: 2461200.5 },
  golevka: { a: 2.47, e: 0.619, i: 2.26, om: 209.0, w: 69.8, ma: 303.0, epochJD: 2461200.5 },
  hw1: { a: 2.05, e: 0.449, i: 8.45, om: 177.0, w: 177.0, ma: 21.7, epochJD: 2461200.5 },
};
for (const [k, v] of Object.entries(SMALL_ORBITS)) registerSmallBody(k, v);
const small = (k: string) => (ms: number) => smallBodyPosition(k, ms);

export const BODIES: Body[] = [
  {
    id: 'sun',
    name: 'Sonne',
    kind: 'star',
    radiusKm: 696340,
    color: '#ffcc55',
    texture: tex('8k_sun.jpg'),
    tiltDeg: 7.25,
    rotationHours: 609.12,
    position: () => [0, 0, 0],
    facts: [
      ['facts.diameter', 'sun.diameter'],
      ['facts.mass', 'sun.mass'],
      ['facts.surfaceTemp', 'sun.surfaceTemp'],
      ['facts.age', 'sun.age'],
    ],
    description: 'desc',
  },
  {
    id: 'mercury',
    name: 'Merkur',
    kind: 'planet',
    radiusKm: 2439.7,
    color: '#a39e98',
    texture: tex('8k_mercury.jpg'),
    bumpMap: tex('8k_mercury.jpg'),
    bumpScale: 0.015,
    tiltDeg: 0.03,
    rotationHours: 1407.6,
    position: planet('mercury'),
    orbit: true,
    facts: [
      ['facts.diameter', 'mercury.diameter'],
      ['facts.orbit', 'mercury.orbit'],
      ['facts.dayLength', 'mercury.dayLength'],
      ['facts.temp', 'mercury.temp'],
      ['facts.gravity', 'mercury.gravity'],
      ['facts.moons', 'mercury.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'planet',
    radiusKm: 6051.8,
    color: '#e8c785',
    texture: tex('8k_venus_surface.jpg'),
    tiltDeg: 177.4,
    rotationHours: -5832.5,
    position: planet('venus'),
    orbit: true,
    facts: [
      ['facts.diameter', 'venus.diameter'],
      ['facts.orbit', 'venus.orbit'],
      ['facts.dayLength', 'venus.dayLength'],
      ['facts.temp', 'venus.temp'],
      ['facts.pressure', 'venus.pressure'],
      ['facts.moons', 'venus.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'earth',
    name: 'Erde',
    kind: 'planet',
    radiusKm: 6371,
    color: '#4f8cff',
    texture: tex('8k_earth_daymap.jpg'),
    tiltDeg: 23.44,
    rotationHours: 23.9345,
    position: planet('earth'),
    orbit: true,
    facts: [
      ['facts.diameter', 'earth.diameter'],
      ['facts.orbit', 'earth.orbit'],
      ['facts.dayLength', 'earth.dayLength'],
      ['facts.meanTemp', 'earth.meanTemp'],
      ['facts.gravity', 'earth.gravity'],
      ['facts.moons', 'earth.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'moon',
    name: 'Mond',
    kind: 'moon',
    parent: 'earth',
    radiusKm: 1737.4,
    color: '#c9c9c9',
    texture: tex('8k_moon.jpg'),
    bumpMap: tex('8k_moon.jpg'),
    bumpScale: 0.012,
    tiltDeg: 6.68,
    position: (ms, ctx) => add(ctx('earth'), moonGeocentric(ms)),
    periodDays: 27.32,
    facts: [
      ['facts.diameter', 'moon.diameter'],
      ['facts.earthDistance', 'moon.earthDistance'],
      ['facts.orbit', 'moon.orbit'],
      ['facts.gravity', 'moon.gravity'],
    ],
    description: 'desc',
  },
  {
    id: 'mars',
    name: 'Mars',
    kind: 'planet',
    radiusKm: 3389.5,
    color: '#d0643c',
    texture: tex('8k_mars.jpg'),
    bumpMap: tex('8k_mars.jpg'),
    bumpScale: 0.02,
    tiltDeg: 25.19,
    rotationHours: 24.623,
    position: planet('mars'),
    orbit: true,
    facts: [
      ['facts.diameter', 'mars.diameter'],
      ['facts.orbit', 'mars.orbit'],
      ['facts.dayLength', 'mars.dayLength'],
      ['facts.temp', 'mars.temp'],
      ['facts.gravity', 'mars.gravity'],
      ['facts.moons', 'mars.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'phobos',
    name: 'Phobos',
    kind: 'moon',
    parent: 'mars',
    radiusKm: 11.27,
    color: '#8a7a6a',
    texture: tex('moons/phobos.jpg'),
    ...moon({ parent: 'mars', aKm: 9376, periodDays: 0.31891, l0: 0, incl: 26 }),
  },
  {
    id: 'deimos',
    name: 'Deimos',
    kind: 'moon',
    parent: 'mars',
    radiusKm: 6.2,
    color: '#9a8a7a',
    texture: tex('moons/deimos.jpg'),
    ...moon({ parent: 'mars', aKm: 23463, periodDays: 1.26244, l0: 120, incl: 26 }),
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'planet',
    radiusKm: 69911,
    color: '#d9b38c',
    texture: tex('8k_jupiter.jpg'),
    tiltDeg: 3.13,
    rotationHours: 9.925,
    position: planet('jupiter'),
    orbit: true,
    facts: [
      ['facts.diameter', 'jupiter.diameter'],
      ['facts.orbit', 'jupiter.orbit'],
      ['facts.dayLength', 'jupiter.dayLength'],
      ['facts.temp', 'jupiter.temp'],
      ['facts.gravity', 'jupiter.gravity'],
      ['facts.moons', 'jupiter.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'io',
    name: 'Io',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 1821.6,
    color: '#e8d36a',
    texture: tex('moons/io.jpg'),
    ...moon({ parent: 'jupiter', aKm: 421700, periodDays: 1.769138, l0: 106.07719, incl: 2.2 }),
    description: 'desc',
  },
  {
    id: 'europa',
    name: 'Europa',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 1560.8,
    color: '#d8cbb0',
    texture: tex('moons/europa.jpg'),
    ...moon({ parent: 'jupiter', aKm: 671034, periodDays: 3.551181, l0: 175.73161, incl: 2.2 }),
    description: 'desc',
  },
  {
    id: 'ganymede',
    name: 'Ganymed',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 2634.1,
    color: '#a99c8c',
    texture: tex('moons/ganymede.jpg'),
    ...moon({ parent: 'jupiter', aKm: 1070412, periodDays: 7.15455, l0: 120.55883, incl: 2.2 }),
    description: 'desc',
  },
  {
    id: 'callisto',
    name: 'Kallisto',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 2410.3,
    color: '#7d7468',
    texture: tex('moons/callisto.jpg'),
    ...moon({ parent: 'jupiter', aKm: 1882709, periodDays: 16.689, l0: 84.44459, incl: 2.2 }),
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'planet',
    radiusKm: 58232,
    color: '#e3cf98',
    texture: tex('8k_saturn.jpg'),
    tiltDeg: 26.73,
    rotationHours: 10.656,
    position: planet('saturn'),
    orbit: true,
    facts: [
      ['facts.diameter', 'saturn.diameter'],
      ['facts.orbit', 'saturn.orbit'],
      ['facts.dayLength', 'saturn.dayLength'],
      ['facts.temp', 'saturn.temp'],
      ['facts.gravity', 'saturn.gravity'],
      ['facts.moons', 'saturn.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'titan',
    name: 'Titan',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 2574.7,
    color: '#d9a650',
    texture: tex('moons/titan.jpg'),
    ...moon({ parent: 'saturn', aKm: 1221870, periodDays: 15.945, l0: 30, incl: 27 }),
    description: 'desc',
  },
  {
    id: 'uranus',
    name: 'Uranus',
    kind: 'planet',
    radiusKm: 25362,
    color: '#a6e3ea',
    texture: tex('uranusmap.jpg'),
    tiltDeg: 97.77,
    rotationHours: -17.24,
    position: planet('uranus'),
    orbit: true,
    facts: [
      ['facts.diameter', 'uranus.diameter'],
      ['facts.orbit', 'uranus.orbit'],
      ['facts.dayLength', 'uranus.dayLength'],
      ['facts.temp', 'uranus.temp'],
      ['facts.axialTilt', 'uranus.axialTilt'],
      ['facts.moons', 'uranus.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'neptune',
    name: 'Neptun',
    kind: 'planet',
    radiusKm: 24622,
    color: '#4b70dd',
    texture: tex('neptunemap.jpg'),
    tiltDeg: 28.32,
    rotationHours: 16.11,
    position: planet('neptune'),
    orbit: true,
    facts: [
      ['facts.diameter', 'neptune.diameter'],
      ['facts.orbit', 'neptune.orbit'],
      ['facts.dayLength', 'neptune.dayLength'],
      ['facts.temp', 'neptune.temp'],
      ['facts.wind', 'neptune.wind'],
      ['facts.moons', 'neptune.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf',
    radiusKm: 1188.3,
    color: '#cdb79e',
    texture: tex('moons/pluto.jpg'),
    tiltDeg: 122.5,
    rotationHours: -153.3,
    position: planet('pluto'),
    orbit: true,
    facts: [
      ['facts.diameter', 'pluto.diameter'],
      ['facts.orbit', 'pluto.orbit'],
      ['facts.temp', 'pluto.temp'],
      ['facts.moons', 'pluto.moons'],
    ],
    description: 'desc',
  },
  {
    id: 'mimas',
    name: 'Mimas',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 198.2,
    color: '#bdbdbd',
    texture: tex('moons/mimas.jpg'),
    rotationHours: 22.61,
    approx: true,
    ...moon({ parent: 'saturn', aKm: 185520, periodDays: 0.942, l0: 236, incl: 27 }),
    description: 'desc',
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 252.1,
    color: '#f2f4f6',
    texture: tex('moons/enceladus.jpg'),
    rotationHours: 32.88,
    approx: true,
    ...moon({ parent: 'saturn', aKm: 238020, periodDays: 1.37, l0: 230, incl: 27 }),
    description: 'desc',
  },
  {
    id: 'tethys',
    name: 'Tethys',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 531.1,
    color: '#d8d8d8',
    texture: tex('moons/tethys.jpg'),
    rotationHours: 45.31,
    approx: true,
    ...moon({ parent: 'saturn', aKm: 294660, periodDays: 1.888, l0: 357, incl: 27 }),
    description: 'desc',
  },
  {
    id: 'dione',
    name: 'Dione',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 561.4,
    color: '#cfcfcf',
    texture: tex('moons/dione.jpg'),
    rotationHours: 65.69,
    approx: true,
    ...moon({ parent: 'saturn', aKm: 377400, periodDays: 2.737, l0: 173, incl: 27 }),
    description: 'desc',
  },
  {
    id: 'rhea',
    name: 'Rhea',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 763.8,
    color: '#c8c8c8',
    texture: tex('moons/rhea.jpg'),
    rotationHours: 108.43,
    approx: true,
    ...moon({ parent: 'saturn', aKm: 527040, periodDays: 4.518, l0: 25, incl: 27 }),
    description: 'desc',
  },
  {
    id: 'iapetus',
    name: 'Iapetus',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 734.5,
    color: '#a8a090',
    texture: tex('moons/iapetus.jpg'),
    rotationHours: 1903.92,
    approx: true,
    ...moon({ parent: 'saturn', aKm: 3560820, periodDays: 79.33, l0: 260, incl: 17 }),
    description: 'desc',
  },
  {
    id: 'miranda',
    name: 'Miranda',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 235.8,
    color: '#b8b8b8',
    texture: tex('moons/miranda.jpg'),
    rotationHours: 33.91,
    approx: true,
    ...moon({ parent: 'uranus', aKm: 129390, periodDays: 1.413, l0: 165, incl: 98 }),
    description: 'desc',
  },
  {
    id: 'ariel',
    name: 'Ariel',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 578.9,
    color: '#c8c8c8',
    texture: tex('moons/ariel.jpg'),
    rotationHours: 60.48,
    approx: true,
    ...moon({ parent: 'uranus', aKm: 191020, periodDays: 2.52, l0: 194, incl: 98 }),
    description: 'desc',
  },
  {
    id: 'umbriel',
    name: 'Umbriel',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 584.7,
    color: '#7e7e7e',
    texture: tex('moons/umbriel.jpg'),
    rotationHours: 99.46,
    approx: true,
    ...moon({ parent: 'uranus', aKm: 266300, periodDays: 4.144, l0: 36, incl: 98 }),
    description: 'desc',
  },
  {
    id: 'titania',
    name: 'Titania',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 788.9,
    color: '#b0aca4',
    texture: tex('moons/titania.jpg'),
    rotationHours: 208.94,
    approx: true,
    ...moon({ parent: 'uranus', aKm: 435910, periodDays: 8.706, l0: 20, incl: 98 }),
    description: 'desc',
  },
  {
    id: 'oberon',
    name: 'Oberon',
    kind: 'moon',
    parent: 'uranus',
    radiusKm: 761.4,
    color: '#a49c94',
    texture: tex('moons/oberon.jpg'),
    rotationHours: 323.11,
    approx: true,
    ...moon({ parent: 'uranus', aKm: 583520, periodDays: 13.463, l0: 324, incl: 98 }),
    description: 'desc',
  },
  {
    id: 'triton',
    name: 'Triton',
    kind: 'moon',
    parent: 'neptune',
    radiusKm: 1353.4,
    color: '#e0d4cc',
    texture: tex('moons/triton.jpg'),
    rotationHours: -141.05,
    approx: true,
    ...moon({ parent: 'neptune', aKm: 354759, periodDays: -5.877, l0: 77, incl: 29 }),
    description: 'desc',
  },
  {
    id: 'charon',
    name: 'Charon',
    kind: 'moon',
    parent: 'pluto',
    radiusKm: 606,
    color: '#9c9288',
    texture: tex('moons/charon.jpg'),
    rotationHours: 153.29,
    approx: true,
    ...moon({ parent: 'pluto', aKm: 19591, periodDays: 6.387, l0: 299, incl: 119 }),
    description: 'desc',
  },
  {
    id: 'ceres',
    name: 'Ceres',
    kind: 'dwarf',
    radiusKm: 469.7,
    color: '#9a948c',
    texture: tex('moons/ceres.jpg'),
    rotationHours: 9.074,
    position: small('ceres'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'vesta',
    name: 'Vesta',
    kind: 'asteroid',
    radiusKm: 262.7,
    color: '#b3a89a',
    texture: tex('moons/vesta.jpg'),
    rotationHours: 5.342,
    position: small('vesta'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'eris',
    name: 'Eris',
    kind: 'dwarf',
    radiusKm: 1163,
    color: '#d8d4cc',
    position: small('eris'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'haumea',
    name: 'Haumea',
    kind: 'dwarf',
    radiusKm: 816,
    color: '#cfd0d4',
    rotationHours: 3.915,
    position: small('haumea'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'makemake',
    name: 'Makemake',
    kind: 'dwarf',
    radiusKm: 715,
    color: '#c9a98c',
    position: small('makemake'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
];

// ---------------------------------------------------------------------------
// Spacecraft. Deep-space trajectories are approximations (no ephemeris service is
// reachable for free without CORS restrictions), clearly marked in the UI.

const date = (s: string) => Date.parse(s);
const YEAR_MS = 365.25 * 86400000;

/** Escaping probes: straight line outward from the Sun at (nearly) constant speed. */
function escaping(lon: number, lat: number, rAt2025: number, auPerYear: number, from: string) {
  const t0 = date('2025-01-01');
  const valid = date(from);
  return (ms: number) => (ms < valid ? null : fromSpherical(lon, lat, rAt2025 + ((ms - t0) / YEAR_MS) * auPerYear));
}

/** JPL Horizons trajectory when loaded and covering the time, otherwise the approximation. */
function tracked(id: string, fallback: (ms: number, ctx: PositionContext) => Vec3 | null) {
  return (ms: number, ctx: PositionContext): Vec3 | null => trajectoryAt(id, ms) ?? fallback(ms, ctx);
}

/** Near a body (in orbit or on the surface): small fixed offset so it doesn't hide inside. */
function near(parent: string, from: string, offsetKm: [number, number, number], until?: string) {
  const a = date(from);
  const b = until ? date(until) : Infinity;
  return (ms: number, ctx: PositionContext) => (ms < a || ms > b ? null : add(ctx(parent), scale(offsetKm, 1 / 149_597_870.7)));
}

/**
 * A point on the surface of a rotating body, in heliocentric ecliptic AU. Mirrors the scene
 * graph of the space view: tilt about x, spin about y, three.js (x, y, z) = ecliptic (x, z, −y).
 */
function surfacePoint(parent: string, lon: number, lat: number, altKm: number, ms: number, ctx: PositionContext): Vec3 {
  const b = BODIES.find((x) => x.id === parent)!;
  const phi = ((lon + 180) * Math.PI) / 180;
  const theta = ((90 - lat) * Math.PI) / 180;
  const x0 = -Math.cos(phi) * Math.sin(theta);
  const y0 = Math.cos(theta);
  const z0 = Math.sin(phi) * Math.sin(theta);
  const a = b.rotationHours ? ((ms / 3600000 / b.rotationHours) % 1) * 2 * Math.PI : 0;
  const x1 = x0 * Math.cos(a) + z0 * Math.sin(a);
  const z1 = -x0 * Math.sin(a) + z0 * Math.cos(a);
  const beta = -((b.tiltDeg ?? 0) * Math.PI) / 180;
  const y2 = y0 * Math.cos(beta) - z1 * Math.sin(beta);
  const z2 = y0 * Math.sin(beta) + z1 * Math.cos(beta);
  const r = (b.radiusKm + altKm) / 149_597_870.7;
  return add(ctx(parent), [x1 * r, -z2 * r, y2 * r]);
}

/** Craft standing at a lon/lat on a body, driven along a track (rovers) when one is known. */
function onSurface(parent: string, from: string, fallback: [number, number], where?: (ms: number) => [number, number] | null) {
  const a = date(from);
  return (ms: number, ctx: PositionContext): Vec3 | null => {
    if (ms < a) return null;
    const [lon, lat] = where?.(ms) ?? fallback;
    return surfacePoint(parent, lon, lat, 0.0008, ms, ctx);
  };
}

/** Cruise along waypoints (body, date): interpolated in polar coordinates, prograde. */
function cruise(waypoints: [string, string][], thenNear?: string) {
  const pts = waypoints.map(([body, d]) => ({ body, t: date(d) }));
  return (ms: number, ctx: PositionContext): Vec3 | null => {
    if (ms < pts[0].t) return null;
    const last = pts[pts.length - 1];
    if (ms >= last.t) return thenNear ? add(ctx(thenNear), [0.002, 0, 0]) : null;
    let i = 0;
    while (pts[i + 1].t <= ms) i++;
    const A = positionOf(pts[i].body, pts[i].t, ctx);
    const B = positionOf(pts[i + 1].body, pts[i + 1].t, ctx);
    const f = (ms - pts[i].t) / (pts[i + 1].t - pts[i].t);
    const rA = Math.hypot(A[0], A[1]);
    const rB = Math.hypot(B[0], B[1]);
    const aA = Math.atan2(A[1], A[0]);
    let dA = Math.atan2(B[1], B[0]) - aA;
    while (dA < 0) dA += 2 * Math.PI; // prograde
    const r = rA + (rB - rA) * f;
    const ang = aA + dA * f;
    return [r * Math.cos(ang), r * Math.sin(ang), A[2] + (B[2] - A[2]) * f];
  };
}

let positionOf: (id: string, ms: number, ctx: PositionContext) => Vec3 = () => [0, 0, 0];
export function setPositionResolver(fn: typeof positionOf) {
  positionOf = fn;
}

/** Earth satellites resolved from live orbital elements (set by the view once loaded). */
let satLookup: (norad: string, ms: number) => Vec3 | null = () => null;
export function setSatLookup(fn: typeof satLookup) {
  satLookup = fn;
}

/** detailRotY: rotation (rad, about the model's vertical axis) that aligns the detailed model with the small one */
const m = (file: string, sizeM: number, note?: string, detail?: string, detailRotY?: number) => ({
  url: `./models/${file}`,
  sizeM,
  note,
  detailUrl: detail ? `./models/${detail}` : undefined,
  detailRotY,
});


/** Asteroids with a (shape) model – no sphere, drawn like spacecraft models. */
export const ASTEROIDS: Body[] = [
  {
    id: 'eros',
    name: 'Eros',
    kind: 'asteroid',
    radiusKm: 17.2,
    color: '#b0a090',
    model: { ...m('eros.glb', 34400), source: 'NASA 3D Resources (Formmodell)' },
    position: small('eros'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'bennu',
    name: 'Bennu',
    kind: 'asteroid',
    radiusKm: 0.2825,
    color: '#8a857c',
    model: { ...m('bennu.glb', 565), source: 'NASA 3D Resources' },
    position: small('bennu'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'itokawa',
    name: 'Itokawa',
    kind: 'asteroid',
    radiusKm: 0.2675,
    color: '#a09585',
    model: { ...m('itokawa.glb', 535), source: 'NASA 3D Resources (Formmodell nach JAXA-Hayabusa-Daten)' },
    position: small('itokawa'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'kleopatra',
    name: 'Kleopatra',
    kind: 'asteroid',
    radiusKm: 108.5,
    color: '#a8a39a',
    model: { ...m('kleopatra.glb', 217000), source: 'NASA 3D Resources (Formmodell)' },
    position: small('kleopatra'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'geographos',
    name: 'Geographos',
    kind: 'asteroid',
    radiusKm: 2.55,
    color: '#9a9388',
    model: { ...m('geographos.glb', 5100), source: 'NASA 3D Resources (Formmodell)' },
    position: small('geographos'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'toutatis',
    name: 'Toutatis',
    kind: 'asteroid',
    radiusKm: 2.3,
    color: '#938c80',
    model: { ...m('toutatis.glb', 4600), source: 'NASA 3D Resources (Radar-Formmodell)' },
    position: small('toutatis'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'mithra',
    name: 'Mithra',
    kind: 'asteroid',
    radiusKm: 1.35,
    color: '#8e877c',
    model: { ...m('mithra.glb', 2700), source: 'NASA 3D Resources (Radar-Formmodell)' },
    position: small('mithra'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'golevka',
    name: 'Golevka',
    kind: 'asteroid',
    radiusKm: 0.265,
    color: '#948d82',
    model: { ...m('golevka.glb', 530), source: 'NASA 3D Resources (Radar-Formmodell)' },
    position: small('golevka'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
  {
    id: 'hw1',
    name: '1996 HW1',
    kind: 'asteroid',
    radiusKm: 1.9,
    color: '#8f887b',
    model: { ...m('hw1.glb', 3800), source: 'NASA 3D Resources (Radar-Formmodell)' },
    position: small('hw1'),
    orbit: true,
    facts: [

    ],
    description: 'desc',
  },
];

export const CRAFT: Body[] = [
  {
    id: 'iss',
    name: 'ISS',
    kind: 'craft',
    parent: 'earth',
    radiusKm: 0.055,
    color: '#ffffff',
    // iss-detail.glb (NASA ISS (D), ~96 MB) is fetched by the deploy workflow; the small model stays until it is loaded
    model: m('iss.glb', 109, undefined, 'iss-detail.glb', Math.PI / 2),
    position: (ms) => satLookup('25544', ms),
    facts: [
      ['facts.orbitHeight', 'iss.orbitHeight'],
      ['facts.speed', 'iss.speed'],
      ['facts.crew', 'iss.crew'],
    ],
    description: 'desc',
  },
  {
    id: 'hubble',
    name: 'Hubble-Teleskop',
    kind: 'craft',
    parent: 'earth',
    radiusKm: 0.0066,
    color: '#d6dbe8',
    model: m('hubble-lite.glb', 13.2, undefined, 'hubble.glb'),
    position: (ms) => satLookup('20580', ms),
    facts: [
      ['facts.launch', 'hubble.launch'],
      ['facts.orbitHeight', 'hubble.orbitHeight'],
      ['facts.mirror', 'hubble.mirror'],
    ],
    description: 'desc',
  },
  {
    id: 'voyager1',
    name: 'Voyager 1',
    kind: 'craft',
    model: m('voyager.glb', 16),
    radiusKm: 0.002,
    color: '#ffd23f',
    position: tracked('voyager1', escaping(255.6, 35.0, 164.9, 3.57, '1981-01-01')),
    facts: [
      ['facts.launch', 'voyager1.launch'],
      ['facts.status', 'voyager1.status'],
      ['facts.speed', 'voyager1.speed'],
    ],
    description: 'desc',
  },
  {
    id: 'voyager2',
    name: 'Voyager 2',
    kind: 'craft',
    model: m('voyager.glb', 16),
    radiusKm: 0.002,
    color: '#ffd23f',
    position: tracked('voyager2', escaping(289.8, -32.0, 138.2, 3.25, '1990-01-01')),
    facts: [
      ['facts.launch', 'voyager2.launch'],
      ['facts.status', 'voyager2.status'],
    ],
    description: 'desc',
  },
  {
    id: 'newhorizons',
    name: 'New Horizons',
    kind: 'craft',
    model: m('newhorizons-lite.glb', 2.2, undefined, 'newhorizons.glb'),
    radiusKm: 0.002,
    color: '#ffd23f',
    position: tracked('newhorizons', escaping(288.0, 1.9, 61.1, 2.89, '2016-01-01')),
    facts: [
      ['facts.launch', 'newhorizons.launch'],
      ['facts.plutoFlyby', 'newhorizons.plutoFlyby'],
      ['facts.arrokothFlyby', 'newhorizons.arrokothFlyby'],
    ],
    description: 'desc',
  },
  {
    id: 'pioneer10',
    name: 'Pioneer 10',
    kind: 'craft',
    model: m('pioneer-lite.glb', 8, undefined, 'pioneer.glb'),
    radiusKm: 0.002,
    color: '#b0b8c8',
    position: tracked('pioneer10', escaping(77.2, 3.0, 137.0, 2.51, '1980-01-01')),
    facts: [
      ['facts.launch', 'pioneer10.launch'],
      ['facts.status', 'pioneer10.status'],
    ],
    description: 'desc',
  },
  {
    id: 'pioneer11',
    name: 'Pioneer 11',
    kind: 'craft',
    model: m('pioneer-lite.glb', 8, 'modelNote', 'pioneer.glb'),
    radiusKm: 0.002,
    color: '#b0b8c8',
    position: tracked('pioneer11', escaping(284.7, 13.0, 114.0, 2.37, '1991-01-01')),
    facts: [
      ['facts.launch', 'pioneer11.launch'],
      ['facts.status', 'pioneer11.status'],
    ],
  },
  {
    id: 'jwst',
    name: 'James-Webb-Teleskop',
    kind: 'craft',
    model: m('jwst-lite.glb', 21, undefined, 'jwst.glb'),
    radiusKm: 0.01,
    color: '#ffb84d',
    approx: true,
    position: (ms, ctx) => (ms < date('2022-01-24') ? null : scale(ctx('earth'), 1.01003)),
    facts: [
      ['facts.launch', 'jwst.launch'],
      ['facts.location', 'jwst.location'],
    ],
    description: 'desc',
  },
  {
    id: 'soho',
    name: 'SOHO',
    kind: 'craft',
    radiusKm: 0.004,
    model: m('soho.glb', 9.5),
    color: '#ffb84d',
    approx: true,
    position: (ms, ctx) => (ms < date('1996-02-14') ? null : scale(ctx('earth'), 0.99)),
    facts: [
      ['facts.launch', 'soho.launch'],
      ['facts.location', 'soho.location'],
    ],
    description: 'desc',
  },
  {
    id: 'parker',
    name: 'Parker Solar Probe',
    kind: 'craft',
    model: m('parker.glb', 6),
    radiusKm: 0.002,
    color: '#ff7a45',
    // final orbit since Nov 2024: perihelion 0.0459 AU, aphelion 0.7316 AU, period ≈ 88 days
    position: tracked('parker', (ms) => {
      if (ms < date('2024-11-07')) return null;
      const a = (0.0459 + 0.7316) / 2;
      const e = (0.7316 - 0.0459) / (0.7316 + 0.0459);
      const period = 365.256 * Math.pow(a, 1.5) * 86400000;
      const M = (2 * Math.PI * (ms - date('2024-12-24T11:53:00Z'))) / period;
      let E = M;
      for (let k = 0; k < 15; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      const x = a * (Math.cos(E) - e);
      const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const w = (100 * Math.PI) / 180;
      return [x * Math.cos(w) - y * Math.sin(w), x * Math.sin(w) + y * Math.cos(w), 0];
    }),
    facts: [
      ['facts.launch', 'parker.launch'],
      ['facts.sunProximity', 'parker.sunProximity'],
      ['facts.topSpeed', 'parker.topSpeed'],
    ],
    description: 'desc',
  },
  {
    id: 'juno',
    name: 'Juno',
    kind: 'craft',
    model: m('juno.glb', 20),
    radiusKm: 0.002,
    color: '#ffd23f',
    approx: true,
    position: near('jupiter', '2016-07-05', [0, 0, 400000]),
    facts: [
      ['facts.launch', 'juno.launch'],
      ['facts.arrivalJupiter', 'juno.arrivalJupiter'],
    ],
    description: 'desc',
  },
  {
    id: 'perseverance',
    name: 'Perseverance',
    kind: 'craft',
    parent: 'mars',
    surface: 'mars',
    model: m('perseverance-lite.glb', 3, undefined, 'perseverance.glb'),
    radiusKm: 0.002,
    color: '#ff9966',
    position: onSurface('mars', '2021-02-18', [77.4509, 18.4446], (ms) => roverAt(getMarsTracks()?.m20, ms)),
    facts: [
      ['facts.landing', 'perseverance.landing'],
      ['facts.task', 'perseverance.task'],
    ],
    description: 'desc',
  },
  {
    id: 'ingenuity',
    name: 'Ingenuity',
    kind: 'craft',
    parent: 'mars',
    surface: 'mars',
    radiusKm: 0.0006,
    color: '#ffd23f',
    position: onSurface('mars', '2021-04-04', [77.4510, 18.4449], (ms) => heliAt(ms)),
    facts: [
      ['facts.firstFlight', 'ingenuity.firstFlight'],
      ['facts.flights', 'ingenuity.flights'],
      ['facts.status', 'ingenuity.status'],
    ],
    description: 'desc',
  },
  {
    id: 'curiosity',
    name: 'Curiosity',
    kind: 'craft',
    parent: 'mars',
    surface: 'mars',
    model: m('curiosity-lite.glb', 3, undefined, 'curiosity.glb'),
    radiusKm: 0.002,
    color: '#ff9966',
    position: onSurface('mars', '2012-08-06', [137.4417, -4.5895], (ms) => roverAt(getMarsTracks()?.msl, ms)),
    facts: [['Landung', '6. August 2012, Gale-Krater']],
    description: 'desc',
  },
  {
    id: 'lro',
    name: 'Lunar Reconnaissance Orbiter',
    kind: 'craft',
    parent: 'moon',
    radiusKm: 0.003,
    color: '#ffd23f',
    approx: true,
    model: m('lro.glb', 5),
    position: near('moon', '2009-06-23', [0, 0, 1787]),
    facts: [
      ['facts.launch', 'lro.launch'],
      ['facts.orbitHeight', 'lro.orbitHeight'],
    ],
    description: 'desc',
  },
  {
    id: 'europaclipper',
    name: 'Europa Clipper',
    kind: 'craft',
    model: m('europaclipper-lite.glb', 30.5, undefined, 'europaclipper.glb'),
    radiusKm: 0.003,
    color: '#7ad3ff',
    position: tracked('europaclipper', cruise(
      [
        ['earth', '2024-10-14'],
        ['mars', '2025-03-01'],
        ['earth', '2026-12-03'],
        ['jupiter', '2030-04-11'],
      ],
      'jupiter',
    )),
    facts: [
      ['facts.launch', 'europaclipper.launch'],
      ['facts.arrivalJupiter', 'europaclipper.arrivalJupiter'],
      ['facts.route', 'europaclipper.route'],
    ],
    description: 'desc',
  },
  {
    id: 'juice',
    name: 'JUICE',
    kind: 'craft',
    radiusKm: 0.003,
    model: { ...m('juice.glb', 27), source: '© ESA – ESA SPICE Service (Cosmographia-Modell)' },
    color: '#7ad3ff',
    position: tracked('juice', cruise(
      [
        ['earth', '2023-04-14'],
        ['earth', '2024-08-20'],
        ['venus', '2025-08-31'],
        ['earth', '2026-09-29'],
        ['earth', '2029-01-18'],
        ['jupiter', '2031-07-21'],
      ],
      'jupiter',
    )),
    facts: [
      ['facts.launch', 'juice.launch'],
      ['facts.arrivalJupiter', 'juice.arrivalJupiter'],
    ],
    description: 'desc',
  },
  {
    id: 'bepicolombo',
    name: 'BepiColombo',
    kind: 'craft',
    radiusKm: 0.003,
    model: { ...m('bepicolombo.glb', 30), source: '© ESA – ESA SPICE Service (Cosmographia-Modell)' },
    color: '#7ad3ff',
    position: tracked('bepicolombo', cruise(
      [
        ['earth', '2018-10-20'],
        ['earth', '2020-04-10'],
        ['venus', '2020-10-15'],
        ['venus', '2021-08-10'],
        ['mercury', '2021-10-01'],
        ['mercury', '2022-06-23'],
        ['mercury', '2023-06-19'],
        ['mercury', '2024-09-04'],
        ['mercury', '2024-12-01'],
        ['mercury', '2025-01-08'],
        ['mercury', '2026-11-21'],
      ],
      'mercury',
    )),
    facts: [
      ['facts.launch', 'bepicolombo.launch'],
      ['facts.arrivalMercury', 'bepicolombo.arrivalMercury'],
    ],
    description: 'desc',
  },
];
