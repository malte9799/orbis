import * as THREE from 'three';
import { flagCanvas, type FlagKind } from './moon';

// Procedural 3D models of what stands at the landing sites (flags, landers, rovers). They are
// built in metres (y up, the feet on y = 0), so the planet map can place them like a glTF model.
// Everything is deliberately simple geometry – recognisable from above and at an angle.

// The map's custom layer has no environment map, so metals would render black: keep them matte
// and let a little self-illumination carry the metallic colours.
const mat = (color: number, _metalness = 0, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness, emissive: color, emissiveIntensity: 0.2 });
const GOLD = mat(0xc9a02c, 0.7, 0.35);
const SILVER = mat(0xb9bec6, 0.65, 0.4);
const WHITE = mat(0xe8e8ea, 0.1, 0.6);
const DARK = mat(0x2a2c31, 0.3, 0.7);
const GREY = mat(0x7d8087, 0.4, 0.6);
const SOLAR = mat(0x1d2f66, 0.5, 0.35);
const WHEEL = mat(0x8c8f96, 0.5, 0.6);
const BLACK = mat(0x15161a, 0.2, 0.8);

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  return o;
};
const cyl = (rTop: number, rBot: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 16) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m);
  o.position.set(x, y, z);
  return o;
};
const ball = (r: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  o.position.set(x, y, z);
  return o;
};

/** Thin strut between two points. */
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) {
  const d = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), m);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}

/** n legs from the body edge down to foot pads, spread over the circle. */
function legs(g: THREE.Group, n: number, topR: number, topY: number, footR: number, r: number, m: THREE.Material, pad = r * 3.2, rot = Math.PI / n) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    const top = new THREE.Vector3(Math.cos(a) * topR, topY, Math.sin(a) * topR);
    const foot = new THREE.Vector3(Math.cos(a) * footR, pad * 0.2, Math.sin(a) * footR);
    g.add(strut(top, foot, r, m));
    g.add(cyl(pad, pad, pad * 0.4, m, foot.x, pad * 0.2, foot.z, 12));
  }
}

function wheel(g: THREE.Group, x: number, y: number, z: number, r: number, w: number) {
  const o = cyl(r, r, w, WHEEL, x, y, z, 14);
  o.rotation.x = Math.PI / 2;
  g.add(o);
  const hub = cyl(r * 0.35, r * 0.35, w * 1.15, DARK, x, y, z, 8);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
}

function dish(g: THREE.Group, x: number, y: number, z: number, r: number, tilt = 0.5) {
  const d = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.35, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xe9e9ea, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }));
  d.position.set(x, y, z);
  d.rotation.x = Math.PI - tilt;
  g.add(d);
}

// ----- flag ------------------------------------------------------------------------

const flagTextures = new Map<FlagKind, THREE.CanvasTexture>();
function flagTexture(k: FlagKind) {
  let t = flagTextures.get(k);
  if (!t) {
    t = new THREE.CanvasTexture(flagCanvas(k));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    flagTextures.set(k, t);
  }
  return t;
}

/** Flag on a 2.4 m pole, hung from a horizontal rod (like the Apollo flags), 0.9 × 1.5 m. */
export function flag(kind: FlagKind) {
  const g = new THREE.Group();
  g.add(cyl(0.025, 0.025, 2.4, SILVER, 0, 1.2, 0, 6));
  const geo = new THREE.PlaneGeometry(1.5, 0.95, 14, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.75;
    pos.setZ(i, Math.sin(u * 5.5) * 0.04 * u);
  }
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(kind), side: THREE.DoubleSide, roughness: 0.9, metalness: 0, emissive: 0xffffff, emissiveMap: flagTexture(kind), emissiveIntensity: 0.35 }));
  cloth.position.set(0.8, 1.78, 0);
  g.add(cloth);
  const rod = cyl(0.016, 0.016, 1.55, SILVER, 0.78, 2.28, 0, 6);
  rod.rotation.z = Math.PI / 2;
  g.add(rod);
  g.add(cyl(0.12, 0.12, 0.05, GREY, 0, 0.025, 0, 10));
  return g;
}

