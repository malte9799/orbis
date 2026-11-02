import type { Map as MlMap } from 'maplibre-gl';
import { cameraHeld, cameraRelease } from '../../mapctl';
import { EARTH_RADIUS_M, type Vec3 } from './frame';
import type { GeoStage, GeoTarget } from './stage';

// Keeps the camera on an object: dragging turns around it, the wheel zooms towards it, and it stays in
// the middle of the screen while it moves.
//
// MapLibre only turns around a point on the ground, so the map centre is put where the line of sight
// through the object meets the ground. The flat camera can do better (it has a centre elevation), the
// globe camera ignores that. During the blend both are mixed like the map itself.
//
// The map's own handlers are off meanwhile: they would be cancelled by every camera update of a
// moving object, and left drag would pan. All of the camera state lives here. Nothing turns rotation and
// tilt back while following; when it ends the camera eases straight back to what the map allows there.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** focus can look flatter than the map normally allows, nearly along the ground */
const FOCUS_MAX_PITCH = 85;
const FLY_IN_MS = 900;
const WHEEL_ZOOM_PER_PIXEL = 0.002;
/** time constant of the zoom smoothing (s) */
const ZOOM_SMOOTH_S = 0.08;
const BEARING_PER_PIXEL = 0.8;
const PITCH_PER_PIXEL = 0.5;
/** further than this the pointer did not click */
const DRAG_PX = 4;
/** time constant of a turn asked for by a button (s), and when it has arrived (degrees) */
const AIM_SMOOTH_S = 0.12;
const AIM_DONE_DEG = 0.05;
/** the map centre moved further than this without us (degrees) */
const OTHER_CAMERA_DEG = 1e-6;
/** the camera stays this far from the object on the globe: at most (radii), and in share of its way */
const MIN_GAP_RADII = 0.1;
const MIN_GAP_SHARE = 0.3;
const MAX_CENTRE_LAT = 85;

const HANDLERS = ['scrollZoom', 'boxZoom', 'dragRotate', 'dragPan', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch'] as const;

/**
 * The place from which, looking along `bearing` (degrees from north, as measured there), lon / lat lies
 * `angle` radians straight behind. A compass direction changes along a great circle, so simply going
 * that way from lon / lat would miss it.
 */
export function placeAhead(lon: number, lat: number, bearing: number, angle: number): [number, number] {
  const sinP = Math.sin(rad(lat));
  // sin(lat) = sin(x) cos(angle) - cos(x) sin(angle) cos(bearing), solved for the latitude x
  const a = Math.cos(angle);
  const b = -Math.sin(angle) * Math.cos(rad(bearing));
  // close to the pole there is no such place: as near as it gets
  const x = Math.asin(Math.max(-1, Math.min(1, sinP / Math.hypot(a, b)))) - Math.atan2(b, a);
  const dLon = Math.atan2(-Math.sin(rad(bearing)) * Math.sin(angle) * Math.cos(x), Math.cos(angle) - Math.sin(x) * sinP);
  return [lon - deg(dLon), deg(x)];
}

/** Way from the ground point to the object along the line of sight, in earth radii. */
export function sightToObject(altM: number, pitch: number): number {
  const r = 1 + altM / EARTH_RADIUS_M;
  const c = Math.cos(rad(pitch));
  return -c + Math.sqrt(c * c + r * r - 1);
}

/** Map centre that puts the object in the middle of the screen; `t`: how much of a globe the map is. */
export function focusCentre(p: Vec3, bearing: number, pitch: number, t: number): [number, number] {
  const s = sightToObject(p[2], pitch);
  const a = rad(pitch);
  // the object is seen from the camera's side of the centre, so the centre is further ahead
  const angle = Math.atan2(s * Math.sin(a), 1 + s * Math.cos(a));
  return placeAhead(p[0], p[1], bearing, angle * t);
}

/** Zoom, independent of latitude (the zoom of the map is this plus log2(cos lat)) at which the camera on the globe is still clear of the object. */
export function maxFocusZoom(altM: number, pitch: number, toCentre: number): number {
  const s = sightToObject(altM, pitch);
  const distance = s + Math.min(MIN_GAP_RADII, s * MIN_GAP_SHARE);
  return s > 0 ? Math.log2((toCentre * 2 * Math.PI) / (512 * distance)) : Infinity;
}

const latScale = (lat: number) => Math.log2(Math.cos(rad(Math.max(-MAX_CENTRE_LAT, Math.min(MAX_CENTRE_LAT, lat)))));

/** Between two places along the great circle. */
function slerp(a: [number, number], b: [number, number], k: number): [number, number] {
  const v = (p: [number, number]) => [Math.cos(rad(p[1])) * Math.cos(rad(p[0])), Math.cos(rad(p[1])) * Math.sin(rad(p[0])), Math.sin(rad(p[1]))];
  const [p, q] = [v(a), v(b)];
  const d = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  if (d < 1e-9) return b;
  const [k1, k2] = [Math.sin((1 - k) * d) / Math.sin(d), Math.sin(k * d) / Math.sin(d)];
  const [x, y, z] = [k1 * p[0] + k2 * q[0], k1 * p[1] + k2 * q[1], k1 * p[2] + k2 * q[2]];
  return [deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))];
}

