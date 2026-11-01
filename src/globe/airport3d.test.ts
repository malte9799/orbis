import { describe, expect, it } from 'vitest';
import type { Feature, LineString } from 'geojson';
import { runwayFor } from './airport3d';

type LineFeature = Feature<LineString>;

// Two parallel runways 500 m apart (e.g. 25C/25L), both heading 90° (west → east), 3 km long.
const M_PER_DEG = 111320;
const cosLa = Math.cos((49 * Math.PI) / 180);
const NORTH_LAT = 49 + 0.0045;
const SOUTH_LAT = 49;
/** west end → east end: the western end is the approach threshold (07) */
const eastWest = (lat: number): LineFeature => ({
  type: 'Feature',
  properties: { kind: 'runway' },
  geometry: { type: 'LineString', coordinates: [[7 - 1500 / (M_PER_DEG * cosLa), lat], [7 + 1500 / (M_PER_DEG * cosLa), lat]] },
});
/** aircraft `m` metres before the threshold of a runway at `lat`, on its centre line */
const approaching = (m: number, lat: number): [number, number] => [7 - (1500 + m) / (M_PER_DEG * cosLa), lat];

describe('runwayFor picks the runway the aircraft is actually on', () => {
  it('between two parallel runways it takes the one whose centre line the aircraft follows', () => {
    const lines = [eastWest(NORTH_LAT), eastWest(SOUTH_LAT)];
    // final on the northern runway: 8 km out, on its line, heading 90
    const [lon, lat] = approaching(8000, NORTH_LAT);
    const r = runwayFor(lines, lon, lat, 90)!;
    expect(r.hdg).toBe(90);
    expect(r.thLat).toBeCloseTo(NORTH_LAT, 3);
    expect(r.thLon).toBeCloseTo(7 - 1500 / (M_PER_DEG * cosLa), 6);
    // same, but for the southern centre line
    const r2 = runwayFor(lines, ...approaching(8000, SOUTH_LAT), 90)!;
    expect(r2.thLat).toBeCloseTo(SOUTH_LAT, 3);
  });

  it('in the middle between two parallels (steep turn to final) the closer centre line wins, deterministically', () => {
    const lines = [eastWest(NORTH_LAT), eastWest(SOUTH_LAT)];
    const midLat = (NORTH_LAT + SOUTH_LAT) / 2;
    const r = runwayFor(lines, ...approaching(6000, midLat), 90)!;
    expect(r.thLat === NORTH_LAT || r.thLat === SOUTH_LAT).toBe(true);
  });

  it('an aircraft already past a runway does not align to it again', () => {
    const lines = [eastWest(NORTH_LAT)];
    // 10 km after the far end of a 3 km runway in the flight direction → unusable
    const [lon, lat] = approaching(-13000, NORTH_LAT);
    expect(runwayFor(lines, lon, lat, 90)).toBeNull();
  });

  it('a crossing runway with an equal midpoint distance loses against the centre line being flown', () => {
    // E-W runway at 49°, plus a NE-SW runway whose midpoint sits exactly at the aircraft's final
    const eastWestLine = eastWest(SOUTH_LAT);
    const diag: LineFeature = {
      type: 'Feature',
      properties: { kind: 'runway' },
      // 3 km runway heading 135: centre (7 + 650/(M*cosLa)?, 49 + 650/M)?; simple symmetric piece
      geometry: { type: 'LineString', coordinates: [[7 - 1060 / (M_PER_DEG * cosLa), SOUTH_LAT + 1060 / M_PER_DEG], [7 + 1060 / (M_PER_DEG * cosLa), SOUTH_LAT - 1060 / M_PER_DEG]] },
    };
    const [lon, lat] = approaching(8000, SOUTH_LAT);
    const r = runwayFor([eastWestLine, diag], lon, lat, 90)!;
    expect(r.hdg).toBe(90);
    expect(r.thLat).toBeCloseTo(SOUTH_LAT, 3);
  });
});