// ----- landers ---------------------------------------------------------------------

/** Apollo lunar module, descent stage (the ascent stage flew home). ≈ 9.4 m across the feet. */
function apolloLM() {
  const g = new THREE.Group();
  const body = cyl(2.05, 2.05, 1.7, GOLD, 0, 2.15, 0, 8);
  body.rotation.y = Math.PI / 8;
  g.add(body);
  g.add(cyl(1.4, 2.0, 0.25, mat(0xd8d8da, 0.5, 0.4), 0, 3.12, 0, 8));
  g.add(cyl(0.85, 0.45, 0.9, BLACK, 0, 0.95, 0, 14)); // engine bell
  legs(g, 4, 1.9, 2.5, 4.7, 0.09, SILVER, 0.55, Math.PI / 4);
  // ladder on the front leg
  g.add(box(0.5, 2.3, 0.08, SILVER, 3.3, 1.35, 0));
  return g;
}

/** Lunar roving vehicle (Apollo 15–17), ≈ 3 m long. */
function lrv() {
  const g = new THREE.Group();
  g.add(box(2.6, 0.18, 1.5, GREY, 0, 0.62, 0));
  g.add(box(0.7, 0.12, 0.5, SILVER, -0.9, 0.8, 0));
  for (const z of [-0.32, 0.32]) {
    g.add(box(0.5, 0.5, 0.08, SILVER, 0.15, 1.05, z)); // seats
    g.add(box(0.5, 0.06, 0.45, SILVER, 0.15, 0.82, z));
  }
  g.add(box(0.12, 0.5, 0.9, SILVER, 0.75, 0.95, 0)); // control post
  for (const x of [-1.05, 1.05]) for (const z of [-0.85, 0.85]) wheel(g, x, 0.4, z, 0.4, 0.22);
  g.add(cyl(0.02, 0.02, 1.2, SILVER, -0.85, 1.35, 0.25, 5)); // antenna mast
  dish(g, -0.85, 2.0, 0.25, 0.4, 0.6);
  g.add(box(0.5, 0.35, 0.4, WHITE, -1.05, 0.95, -0.3)); // battery
  return g;
}

/** Surveyor: tripod with a mast and a solar panel. ≈ 3 m. */
function surveyor() {
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.12, 2.2, SILVER, 0, 1.7, 0, 8));
  g.add(cyl(0.7, 0.7, 0.8, mat(0xcfd2d8, 0.5, 0.5), 0, 1.05, 0, 3));
  g.add(box(1.2, 0.04, 0.9, SOLAR, 0, 3.0, 0));
  legs(g, 3, 0.5, 1.4, 1.55, 0.04, SILVER, 0.25, Math.PI / 6);
  dish(g, 0, 2.9, 0.4, 0.3, 0.8);
  return g;
}

