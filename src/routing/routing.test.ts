import { describe, expect, it } from 'vitest';
import { fmt } from '../util';
import { t } from '../i18n';
import { angleDiff, bearing, cumulative, decodePolyline, haversine, lerpAngle, meanAngle, snapToLine, thin } from './geo';
import { headingFromOrientation } from './gps';
import { newGuideState, prepare, progress } from './guidance';
import { parseOsrm, type OsrmRoute } from './osrm';
import { fromGoogle, fromOsrm, fromValhalla, instruction } from './text';
import { spokenDistance } from './speech';
import type { LngLat, Route } from './types';

const close = (a: number, b: number, eps = 0.5) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('geo', () => {
  it('measures distances and bearings', () => {
    close(haversine([13.4, 52.5], [13.4, 52.6]) / 1000, 11.12, 0.05);
    close(bearing([0, 0], [0, 1]), 0);
    close(bearing([0, 0], [1, 0]), 90);
    close(bearing([0, 0], [0, -1]), 180);
    close(bearing([0, 0], [-1, 0]), 270);
  });

  it('takes the short way around the compass', () => {
    close(angleDiff(350, 10), 20);
    close(angleDiff(10, 350), -20);
    close(lerpAngle(350, 10, 0.5), 0);
    close(meanAngle([350, 10]) ?? -1, 0);
    expect(meanAngle([])).toBeNull();
  });

  it('decodes polylines (Google example, precision 5)', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toHaveLength(3);
    close(pts[0][1], 38.5, 1e-6);
    close(pts[0][0], -120.2, 1e-6);
    close(pts[2][1], 43.252, 1e-6);
    close(pts[2][0], -126.453, 1e-6);
  });

  it('snaps a position onto the line and tells the distance along it', () => {
    const line: LngLat[] = [[0, 0], [0.01, 0], [0.01, 0.01]];
    const cum = cumulative(line);
    const s = snapToLine(line, cum, [0.005, 0.0003])!;
    expect(s.index).toBe(0);
    close(s.offset, 33.4, 1);
    close(s.along, haversine([0, 0], [0.005, 0]), 1);
    close(s.bearing, 90);
    // only looking ahead of segment 1: the first leg is out of reach
    expect(snapToLine(line, cum, [0.005, 0.0003], 1)!.index).toBe(1);
  });

  it('thins a line but keeps both ends', () => {
    const line: LngLat[] = Array.from({ length: 100 }, (_, i) => [i * 0.00001, 0]);
    const t = thin(line, 5);
    expect(t[0]).toEqual(line[0]);
    expect(t[t.length - 1]).toEqual(line[99]);
    expect(t.length).toBeLessThan(40);
  });
});

describe('compass', () => {
  it('flat phone: the heading is the top edge', () => {
    // alpha 0 = top towards north; alpha 90 = turned counter-clockwise → top towards west (270)
    close(headingFromOrientation(0, 0, 0)!, 0, 1);
    close(headingFromOrientation(90, 0, 0)!, 270, 1);
    close(headingFromOrientation(270, 0, 0)!, 90, 1);
  });

  it('upright phone: the heading is where the back faces', () => {
    // beta 90 = held upright facing the user; alpha 0 → the back looks north
    close(headingFromOrientation(0, 90, 0)!, 0, 1);
    close(headingFromOrientation(90, 90, 0)!, 270, 1);
  });

  it('landscape turns the screen up-direction', () => {
    close(headingFromOrientation(0, 0, 0, 90)!, 90, 1);
  });

  it('gives nothing for a phone lying face down', () => {
    expect(headingFromOrientation(0, 180, 0)).toBeNull();
  });
});

