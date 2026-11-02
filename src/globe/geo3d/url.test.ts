import { describe, expect, it } from 'vitest';
import { readFollow, writeFollow } from './url';

describe('readFollow', () => {
  it('reads source, slug and the extra values of the source', () => {
    expect(readFollow('#/karte?follow=sat/iss&follow.t=1730000000&lat=1')).toEqual({ source: 'sat', slug: 'iss', params: { t: '1730000000' } });
  });

  it('a slug may contain slashes', () => {
    expect(readFollow('#/karte?follow=ship/de/123')).toEqual({ source: 'ship', slug: 'de/123', params: {} });
  });

  it('also reads an encoded slash', () => {
    expect(readFollow('#/karte?follow=sat%2Fiss')?.slug).toBe('iss');
  });

  it.each(['#/karte', '#/karte?lat=1', '#/karte?follow=', '#/karte?follow=sat', '#/karte?follow=sat/', '#/karte?follow=/iss', '#/vorhersage?follow=sat/iss', ''])('nothing in %s', (hash) => {
    expect(readFollow(hash)).toBeNull();
  });
});

describe('writeFollow', () => {
  const iss = { source: 'sat', slug: 'iss', params: { t: '5' } };

  it('stays readable', () => {
    expect(writeFollow('#/karte', iss)).toBe('#/karte?follow=sat/iss&follow.t=5');
  });

  it('keeps everything else', () => {
    expect(writeFollow('#/karte?lat=1&lon=2', iss)).toBe('#/karte?lat=1&lon=2&follow=sat/iss&follow.t=5');
  });

  it('replaces the old object with all of its values', () => {
    expect(writeFollow('#/karte?follow=sat/iss&follow.t=5&follow.x=1', { source: 'pin', slug: 'berlin', params: {} })).toBe('#/karte?follow=pin/berlin');
  });

  it('removes it again', () => {
    expect(writeFollow('#/karte?lat=1&follow=sat/iss&follow.t=5', null)).toBe('#/karte?lat=1');
    expect(writeFollow('#/karte?follow=sat/iss', null)).toBe('#/karte');
  });

  it('leaves other views alone', () => {
    expect(writeFollow('#/vorhersage?a=1', iss)).toBe('#/vorhersage?a=1');
  });

  it('what is written can be read', () => {
    expect(readFollow(writeFollow('#/karte', iss))).toEqual(iss);
  });
});