/** Luna 9 (ball with petals). */
function luna9() {
  const g = new THREE.Group();
  g.add(ball(0.35, SILVER, 0, 0.45, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const p = box(0.7, 0.03, 0.28, GOLD, Math.cos(a) * 0.62, 0.15, Math.sin(a) * 0.62);
    p.rotation.y = -a;
    p.rotation.z = 0.15;
    g.add(p);
  }
  for (const a of [0.6, 2.2, 3.9, 5.3]) g.add(cyl(0.012, 0.012, 0.9, SILVER, Math.cos(a) * 0.15, 1.1, Math.sin(a) * 0.15, 4));
  return g;
}

/** Luna sample-return / Lunokhod platform: round stage on four legs with a rocket on top. */
function lunaStage(withRamps = false) {
  const g = new THREE.Group();
  g.add(cyl(1.5, 1.5, 0.9, mat(0xc4c7cc, 0.5, 0.5), 0, 1.6, 0, 14));
  g.add(cyl(0.9, 1.0, 1.1, withRamps ? GOLD : WHITE, 0, 2.6, 0, 12));
  g.add(cyl(0.12, 0.35, 0.9, BLACK, 0, 0.75, 0, 10));
  legs(g, 4, 1.35, 1.4, 2.3, 0.07, SILVER, 0.35, Math.PI / 4);
  if (withRamps) {
    const ramp = box(1.0, 0.06, 3.4, GREY, 0, 1.05, 3.2);
    ramp.rotation.x = 0.4;
    g.add(ramp);
  }
  return g;
}

/** Lunokhod: tub-shaped body with an opening lid and eight wheels. ≈ 4.4 m. */
function lunokhod() {
  const g = new THREE.Group();
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.3, 0.9, 20), mat(0xb7bbc2, 0.55, 0.5));
  tub.position.y = 1.15;
  tub.scale.set(1.35, 1, 1);
  g.add(tub);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.3, 0.12, 24), SOLAR);
  lid.scale.set(1.2, 1, 0.95);
  lid.position.set(-0.4, 1.9, 0);
  lid.rotation.z = 0.55;
  g.add(lid);
  for (const x of [-1.6, -0.55, 0.55, 1.6]) for (const z of [-1.1, 1.1]) wheel(g, x, 0.5, z, 0.5, 0.25);
  g.add(cyl(0.015, 0.015, 1.3, SILVER, 1.4, 1.9, 0.3, 4));
  return g;
}

/** Chang'e 3/4/5/6 lander: gold box with four legs and a dish. */
function changeLander(tall = false) {
  const g = new THREE.Group();
  g.add(box(2.1, tall ? 1.9 : 1.2, 2.1, GOLD, 0, tall ? 2.2 : 1.9, 0));
  g.add(cyl(0.45, 0.6, 0.7, BLACK, 0, 1.0, 0, 12));
  legs(g, 4, 1.05, 1.7, 3.4, 0.07, SILVER, 0.4, Math.PI / 4);
  g.add(box(2.2, 0.04, 0.8, SOLAR, 1.9, 2.5, 0)); // folded solar panel
  dish(g, -0.4, tall ? 3.5 : 2.9, 0.3, 0.45, 0.5);
  if (tall) g.add(box(1.1, 1.2, 1.1, WHITE, 0, 3.7, 0));
  return g;
}

/** Yutu / Zhurong / Pragyan style six-wheeled rover with a mast and solar wings. */
function sixWheeler(scale = 1, color = 0xd8d8da) {
  const g = new THREE.Group();
  const s = scale;
  g.add(box(1.0 * s, 0.4 * s, 0.8 * s, mat(color, 0.4, 0.5), 0, 0.75 * s, 0));
  g.add(box(1.0 * s, 0.03 * s, 1.7 * s, SOLAR, 0, 1.0 * s, 0));
  g.add(cyl(0.025 * s, 0.025 * s, 0.9 * s, SILVER, -0.3 * s, 1.5 * s, 0, 5));
  g.add(box(0.2 * s, 0.14 * s, 0.3 * s, DARK, -0.3 * s, 1.95 * s, 0));
  for (const x of [-0.5, 0, 0.5]) for (const z of [-0.6, 0.6]) wheel(g, x * s, 0.28 * s, z * s, 0.27 * s, 0.14 * s);
  return g;
}

/** Vikram (Chandrayaan-3) and similar box landers with a ramp. */
function vikram() {
  const g = new THREE.Group();
  g.add(box(1.6, 1.5, 1.6, mat(0xdcdde0, 0.3, 0.5), 0, 1.45, 0));
  g.add(box(1.7, 0.2, 1.7, GOLD, 0, 2.3, 0));
  legs(g, 4, 0.9, 1.0, 2.3, 0.06, SILVER, 0.3, Math.PI / 4);
  const ramp = box(0.9, 0.04, 1.8, GREY, 0, 0.7, 1.6);
  ramp.rotation.x = 0.55;
  g.add(ramp);
  g.add(box(1.4, 0.04, 1.1, SOLAR, 0, 2.45, 0));
  return g;
}

