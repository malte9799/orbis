import { describe, expect, it } from 'vitest';
import {
  ang2pixNest,
  cellCenterRadec,
  cellPointDir,
  dirFromRadec,
  nest2xyf,
  pix2angNestZPhi,
  radecFromDir,
  xyf2nest,
} from './healpix';

const ORDERS = [0, 1, 2, 3, 5];

describe('HEALPix (nested)', () => {
  it('roundtrip: every cell center maps back to its own pixel', () => {
    for (const order of ORDERS) {
      const nside = 1 << order;
      for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
        const { ra, dec } = cellCenterRadec(nside, ipix);
        expect(ang2pixNest(nside, ra, dec), `order ${order} ipix ${ipix}`).toBe(ipix);
      }
    }
  });

  it('cell center (0.5, 0.5) equals cellCenterRadec', () => {
    for (const order of ORDERS) {
      const nside = 1 << order;
      for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
        const [x, y, z] = cellPointDir(nside, ipix, 0.5, 0.5);
        const c = radecFromDir([x, y, z]);
        const { ra, dec } = cellCenterRadec(nside, ipix);
        expect(Math.abs(c.dec - dec)).toBeLessThan(1e-6);
        // RA ist am ±180°-Rand periodisch
        const dra = Math.abs(((c.ra - ra + 540) % 360) - 180);
        expect(dra).toBeLessThan(1e-6);
      }
    }
  });

  it('cell corners are unit directions and neighbors share edges', () => {
    for (const order of ORDERS) {
      const nside = 1 << order;
      const npix = 12 * nside * nside;
      for (let ipix = 0; ipix < npix; ipix++) {
        for (const [s, t] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const [x, y, z] = cellPointDir(nside, ipix, s, t);
          expect(Math.abs(Math.hypot(x, y, z) - 1)).toBeLessThan(1e-12);
        }
        // rechte Kante dieser Zelle == linke Kante der Nachbarzelle (gleiche Face, ix + 1)
        const { ix, iy, face } = nest2xyf(nside, ipix);
        if (ix + 1 < nside) {
          const right = cellPointDir(nside, ipix, 1, 0.5);
          const neighbor = xyf2nest(nside, ix + 1, iy, face);
          const left = cellPointDir(nside, neighbor, 0, 0.5);
          expect(right[0]).toBeCloseTo(left[0], 12);
          expect(right[1]).toBeCloseTo(left[1], 12);
          expect(right[2]).toBeCloseTo(left[2], 12);
        }
      }
    }
  });

  it('hierarchy: the four children keep face and halve the (ix, iy)', () => {
    for (const order of [0, 1, 2, 4]) {
      const nside = 1 << order;
      const childSide = nside * 2;
      for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
        const parent = nest2xyf(nside, ipix);
        for (let child = 0; child < 4; child++) {
          const c = nest2xyf(childSide, ipix * 4 + child);
          expect(c.face).toBe(parent.face);
          expect(c.ix >> 1).toBe(parent.ix);
          expect(c.iy >> 1).toBe(parent.iy);
        }
      }
    }
  });

  it('the poles land in the polar cells (one corner is the pole itself)', () => {
    for (const order of ORDERS) {
      const nside = 1 << order;
      for (const [dec, sign] of [[90, 1], [-90, -1]] as const) {
        const ipix = ang2pixNest(nside, 0, dec);
        expect(sign * pix2angNestZPhi(nside, ipix).z).toBeGreaterThan(0.6); // Ordnung 0: 2/3
        const corners = ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).map(([s, t]) => cellPointDir(nside, ipix, s, t));
        expect(Math.max(...corners.map((c) => sign * c[1]))).toBeCloseTo(1, 6);
      }
    }
  });

  it('dirFromRadec/radecFromDir roundtrip', () => {
    for (const ra of [0, 45, 179.9, 180, 270, 359.9]) {
      for (const dec of [-89, -30, 0, 30, 89]) {
        const back = radecFromDir(dirFromRadec(ra, dec));
        expect(Math.abs(back.dec - dec)).toBeLessThan(1e-9);
        const dra = Math.abs(((back.ra - ra + 540) % 360) - 180);
        expect(dra).toBeLessThan(1e-9);
      }
    }
  });
});
