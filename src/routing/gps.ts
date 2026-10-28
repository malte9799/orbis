import { angleDiff, bearing, haversine, lerpAngle, norm } from './geo';
import type { LngLat } from './types';

// Position and heading of the device, cleaned up for a map:
// - position: a Kalman filter over the raw fixes (the weight of a fix follows its reported accuracy), fixes that are
//   far too imprecise or jump impossibly are dropped
// - heading: the GPS course while moving (reliable, but only then), the tilt-compensated compass while standing or
//   walking slowly. The compass is calibrated against the GPS course whenever both are known (corrects declination
//   and how the phone is held).

export interface Fix {
  lon: number;
  lat: number;
  /** estimated error radius in m (after filtering) */
  accuracy: number;
  /** m/s, null if unknown */
  speed: number | null;
  /** timestamp of the raw fix (ms) */
  t: number;
}

export type HeadingSource = 'gps' | 'compass' | 'last';
export interface Heading {
  deg: number;
  source: HeadingSource;
}

export type GpsStatus = 'idle' | 'searching' | 'active' | 'denied' | 'unavailable';

/** a fix worse than this is thrown away (as soon as a better one exists) */
const MAX_ACCURACY = 120;
/** faster than this between two fixes is no car, it is a GPS jump (m/s) */
const MAX_SPEED = 90;
/** from this speed the GPS course is trusted over the compass (m/s) */
const COURSE_SPEED = 2;
/** the course of a fix older than this is no longer current (ms) */
const COURSE_MAX_AGE = 4000;

const rad = (d: number) => (d * Math.PI) / 180;

/** 1-D-per-axis Kalman filter for the position in local metres (constant-position model, noise grows with speed) */
class PositionFilter {
  private lon = 0;
  private lat = 0;
  private variance = -1;
  private t = 0;

  reset() {
    this.variance = -1;
  }

  update(lon: number, lat: number, accuracy: number, t: number, speed: number): { lon: number; lat: number; accuracy: number } {
    const acc = Math.max(accuracy, 3);
    if (this.variance < 0) {
      this.lon = lon;
      this.lat = lat;
      this.variance = acc * acc;
      this.t = t;
      return { lon, lat, accuracy: acc };
    }
    const dt = Math.max(0, (t - this.t) / 1000);
    this.t = t;
    // the true position may have moved by up to `speed` since the last fix (at least walking pace worth of doubt)
    const q = Math.max(speed, 1.5);
    this.variance += dt * q * q;
    const k = this.variance / (this.variance + acc * acc);
    this.lon += (lon - this.lon) * k;
    this.lat += (lat - this.lat) * k;
    this.variance *= 1 - k;
    return { lon: this.lon, lat: this.lat, accuracy: Math.sqrt(this.variance) };
  }
}

/** tilt-compensated heading the user faces from the W3C orientation angles (all degrees) */
export function headingFromOrientation(alpha: number, beta: number, gamma: number, screenAngle = 0): number | null {
  const cA = Math.cos(rad(alpha));
  const sA = Math.sin(rad(alpha));
  const cB = Math.cos(rad(beta));
  const sB = Math.sin(rad(beta));
  const cG = Math.cos(rad(gamma));
  const sG = Math.sin(rad(gamma));
  // back of the device (rear camera): horizontal part of −Z. Well defined when the phone is held upright / tilted.
  const backE = -cA * sG - sA * sB * cG;
  const backN = -sA * sG + cA * sB * cG;
  // top edge of the device: horizontal part of +Y. Well defined when the phone lies flat in the hand. The screen's
  // own "up" is that edge turned by the screen rotation.
  let topE = 0;
  let topN = 0;
  if (cB > 0) {
    const sa = Math.sin(rad(screenAngle));
    const ca = Math.cos(rad(screenAngle));
    const e = -sA * cB;
    const n = cA * cB;
    // rotate clockwise by the screen angle
    topE = e * ca + n * sa;
    topN = -e * sa + n * ca;
  }
  const e = backE + topE;
  const n = backN + topN;
  if (Math.hypot(e, n) < 0.15) return null; // phone flat on its back and face down, or similar: no usable direction
  return norm((Math.atan2(e, n) * 180) / Math.PI);
}