export class GeoFocus {
  target: GeoTarget | null = null;
  private listeners: ((target: GeoTarget | null) => void)[] = [];
  private raf = 0;
  private startedAt = 0;
  private lastTick = 0;
  private from: [number, number] = [0, 0];
  private bearing = 0;
  private pitch = 0;
  /** zoom independent of latitude: wanted and shown */
  private wanted = 0;
  private zoom = 0;
  private restore: { handlers: string[]; clamped: boolean; touchAction: string } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private last = '';
  /** the pointer travelled since it went down: what follows is the end of a drag, not a click */
  private dragged = false;
  private travel = 0;
  /** where the buttons want the camera; a drag takes over */
  private aimBearing: number | null = null;
  private aimPitch: number | null = null;
  /** the centre set last: a different one means someone else moves the camera */
  private lastCentre: [number, number] = [0, 0];

  constructor(
    private map: MlMap,
    private stage: GeoStage,
  ) {}

  /** `fn` hears about every change of the followed object. */
  listen(fn: (target: GeoTarget | null) => void) {
    this.listeners.push(fn);
  }

  private changed() {
    for (const fn of this.listeners) fn(this.target);
  }

  /**
   * A click on the map (CSS px): focuses what it hits, ends the focus when it hits nothing. True: the click
   * is used up. False: it is free for whatever else is at that point, also when it ended the focus.
   */
  click(x: number, y: number): boolean {
    if (this.dragged) {
      this.dragged = false;
      return true;
    }
    // the followed object itself: stays followed
    if (this.target && this.stage.hits(this.target, x, y)) return true;
    const target = this.stage.pick(x, y);
    if (!target) {
      this.stop();
      return false;
    }
    this.start(target);
    return true;
  }

  /** The zoom buttons, while following. False: not following, the map does it itself. */
  zoomBy(delta: number): boolean {
    if (!this.target) return false;
    this.wanted += delta;
    return true;
  }

  /** The tilt control, while following. */
  setPitch(deg: number, animate: boolean): boolean {
    if (!this.target) return false;
    if (animate) this.aimPitch = deg;
    else {
      this.aimPitch = null;
      this.pitch = deg;
    }
    return true;
  }

  /** The compass, while following. */
  setBearing(deg: number): boolean {
    if (!this.target) return false;
    this.aimBearing = deg;
    return true;
  }