describe('providers', () => {
  const osrm: OsrmRoute = {
    distance: 1500,
    duration: 200,
    geometry: { coordinates: [[13.4, 52.5], [13.41, 52.5], [13.41, 52.51]] },
    legs: [
      {
        summary: 'Hauptstraße',
        steps: [
          { distance: 800, duration: 100, name: 'Hauptstraße', maneuver: { type: 'depart', location: [13.4, 52.5] } },
          { distance: 700, duration: 100, name: 'Nebenweg', maneuver: { type: 'turn', modifier: 'left', location: [13.41, 52.5] } },
          { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [13.41, 52.51] } },
        ],
      },
    ],
  };

  it('writes German instructions from OSRM manoeuvres', () => {
    const [r] = parseOsrm([osrm], 'fossgis', 'car');
    expect(r.steps.map((s) => s.maneuver)).toEqual(['depart', 'left', 'arrive']);
    expect(r.steps[1].text).toBe(`${t('routing.text.left')}${t('routing.text.onto', { name: 'Nebenweg' })}`);
    expect(r.steps[2].text).toBe(t('routing.text.arrive'));
    expect(r.summary).toBe('Hauptstraße');
  });

  it('keeps the provider sentence when asked', () => {
    const local = structuredClone(osrm);
    local.legs[0].steps[1].maneuver.instruction = 'Biegen Sie links ab';
    expect(parseOsrm([local], 'mapbox', 'car', true)[0].steps[1].text).toBe('Biegen Sie links ab');
  });

  it('turns via-point arrivals into plain steps', () => {
    const two: OsrmRoute = { ...osrm, legs: [osrm.legs[0], osrm.legs[0]] };
    const steps = parseOsrm([two], 'fossgis', 'car')[0].steps;
    expect(steps.filter((s) => s.maneuver === 'arrive')).toHaveLength(1);
  });

  it('maps the vocabularies', () => {
    expect(fromOsrm('turn', 'sharp right')).toBe('sharp-right');
    expect(fromOsrm('new name', 'straight')).toBe('straight');
    expect(fromOsrm('fork', 'slight left')).toBe('fork-left');
    expect(fromValhalla(15)).toBe('left');
    expect(fromValhalla(26)).toBe('roundabout');
    expect(fromGoogle('TURN_SLIGHT_RIGHT')).toBe('slight-right');
    expect(fromGoogle(undefined)).toBe('straight');
    expect(instruction('roundabout', 'Ring', 2)).toBe(
      `${t('routing.text.roundabout')}. ${t('routing.text.exitNote', { ord: t('routing.text.ord.2') })}${t('routing.text.towards', { name: 'Ring' })}`,
    );
  });

  it('says distances like a person', () => {
    expect(spokenDistance(430)).toBe(t('routing.say.m', { n: 450 }));
    expect(spokenDistance(1480)).toBe(t('routing.say.km', { n: fmt.num(1.5, 1) }));
  });
});

describe('guidance', () => {
  // 1 km east, then 1 km north
  const geometry: LngLat[] = [[13.4, 52.5], [13.4146, 52.5], [13.4146, 52.509]];
  const route: Route = {
    provider: 't',
    profile: 'car',
    geometry,
    distance: 2000,
    duration: 240,
    steps: [
      { maneuver: 'depart', text: 'Losfahren', name: '', distance: 1000, duration: 120, at: geometry[0] },
      { maneuver: 'left', text: 'Links abbiegen', name: '', distance: 1000, duration: 120, at: geometry[1] },
      { maneuver: 'arrive', text: 'Ziel erreicht', name: '', distance: 0, duration: 0, at: geometry[2] },
    ],
  };
  const prep = prepare(route);

  it('locates the manoeuvres along the line', () => {
    close(prep.stepAt[0], 0);
    close(prep.stepAt[1], 1000, 15);
    close(prep.stepAt[2], prep.length, 1);
  });

  it('tracks progress, next manoeuvre and the time left', () => {
    const st = newGuideState();
    const p = progress(prep, [13.4073, 52.5], 5, st)!;
    expect(p.next).toBe(1);
    close(p.toNext, 500, 15);
    close(p.remainingTime, 180, 10);
    expect(p.arrived).toBe(false);
  });

  it('flips to the next manoeuvre once the first is passed', () => {
    const st = newGuideState();
    const p = progress(prep, [13.4146, 52.5045], 5, st)!;
    expect(p.next).toBe(2);
  });

  it('notices leaving the route and arriving', () => {
    const st = newGuideState();
    expect(progress(prep, [13.4073, 52.502], 5, st)).toBeNull();
    expect(st.strays).toBe(1);
    expect(progress(prep, [13.4073, 52.502], 5, st)).toBeNull();
    expect(st.strays).toBe(2);
    const back = progress(prep, [13.4073, 52.5], 5, st)!;
    expect(back).not.toBeNull();
    expect(st.strays).toBe(0);
    expect(progress(prep, geometry[2], 5, newGuideState())!.arrived).toBe(true);
  });

  it('is generous with a bad GPS signal', () => {
    // 60 m beside the line, but the signal is only good to 40 m
    expect(progress(prep, [13.4073, 52.50054], 40, newGuideState())).not.toBeNull();
    expect(progress(prep, [13.4073, 52.50054], 5, newGuideState())).toBeNull();
  });
});