/** SLIM: it landed on its nose – a box lander the wrong way up. */
function slim() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(box(1.7, 1.4, 1.7, mat(0xd9d9dc, 0.3, 0.5), 0, 1.0, 0));
  inner.add(box(1.5, 0.05, 1.1, SOLAR, 0, 1.75, 0));
  inner.add(cyl(0.3, 0.4, 0.4, BLACK, 0, 0.2, 0, 10));
  inner.rotation.z = Math.PI * 0.85;
  inner.position.set(0.3, 1.25, 0);
  g.add(inner);
  return g;
}

/** Intuitive Machines Nova-C (Odysseus / Athena): tall hexagonal tank tipped over on its side. */
function novaC() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(cyl(0.75, 0.75, 4.0, mat(0xdfe0e3, 0.35, 0.5), 0, 2.0, 0, 6));
  inner.add(cyl(0.6, 0.35, 0.5, BLACK, 0, -0.2, 0, 10));
  inner.add(cyl(0.9, 0.9, 0.12, GOLD, 0, 3.3, 0, 6));
  inner.rotation.z = Math.PI / 2 - 0.12;
  inner.position.set(1.9, 0.9, 0);
  g.add(inner);
  legs(g, 4, 0.7, 1.4, 1.7, 0.05, SILVER, 0.2, Math.PI / 4);
  return g;
}

/** Firefly Blue Ghost: low box lander with four legs, solar panel on top. */
function blueGhost() {
  const g = new THREE.Group();
  g.add(box(2.6, 1.0, 2.6, mat(0xd9dadd, 0.3, 0.5), 0, 1.5, 0));
  g.add(box(2.7, 0.05, 2.7, SOLAR, 0, 2.05, 0));
  g.add(cyl(0.4, 0.6, 0.5, BLACK, 0, 0.8, 0, 12));
  legs(g, 4, 1.25, 1.2, 2.4, 0.06, SILVER, 0.3, Math.PI / 4);
  dish(g, 0.6, 2.4, 0.6, 0.35, 0.6);
  return g;
}

// ----- Mars ------------------------------------------------------------------------

/** Viking lander: hexagonal deck on three legs with a dish and a boom. */
function viking() {
  const g = new THREE.Group();
  g.add(cyl(1.5, 1.5, 0.5, mat(0xcfd0d3, 0.4, 0.5), 0, 1.0, 0, 6));
  g.add(box(1.4, 0.9, 1.0, WHITE, 0, 1.6, 0));
  legs(g, 3, 1.3, 1.0, 2.3, 0.07, SILVER, 0.3, Math.PI / 6);
  dish(g, 0.3, 2.5, 0, 0.5, 0.5);
  g.add(box(0.06, 0.06, 1.6, SILVER, -0.8, 1.2, 1.2)); // sampler boom
  g.add(cyl(0.03, 0.03, 1.6, SILVER, -0.9, 2.4, -0.4, 5)); // met mast
  return g;
}

/** Mars Pathfinder: opened tetrahedron (three petals) with the rover Sojourner next to it. */
function pathfinder() {
  const g = new THREE.Group();
  g.add(cyl(0.55, 0.55, 0.55, WHITE, 0, 0.5, 0, 3));
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + Math.PI / 2;
    const p = box(1.35, 0.05, 0.9, SOLAR, Math.cos(a) * 0.95, 0.35, Math.sin(a) * 0.95);
    p.rotation.y = -a;
    p.rotation.z = -0.1;
    g.add(p);
  }
  g.add(cyl(0.02, 0.02, 1.5, SILVER, 0, 1.4, 0, 4));
  return g;
}

/** Sojourner (65 cm long). */
function sojourner() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.2, 0.4, GOLD, 0, 0.32, 0));
  g.add(box(0.45, 0.02, 0.35, SOLAR, 0, 0.44, 0));
  for (const x of [-0.2, 0, 0.2]) for (const z of [-0.25, 0.25]) wheel(g, x, 0.13, z, 0.13, 0.08);
  return g;
}

