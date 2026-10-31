/** Tests for the head/manifest i18n glue. */
import { describe, expect, it } from 'vitest';
import { setLang } from './index';
import { translateManifest } from './head';

const BASE = {
  name: 'Orbis – Wetter, Erde & Weltall',
  short_name: 'Orbis',
  description: 'Wettervorhersage, Live-Weltkarte und interaktives 3D-Sonnensystem',
  lang: 'de',
  start_url: './',
};

describe('translateManifest', () => {
  it('swaps name/description/lang for de', () => {
    setLang('de');
    const m = translateManifest(BASE, 'de');
    expect(m.name).toContain('Orbis');
    expect(m.lang).toBe('de');
    expect(m.description).toBe('Wettervorhersage, Live-Weltkarte und interaktives 3D-Sonnensystem');
  });

  it('swaps name/description/lang for en, keeping the rest', () => {
    setLang('en');
    const m = translateManifest(BASE, 'en');
    expect(m.name).toBe('Orbis – Weather, Earth & Space');
    expect(m.description).toBe('Weather forecast, live world map and interactive 3D solar system');
    expect(m.lang).toBe('en');
    expect(m.short_name).toBe('Orbis'); // brand, language-neutral
  });
});