  start(target: GeoTarget) {
    const map = this.map;
    map.stop();
    this.target?.released?.();
    this.target = target;
    target.entered?.();
    this.changed();
    const c = map.getCenter();
    this.from = [c.lng, c.lat];
    this.lastCentre = [c.lng, c.lat];
    this.aimBearing = this.aimPitch = null;
    this.bearing = map.getBearing();
    this.pitch = map.getPitch();
    this.zoom = this.wanted = map.getZoom() - latScale(c.lat);
    this.startedAt = performance.now();
    if (this.restore) return; // on to another object: everything is set up already
    const handlers = HANDLERS.filter((h) => map[h].isEnabled());
    for (const h of handlers) map[h].disable();
    const box = map.getCanvasContainer();
    this.restore = { handlers, clamped: map.getCenterClampedToGround(), touchAction: box.style.touchAction };
    // north-up and the tilt limit of the zoomed-out map would turn the camera back
    cameraHeld.add(map);
    map.setMaxPitch(FOCUS_MAX_PITCH);
    map.setCenterClampedToGround(false);
    box.style.touchAction = 'none';
    // capture: the app has wheel listeners of its own on the map
    box.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    box.addEventListener('pointerdown', this.onDown);
    box.addEventListener('pointermove', this.onMove);
    box.addEventListener('pointerup', this.onUp);
    box.addEventListener('pointercancel', this.onUp);
    box.addEventListener('contextmenu', this.onContext);
    window.addEventListener('keydown', this.onKey);
    map.on('move', this.onCameraMove);
    this.lastTick = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** `handedOver`: someone else flies the camera already, so it must not be touched. */
  stop(handedOver = false) {
    if (!this.target) return;
    this.target.released?.();
    this.target = null;
    this.changed();
    this.last = '';
    this.dragged = false;
    cancelAnimationFrame(this.raf);
    this.stage.clock = null;
    this.pointers.clear();
    const map = this.map;
    const box = map.getCanvasContainer();
    box.removeEventListener('wheel', this.onWheel, { capture: true });
    box.removeEventListener('pointerdown', this.onDown);
    box.removeEventListener('pointermove', this.onMove);
    box.removeEventListener('pointerup', this.onUp);
    box.removeEventListener('pointercancel', this.onUp);
    box.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('keydown', this.onKey);
    map.off('move', this.onCameraMove);
    const r = this.restore!;
    this.restore = null;
    for (const h of r.handlers) map[h as (typeof HANDLERS)[number]].enable();
    box.style.touchAction = r.touchAction;
    cameraHeld.delete(map);
    map.setCenterClampedToGround(r.clamped);
    if (handedOver) {
      // written through the camera (as in mapctl.ts): a camera call would end the flight that just began
      (map as unknown as { _camera: { applyTransformChange(change: (tr: { setElevation(e: number): void }) => void): void } })._camera.applyTransformChange((tr) => tr.setElevation(0));
      return;
    }
    // back down to the ground as well, the map does not know anything else
    const back = { elevation: 0 };
    const release = cameraRelease.get(map);
    if (release) release(back);
    else map.easeTo({ ...back, duration: 450 });
  }

  private tick = (now: number) => {
    const target = this.target;
    if (!target) return;
    this.raf = requestAnimationFrame(this.tick);
    const time = performance.now();
    const p = target.position(time);
    if (!p) {
      this.stop();
      return;
    }
    this.stage.clock = time;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    const frame = this.stage.frame;
    const t = frame?.t ?? 1;
    // nearer on the globe would put the camera behind the object; the flat map has no such limit
    if (t > 0) this.wanted = Math.min(this.wanted, maxFocusZoom(p[2], this.pitch, frame?.pxDistance ?? 1));
    const raw = Math.min(1, (time - this.startedAt) / FLY_IN_MS);
    const k = raw * raw * (3 - 2 * raw);
    const aim = focusCentre(p, this.bearing, this.pitch, t);
    const centre = k < 1 ? slerp(this.from, aim, k) : aim;
    const map = this.map;
    // a wheel turned on at the limit must not have to be turned all the way back
    const scale = latScale(centre[1]);
    this.wanted = Math.max(map.getMinZoom() + 0.05 - scale, Math.min(map.getMaxZoom() - scale, this.wanted));
    this.zoom += (this.wanted - this.zoom) * (1 - Math.exp(-dt / ZOOM_SMOOTH_S));
    this.aimCamera(dt);
    const zoom = this.zoom + scale;
    const state = `${centre[0]}|${centre[1]}|${zoom}|${this.bearing}|${this.pitch}|${p[2] * k}`;
    if (state === this.last) return;
    this.last = state;
    // a camera update of ours, for whoever listens to the move events
    map.jumpTo({ center: centre, zoom, bearing: this.bearing, pitch: this.pitch, elevation: p[2] * k }, { geo3dFocus: true });
    const c = map.getCenter();
    this.lastCentre = [c.lng, c.lat];
  };

  /** Eases towards what the buttons asked for. */
  private aimCamera(dt: number) {
    const k = 1 - Math.exp(-dt / AIM_SMOOTH_S);
    if (this.aimBearing !== null) {
      const delta = ((this.aimBearing - this.bearing + 540) % 360) - 180;
      this.bearing += Math.abs(delta) < AIM_DONE_DEG ? delta : delta * k;
      if (Math.abs(delta) < AIM_DONE_DEG) this.aimBearing = null;
    }
    if (this.aimPitch !== null) {
      const delta = this.aimPitch - this.pitch;
      this.pitch += Math.abs(delta) < AIM_DONE_DEG ? delta : delta * k;
      if (Math.abs(delta) < AIM_DONE_DEG) this.aimPitch = null;
    }
  }

  /** A flight or a jump from elsewhere (search, a panel): that wins, the focus lets go. A resize keeps the centre. */
  private onCameraMove = (e: object) => {
    if ((e as { geo3dFocus?: boolean }).geo3dFocus) return;
    const c = this.map.getCenter();
    const dLng = ((c.lng - this.lastCentre[0] + 540) % 360) - 180;
    if (Math.abs(dLng) > OTHER_CAMERA_DEG || Math.abs(c.lat - this.lastCentre[1]) > OTHER_CAMERA_DEG) this.stop(true);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // lines (mouse wheels in some browsers) are about 40 pixels
    const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    this.wanted -= delta * WHEEL_ZOOM_PER_PIXEL;
  };

  private onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.travel = 0;
    this.dragged = false;
    this.aimBearing = this.aimPitch = null;
    this.map.getCanvasContainer().setPointerCapture?.(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.travel += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (this.travel > DRAG_PX) this.dragged = true;
    const others = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId);
    if (others.length === 1) {
      // two fingers: spread to zoom, turn to turn
      const other = others[0][1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0 && after > 0) this.wanted += Math.log2(after / before);
      const angle = (x: number, y: number) => deg(Math.atan2(y - other.y, x - other.x));
      this.bearing -= ((angle(e.clientX, e.clientY) - angle(prev.x, prev.y) + 540) % 360) - 180;
    } else if (others.length === 0) {
      this.bearing += (e.clientX - prev.x) * BEARING_PER_PIXEL;
      this.pitch = Math.max(0, Math.min(FOCUS_MAX_PITCH, this.pitch - (e.clientY - prev.y) * PITCH_PER_PIXEL));
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
  };

  private onContext = (e: Event) => e.preventDefault();

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.stop();
  };
}