export class Gps {
  fix: Fix | null = null;
  status: GpsStatus = 'idle';
  onFix: (f: Fix) => void = () => {};
  onStatus: (s: GpsStatus) => void = () => {};

  private watchId: number | null = null;
  private filter = new PositionFilter();
  private raw: { lon: number; lat: number; t: number } | null = null;
  private jumps = 0;
  private trail: LngLat[] = [];

  private gpsHeading: number | null = null;
  private gpsHeadingAt = 0;
  private lastSpeed = 0;

  private compassRaw: number | null = null;
  private compassAt = 0;
  private compassOffset = 0;
  private compassListening = false;
  private lastHeading: number | null = null;

  private setStatus(s: GpsStatus) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }

  start() {
    if (this.watchId != null) return;
    if (!navigator.geolocation) {
      this.setStatus('unavailable');
      return;
    }
    this.setStatus('searching');
    this.watchId = navigator.geolocation.watchPosition((p) => this.onPosition(p), (e) => this.onError(e), { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    void this.startCompass();
  }

  stop() {
    this.halt();
    this.setStatus('idle');
  }

  private halt() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.stopCompass();
    this.filter.reset();
    this.raw = null;
    this.trail = [];
    this.gpsHeading = null;
    this.fix = null;
  }

  private onError(e: GeolocationPositionError) {
    // a timeout or a short loss of signal is not the end: the watch keeps trying
    if (e.code === e.PERMISSION_DENIED) {
      this.halt();
      this.setStatus('denied');
    } else if (e.code === e.POSITION_UNAVAILABLE && !this.fix) this.setStatus('unavailable');
  }

  private onPosition(p: GeolocationPosition) {
    const c = p.coords;
    const t = p.timestamp || Date.now();
    if (this.raw && t <= this.raw.t) return; // out of order
    const acc = c.accuracy || 50;
    // too imprecise: only take it while nothing better is known (first coarse fix still helps the first view)
    if (acc > MAX_ACCURACY && this.fix && this.fix.accuracy < acc) return;
    if (this.raw) {
      const dt = (t - this.raw.t) / 1000;
      const jump = haversine([this.raw.lon, this.raw.lat], [c.longitude, c.latitude]);
      // an impossible jump with a mediocre fix is noise; after two in a row it is the new truth (e.g. tunnel exit)
      if (dt > 0 && jump / dt > MAX_SPEED && jump > acc * 2 && this.jumps < 2) {
        this.jumps++;
        return;
      }
    }
    this.jumps = 0;
    const prev = this.fix;
    const speedRaw = c.speed != null && Number.isFinite(c.speed) ? Math.max(0, c.speed) : null;
    const f = this.filter.update(c.longitude, c.latitude, acc, t, speedRaw ?? this.lastSpeed);
    // speed: the device value, otherwise worked out from the movement of the filtered position
    let speed = speedRaw;
    if (speed == null && prev) {
      const dt = (t - prev.t) / 1000;
      if (dt > 0.3) speed = Math.min(MAX_SPEED, haversine([prev.lon, prev.lat], [f.lon, f.lat]) / dt);
    }
    this.lastSpeed = speed ?? 0;
    this.raw = { lon: c.longitude, lat: c.latitude, t };

    this.updateCourse(c.heading, speed, [f.lon, f.lat], f.accuracy);
    this.calibrate(speed);

    this.fix = { lon: f.lon, lat: f.lat, accuracy: f.accuracy, speed, t };
    this.setStatus('active');
    this.onFix(this.fix);
  }

  /** GPS course: the device's own when it gives one, otherwise from the way travelled */
  private updateCourse(devHeading: number | null, speed: number | null, pos: LngLat, accuracy: number) {
    let course: number | null = null;
    if (devHeading != null && Number.isFinite(devHeading) && (speed ?? 0) >= 1) course = norm(devHeading);
    else {
      // distance travelled since the oldest trail point that is far enough away to rise out of the noise
      const need = Math.max(8, accuracy * 1.5);
      for (let i = this.trail.length - 1; i >= 0; i--) {
        if (haversine(this.trail[i], pos) >= need) {
          course = bearing(this.trail[i], pos);
          this.trail.splice(0, i); // older points are not needed any more
          break;
        }
      }
    }
    this.trail.push(pos);
    if (this.trail.length > 30) this.trail.shift();
    if (course == null) return;
    const v = speed ?? 0;
    this.gpsHeading = this.gpsHeading == null ? course : lerpAngle(this.gpsHeading, course, v > 8 ? 0.7 : v > 3 ? 0.5 : 0.35);
    this.gpsHeadingAt = Date.now();
  }

  /** while the GPS course is reliable, learn how far the compass is off (declination, mounting) */
  private calibrate(speed: number | null) {
    if (this.gpsHeading == null || this.compassRaw == null || (speed ?? 0) < 4 || Date.now() - this.compassAt > 1500) return;
    const off = angleDiff(this.compassRaw, this.gpsHeading);
    // a phone in a pocket or bag points anywhere: only a plausible difference counts as calibration
    if (Math.abs(off) > 35) return;
    this.compassOffset += angleDiff(this.compassOffset, off) * 0.08;
  }

  /** current best heading in degrees, null if nothing is known */
  heading(): Heading | null {
    const now = Date.now();
    const gpsFresh = this.gpsHeading != null && now - this.gpsHeadingAt < COURSE_MAX_AGE;
    if (gpsFresh && this.lastSpeed >= COURSE_SPEED) return this.keep({ deg: this.gpsHeading!, source: 'gps' });
    if (this.compassRaw != null && now - this.compassAt < 2500) return this.keep({ deg: norm(this.compassRaw + this.compassOffset), source: 'compass' });
    if (gpsFresh) return this.keep({ deg: this.gpsHeading!, source: 'gps' });
    return this.lastHeading != null ? { deg: this.lastHeading, source: 'last' } : null;
  }

  private keep(h: Heading): Heading {
    this.lastHeading = h.deg;
    return h;
  }

  // ----- compass --------------------------------------------------------------
  private screenAngle = () => screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;

  private onOrientation = (e: Event) => {
    const o = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
    let raw: number | null = null;
    if (typeof o.webkitCompassHeading === 'number' && Number.isFinite(o.webkitCompassHeading)) {
      // iOS: already tilt-compensated and north-referenced, but relative to the device, not the screen
      raw = norm(o.webkitCompassHeading + this.screenAngle());
    } else if ((o.absolute || e.type === 'deviceorientationabsolute') && o.alpha != null && o.beta != null && o.gamma != null) {
      raw = headingFromOrientation(o.alpha, o.beta, o.gamma, this.screenAngle());
    }
    if (raw == null) return;
    const now = Date.now();
    // low-pass: ~0.25 s time constant steadies the jitter of the magnetometer without feeling sluggish
    const dt = this.compassRaw == null ? 1 : Math.min(1, (now - this.compassAt) / 1000);
    this.compassRaw = this.compassRaw == null ? raw : lerpAngle(this.compassRaw, raw, 1 - Math.exp(-dt / 0.25));
    this.compassAt = now;
  };

  /** iOS only shows its compass after the user agreed: call from a tap. Resolves to whether the compass works. */
  async startCompass(): Promise<boolean> {
    if (this.compassListening) return true;
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') return false;
      } catch {
        return false; // not called from a user gesture
      }
    }
    // Chrome/Android: the absolute event is north-referenced; the plain one is relative to an arbitrary start
    const abs = 'ondeviceorientationabsolute' in window;
    window.addEventListener(abs ? 'deviceorientationabsolute' : 'deviceorientation', this.onOrientation as EventListener, true);
    this.compassListening = true;
    return true;
  }

  private stopCompass() {
    if (!this.compassListening) return;
    window.removeEventListener('deviceorientationabsolute', this.onOrientation as EventListener, true);
    window.removeEventListener('deviceorientation', this.onOrientation as EventListener, true);
    this.compassListening = false;
    this.compassRaw = null;
  }
}
