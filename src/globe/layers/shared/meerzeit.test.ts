import { beforeEach, describe, expect, it } from 'vitest';
import {
  dayCalendarYear,
  HOLD_MS,
  MEER_END_DEFAULT,
  MEER_START,
  meerCalYear,
  meerDriven,
  meerFocus,
  meerLayerTime,
  meerDaysPerMs,
  meerRange,
  meerState,
  resetMeer,
  setMeerFocus,
  setMeerLayerRange,
  setMeerEnd,
  setMeerGate,
  setMeerPlaying,
  setMeerSpeed,
  setMeerTime,
  subscribeMeer,
  subscribeMeerTick,
  tickMeer,
  yearStartDay,
} from './meerzeit';

describe('meerzeit', () => {
  beforeEach(() => resetMeer());

  it('runs from 1950-01-01 to the end of the drifter data and starts at the beginning', () => {
    expect(dayCalendarYear(MEER_START)).toBe(1950);
    expect(MEER_START).toBe(yearStartDay(1950));
    expect(meerRange()).toEqual({ lo: MEER_START, hi: MEER_END_DEFAULT });
    expect(dayCalendarYear(MEER_END_DEFAULT)).toBe(2025);
    expect(meerState().time).toBe(MEER_START);
    expect(meerState().playing).toBe(true);
    expect(meerState().speed).toBe(3);
  });

  it('clamps the time to the axis and a new end shortens it', () => {
    setMeerTime(1e9);
    expect(meerState().time).toBe(MEER_END_DEFAULT);
    setMeerTime(-1e9);
    expect(meerState().time).toBe(MEER_START);
    setMeerTime(MEER_END_DEFAULT);
    setMeerEnd(MEER_END_DEFAULT - 100);
    expect(meerState().time).toBe(MEER_END_DEFAULT - 100);
    setMeerEnd(MEER_START - 5); // not after the start: ignored
    expect(meerRange().hi).toBe(MEER_END_DEFAULT - 100);
  });

  it('plays one year in 1 / 3 / 10 s', () => {
    for (const v of [1, 3, 10] as const) {
      setMeerSpeed(v);
      setMeerTime(MEER_START);
      const t = tickMeer(v * 1000);
      expect(t - MEER_START).toBeCloseTo(365.25, 6);
      expect(meerDaysPerMs() * v * 1000).toBeCloseTo(365.25, 6);
    }
    setMeerSpeed(7 as never);
    expect(meerState().speed).toBe(10);
  });

  it('does not move when paused, and Play at the end starts over', () => {
    setMeerPlaying(false);
    expect(tickMeer(1000)).toBe(MEER_START);
    setMeerTime(MEER_END_DEFAULT);
    setMeerPlaying(true);
    expect(meerState().time).toBe(MEER_START);
  });

  it('holds the last picture at the end, then starts over', () => {
    setMeerTime(MEER_END_DEFAULT - 1);
    expect(tickMeer(100000)).toBe(MEER_END_DEFAULT);
    expect(tickMeer(HOLD_MS - 10)).toBe(MEER_END_DEFAULT);
    expect(tickMeer(20)).toBe(MEER_START);
    // and it plays on
    expect(tickMeer(1000)).toBeGreaterThan(MEER_START);
  });

  it('waits for a model that has not got there yet (gate) and never runs backwards', () => {
    setMeerGate(MEER_START + 100);
    expect(tickMeer(100000)).toBe(MEER_START + 100);
    expect(tickMeer(100000)).toBe(MEER_START + 100);
    // a jump beyond the gate: the clock stays, it does not go back
    setMeerTime(MEER_START + 1000);
    expect(tickMeer(1000)).toBe(MEER_START + 1000);
    setMeerGate(MEER_START + 1500);
    expect(tickMeer(100000)).toBe(MEER_START + 1500);
    setMeerGate(null);
    expect(tickMeer(1000)).toBeGreaterThan(MEER_START + 1500);
  });

  it('drives all three layers by default (focus "Alle")', () => {
    expect(meerFocus()).toBe('all');
    expect(meerDriven('plastik') && meerDriven('bojen') && meerDriven('modell')).toBe(true);
  });

  it('a single layer as the focus drives only that layer; the others hold the shared time of that moment', () => {
    let n = 0;
    const off = subscribeMeer(() => n++);
    setMeerTime(yearStartDay(1990));
    setMeerFocus('bojen');
    expect(n).toBe(2);
    setMeerFocus('bojen');
    expect(n).toBe(2);
    off();
    expect(meerDriven('bojen')).toBe(true);
    expect(meerDriven('plastik')).toBe(false);
    setMeerTime(yearStartDay(2000));
    expect(meerLayerTime('bojen')).toBe(yearStartDay(2000));
    expect(meerLayerTime('plastik')).toBe(yearStartDay(1990));
    expect(meerLayerTime('modell')).toBe(yearStartDay(1990));
    // from one layer to the next: each shows the time it held, the old one keeps the time it had
    setMeerFocus('modell');
    expect(meerState().time).toBe(yearStartDay(1990));
    expect(meerLayerTime('bojen')).toBe(yearStartDay(2000));
    // "Alle": everything jumps to the shared time from before the focus left it
    setMeerFocus('all');
    expect(meerState().time).toBe(yearStartDay(1990));
    expect(meerLayerTime('bojen')).toBe(yearStartDay(1990));
  });

  it('the axis of a layer in focus is its data range; the loop and Play at the end use it', () => {
    setMeerLayerRange('bojen', { lo: yearStartDay(1979), hi: yearStartDay(2020) });
    expect(meerRange()).toEqual({ lo: MEER_START, hi: MEER_END_DEFAULT });
    setMeerFocus('bojen');
    expect(meerRange()).toEqual({ lo: yearStartDay(1979), hi: yearStartDay(2020) });
    // the focus starts inside the range
    expect(meerState().time).toBe(yearStartDay(1979));
    setMeerTime(1e9);
    expect(meerState().time).toBe(yearStartDay(2020));
    setMeerPlaying(false);
    setMeerPlaying(true);
    expect(meerState().time).toBe(yearStartDay(1979));
    // a year of the plastic layer takes 200 ms per second of the tempo
    setMeerLayerRange('plastik', { lo: yearStartDay(1970), hi: yearStartDay(2015) });
    setMeerFocus('plastik');
    setMeerSpeed(3);
    expect(meerDaysPerMs() * 600).toBeCloseTo(365.25, 6);
  });

  it('structural subscribers hear jumps, tick subscribers also the running clock', () => {
    let s = 0;
    let t = 0;
    const o1 = subscribeMeer(() => s++);
    const o2 = subscribeMeerTick(() => t++);
    tickMeer(500);
    expect(s).toBe(0);
    expect(t).toBe(1);
    setMeerTime(MEER_START + 10);
    expect(s).toBe(1);
    expect(t).toBe(2);
    o1();
    o2();
  });

  it('reports the calendar year of the time', () => {
    setMeerTime(yearStartDay(1994) + 200);
    expect(meerCalYear()).toBe(1994);
  });
});
