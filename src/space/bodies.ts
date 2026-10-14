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
    texture: tex('moons/io.jpg'),
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
    texture: tex('moons/europa.jpg'),
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
    texture: tex('moons/ganymede.jpg'),
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
    texture: tex('moons/titan.jpg'),
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
    texture: tex('moons/pluto.jpg'),
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
    description: "Der kleinste und innerste der großen Saturnmonde – der riesige Herschel-Krater erinnert an den „Todesstern“.",
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
    description: "Eisgeysire am Südpol speisen den E-Ring; unter dem Eis liegt ein Ozean – ein Kandidat für außerirdisches Leben.",
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
    description: "Fast reines Eis, geprägt vom Odysseus-Krater und dem Canyon Ithaca Chasma.",
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
    description: "Eismond mit hellen Eisklippen auf der Rückseite und Spuren möglicher Geologie im Inneren.",
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
    description: "Zweitgrößter Saturnmond, stark verkratert und fast nur aus Wassereis.",
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
    description: "Zweifarbig: eine Hälfte pechschwarz, die andere hell – dazu ein 20 km hoher Äquatorgrat.",
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
    description: "Der zerklüftetste Uranusmond mit Canyons, die bis zu 20 km tief sind.",
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
    description: "Hellster Uranusmond mit Tälern und Gräben aus Eis.",
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
    description: "Dunkelster der großen Uranusmonde mit einem rätselhaften hellen Ring im Krater Wunda.",
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
    description: "Größter Uranusmond, durchzogen von gewaltigen Gräben.",
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
    description: "Äußerer großer Uranusmond, uralt und stark verkratert.",
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
    description: "Größter Neptunmond: umkreist seinen Planeten rückläufig – vermutlich ein eingefangener Kuipergürtel-Körper mit Stickstoffgeysiren.",
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
    description: "Pluto und Charon umkreisen einen gemeinsamen Schwerpunkt außerhalb Plutos und zeigen einander stets dieselbe Seite.",
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
      ["Durchmesser", "939 km"],
      ["Umlaufzeit", "4,6 Jahre"],
      ["Tageslänge", "9,1 h"],
      ["Besuch", "Dawn (2015–2018)"],
    ],
    description: "Der größte Körper im Asteroidengürtel und der einzige Zwergplanet im inneren Sonnensystem – 2015 von der Sonde Dawn erkundet.",
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
      ["Durchmesser", "≈ 525 km"],
      ["Umlaufzeit", "3,6 Jahre"],
      ["Tageslänge", "5,3 h"],
      ["Besuch", "Dawn (2011–2012)"],
    ],
    description: "Zweitgrößter Körper des Asteroidengürtels mit dem riesigen Rheasilvia-Einschlagbecken am Südpol – von Dawn 2011/12 kartiert.",
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
      ["Durchmesser", "≈ 2 326 km"],
      ["Umlaufzeit", "≈ 559 Jahre"],
      ["Mond", "Dysnomia"],
    ],
    description: "Massereichster bekannter Zwergplanet jenseits von Neptun, 2005 entdeckt – ihre Entdeckung führte zur Neudefinition des Planetenbegriffs. Keine Oberflächenkarte vorhanden.",
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
      ["Durchmesser", "≈ 1 600 × 1 000 km"],
      ["Umlaufzeit", "≈ 283 Jahre"],
      ["Tageslänge", "3,9 h"],
    ],
    description: "Schnell rotierender, eiförmiger Zwergplanet im Kuipergürtel mit Ring und zwei Monden. Keine Oberflächenkarte vorhanden.",
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
      ["Durchmesser", "≈ 1 430 km"],
      ["Umlaufzeit", "≈ 305 Jahre"],
      ["Mond", "S/2015 (136472) 1"],
    ],
    description: "Heller, rötlicher Zwergplanet im Kuipergürtel. Keine Oberflächenkarte vorhanden.",
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
      ["Größe", "34 × 11 × 11 km"],
      ["Besuch", "NEAR Shoemaker (2000–2001)"],
      ["Umlaufzeit", "1,8 Jahre"],
      ["Rotation", "5,3 h"],
    ],
    description: "Erdnaher Asteroid, 1898 entdeckt und von NEAR Shoemaker 2000/01 umkreist – der erste Asteroid, auf dem eine Sonde landete.",
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
      ["Größe", "≈ 490 m"],
      ["Besuch", "OSIRIS-REx (2018–2021)"],
      ["Umlaufzeit", "1,2 Jahre"],
      ["Rotation", "4,3 h"],
    ],
    description: "Kohlenstoffreicher, erdnaher Asteroid – OSIRIS-REx nahm hier 2020 eine Probe und brachte sie 2023 zur Erde.",
  },
  {
    id: 'itokawa',
    name: 'Itokawa',
    kind: 'asteroid',
    radiusKm: 0.2675,
    color: '#a09585',
    model: { ...m('itokawa.glb', 535), source: 'NASA 3D Resources (Formmodell)' },
    position: small('itokawa'),
    orbit: true,
    facts: [
      ["Größe", "535 × 294 × 209 m"],
      ["Besuch", "Hayabusa (2005)"],
      ["Umlaufzeit", "1,5 Jahre"],
      ["Rotation", "12,1 h"],
    ],
    description: "Erdnaher, erdnussförmiger Asteroid – von Hayabusa 2005 besucht, 2010 kamen erstmals Asteroidenproben zur Erde.",
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
      ["Größe", "≈ 217 × 94 × 81 km"],
      ["Umlaufzeit", "4,7 Jahre"],
      ["Rotation", "5,4 h"],
    ],
    description: "Knochenförmiger Metall-Asteroid im Hauptgürtel mit zwei kleinen Monden.",
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
      ["Größe", "≈ 5,1 × 1,8 km"],
      ["Umlaufzeit", "1,4 Jahre"],
      ["Rotation", "5,2 h"],
    ],
    description: "Extrem länglicher erdnaher Asteroid – einer der am stärksten gestreckten Körper des Sonnensystems.",
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
      ["Größe", "≈ 4,6 × 2,3 km"],
      ["Besuch", "Chang'e 2 (2012, Vorbeiflug)"],
      ["Umlaufzeit", "4,0 Jahre"],
      ["Rotation", "7 Tage"],
    ],
    description: "Erdnaher Asteroid mit chaotischer Taumelbewegung; 2012 flog Chinas Chang'e 2 vorbei.",
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
      ["Größe", "≈ 2,7 km"],
      ["Umlaufzeit", "3,3 Jahre"],
      ["Rotation", "3 Tage"],
    ],
    description: "Erdnaher Apollo-Asteroid, per Radar vermessen.",
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
      ["Größe", "≈ 530 m"],
      ["Umlaufzeit", "3,9 Jahre"],
      ["Rotation", "6,0 h"],
    ],
    description: "Kleiner erdnaher Asteroid – an ihm wurde der Yarkovsky-Effekt (Bahnänderung durch Wärmeabstrahlung) erstmals gemessen.",
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
      ["Größe", "≈ 3,8 km"],
      ["Umlaufzeit", "2,9 Jahre"],
      ["Rotation", "8,8 h"],
    ],
    description: "Doppelasteroid-ähnlicher „Kontaktbinär“ aus zwei verschmolzenen Körpern, per Radar vermessen.",
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
    model: m('soho.glb', 9.5),
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
    model: { ...m('juice.glb', 27), source: 'ESA SPICE (Cosmographia-Modell)' },
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
    model: { ...m('bepicolombo.glb', 30), source: 'ESA SPICE (Cosmographia-Modell)' },
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
