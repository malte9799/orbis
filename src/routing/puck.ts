import { Marker, type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import { circle, destination, lerpAngle } from './geo';
import type { Fix } from './gps';
import type { LngLat } from './types';

// The position on the map: a direction arrow (turns with the heading, lies flat on the ground when the map is tilted)
// and a disc showing how uncertain the position is. Between two GPS fixes (about 1 s) the arrow keeps moving with the
// speed and course, so it glides instead of hopping.

const SRC = 'gps-acc';

const ARROW = `
<div class="gps-puck">
  <svg class="gps-cone" viewBox="-40 -40 80 80" aria-hidden="true"><defs><radialGradient id="gpsCone" cx="0" cy="0" r="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4285f4" stop-opacity=".6"/><stop offset="1" stop-color="#4285f4" stop-opacity="0"/></radialGradient></defs><path d="M0 0 L-19 -37 A42 42 0 0 1 19 -37 Z" fill="url(#gpsCone)"/></svg>
  <svg class="gps-dot" viewBox="-14 -14 28 28" aria-hidden="true"><circle r="12" fill="#fff"/><circle r="8.5" fill="#4285f4"/></svg>
  <svg class="gps-nav" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -16 L12.5 14 L0 7.5 L-12.5 14 Z" fill="#4285f4" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/></svg>
</div>`;

export class Puck {
  private marker: Marker;
  private el: HTMLElement;
  private target: LngLat | null = null;
  private shown: LngLat | null = null;
  private fix: Fix | null = null;
  private fixAt = 0;
  private course: number | null = null;
  private heading = 0;
  private headingShown = 0;
  private hasHeading = false;
  private raf = 0;
  private last = 0;
  private lastDisc = '';
  /** the position the camera should follow: the glided one */
  onFrame: (pos: LngLat, heading: number | null) => void = () => {};

  constructor(private map: MlMap) {
    const wrap = document.createElement('div');
    wrap.innerHTML = ARROW;
    this.el = wrap.firstElementChild as HTMLElement;
    this.marker = new Marker({ element: this.el, rotationAlignment: 'map', pitchAlignment: 'map' });
    this.ensureLayers();
  }

  /** (re)creates the accuracy layers – cheap, and survives a style that was swapped */
  private ensureLayers() {
    if (this.map.getSource(SRC)) return;
    this.map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    this.map.addLayer({ id: SRC, type: 'fill', source: SRC, paint: { 'fill-color': '#4285f4', 'fill-opacity': 0.14, 'fill-outline-color': 'rgba(66,133,244,.45)' } });
  }

  show() {
    this.ensureLayers();
    if (this.raf) return;
    this.marker.setLngLat(this.shown ?? [0, 0]);
    if (this.shown) this.marker.addTo(this.map);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  hide() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.marker.remove();
    this.shown = this.target = null;
    (this.map.getSource(SRC) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    this.lastDisc = '';
  }

  /** a new fix (position may be replaced by a snapped one) */
  setFix(fix: Fix, pos: LngLat = [fix.lon, fix.lat]) {
    this.fix = fix;
    this.fixAt = performance.now();
    this.target = pos;
    if (!this.shown) {
      this.shown = pos;
      this.marker.setLngLat(pos).addTo(this.map);
    }
    this.drawDisc(pos, fix.accuracy);
  }

  /** the heading to show; null = unknown (the cone is hidden) */
  setHeading(deg: number | null, course: number | null = null) {
    this.course = course;
    if (deg == null) {
      this.hasHeading = false;
      this.el.classList.remove('has-heading');
      return;
    }
    if (!this.hasHeading) this.headingShown = deg;
    this.hasHeading = true;
    this.heading = deg;
    this.el.classList.add('has-heading');
  }

  /** navigation look: a chevron instead of the dot (like the map apps while guiding) */
  setNav(on: boolean) {
    this.el.classList.toggle('nav', on);
  }

  /** is the arrow on the map */
  get active() {
    return !!this.shown;
  }

  position(): LngLat | null {
    return this.shown;
  }

  private drawDisc(pos: LngLat, acc: number) {
    // 5 m steps are enough for the eye and spare the map a re-upload every second
    const key = `${pos[0].toFixed(5)},${pos[1].toFixed(5)},${Math.round(acc / 5)}`;
    if (key === this.lastDisc) return;
    this.lastDisc = key;
    (this.map.getSource(SRC) as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: acc > 8 ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(pos, acc)] } }] : [],
    });
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (!this.target || !this.shown) return;
    let want = this.target;
    // glide on along the course until the next fix arrives (at most 2 s, then it is standing still / signal lost)
    const v = this.fix?.speed ?? 0;
    if (this.course != null && v > 1.2) want = destination(this.target, this.course, v * Math.min(2, (now - this.fixAt) / 1000));
    const k = 1 - Math.exp(-dt / 0.3);
    this.shown = [this.shown[0] + (want[0] - this.shown[0]) * k, this.shown[1] + (want[1] - this.shown[1]) * k];
    this.marker.setLngLat(this.shown);
    if (this.hasHeading) {
      this.headingShown = lerpAngle(this.headingShown, this.heading, 1 - Math.exp(-dt / 0.12));
      this.marker.setRotation(this.headingShown);
    }
    this.onFrame(this.shown, this.hasHeading ? this.headingShown : null);
  };
}