/** Mars Exploration Rover (Spirit / Opportunity), 2.3 m. */
function mer() {
  const g = new THREE.Group();
  g.add(box(1.5, 0.35, 1.0, GOLD, 0, 0.8, 0));
  g.add(box(1.7, 0.03, 1.5, SOLAR, 0, 1.0, 0));
  g.add(cyl(0.03, 0.03, 1.0, SILVER, -0.55, 1.55, 0.3, 5));
  g.add(box(0.28, 0.14, 0.2, DARK, -0.55, 2.1, 0.3));
  for (const x of [-0.7, 0, 0.7]) for (const z of [-0.65, 0.65]) wheel(g, x, 0.25, z, 0.25, 0.17);
  g.add(box(0.15, 0.15, 0.55, SILVER, 0.85, 0.7, 0)); // arm
  return g;
}

/** Phoenix: deck on three legs with two round solar arrays and an arm. */
function phoenix() {
  const g = new THREE.Group();
  g.add(cyl(1.2, 1.2, 0.18, mat(0xcfd1d5, 0.4, 0.5), 0, 0.95, 0, 6));
  g.add(box(0.8, 0.5, 0.8, WHITE, 0, 1.3, 0));
  legs(g, 3, 1.0, 0.9, 1.7, 0.05, SILVER, 0.22, Math.PI / 6);
  for (const s of [-1, 1]) {
    const p = cyl(1.05, 1.05, 0.04, SOLAR, s * 2.1, 1.0, 0, 20);
    p.rotation.z = s * 0.06;
    g.add(p);
    g.add(box(0.8, 0.04, 0.12, SILVER, s * 1.0, 1.0, 0));
  }
  g.add(box(2.0, 0.07, 0.07, SILVER, 0, 1.15, 0.9)); // arm
  g.add(cyl(0.02, 0.02, 1.4, SILVER, 0.3, 1.9, -0.3, 5)); // met mast
  return g;
}

/** InSight: deck with two big circular solar arrays, the seismometer dome and the HP³ probe. */
function insight() {
  const g = new THREE.Group();
  g.add(cyl(0.8, 0.9, 0.35, mat(0xcfd1d5, 0.4, 0.5), 0, 1.0, 0, 6));
  g.add(box(0.9, 0.35, 0.8, GOLD, 0, 1.35, 0));
  legs(g, 3, 0.8, 0.9, 1.4, 0.05, SILVER, 0.2, Math.PI / 6);
  for (const s of [-1, 1]) {
    g.add(cyl(1.1, 1.1, 0.04, SOLAR, s * 1.9, 1.15, 0, 24));
    g.add(box(0.9, 0.04, 0.1, SILVER, s * 0.95, 1.15, 0));
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), SILVER).translateX(1.7).translateZ(2.2)); // seismometer dome
  g.add(cyl(0.15, 0.15, 0.3, DARK, -1.6, 0.15, 2.0, 10));
  return g;
}

// ----- scenes ----------------------------------------------------------------------

export type PartKind =
  | 'flag'
  | 'lm'
  | 'lrv'
  | 'surveyor'
  | 'luna9'
  | 'lunaStage'
  | 'lunaRamp'
  | 'lunokhod'
  | 'change'
  | 'changeTall'
  | 'yutu'
  | 'vikram'
  | 'pragyan'
  | 'slim'
  | 'novaC'
  | 'blueGhost'
  | 'viking'
  | 'pathfinder'
  | 'sojourner'
  | 'mer'
  | 'phoenix'
  | 'insight'
  | 'zhurong';

/** kind, x, z (metres from the site), heading (rad) */
export type PartSpec = [PartKind, number, number, number?];

const PARTS: Record<Exclude<PartKind, 'flag'>, () => THREE.Group> = {
  lm: apolloLM,
  lrv,
  surveyor,
  luna9,
  lunaStage: () => lunaStage(false),
  lunaRamp: () => lunaStage(true),
  lunokhod,
  change: () => changeLander(false),
  changeTall: () => changeLander(true),
  yutu: () => sixWheeler(1),
  vikram,
  pragyan: () => sixWheeler(0.6, 0xcfd1d6),
  slim,
  novaC,
  blueGhost,
  viking,
  pathfinder,
  sojourner,
  mer,
  phoenix,
  insight,
  zhurong: () => sixWheeler(1.5, 0xe0e0e3),
};

