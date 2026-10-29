import { describe, expect, it } from 'vitest';
// @ts-expect-error – plain JS worker file, deployed on its own
import { buildMessage, cleanTrips, dueNotifications, instantAt, zoned } from '../../proxy/fahrplan-push-worker.js';

const TZ = 'Europe/Berlin';
const stop = (name: string) => ({ id: `id-${name}`, name, lat: 53.7, lon: 11.4, src: 'db' });
const trip = (over = {}) => ({ id: 't1', from: stop('Bad Kleinen'), to: stop('Wismar'), line: 'RE 8', hm: '07:12', days: [1, 2, 3, 4, 5], leads: [30, 20, 10], onlyDelay: false, ...over });

describe('time zones', () => {
  it('maps wall clock to instants, also across the DST change', () => {
    // CEST (UTC+2) on 2026-10-24, CET (UTC+1) on 2026-10-26 – the clocks change on Sunday 25 October
    expect(new Date(instantAt(2026, 10, 24, 7, 12, TZ)).toISOString()).toBe('2026-10-24T05:12:00.000Z');
    expect(new Date(instantAt(2026, 10, 26, 7, 12, TZ)).toISOString()).toBe('2026-10-26T06:12:00.000Z');
    expect(zoned(Date.parse('2026-10-29T05:30:00Z'), TZ)).toMatchObject({ y: 2026, m: 10, d: 29, h: 6, mi: 30, wd: 4 });
  });
  it('lets the day overflow into the next month', () => {
    expect(new Date(instantAt(2026, 10, 32, 0, 10, TZ)).toISOString()).toBe('2026-10-31T23:10:00.000Z');
  });
});

describe('dueNotifications', () => {
  // Thursday 2026-10-29, departure 07:12 CET = 06:12Z
  const at = (hhmm: string) => Date.parse(`2026-10-29T${hhmm}:00Z`);
  it('fires at each lead time, once', () => {
    expect(dueNotifications(trip(), TZ, at('05:41'), {})).toEqual([]);
    const due = dueNotifications(trip(), TZ, at('05:42'), {});
    expect(due.map((d: { lead: number }) => d.lead)).toEqual([30]);
    expect(dueNotifications(trip(), TZ, at('05:42'), { [due[0].key]: 1 })).toEqual([]);
    expect(dueNotifications(trip(), TZ, at('06:02'), {}).map((d: { lead: number }) => d.lead)).toEqual([10]);
  });
  it('makes up for a missed cron minute, but not for long', () => {
    expect(dueNotifications(trip(), TZ, at('05:45'), {}).map((d: { lead: number }) => d.lead)).toEqual([30]);
    expect(dueNotifications(trip(), TZ, at('05:47'), {})).toEqual([]);
  });
  it('respects the weekdays and never fires after departure', () => {
    expect(dueNotifications(trip({ days: [6, 0] }), TZ, at('05:42'), {})).toEqual([]);
    expect(dueNotifications(trip({ leads: [1] }), TZ, at('06:12'), {})).toEqual([]);
  });
  it('sees a departure just after midnight from the evening before', () => {
    const night = trip({ hm: '00:10', leads: [30], days: [5] });
    // Thursday 23:41 local → Friday 00:10 departure
    expect(dueNotifications(night, TZ, Date.parse('2026-10-29T22:41:00Z'), {})).toHaveLength(1);
  });
});

describe('buildMessage', () => {
  const t = trip();
  it('says on time, late and cancelled', () => {
    const dep = Date.parse('2026-10-29T06:12:00Z');
    expect(buildMessage(t, { cancelled: false, delayMin: 0, dep, track: '2' }, TZ).body).toBe('Dein Zug ist pünktlich (Abfahrt: 07:12 Uhr, Gleis 2).');
    expect(buildMessage(t, { cancelled: false, delayMin: 14, dep: dep + 14 * 60000 }, TZ).body).toBe('Dein Zug hat 14 min Verspätung (Abfahrt: 07:26 Uhr).');
    expect(buildMessage(t, { cancelled: true, delayMin: null, dep }, TZ).body).toContain('entfällt');
    expect(buildMessage(t, { cancelled: false, delayMin: null, dep }, TZ).body).toContain('keine Echtzeitdaten');
  });
  it('stays quiet for on-time trains when only delays are wanted', () => {
    const dep = Date.parse('2026-10-29T06:12:00Z');
    expect(buildMessage(trip({ onlyDelay: true }), { cancelled: false, delayMin: 0, dep }, TZ)).toBeNull();
    expect(buildMessage(trip({ onlyDelay: true }), { cancelled: false, delayMin: 3, dep }, TZ)).not.toBeNull();
  });
});

describe('cleanTrips', () => {
  it('drops broken trips and clamps the rest', () => {
    const r = cleanTrips([trip({ leads: [10, 10, 500, 0, 5] }), trip({ hm: '7:12' }), trip({ days: [] }), { nonsense: true }]);
    expect(r).toHaveLength(1);
    expect(r[0].leads).toEqual([10, 5]);
  });
});
