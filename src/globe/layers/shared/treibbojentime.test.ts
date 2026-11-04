import { beforeEach, describe, expect, it } from 'vitest';
import { dotAlpha, localStep, pointAt, SHARED_SPAN_DAYS, yearToDay, type Tracks } from './treibbojen';
import { meerRange, meerState, resetMeer, setMeerFocus, setMeerTime, yearStartDay } from './meerzeit';
import { driftFollowsClock, driftRange, driftState, setDriftMode, setDriftReady, setDriftTime, subscribeDrift, tickDrift } from './treibbojentime';

describe('treibbojentime', () => {
  beforeEach(() => resetMeer());
  it('starts in real time; the range is a placeholder until the data are there', () => {
    expect(driftState().mode).toBe('real');
    expect(driftState().time).toBe(0);
    expect(driftRange()).toEqual({ lo: 0, hi: SHARED_SPAN_DAYS });
  });
  it('real time starts at the first data day once the data are there; the last data day ends the shared axis; shared start resets the time', () => {
    setDriftReady({ first: 3000, last: 20000, count: 5 });
    expect(driftState().mode).toBe('real');
    expect(driftRange()).toEqual({ lo: 3000, hi: 20000 });
    expect(driftState().time).toBe(3000);
    expect(meerState().end).toBe(20000);
    setDriftTime(1e9);
    expect(driftState().time).toBe(20000);
    setDriftMode('shared');
    expect(driftRange()).toEqual({ lo: 0, hi: SHARED_SPAN_DAYS });
    expect(driftState().time).toBe(0);
    setDriftMode('real');
    expect(driftState().time).toBe(3000);
  });
  it('real time follows the clock; the shared start is a mode of the layer alone and "Alle" returns to real time', () => {
    setDriftReady({ first: 3000, last: 20000, count: 5 });
    setDriftMode('real');
    expect(driftFollowsClock()).toBe(true);
    // the range of the data is the axis of the layer in focus
    setMeerFocus('bojen');
    expect(meerRange()).toEqual({ lo: 3000, hi: 20000 });
    setDriftMode('shared');
    expect(driftFollowsClock()).toBe(false);
    // another layer in focus: the layer is not driven by the clock
    setMeerFocus('plastik');
    expect(driftFollowsClock()).toBe(false);
    setMeerFocus('all');
    expect(driftState().mode).toBe('real');
    expect(driftFollowsClock()).toBe(true);
    setMeerTime(yearStartDay(1990));
    setMeerFocus('plastik');
    // real time but not driven: it holds the date
    expect(driftState().mode).toBe('real');
    expect(driftFollowsClock()).toBe(false);
    setMeerFocus('all');
  });
  it('advances on its own and notifies on changes', () => {
    let n = 0;
    const off = subscribeDrift(() => n++);
    setDriftMode('shared');
    n = 0;
    setDriftTime(100);
    expect(n).toBe(1);
    off();
    expect(tickDrift(5000)).toBeCloseTo(465, 5);
    setDriftMode('real');
  });
});

describe('shared time -> drifter position', () => {
  // one track from 1980-01-01 (5 points, every 5 days)
  const start = yearToDay(1980) / 5;
  const t: Tracks = {
    count: 1,
    stepDays: 5,
    ids: [1],
    start: Uint16Array.of(start),
    len: Uint16Array.of(5),
    off: Uint32Array.of(0),
    lon: Float32Array.of(0, 1, 2, 3, 4),
    lat: Float32Array.of(0, 0, 0, 0, 0),
  };
  it('has no drifter before the first one (the axis starts in 1950)', () => {
    const local = localStep('real', yearToDay(1960), t.start[0], 5);
    expect(pointAt(t, 0, local)).toBeNull();
    expect(dotAlpha(local, 5)).toBe(0);
  });
  it('shows it on the calendar days of its track and not after', () => {
    const at = (day: number) => {
      const local = localStep('real', day, t.start[0], 5);
      return pointAt(t, 0, local);
    };
    const first = t.start[0] * 5;
    expect(at(first + 10)?.lon).toBeCloseTo(2, 5);
    expect(at(first + 100)).toBeNull();
    expect(at(first - 1)).toBeNull();
  });
});