/** Reference length (m) the exaggeration is based on – the lander, about as big as one "object". */
const REF_M: Partial<Record<PartKind, number>> = { lm: 9.4, luna9: 1.4, surveyor: 3.2, viking: 4.6, phoenix: 5.6, insight: 5.5, pathfinder: 2.6, mer: 2.3 };

/** What stands at the sites (a flag is added next to the first part where the site has one). */
const SITE_PARTS: Record<string, PartSpec[]> = {
  apollo11: [['lm', 0, 0]],
  apollo12: [['lm', 0, 0], ['surveyor', 20, 8, 0.6]],
  apollo14: [['lm', 0, 0]],
  apollo15: [['lm', 0, 0], ['lrv', -10, 7, 0.4]],
  apollo16: [['lm', 0, 0], ['lrv', 11, -8, -0.5]],
  apollo17: [['lm', 0, 0], ['lrv', -10, -7, 0.3]],
  luna9: [['luna9', 0, 0]],
  surveyor1: [['surveyor', 0, 0]],
  luna16: [['lunaStage', 0, 0]],
  luna17: [['lunaRamp', 0, 0], ['lunokhod', 3, 6.5, 1.2]],
  luna21: [['lunaRamp', 0, 0], ['lunokhod', -3, 6.5, -0.8]],
  luna24: [['lunaStage', 0, 0]],
  change3: [['change', 0, 0], ['yutu', 6, 5, 0.6]],
  change4: [['change', 0, 0], ['yutu', -6, 5, -0.6]],
  change5: [['changeTall', 0, 0]],
  change6: [['changeTall', 0, 0]],
  chandrayaan3: [['vikram', 0, 0], ['pragyan', 3.5, 5.5, 0.4]],
  slim: [['slim', 0, 0]],
  im1: [['novaC', 0, 0]],
  blueghost1: [['blueGhost', 0, 0]],
  im2: [['novaC', 0, 0]],
  // Mars
  viking1: [['viking', 0, 0]],
  viking2: [['viking', 0, 0]],
  pathfinder: [['pathfinder', 0, 0], ['sojourner', 2.2, 1.6, 0.5]],
  spirit: [['mer', 0, 0]],
  opportunity: [['mer', 0, 0]],
  phoenix: [['phoenix', 0, 0]],
  insight: [['insight', 0, 0]],
  zhurong: [['zhurong', 0, 0]],
};

export interface SurfaceScene {
  group: THREE.Group;
  /** metres the exaggeration is based on (the lander) */
  refM: number;
}

/** Whether the site has a model of its own (the Curiosity / Perseverance rovers are glTF models). */
export const hasSceneModel = (siteId: string) => !!SITE_PARTS[siteId];

/** Landing-site scene: lander(s), rover(s) and – if the nation has one – its flag. */
export function buildSiteScene(siteId: string, flagKind?: FlagKind): SurfaceScene | null {
  const parts = SITE_PARTS[siteId];
  if (!parts) return null;
  const group = new THREE.Group();
  let ref = 0;
  for (const [kind, x, z, rot] of parts) {
    const p = PARTS[kind as Exclude<PartKind, 'flag'>]();
    p.position.set(x, 0, z);
    p.rotation.y = rot ?? 0;
    group.add(p);
    ref = Math.max(ref, REF_M[kind] ?? new THREE.Box3().setFromObject(p).getSize(new THREE.Vector3()).length() * 0.7);
  }
  if (flagKind) {
    // a few metres beside the first part, seen well from the usual (north-up) view
    const first = parts[0];
    const f = flag(flagKind);
    const side = (REF_M[first[0]] ?? ref) * 0.85;
    f.position.set(first[1] - side * 0.6, 0, first[2] - side * 0.8);
    f.rotation.y = 0.15;
    group.add(f);
  }
  return { group, refM: ref };
}
