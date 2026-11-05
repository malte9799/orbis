// HEALPix (nested) – Kernrechnen, übertragen aus der Referenz-Implementierung
// chealpix.c (Górski/Hivon/Reinecke, GPL-2+ / LGPL-3 im HEALPix-Paket).
// Konvention: phi = Rektaszension (Osten), z = sin(deklination), Nordpol = +Z.
// Szenen-Koordinaten: +Y = Nordpol, RA-Winkel in x-z-Ebene (x = RA 0°, −z = RA 90°; Blick von innen, Osten links).

const D2R = Math.PI / 180;
const TWO_THIRD = 2 / 3;
const TWO_PI = Math.PI * 2;

const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

function fmodulo(v: number, n: number): number {
  if (v >= 0) return v % n;
  const t = (v % n) + n;
  return t === n ? 0 : t;
}

function spreadBits(v: number): number {
  let r = 0;
  for (let k = 0; k < 16; k++) r |= ((v >>> k) & 1) << (2 * k);
  return r;
}

function compressBits(v: number): number {
  let r = 0;
  for (let k = 0; k < 16; k++) r |= ((v >>> (2 * k)) & 1) << k;
  return r;
}

export function xyf2nest(nside: number, ix: number, iy: number, face: number): number {
  return face * nside * nside + spreadBits(ix) + (spreadBits(iy) << 1);
}

export function nest2xyf(nside: number, ipix: number): { ix: number; iy: number; face: number } {
  const npface = nside * nside;
  const face = Math.floor(ipix / npface);
  const pix = ipix % npface;
  return { ix: compressBits(pix), iy: compressBits(Math.floor(pix / 2)), face };
}

export function ang2z(decDeg: number): number {
  return Math.sin(decDeg * D2R);
}

// RA/Dec (Grad) -> nested ipix; nside = 2^order
export function ang2pixNest(nside: number, raDeg: number, decDeg: number): number {
  return ang2pixNestZPhi(nside, ang2z(decDeg), raDeg * D2R);
}

// (z = sin dec, phi = RA) -> nested ipix
export function ang2pixNestZPhi(nside: number, z: number, phi: number): number {
  const za = Math.abs(z);
  const tt = fmodulo(phi, TWO_PI) * (2 / Math.PI); // in [0,4)
  let face: number, ix: number, iy: number;

  if (za <= TWO_THIRD) { // Äquatorialgürtel
    const temp1 = nside * (0.5 + tt);
    const temp2 = nside * (z * 0.75);
    const jp = Math.trunc(temp1 - temp2);
    const jm = Math.trunc(temp1 + temp2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    face = ifp === ifm ? ifp | 4 : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (nside - 1);
    iy = nside - (jp & (nside - 1)) - 1;
  } else { // Polkappen
    let ntt = Math.trunc(tt);
    if (ntt >= 4) ntt = 3;
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    let jp = Math.floor(tp * tmp);
    let jm = Math.floor((1.0 - tp) * tmp);
    if (jp >= nside) jp = nside - 1;
    if (jm >= nside) jm = nside - 1;
    if (z >= 0) { face = ntt; ix = nside - jm - 1; iy = nside - jp - 1; }
    else { face = ntt + 8; ix = jp; iy = jm; }
  }
  return xyf2nest(nside, ix, iy, face);
}

// nested ipix -> { z = sin dec, phi = RA } des Pixelzentrums
export function pix2angNestZPhi(nside: number, ipix: number): { z: number; phi: number } {
  const nl4 = nside * 4;
  const npix = 12 * nside * nside;
  const fact2 = 4 / npix;
  const { ix, iy, face } = nest2xyf(nside, ipix);
  const jr = JRLL[face] * nside - ix - iy - 1;
  let nr: number, kshift: number, z: number;

  if (jr < nside) {
    nr = jr;
    z = 1 - nr * nr * fact2;
    kshift = 0;
  } else if (jr > 3 * nside) {
    nr = nl4 - jr;
    z = nr * nr * fact2 - 1;
    kshift = 0;
  } else {
    const fact1 = (nside << 1) * fact2;
    nr = nside;
    z = (2 * nside - jr) * fact1;
    kshift = (jr - nside) & 1;
  }

  let jp = Math.trunc((JPLL[face] * nr + ix - iy + 1 + kshift) / 2);
  if (jp > nl4) jp -= nl4;
  if (jp < 1) jp += nl4;

  const phi = (jp - (kshift + 1) * 0.5) * (Math.PI / 2) / nr;
  return { z, phi };
}

export function cellCenterRadec(nside: number, ipix: number): { ra: number; dec: number } {
  const { z, phi } = pix2angNestZPhi(nside, ipix);
  return { ra: phi / D2R % 360, dec: 90 - Math.acos(z) / D2R };
}

// Punkt innerhalb einer Zelle (s längs ix, t längs iy, je 0..1) als Szenen-Richtung.
// Kontinuierliche Fassung von pix2ang (Zellränder exakt, Nachbarn teilen identische Kanten).
export function cellPointDir(nside: number, ipix: number, s: number, t: number): [number, number, number] {
  const { ix, iy, face } = nest2xyf(nside, ipix);
  const x = ix + s;
  const y = iy + t;
  const jr = JRLL[face] * nside - x - y;
  const fact2 = 4 / (12 * nside * nside);
  let nr: number, z: number;
  if (jr < nside) {
    nr = Math.max(0, jr);
    z = 1 - nr * nr * fact2;
  } else if (jr > 3 * nside) {
    nr = Math.max(0, 4 * nside - jr);
    z = nr * nr * fact2 - 1;
  } else {
    nr = nside;
    z = (2 * nside - jr) * (2 * nside * fact2);
  }
  const phi = nr > 0 ? (Math.PI / 4) * (JPLL[face] * nr + x - y) / nr : 0;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), z, -r * Math.sin(phi)];
}

// Richtung [x,y,z] in Szenen-Konvention aus RA/dec (Grad)
export function dirFromRadec(ra: number, dec: number): [number, number, number] {
  const dr = ra * D2R;
  const dd = dec * D2R;
  return [Math.cos(dd) * Math.cos(dr), Math.sin(dd), -Math.cos(dd) * Math.sin(dr)];
}

// RA/dec (Grad) aus Szenen-Richtung
export function radecFromDir(v: ArrayLike<number>): { ra: number; dec: number } {
  const dec = Math.asin(Math.max(-1, Math.min(1, v[1]))) / D2R;
  const ra = Math.atan2(-v[2], v[0]) / D2R;
  return { ra: (ra + 360) % 360, dec };
}
