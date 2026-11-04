import { describe, expect, it } from 'vitest';
import { catalogOf, GEFAHREN_MENU, pruneMenu, radioMenu } from './catalog';
import { STANDARD } from './karten';
import type { TrafficCat } from './menus';

describe('Karte "Gefahren"', () => {
  it('is a standard Karte steered by the gefahren menu', () => {
    const k = STANDARD.find((x) => x.id === 'gefahren');
    expect(k?.menu).toBe('gefahren');
    expect(radioMenu('gefahren').cats).toBe(GEFAHREN_MENU);
    // the start category and its default layers must exist
    expect(GEFAHREN_MENU.some((c) => c.id === k?.tmode)).toBe(true);
    for (const l of k!.layers) expect(catalogOf(l.id)).toBeTruthy();
  });

  it('lists only layers that exist in the catalog', () => {
    for (const c of GEFAHREN_MENU) {
      expect(c.rows.length).toBeGreaterThan(0);
      for (const id of [...(c.defaults ?? []), ...c.rows.flatMap((r) => r.layers)]) expect(catalogOf(id), id).toBeTruthy();
    }
  });

  it('has the sections Unwetter and Ereignisse', () => {
    expect(GEFAHREN_MENU.map((c) => c.id)).toEqual(expect.arrayContaining(['unwetter', 'ereignisse']));
  });
});

describe('pruneMenu', () => {
  const cats: TrafficCat[] = [
    { id: 'a', label: 'A', icon: 'pin', defaults: ['x', 'gone'], rows: [{ label: 'X', layers: ['x'] }, { label: 'G', layers: ['gone'] }] },
    { id: 'b', label: 'B', icon: 'pin', defaults: ['gone'], rows: [{ label: 'G', layers: ['gone'] }] },
  ];
  const out = pruneMenu(cats, (id) => id === 'x');

  it('drops unknown layers, empty rows and empty categories', () => {
    expect(out.map((c) => c.id)).toEqual(['a']);
    expect(out[0].defaults).toEqual(['x']);
    expect(out[0].rows).toEqual([{ label: 'X', layers: ['x'] }]);
  });

  it('keeps a row once its layer exists', () => {
    expect(pruneMenu(cats, () => true)).toHaveLength(2);
  });
});
