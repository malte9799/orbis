import {
  add,
  fromSpherical,
  moonGeocentric,
  planetPosition,
  satellitePosition,
  scale,
  type MoonOrbit,
  type Vec3,
} from './ephemeris';
import { getMarsTracks, heliAt, roverAt } from './mars';

export type BodyKind = 'star' | 'planet' | 'dwarf' | 'moon' | 'craft';

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
  model?: { url: string; sizeM: number; note?: string; detailUrl?: string; detailRotY?: number };
}

export type PositionContext = (id: string) => Vec3;

const tex = (f: string) => `./textures/${f}`;
const planet = (id: string) => (ms: number) => planetPosition(id, ms);

const moon = (o: MoonOrbit) => ({
  position: (ms: number, ctx: PositionContext) => satellitePosition(o, ms, ctx(o.parent)),
  periodDays: o.periodDays,
});

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
      ['Durchmesser', '1 392 684 km (109 × Erde)'],
      ['Masse', '333 000 × Erde'],
      ['Oberflächentemperatur', '≈ 5 500 °C'],
      ['Alter', '≈ 4,6 Mrd. Jahre'],
    ],
    description: 'Unser Stern – ein gelber Zwerg, der 99,86 % der Masse des Sonnensystems enthält.',
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
      ['Durchmesser', '4 879 km'],
      ['Umlaufzeit', '88 Tage'],
      ['Tageslänge', '176 Erdtage (Sonnentag)'],
      ['Temperatur', '−173 bis +427 °C'],
      ['Schwerkraft', '3,7 m/s²'],
      ['Monde', 'keine'],
    ],
    description: 'Der kleinste und sonnennächste Planet, ohne nennenswerte Atmosphäre.',
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
      ['Durchmesser', '12 104 km'],
      ['Umlaufzeit', '225 Tage'],
      ['Tageslänge', '117 Erdtage, rückläufig'],
      ['Temperatur', '≈ 464 °C'],
      ['Luftdruck', '92 bar (CO₂)'],
      ['Monde', 'keine'],
    ],
    description: 'Der heißeste Planet – eine dichte CO₂-Atmosphäre sorgt für einen extremen Treibhauseffekt.',
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
      ['Durchmesser', '12 742 km'],
      ['Umlaufzeit', '365,25 Tage'],
      ['Tageslänge', '24 h'],
      ['Mittlere Temperatur', '≈ 15 °C'],
      ['Schwerkraft', '9,81 m/s²'],
      ['Monde', '1'],
    ],
    description: 'Unser Heimatplanet. Hineinzoomen öffnet die Wetterkarte.',
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
      ['Durchmesser', '3 474 km'],
      ['Entfernung zur Erde', '≈ 384 400 km'],
      ['Umlaufzeit', '27,3 Tage'],
      ['Schwerkraft', '1,62 m/s²'],
    ],
    description: 'Der Erdmond zeigt uns wegen der gebundenen Rotation immer dieselbe Seite.',
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
      ['Durchmesser', '6 779 km'],
      ['Umlaufzeit', '687 Tage'],
      ['Tageslänge', '24 h 37 min'],
      ['Temperatur', '≈ −65 °C'],
      ['Schwerkraft', '3,71 m/s²'],
      ['Monde', '2 (Phobos, Deimos)'],
    ],
    description: 'Der rote Planet mit dem höchsten Vulkan (Olympus Mons) und dem größten Canyon des Sonnensystems.',
  },
  {
    id: 'phobos',
    name: 'Phobos',
    kind: 'moon',
    parent: 'mars',
    radiusKm: 11.27,
    color: '#8a7a6a',
    ...moon({ parent: 'mars', aKm: 9376, periodDays: 0.31891, l0: 0, incl: 26 }),
  },
  {
    id: 'deimos',
    name: 'Deimos',
    kind: 'moon',
    parent: 'mars',
    radiusKm: 6.2,
    color: '#9a8a7a',
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
      ['Durchmesser', '139 820 km (11 × Erde)'],
      ['Umlaufzeit', '11,9 Jahre'],
      ['Tageslänge', '9 h 56 min'],
      ['Temperatur', '≈ −110 °C (Wolkenobergrenze)'],
      ['Schwerkraft', '24,8 m/s²'],
      ['Monde', '95'],
    ],
    description: 'Der größte Planet – ein Gasriese mit dem Großen Roten Fleck, einem seit Jahrhunderten tobenden Sturm.',
  },
  {
    id: 'io',
    name: 'Io',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 1821.6,
    color: '#e8d36a',
    ...moon({ parent: 'jupiter', aKm: 421700, periodDays: 1.769138, l0: 106.07719, incl: 2.2 }),
    description: 'Der vulkanisch aktivste Körper im Sonnensystem.',
  },
  {
    id: 'europa',
    name: 'Europa',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 1560.8,
    color: '#d8cbb0',
    ...moon({ parent: 'jupiter', aKm: 671034, periodDays: 3.551181, l0: 175.73161, incl: 2.2 }),
    description: 'Unter dem Eispanzer liegt vermutlich ein globaler Ozean aus flüssigem Wasser.',
  },
  {
    id: 'ganymede',
    name: 'Ganymed',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 2634.1,
    color: '#a99c8c',
    ...moon({ parent: 'jupiter', aKm: 1070412, periodDays: 7.15455, l0: 120.55883, incl: 2.2 }),
    description: 'Der größte Mond des Sonnensystems – größer als der Planet Merkur.',
  },
  {
    id: 'callisto',
    name: 'Kallisto',
    kind: 'moon',
    parent: 'jupiter',
    radiusKm: 2410.3,
    color: '#7d7468',
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
      ['Durchmesser', '116 460 km'],
      ['Umlaufzeit', '29,5 Jahre'],
      ['Tageslänge', '10 h 39 min'],
      ['Temperatur', '≈ −140 °C'],
      ['Schwerkraft', '10,4 m/s²'],
      ['Monde', '146'],
    ],
    description: 'Der Ringplanet – seine Ringe bestehen aus Eisbrocken und sind nur etwa 10 m bis 1 km dick.',
  },
  {
    id: 'titan',
    name: 'Titan',
    kind: 'moon',
    parent: 'saturn',
    radiusKm: 2574.7,
    color: '#d9a650',
    ...moon({ parent: 'saturn', aKm: 1221870, periodDays: 15.945, l0: 30, incl: 27 }),
    description: 'Der einzige Mond mit dichter Atmosphäre und Seen aus flüssigem Methan.',
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
      ['Durchmesser', '50 724 km'],
      ['Umlaufzeit', '84 Jahre'],
      ['Tageslänge', '17 h 14 min, rückläufig'],
      ['Temperatur', '≈ −195 °C'],
      ['Achsneigung', '98° – rollt um die Sonne'],
      ['Monde', '28'],
    ],
    description: 'Ein Eisriese, der praktisch auf der Seite liegend um die Sonne läuft.',
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
      ['Durchmesser', '49 244 km'],
      ['Umlaufzeit', '165 Jahre'],
      ['Tageslänge', '16 h 6 min'],
      ['Temperatur', '≈ −200 °C'],
      ['Windgeschwindigkeit', 'bis 2 100 km/h'],
      ['Monde', '16'],
    ],
    description: 'Der äußerste Planet – mit den schnellsten Winden im Sonnensystem.',
  },
  {
    id: 'pluto',
    name: 'Pluto',
    kind: 'dwarf',
    radiusKm: 1188.3,
    color: '#cdb79e',
    tiltDeg: 122.5,
    rotationHours: -153.3,
    position: planet('pluto'),
    orbit: true,
    facts: [
      ['Durchmesser', '2 377 km'],
      ['Umlaufzeit', '248 Jahre'],
      ['Temperatur', '≈ −225 °C'],
      ['Monde', '5 (u. a. Charon)'],
    ],
    description: 'Zwergplanet im Kuipergürtel, 2015 von New Horizons besucht.',
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
      ['Bahnhöhe', '≈ 420 km'],
      ['Geschwindigkeit', '≈ 27 600 km/h'],
      ['Besatzung', 'seit November 2000 dauerhaft bewohnt'],
    ],
    description: 'Die Internationale Raumstation – Position live aus aktuellen Bahndaten (CelesTrak).',
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
      ['Start', '24. April 1990'],
      ['Bahnhöhe', '≈ 515 km'],
      ['Spiegel', '2,4 m'],
    ],
    description: 'Das berühmte Weltraumteleskop – Position live aus aktuellen Bahndaten (CelesTrak).',
  },
  {
    id: 'voyager1',
    name: 'Voyager 1',
    kind: 'craft',
    model: m('voyager.glb', 16),
    radiusKm: 0.002,
    color: '#ffd23f',
    approx: true,
    position: escaping(255.6, 35.0, 164.9, 3.57, '1981-01-01'),
    facts: [
      ['Start', '5. September 1977'],
      ['Status', 'aktiv, im interstellaren Raum'],
      ['Geschwindigkeit', '≈ 61 000 km/h relativ zur Sonne'],
    ],
    description: 'Das am weitesten entfernte menschengemachte Objekt. Besuchte Jupiter und Saturn.',
  },
  {
    id: 'voyager2',
    name: 'Voyager 2',
    kind: 'craft',
    model: m('voyager.glb', 16),
    radiusKm: 0.002,
    color: '#ffd23f',
    approx: true,
    position: escaping(289.8, -32.0, 138.2, 3.25, '1990-01-01'),
    facts: [
      ['Start', '20. August 1977'],
      ['Status', 'aktiv, im interstellaren Raum'],
    ],
    description: 'Einzige Sonde, die alle vier Gasriesen besucht hat (Jupiter, Saturn, Uranus, Neptun).',
  },
  {
    id: 'newhorizons',
    name: 'New Horizons',
    kind: 'craft',
    model: m('newhorizons-lite.glb', 2.2, undefined, 'newhorizons.glb'),
    radiusKm: 0.002,
    color: '#ffd23f',
    approx: true,
    position: escaping(288.0, 1.9, 61.1, 2.89, '2016-01-01'),
    facts: [
      ['Start', '19. Januar 2006'],
      ['Pluto-Vorbeiflug', '14. Juli 2015'],
      ['Arrokoth-Vorbeiflug', '1. Januar 2019'],
    ],
    description: 'Erkundete Pluto und das Kuipergürtel-Objekt Arrokoth.',
  },
  {
    id: 'pioneer10',
    name: 'Pioneer 10',
    kind: 'craft',
    model: m('pioneer-lite.glb', 8, undefined, 'pioneer.glb'),
    radiusKm: 0.002,
    color: '#b0b8c8',
    approx: true,
    position: escaping(77.2, 3.0, 137.0, 2.51, '1980-01-01'),
    facts: [
      ['Start', '3. März 1972'],
      ['Status', 'Kontakt 2003 verloren'],
    ],
    description: 'Erste Sonde, die den Asteroidengürtel durchquerte und Jupiter besuchte.',
  },
  {
    id: 'pioneer11',
    name: 'Pioneer 11',
    kind: 'craft',
    model: m('pioneer-lite.glb', 8, 'Modell: Pioneer 10 (baugleich)', 'pioneer.glb'),
    radiusKm: 0.002,
    color: '#b0b8c8',
    approx: true,
    position: escaping(284.7, 13.0, 114.0, 2.37, '1991-01-01'),
    facts: [
      ['Start', '6. April 1973'],
      ['Status', 'Kontakt 1995 verloren'],
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
      ['Start', '25. Dezember 2021'],
      ['Ort', 'Lagrange-Punkt L2, 1,5 Mio. km von der Erde'],
    ],
    description: 'Das größte Weltraumteleskop, beobachtet im Infrarot.',
  },
  {
    id: 'soho',
    name: 'SOHO',
    kind: 'craft',
    radiusKm: 0.004,
    color: '#ffb84d',
    approx: true,
    position: (ms, ctx) => (ms < date('1996-02-14') ? null : scale(ctx('earth'), 0.99)),
    facts: [
      ['Start', '2. Dezember 1995'],
      ['Ort', 'Lagrange-Punkt L1 zwischen Erde und Sonne'],
    ],
    description: 'Sonnenobservatorium von ESA und NASA.',
  },
  {
    id: 'parker',
    name: 'Parker Solar Probe',
    kind: 'craft',
    model: m('parker.glb', 6),
    radiusKm: 0.002,
    color: '#ff7a45',
    approx: true,
    // final orbit since Nov 2024: perihelion 0.0459 AU, aphelion 0.7316 AU, period ≈ 88 days
    position: (ms) => {
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
    },
    facts: [
      ['Start', '12. August 2018'],
      ['Sonnennähe', '6,2 Mio. km – näher als je ein Objekt zuvor'],
      ['Höchstgeschwindigkeit', '≈ 690 000 km/h'],
    ],
    description: 'Fliegt durch die Korona der Sonne. Bahnlage angenähert.',
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
      ['Start', '5. August 2011'],
      ['Ankunft am Jupiter', '5. Juli 2016'],
    ],
    description: 'Umkreist Jupiter auf einer polaren Bahn.',
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
      ['Landung', '18. Februar 2021, Jezero-Krater'],
      ['Aufgabe', 'Suche nach Spuren früheren Lebens'],
    ],
    description: 'Der Rover sammelt Gesteinsproben für eine spätere Rückführung. Position und Fahrspur aus den Daten der NASA (MMGIS).',
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
      ['Erstflug', '19. April 2021 – erster Motorflug auf einem anderen Planeten'],
      ['Flüge', '72 (letzter: 18. Januar 2024)'],
      ['Status', 'Mission beendet, Rotorblatt beschädigt'],
    ],
    description: 'Der Mars-Hubschrauber – die Karte zeigt alle Flugrouten, der Punkt markiert seinen letzten Landeplatz.',
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
    description: 'Der Rover erkundet den Mount Sharp im Gale-Krater. Position und Fahrspur aus den Daten der NASA (MMGIS).',
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
      ['Start', '18. Juni 2009'],
      ['Bahnhöhe', '≈ 50–200 km über dem Mond'],
    ],
    description: 'Kartiert den Mond in höchster Auflösung.',
  },
  {
    id: 'europaclipper',
    name: 'Europa Clipper',
    kind: 'craft',
    model: m('europaclipper-lite.glb', 30.5, undefined, 'europaclipper.glb'),
    radiusKm: 0.003,
    color: '#7ad3ff',
    approx: true,
    position: cruise(
      [
        ['earth', '2024-10-14'],
        ['mars', '2025-03-01'],
        ['earth', '2026-12-03'],
        ['jupiter', '2030-04-11'],
      ],
      'jupiter',
    ),
    facts: [
      ['Start', '14. Oktober 2024'],
      ['Ankunft am Jupiter', 'April 2030'],
      ['Route', 'Mars-Vorbeiflug 2025, Erd-Vorbeiflug 2026'],
    ],
    description: 'Soll Jupitermond Europa auf Bewohnbarkeit untersuchen. Flugbahn angenähert.',
  },
  {
    id: 'juice',
    name: 'JUICE',
    kind: 'craft',
    radiusKm: 0.003,
    color: '#7ad3ff',
    approx: true,
    position: cruise(
      [
        ['earth', '2023-04-14'],
        ['earth', '2024-08-20'],
        ['venus', '2025-08-31'],
        ['earth', '2026-09-29'],
        ['earth', '2029-01-18'],
        ['jupiter', '2031-07-21'],
      ],
      'jupiter',
    ),
    facts: [
      ['Start', '14. April 2023 (ESA)'],
      ['Ankunft am Jupiter', 'Juli 2031'],
    ],
    description: 'ESA-Mission zu den Eismonden Ganymed, Kallisto und Europa. Flugbahn angenähert.',
  },
  {
    id: 'bepicolombo',
    name: 'BepiColombo',
    kind: 'craft',
    radiusKm: 0.003,
    color: '#7ad3ff',
    approx: true,
    position: cruise(
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
    ),
    facts: [
      ['Start', '20. Oktober 2018 (ESA/JAXA)'],
      ['Ankunft am Merkur', 'November 2026'],
    ],
    description: 'Europäisch-japanische Merkur-Mission. Flugbahn angenähert.',
  },
];
