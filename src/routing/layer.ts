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
    m.addLayer({ id: `${ALT}-casing`, type: 'line', source: ALT, layout: cap, paint: { 'line-color': '#3c4043', 'line-width': 9.5 } });
    m.addLayer({ id: ALT, type: 'line', source: ALT, layout: cap, paint: { 'line-color': '#9aa0a6', 'line-width': 6 } });
    m.addLayer({ id: `${MAIN}-casing`, type: 'line', source: MAIN, layout: cap, paint: { 'line-color': '#174ea6', 'line-width': 11 } });
    m.addLayer({ id: MAIN, type: 'line', source: MAIN, layout: cap, paint: { 'line-color': '#4285f4', 'line-width': 7.5 } });
    m.addLayer({ id: DONE, type: 'line', source: DONE, layout: cap, paint: { 'line-color': '#9aa0a6', 'line-width': 7.5, 'line-opacity': 0.95 } });
    // start / via: ring dots; destination: red pin
    m.addLayer({
      id: STOPS,
      type: 'circle',
      source: STOPS,
      filter: ['!=', ['get', 'kind'], 'end'],
      paint: { 'circle-radius': 6.5, 'circle-color': '#fff', 'circle-stroke-color': ['match', ['get', 'kind'], 'start', '#4285f4', '#5f6368'], 'circle-stroke-width': 3.5 },
    });
    this.addPin();
  }

  /** the red destination pin, drawn once into the map's image store */
  private addPin() {
    const m = this.map;
    const scale = 2;
    const w = 26 * scale;
    const h = 36 * scale;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#ea4335';
    ctx.beginPath();
    ctx.moveTo(13, 1.5);
    ctx.bezierCurveTo(6.6, 1.5, 2, 6.4, 2, 12.5);
    ctx.bezierCurveTo(2, 20.5, 13, 33, 13, 33);
    ctx.bezierCurveTo(13, 33, 24, 20.5, 24, 12.5);
    ctx.bezierCurveTo(24, 6.4, 19.4, 1.5, 13, 1.5);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(13, 12.5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (!m.hasImage('route-pin')) m.addImage('route-pin', ctx.getImageData(0, 0, w, h), { pixelRatio: scale });
    m.addLayer({
      id: `${STOPS}-end`,
      type: 'symbol',
      source: STOPS,
      filter: ['==', ['get', 'kind'], 'end'],
      layout: { 'icon-image': 'route-pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
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
