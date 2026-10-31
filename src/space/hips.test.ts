import { describe, expect, it } from 'vitest';
import { cellGeometry } from './hips';
import { cellPointDir } from './healpix';
import { equirectProjection, hammerProjection, sphereProjection } from './projections';

function angleBetween(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

// Naht-Test: Zellen über RA 180° müssen an der Meridian-Ebene geteilt werden, statt als
// Dreiecke über die ganze Kartenbreite zu laufen (sonst Löcher/Fransen am Kartenrand).
describe('HiPS cellGeometry', () => {
  const nside = 4;

  it('equirect and hammer: every vertex unprojects to the direction given by its UV', () => {
    for (const proj of [equirectProjection, hammerProjection]) {
      for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
        const geo = cellGeometry(nside, ipix, proj);
        const pos = geo.getAttribute('position').array as Float32Array;
        const uv = geo.getAttribute('uv').array as Float32Array;
        for (let i = 0; i < pos.length; i += 3) {
          // Naht-/Randpunkte liegen rechnerisch minimal außerhalb – auf den Rand klemmen
          let x = pos[i];
          let y = pos[i + 1];
          if (proj.flat && proj.halfW === Math.PI) {
            x = Math.max(-Math.PI, Math.min(Math.PI, x));
            y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, y));
          } else {
            const q = (x * x) / 8 + (y * y) / 2; // Hammer-Ellipse
            // minimal außerhalb (Naht) → knapp auf die Ellipse zurücksetzen
            if (q > 1 - 1e-9) { const f = Math.sqrt((1 - 1e-9) / q); x *= f; y *= f; }
          }
          const dir = proj.unproject(x, y);
          expect(dir, `${proj === hammerProjection ? 'hammer' : 'equirect'} ipix ${ipix} vertex ${i / 3}`).not.toBeNull();
          const s = 1 - uv[(i / 3) * 2 + 1];
          const t = uv[(i / 3) * 2];
          const want = cellPointDir(nside, ipix, s, t);
          // Kanten sind keine Großkreise: lineare 3D-Interpolation weicht minimal von der
          // (s,t)-Parametrisierung ab – 1e-3 rad sind weit unter einem Pixel.
          expect(angleBetween(dir!, want)).toBeLessThan(1e-3);
        }
      }
    }
  });

  it('equirect: no triangle spans the map edge, everything stays on the map', () => {
    const seam = equirectProjection.seam;
    for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
      const pos = cellGeometry(nside, ipix, equirectProjection).getAttribute('position').array as Float32Array;
      expect(pos.length).toBeGreaterThan(0);
      for (let i = 0; i < pos.length; i += 9) {
        const xs = [pos[i], pos[i + 3], pos[i + 6]];
        const ys = [pos[i + 1], pos[i + 4], pos[i + 7]];
        for (const v of xs) expect(Math.abs(v)).toBeLessThanOrEqual(Math.PI + 1e-6);
        for (const v of ys) expect(Math.abs(v)).toBeLessThanOrEqual(Math.PI / 2 + 1e-6);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(seam + 1e-6);
        expect(xs.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('equirect: seam cells cover both map sides', () => {
    // Zelle bei RA 180° (nside 4): linke und rechte Kartenhälfte müssen beide vorhanden sein
    let found = 0;
    for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
      const pos = cellGeometry(nside, ipix, equirectProjection).getAttribute('position').array as Float32Array;
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < pos.length; i += 3) {
        minX = Math.min(minX, pos[i]);
        maxX = Math.max(maxX, pos[i]);
      }
      if (minX < -3 && maxX > 3) found++;
    }
    // mindestens die Zellen direkt am Meridian
    expect(found).toBeGreaterThanOrEqual(8);
  });

  it('hammer: no triangle jumps across the projection edge', () => {
    const seam = hammerProjection.seam;
    for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
      const pos = cellGeometry(nside, ipix, hammerProjection).getAttribute('position').array as Float32Array;
      for (let i = 0; i < pos.length; i += 9) {
        const xs = [pos[i], pos[i + 3], pos[i + 6]];
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(seam + 1e-6);
      }
    }
  });

  it('sphere: unit-length, outward-wound triangles', () => {
    for (let ipix = 0; ipix < 12 * nside * nside; ipix++) {
      const pos = cellGeometry(nside, ipix, sphereProjection).getAttribute('position').array as Float32Array;
      for (let i = 0; i < pos.length; i += 9) {
        const a = [pos[i], pos[i + 1], pos[i + 2]];
        const b = [pos[i + 3], pos[i + 4], pos[i + 5]];
        const c = [pos[i + 6], pos[i + 7], pos[i + 8]];
        expect(Math.abs(Math.hypot(...a) - 1)).toBeLessThan(1e-6);
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ];
        const center = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
        expect(n[0] * center[0] + n[1] * center[1] + n[2] * center[2]).toBeGreaterThan(0);
      }
    }
  });
});
