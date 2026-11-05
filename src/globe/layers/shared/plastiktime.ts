// Year of the layer "Plastik im Meer". The steps are the union of the years of the modelled outline (gap-free from the first to the
// last model year, experimental model) and the years that have net tows; years without either are skipped. The layer shows ONE year:
// it is the calendar year of the time of this layer in the marine-plastic timeline (shared/meerzeit.ts: the clock while the layer is
// driven, else the time it held). Shared state like src/api/wahlen.ts: the layer fills the data, the timeline (views/globe.ts) and the layer subscribe.
import { dayCalendarYear, meerLayerTime, setMeerLayerRange, subscribeMeer, subscribeMeerTick, yearStartDay } from './meerzeit';

export interface ModelYear {
  /** year */
  y: number;
  /** area of the modelled outline in km² (0 = no connected area yet) */
  a: number;
}

let years: number[] = [];
let counts = new Map<number, number>();
let areas = new Map<number, number>();
/** the year shown at the last notification (undefined: none yet) */
let shown: number | null | undefined;
const subs = new Set<() => void>();
const notify = () => subs.forEach((fn) => fn());

export const subscribePlastik = (fn: () => void): (() => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
export const plastikYears = (): readonly number[] => years;

/**
 * The year of the slider that a calendar year shows: the latest year with data up to it. Before the first year: null (nothing);
 * after the last year: the last one.
 */
export function yearAt(ys: readonly number[], calendarYear: number): number | null {
  if (!ys.length || calendarYear < ys[0]) return null;
  let r = ys[0];
  for (const y of ys) {
    if (y > calendarYear) break;
    r = y;
  }
  return r;
}

/** the shown year: the latest year with data up to the calendar year of the layer's time; null = nothing yet (before the first year) */
export const plastikYear = (): number | null => yearAt(years, dayCalendarYear(meerLayerTime('plastik')));

/** number of tows in exactly this year */
export const plastikCount = (year: number | null): number => (year == null ? 0 : (counts.get(year) ?? 0));
/** area of the modelled outline in km² in this year, null without model data for the year */
export const plastikModelArea = (year: number | null): number | null => (year == null ? null : (areas.get(year) ?? null));

/** the sorted years of the slider: all model years without a gap, plus the tow years */
export function sliderYears(towYears: Iterable<number>, model: readonly ModelYear[]): number[] {
  const set = new Set<number>(towYears);
  if (model.length) {
    const ys = model.map((m) => m.y);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) set.add(y);
  }
  return [...set].sort((a, b) => a - b);
}

/** sets the tow years (one entry per tow) and the model years; both are replaced as a whole */
export function setPlastikYears(towYears: number[], model: readonly ModelYear[] = []) {
  const next = new Map<number, number>();
  for (const y of towYears) next.set(y, (next.get(y) ?? 0) + 1);
  const nextAreas = new Map<number, number>(model.map((m) => [m.y, m.a]));
  counts = next;
  areas = nextAreas;
  years = sliderYears(next.keys(), model);
  // the axis of the layer when it is the focus: from the first to the last year of the slider
  setMeerLayerRange('plastik', years.length ? { lo: yearStartDay(years[0]), hi: yearStartDay(years[years.length - 1]) } : null);
  shown = plastikYear();
  notify();
}

// the clock moved or the focus changed: tell the layer only when the year it shows changes
const check = () => {
  const y = plastikYear();
  if (y !== shown) {
    shown = y;
    notify();
  }
};
subscribeMeerTick(check);
subscribeMeer(check);
