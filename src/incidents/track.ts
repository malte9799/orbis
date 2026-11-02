import type { Sample, TrackPoint } from './types';

// Interpolation der Flugspur. Rein, ohne DOM – getestet in incidents.test.ts.

const shortest = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/** Index des letzten Punktes mit Zeit <= t (-1 davor) */
export function indexAt(pts: TrackPoint[], t: number): number {
  let lo = 0;
  let hi = pts.length - 1;
  if (!pts.length || t < pts[0][0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Letzter Punkt mit Höhe bei oder vor Index i und die Sinkrate (ft/min) aus ihm und dem Höhenpunkt davor; null ohne Höhen */
function lastKnown(pts: TrackPoint[], i: number): { k: number; vs: number } | null {
  let k = i;
  while (k >= 0 && pts[k][3] == null) k--;
  if (k < 0) return null;
  let j = k - 1;
  while (j >= 0 && pts[j][3] == null) j--;
  const span = j >= 0 ? pts[k][0] - pts[j][0] : 0;
  return { k, vs: span > 0 ? ((pts[k][3]! - pts[j][3]!) / span) * 60 : 0 };
}

/** Nächster Punkt mit Höhe nach Index i (null: keiner mehr) */
function nextKnown(pts: TrackPoint[], i: number): number | null {
  for (let q = i + 1; q < pts.length; q++) if (pts[q][3] != null) return q;
  return null;
}

/** Zustand zur Zeit t (Unix-s), linear zwischen den Meldungen; vor/nach der Spur der erste/letzte Punkt. */
export function sampleAt(pts: TrackPoint[], t: number): Sample {
  const i = Math.max(0, indexAt(pts, t));
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  const span = b[0] - a[0];
  const f = span > 0 ? Math.min(1, Math.max(0, (t - a[0]) / span)) : 0;
  const known = a[3] != null && b[3] != null;
  let alt = known ? a[3]! + (b[3]! - a[3]!) * f : a[3];
  let vs = known && span > 0 ? ((b[3]! - a[3]!) / span) * 60 : null;
  let estimated = (a[3] != null && b[3] == null) || !!(a[6] || b[6]);
  // Ohne Messwert (Ende der Spur): die letzte bekannte Sinkrate bis zum Boden fortschreiben statt auf 0 zu springen.
  // Auch nach dem letzten Punkt (t über die Spur hinaus): Position bleibt, die Höhe läuft weiter ab.
  if (!known) {
    const lk = lastKnown(pts, Math.min(i + 1, pts.length - 1));
    const q = lk ? nextKnown(pts, lk.k) : null;
    if (lk && q != null) {
      // Lücke zwischen zwei Höhenwerten: linear füllen
      const p0 = pts[lk.k];
      const p1 = pts[q];
      const k = (t - p0[0]) / (p1[0] - p0[0]);
      alt = p0[3]! + (p1[3]! - p0[3]!) * Math.min(1, Math.max(0, k));
      vs = ((p1[3]! - p0[3]!) / (p1[0] - p0[0])) * 60;
      estimated = true;
    } else if (lk) {
      alt = Math.max(0, pts[lk.k][3]! + (lk.vs / 60) * (t - pts[lk.k][0]));
      vs = alt > 0 ? lk.vs : 0;
      estimated = true;
    }
  }
  return {
    t: Math.min(Math.max(t, pts[0][0]), pts[pts.length - 1][0]),
    lat: a[1] + (b[1] - a[1]) * f,
    lon: a[2] + (b[2] - a[2]) * f,
    alt,
    altHeld: estimated,
    gs: a[4] + (b[4] - a[4]) * f,
    trk: (a[5] + shortest(a[5], b[5]) * f + 360) % 360,
    vs,
    i,
  };
}
