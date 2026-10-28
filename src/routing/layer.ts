import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { thin } from './geo';
import type { LngLat, Route } from './types';

// The route on the map: alternatives (grey), the chosen route (blue, with the stretch already driven dimmed) and the
// stops. Added once; the map's style is never replaced, so the layers stay.

const ALT = 'route-alt';
const MAIN = 'route-main';
const DONE = 'route-done';
const STOPS = 'route-stops';

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
const line = (c: LngLat[], props: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: c } });

export class RouteLayer {
  constructor(private map: MlMap) {
    this.ensure();
  }

  private ensure() {
    const m = this.map;
    if (m.getSource(MAIN)) return;
    for (const id of [ALT, MAIN, DONE, STOPS]) m.addSource(id, { type: 'geojson', data: empty() });
    const cap = { 'line-cap': 'round', 'line-join': 'round' } as const;
    // below the labels is not needed: the style has no label layer that would hide behind a route
    m.addLayer({ id: `${ALT}-casing`, type: 'line', source: ALT, layout: cap, paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.7 } });
    m.addLayer({ id: ALT, type: 'line', source: ALT, layout: cap, paint: { 'line-color': '#8896b3', 'line-width': 5.5 } });
    m.addLayer({ id: `${MAIN}-casing`, type: 'line', source: MAIN, layout: cap, paint: { 'line-color': '#0b1b4d', 'line-width': 11, 'line-opacity': 0.85 } });
    m.addLayer({ id: MAIN, type: 'line', source: MAIN, layout: cap, paint: { 'line-color': '#3d7bff', 'line-width': 7 } });
    m.addLayer({ id: DONE, type: 'line', source: DONE, layout: cap, paint: { 'line-color': '#7d8aa8', 'line-width': 7, 'line-opacity': 0.9 } });
    m.addLayer({
      id: STOPS,
      type: 'circle',
      source: STOPS,
      paint: {
        'circle-radius': ['match', ['get', 'kind'], 'end', 9, 7],
        'circle-color': ['match', ['get', 'kind'], 'end', '#e5484d', 'start', '#2f9e44', '#ffffff'],
        'circle-stroke-color': ['match', ['get', 'kind'], 'via', '#3d7bff', '#ffffff'],
        'circle-stroke-width': 3,
      },
    });
  }

  private set(id: string, f: Feature[]) {
    this.ensure();
    (this.map.getSource(id) as GeoJSONSource).setData({ type: 'FeatureCollection', features: f });
  }

  /** `routes[active]` is drawn as the route, the others as alternatives */
  show(routes: Route[], active: number) {
    this.set(MAIN, routes[active] ? [line(thin(routes[active].geometry, 2))] : []);
    this.set(
      ALT,
      routes.flatMap((r, i) => (i === active ? [] : [line(thin(r.geometry, 2), { i })])),
    );
    this.set(DONE, []);
  }

  stops(points: LngLat[]) {
    this.set(
      STOPS,
      points.map((p, i): Feature => ({ type: 'Feature', properties: { kind: i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'via' }, geometry: { type: 'Point', coordinates: p } })),
    );
  }

  /** the stretch already driven, drawn dim over the route (`upTo` = vertex index, `point` = snapped position) */
  progress(geometry: LngLat[], upTo: number, point: LngLat) {
    this.set(DONE, upTo >= 0 ? [line([...geometry.slice(0, upTo + 1), point])] : []);
  }

  /** which alternative was clicked, if any */
  pickAlternative(point: { x: number; y: number }): number | null {
    const box: [[number, number], [number, number]] = [
      [point.x - 8, point.y - 8],
      [point.x + 8, point.y + 8],
    ];
    const hit = this.map.queryRenderedFeatures(box, { layers: [ALT] })[0];
    return hit ? Number(hit.properties?.i) : null;
  }

  /** fits the camera to the route */
  fit(geometry: LngLat[], padding: { top: number; right: number; bottom: number; left: number }) {
    let w = 180, s = 90, e = -180, n = -90;
    for (const [x, y] of geometry) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
    this.map.fitBounds([[w, s], [e, n]], { padding, duration: 900, maxZoom: 17, bearing: 0, pitch: 0 });
  }

  clear() {
    for (const id of [ALT, MAIN, DONE, STOPS]) this.set(id, []);
  }
}
