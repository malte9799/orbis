import { describe, expect, it } from 'vitest';
import { rufbusInfo, telHref } from './rufbus';

describe('rufbusInfo', () => {
  it('knows the number of a listed operator', () => {
    expect(rufbusInfo('Nordwestmecklenburg', 'COMPULSORY')).toEqual({ tel: '0385 55573340', leadMin: 60, required: true });
  });
  it('only says a booking is needed for an unknown operator', () => {
    expect(rufbusInfo('Irgendwo', 'COMPULSORY')).toEqual({ required: true });
    expect(rufbusInfo('Irgendwo', undefined)).toBeNull();
  });
  it('builds a tel: link', () => {
    expect(telHref('0385 55573340')).toBe('tel:038555573340');
  });
});
