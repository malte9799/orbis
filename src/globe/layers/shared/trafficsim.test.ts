import { describe, expect, it } from 'vitest';
import { MAX_CARS, TrafficSim, bucketOf, makeRoad, tomtomClass } from './trafficsim';

const line = (n: number): [number, number][] => Array.from({ length: n }, (_, i) => [13.4 + i * 0.002, 52.5]);

describe('trafficsim', () => {
  it('Straßenlänge in Metern, zu kurze Linien fallen weg', () => {
    const r = makeRoad('a', line(2), { speed: 10, perKm: 5, oneway: 0, level: null })!;
    expect(r.len).toBeGreaterThan(130);
    expect(r.len).toBeLessThan(150);
    expect(makeRoad('b', [[13.4, 52.5], [13.40001, 52.5]], { speed: 10, perKm: 5, oneway: 0, level: null })).toBeNull();
  });

  it('Fahrzeuge bleiben auf der Linie und fahren weiter', () => {
    const sim = new TrafficSim();
    sim.setRoads([makeRoad('a', line(20), { speed: 14, perKm: 20, oneway: 1, level: null })!]);
    expect(sim.count).toBeGreaterThan(0);
    const before = JSON.stringify(sim.toGeoJSON());
    for (let i = 0; i < 30; i++) sim.step(0.066);
    const after = sim.toGeoJSON();
    expect(JSON.stringify(after)).not.toBe(before);
    for (const f of after.features) {
      const [x, y] = f.geometry.coordinates[0][0];
      expect(x).toBeGreaterThanOrEqual(13.4 - 1e-4);
      expect(x).toBeLessThanOrEqual(13.4 + 19 * 0.002 + 1e-4);
      expect(y).toBeCloseTo(52.5, 4);
    }
  });

  it('Stau: mehr Fahrzeuge, rot; Obergrenze wird eingehalten', () => {
    const free = new TrafficSim();
    const jam = new TrafficSim();
    free.setRoads([makeRoad('a', line(40), { speed: 14, perKm: 9, oneway: 1, level: 1 })!]);
    jam.setRoads([makeRoad('a', line(40), { speed: 14, perKm: 9, oneway: 1, level: 0.2 })!]);
    expect(jam.count).toBeGreaterThan(free.count);
    expect(jam.toGeoJSON(0).features[0].properties!.c).toBe('#e05252');
    const many = new TrafficSim();
    many.setRoads(Array.from({ length: 400 }, (_, i) => makeRoad(`r${i}`, line(40), { speed: 14, perKm: 14, oneway: 0, level: null })!));
    expect(many.count).toBeLessThanOrEqual(MAX_CARS + 400);
  });

  it('Klassen und Lage-Stufen', () => {
    expect(tomtomClass('Motorway').speed).toBe(25);
    expect(bucketOf(0.9)).toBe('free');
    expect(bucketOf(0.6)).toBe('slow');
    expect(bucketOf(0.3)).toBe('jam');
  });
});

describe('trafficsim: Stabilität', () => {
  it('Nachladen derselben Straße lässt Fahrzeuge unverändert', () => {
    const sim = new TrafficSim();
    const mk = () => makeRoad('a', line(30), { speed: 14, perKm: 20, oneway: 1, level: null })!;
    sim.setRoads([mk()], () => true);
    const before = JSON.stringify(sim.toGeoJSON());
    sim.setRoads([mk()], () => true);
    expect(JSON.stringify(sim.toGeoJSON())).toBe(before);
  });
});
