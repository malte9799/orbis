import type { Map as MlMap } from 'maplibre-gl';
import { angleDiff, lerpAngle } from './geo';
import { Gps, type Fix, type GpsStatus } from './gps';
import { Puck } from './puck';
import type { LngLat } from './types';

/**
 * "Where am I": GPS, the arrow on the map and the camera that follows it.
 *  off      – nothing runs
 *  track    – the arrow shows, the camera is free
 *  follow   – the camera keeps the arrow centred, north stays up
 *  heading  – the camera also turns with the heading (the way you look is up)
 */
export type LocMode = 'off' | 'track' | 'follow' | 'heading';

export interface NavCamera {
  /** tilt in degrees (0 = from above) */
  pitch: number;
  /** zoom for this speed in m/s */
  zoom(speed: number): number;
  /** share of the screen height the arrow sits below the centre (0–0.5) */
  lower: number;
}

export interface LocatorHooks {
  onMode(mode: LocMode): void;
  onStatus(s: GpsStatus): void;
  /** every filtered fix; return a position on the route to draw the arrow there instead */
  onFix(fix: Fix): LngLat | void;
}

export class Locator {
  readonly gps = new Gps();
  readonly puck: Puck;
  mode: LocMode = 'off';
  private cam: NavCamera | null = null;
  private driving = false;
  private userZoom = 0;
  private camBearing = 0;
  private camZoom = 0;
  private lastFrame = 0;
  private firstFix = true;
  private wantCenter = false;

  constructor(
    private map: MlMap,
    private hooks: LocatorHooks,
    private onFirstFix: (lat: number, lon: number) => void,
  ) {
    this.puck = new Puck(map);
    this.puck.onFrame = (pos, heading) => this.frame(pos, heading);
    this.gps.onStatus = (s) => {
      hooks.onStatus(s);
      if (s === 'denied' || s === 'unavailable') this.set('off');
    };
    this.gps.onFix = (f) => this.fix(f);
    // the user takes the camera: following ends. Our own moves have no originalEvent.
    for (const ev of ['dragstart', 'rotatestart'] as const) {
      map.on(ev, (e) => {
        if ((e as { originalEvent?: Event }).originalEvent && (this.mode === 'follow' || this.mode === 'heading')) this.set('track');
      });
    }
    // zooming by wheel / pinch / buttons while following: keep the zoom the user chose
    map.on('zoomend', () => {
      if (!this.driving && this.following() && this.camZoom) this.userZoom = map.getZoom() - this.camZoom;
    });
  }

  private following = () => this.mode === 'follow' || this.mode === 'heading';

  /** navigation camera (tilted, zoom by speed, arrow low on the screen); null = plain follow */
  setNavCamera(c: NavCamera | null) {
    this.cam = c;
    this.userZoom = 0;
    if (c && this.puck.position()) {
      const speed = this.gps.fix?.speed ?? 0;
      this.camZoom = c.zoom(speed);
      this.map.easeTo({ pitch: c.pitch, zoom: this.camZoom, duration: 800 });
    } else if (!c) {
      this.map.easeTo({ pitch: 0, duration: 600, padding: { ...this.map.getPadding(), top: 0 } });
    }
  }

  set(mode: LocMode) {
    if (mode === this.mode) return;
    const prev = this.mode;
    this.mode = mode;
    if (mode === 'off') {
      this.gps.stop();
      this.puck.hide();
      this.firstFix = true;
      if (this.map.getPadding().top) this.map.setPadding({ ...this.map.getPadding(), top: 0 });
    } else {
      if (prev === 'off') {
        this.puck.show();
        this.gps.start();
        // iOS asks for the compass inside this tap
        void this.gps.startCompass();
      }
      if (this.following()) this.centre();
      if (mode === 'heading') this.camBearing = this.map.getBearing();
      if (mode === 'track' && this.map.getPadding().top) this.map.setPadding({ ...this.map.getPadding(), top: 0 });
    }
    this.hooks.onMode(mode);
  }

  /** locate button: off → follow → heading → off */
  cycle() {
    const next: Record<LocMode, LocMode> = { off: 'follow', track: 'follow', follow: 'heading', heading: 'off' };
    this.set(next[this.mode]);
  }

  /** fly to the arrow (as soon as there is a position) */
  private centre() {
    const pos = this.puck.position();
    if (!pos) {
      this.wantCenter = true;
      return;
    }
    this.wantCenter = false;
    const z = this.map.getZoom();
    this.map.easeTo({ center: pos, zoom: z < 15 ? 16 : z, duration: 900, essential: true, bearing: this.mode === 'heading' ? this.map.getBearing() : 0 });
  }

  private fix(f: Fix) {
    const snapped = this.hooks.onFix(f) || undefined;
    this.puck.setFix(f, snapped);
    this.puck.setHeading(this.gps.heading()?.deg ?? null, this.gps.heading()?.source === 'gps' ? this.gps.heading()!.deg : null);
    if (this.firstFix) {
      this.firstFix = false;
      this.onFirstFix(f.lat, f.lon);
      if (this.wantCenter && this.following()) this.centre();
    }
  }

  /** every animation frame while the arrow is shown */
  private frame(pos: LngLat, heading: number | null) {
    // the heading changes faster than fixes arrive: refresh it here
    const h = this.gps.heading();
    this.puck.setHeading(h?.deg ?? null, h?.source === 'gps' ? h.deg : null);
    if (!this.following() || this.map.isMoving()) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const opts: { center: LngLat; bearing?: number; zoom?: number; padding?: { left: number; right: number; top: number; bottom: number } } = { center: pos };
    if (this.mode === 'heading' && heading != null) {
      // steady the turning: a dead zone against compass flutter, the rest eased
      const diff = angleDiff(this.camBearing, heading);
      if (Math.abs(diff) > 1.5 || (this.gps.fix?.speed ?? 0) > 2) this.camBearing = lerpAngle(this.camBearing, heading, 1 - Math.exp(-dt / 0.35));
      opts.bearing = this.camBearing;
    }
    if (this.cam) {
      const target = this.cam.zoom(this.gps.fix?.speed ?? 0);
      this.camZoom = this.camZoom ? this.camZoom + (target - this.camZoom) * (1 - Math.exp(-dt / 1.5)) : target;
      opts.zoom = this.camZoom + this.userZoom;
      const p = this.map.getPadding();
      const top = Math.round(this.map.getContainer().clientHeight * this.cam.lower * 2);
      if (p.top !== top) opts.padding = { left: p.left ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0, top };
    }
    this.driving = true;
    this.map.jumpTo(opts);
    this.driving = false;
  }
}
