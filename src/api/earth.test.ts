import { describe, expect, it } from 'vitest';
import { pickRtsw } from './earth';

describe('pickRtsw', () => {
  it('prefers the newest active row and skips fill values', () => {
    const rows = [
      { time_tag: '2026-11-03T16:18:00', active: false, bz_gsm: 9 },
      { time_tag: '2026-11-03T16:17:00', active: true, bz_gsm: -2.1 },
      { time_tag: '2026-11-03T16:16:00', active: true, bz_gsm: -9999 },
      { time_tag: '2026-11-03T16:15:00', active: true, bz_gsm: -1.5 },
    ];
    expect(pickRtsw<{ bz_gsm: number }>(rows, 'bz_gsm')?.bz_gsm).toBe(-2.1);
  });
  it('returns null for non-arrays', () => expect(pickRtsw({}, 'x' as never)).toBeNull());
});
