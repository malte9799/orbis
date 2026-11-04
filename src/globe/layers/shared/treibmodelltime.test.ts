import { beforeEach, describe, expect, it } from 'vitest';
import { meerFocus, resetMeer, setMeerFocus } from './meerzeit';
import { DAYS_PER_MS, modelHistoric, modelRunMode, modelState, reportModel, restartModel, RUN_DAYS, setModelMode, setModelReady, setModelRunTarget, subscribeModel, YEAR_MS } from './treibmodelltime';

describe('treibmodelltime', () => {
  beforeEach(() => {
    resetMeer();
    setModelMode('live');
  });
  it('one year in 3 s in live mode', () => {
    expect(DAYS_PER_MS * YEAR_MS).toBeCloseTo(365, 6);
  });
  it('ready', () => {
    setModelReady({ count: 5000 });
    expect(modelState().ready?.count).toBe(5000);
  });
  it('the historic run is the default; live is a mode of the layer alone and starts anew', () => {
    setModelMode('hist');
    expect(modelHistoric()).toBe(true);
    expect(modelRunMode()).toBe('hist');
    reportModel(900, 0.4, 1500);
    const r0 = modelState().restarts;
    setModelMode('live');
    expect(modelRunMode()).toBe('live');
    expect(modelState().day).toBe(0);
    expect(modelState().inSea).toBe(0);
    expect(modelState().restarts).toBe(r0 + 1);
    // live again: nothing
    setModelMode('live');
    expect(modelState().restarts).toBe(r0 + 1);
  });
  it('the focus "Alle" is always the historic run', () => {
    setMeerFocus('modell');
    setModelMode('live');
    expect(modelRunMode()).toBe('live');
    setMeerFocus('plastik');
    // another layer in focus: the model keeps its mode (and holds its picture)
    expect(modelRunMode()).toBe('live');
    setMeerFocus('all');
    expect(meerFocus()).toBe('all');
    expect(modelRunMode()).toBe('hist');
  });
  it('"Jetzt" in the live mode counts a restart and the subscribers hear of it', () => {
    let n = 0;
    const off = subscribeModel(() => n++);
    const r0 = modelState().restarts;
    reportModel(400, 0.1, 1234);
    expect(modelState().inSea).toBe(1234);
    expect(modelState().day).toBe(400);
    restartModel();
    expect(modelState().restarts).toBe(r0 + 1);
    expect(modelState().day).toBe(0);
    expect(n).toBe(1);
    off();
  });
  it('the 10-year run is a mode of the layer alone: starts anew, slider target is clamped, "Alle" falls back to the historic run', () => {
    setMeerFocus('modell');
    const r0 = modelState().restarts;
    reportModel(900, 0.4, 1500);
    setModelMode('run');
    expect(modelRunMode()).toBe('run');
    expect(modelHistoric()).toBe(false);
    expect(modelState().day).toBe(0);
    expect(modelState().restarts).toBe(r0 + 1);
    const s0 = modelState().seeks;
    setModelRunTarget(99999);
    expect(modelState().target).toBe(RUN_DAYS);
    expect(modelState().seeks).toBe(s0 + 1);
    setModelRunTarget(-5);
    expect(modelState().target).toBe(0);
    setModelRunTarget(null);
    expect(modelState().target).toBeNull();
    // "Jetzt"
    reportModel(300, 0.2, 700);
    restartModel();
    expect(modelState().day).toBe(0);
    expect(modelRunMode()).toBe('run');
    setMeerFocus('all');
    expect(modelRunMode()).toBe('hist');
  });
});
