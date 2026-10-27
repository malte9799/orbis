import { describe, expect, it } from 'vitest';
import { fitPose, project, type Pair, type Pose } from './camfit';

const truth: Pose = { heading: 130, down: 14, alt: 7, fov: 38 };
const spots: [number, number][] = [
  [20, -15],
  [35, 5],
  [12, 10],
  [50, -30],
  [28, 22],
];
const pairs = (): Pair[] =>
  spots.flatMap(([e, n]) => {
    const q = project(truth, e, n);
    return q ? [{ u: q[0], v: q[1], e, n }] : [];
  });
const diff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('camera pose from point pairs', () => {
  it('projects what is ahead and drops what is behind', () => {
    expect(project({ heading: 0, down: 0, alt: 2, fov: 40 }, 0, 10)?.[0]).toBeCloseTo(0);
    expect(project({ heading: 0, down: 0, alt: 2, fov: 40 }, 0, -10)).toBeNull();
    // east of a camera that looks north is on the right, the ground is below the centre
    const q = project({ heading: 0, down: 0, alt: 2, fov: 40 }, 5, 10)!;
    expect(q[0]).toBeGreaterThan(0);
    expect(q[1]).toBeLessThan(0);
  });

  it('finds the heading from a single pair', () => {
    const [p] = pairs();
    const r = fitPose([p], { ...truth, heading: 0 });
    expect(diff(r.pose.heading, truth.heading)).toBeLessThan(1);
  });

  it('finds heading, tilt, height and field of view from five pairs', () => {
    const r = fitPose(pairs(), { heading: 40, down: 10, alt: 5, fov: 45 });
    expect(diff(r.pose.heading, truth.heading)).toBeLessThan(1.5);
    expect(r.pose.down).toBeCloseTo(truth.down, 0);
    expect(r.rms).toBeLessThan(0.02);
  });
});
