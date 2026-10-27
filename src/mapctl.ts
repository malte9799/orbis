import type { Map as MlMap } from 'maplibre-gl';

/** Camera control column shared by the Earth and planet maps: zoom +/−, 2D/3D with tilt slider, compass. */

export interface MapCtlHooks {
  zoomBy(delta: number): void;
  /** tilt in degrees (0 = top-down); animated for the 2D/3D button, immediate while the slider is dragged */
  setPitch(deg: number, animate: boolean): void;
  resetNorth(): void;
}

export interface MapCtl {
  /** wrapper with `display: contents`: its three button groups flow in the parent column */
  el: HTMLElement;
  setBearing(deg: number): void;
  syncPitch(deg: number): void;
  /** the tilt the slider's 100 % stands for (changes with the zoom) */
  setMaxTilt(deg: number): void;
  /** true while the tilt slider is being dragged */
  dragging(): boolean;
}

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const MINUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';

/** compass dial: the tick ring turns against the map bearing, the red marker on it points north, the letter is the heading */
const compassDial = () => {
  // 14 slots; the one at north is left out, the red marker sits there and turns with the ring
  const ticks = Array.from({ length: 13 }, (_, i) => `<line x1="22" y1="4.5" x2="22" y2="8" transform="rotate(${(i + 1) * (360 / 14)} 22 22)" stroke-width="1.3"/>`).join('');
  return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="21.5" class="disc"/><g class="ring"><g stroke="#fff" stroke-linecap="round" opacity=".8">${ticks}</g><path d="M22 1.5l2.6 4.4h-5.2z" fill="#ff4d3d"/></g><text x="22" y="22" class="hd" text-anchor="middle" dominant-baseline="central">N</text></svg>`;
};

/** the slider runs 0–100 % of the map's maximum tilt; at 0 it is 2D again */
const TILT_MAX = 60;
const TILT_START = 75;

export function createMapCtl(hooks: MapCtlHooks): MapCtl {
  const el = document.createElement('div');
  el.className = 'mapctl';
  el.innerHTML = `
    <div class="hud-cg">
      <button type="button" data-k="zin" title="Hineinzoomen" aria-label="Hineinzoomen">${PLUS}</button>
      <button type="button" data-k="zout" title="Herauszoomen" aria-label="Herauszoomen">${MINUS}</button>
    </div>
    <div class="hud-cg hud-tilt">
      <button type="button" data-k="tilt" class="hud-tbtn" title="Neigung" aria-label="Kamera neigen">3D</button>
      <div class="hud-tsl"><input type="range" min="0" max="100" step="1" value="${TILT_START}" aria-label="Neigung" tabindex="-1"/></div>
    </div>
    <div class="hud-cg">
      <button type="button" data-k="north" class="hud-compass" title="Norden ausrichten" aria-label="Norden ausrichten">${compassDial()}</button>
    </div>`;

  const tiltBtn = el.querySelector<HTMLButtonElement>('.hud-tbtn')!;
  const tiltSl = el.querySelector<HTMLElement>('.hud-tsl')!;
  const tiltIn = tiltSl.querySelector('input')!;
  let tiltOpen = false;
  let tiltDrag = false;
  let tiltClick = 0;
  let tiltMax = TILT_MAX;
  let lastPitch = 0;
  const toPitch = (v: number) => (v / 100) * tiltMax;

  function showTilt(open: boolean) {
    tiltOpen = open;
    tiltSl.classList.toggle('open', open);
    tiltIn.tabIndex = open ? 0 : -1;
    tiltBtn.textContent = open ? '2D' : '3D';
  }
  tiltIn.addEventListener('input', () => {
    if (!tiltOver) hooks.setPitch(toPitch(Number(tiltIn.value)), false);
  });
  tiltIn.addEventListener('change', () => {
    if (Number(tiltIn.value) > 0) return;
    tiltClick = performance.now();
    showTilt(false);
    hooks.setPitch(0, true);
  });
  tiltIn.addEventListener('pointerdown', () => (tiltDrag = true));
  // the mouse leaving the scale at the top stretches the tilt softly beyond its maximum (like the map drag)
  let tiltOver = false;
  window.addEventListener('pointermove', (e) => {
    if (!tiltDrag) return;
    const r = tiltIn.getBoundingClientRect();
    const frac = (r.bottom - 6 - e.clientY) / (r.height - 12); // 0 at the bottom end, 1 at the top
    if (frac <= 1) {
      tiltOver = false;
      return;
    }
    tiltOver = true;
    const extra = (frac - 1) * tiltMax;
    hooks.setPitch(tiltMax + TILT_STRETCH * Math.log(1 + extra / TILT_STRETCH), false);
  });
  window.addEventListener('pointerup', () => {
    if (tiltDrag && tiltOver) hooks.setPitch(tiltMax, true);
    tiltDrag = false;
    tiltOver = false;
  });

  el.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
    if (k === 'zin') hooks.zoomBy(1);
    else if (k === 'zout') hooks.zoomBy(-1);
    else if (k === 'north') hooks.resetNorth();
    else if (k === 'tilt') {
      tiltClick = performance.now();
      showTilt(!tiltOpen);
      if (tiltOpen) tiltIn.value = String(TILT_START);
      hooks.setPitch(tiltOpen ? toPitch(TILT_START) : 0, true);
    }
  });

  return {
    el,
    dragging: () => tiltDrag,
    setMaxTilt(m) {
      tiltMax = m;
      if (!tiltDrag) tiltIn.value = String(Math.min(100, Math.round((lastPitch / tiltMax) * 100)));
    },
    syncPitch(p) {
      lastPitch = p;
      if (!tiltDrag) tiltIn.value = String(Math.min(100, Math.round((p / tiltMax) * 100)));
      // right after a click the camera is still easing: the button decides, the pitch events must not flip it back
      const settling = performance.now() - tiltClick < 700;
      if (p > 0.5) {
        if (!settling || tiltOpen) showTilt(true);
      } else if (!tiltDrag && tiltOpen && !settling) showTilt(false);
    },
    setBearing(deg) {
      el.style.setProperty('--hud-bearing', `${-deg}deg`);
      const heading = ['N', 'O', 'S', 'W'][Math.round((((deg % 360) + 360) % 360) / 90) % 4];
      const t = el.querySelector<SVGTextElement>('.hud-compass .hd')!;
      if (t.dataset.h !== heading) {
        // fade the old letter out, swap, fade the new one in
        t.dataset.h = heading;
        t.style.opacity = '0';
        window.setTimeout(() => {
          t.textContent = t.dataset.h!;
          t.style.opacity = '1';
        }, 120);
      }
    },
  };
}

/** Tilting only makes sense once zoomed in: below this zoom the 2D/3D button is hidden and a tilt eases back to flat.
 *  Rotation is likewise reset to north when zoomed out far. */
export const TILT_MIN_ZOOM = 3;
/** Below this zoom the map is always north-up: a rotation eases back. */
export const NORTH_MAX_ZOOM = 5;
/** Free rotation (an eighth turn) while zoomed out that far, then the resistance grows linearly with the angle (no end: the screen edge stops the mouse first). */
const ROTATE_FREE = 22.5;
const ROTATE_SOFT = 10;
/** Zoomed out, a tilt can only be stretched a little (about 10° after a long drag). */
const TILT_STRETCH = 3;
/** Degrees above the map's max tilt that the engine allows, so the full 3D tilt can be stretched softly too. */
const TILT_ROOM = 15;
const MAX_ENGINE_PITCH = 85;

/** how far the camera may tilt at a zoom: one eased curve over the whole range, 30° from zoom 2 and below up to 85° from
 *  zoom 12,5 on, no fixed break points in between. */
export const tiltLimit = (zoom: number): number => {
  const t = Math.min(1, Math.max(0, (zoom - 2) / 10.5));
  return 30 + 55 * t * t * (3 - 2 * t); // smoothstep
};

export function bindTiltLimit(map: MlMap, ctl: MapCtl) {
  const tilt = ctl.el.querySelector<HTMLElement>('.hud-tilt')!;
  const sync = () => tilt.classList.toggle('off', map.getZoom() < TILT_MIN_ZOOM);
  // The allowed tilt follows the zoom continuously (see tiltLimit): the engine's max tilt moves with it, so
  // zooming out carries a too-steep tilt down frame by frame. Only while the user drags a tilt (and while it
  // eases back afterwards) the engine gets some room above the limit for the soft stretch. The transform is
  // written through the camera: map.setMaxPitch() fires move events that would restart the running animation.
  let drag: { x: number; y: number; rawB: number; pitch: number } | null = null;
  let down = false;
  let easing = false;
  let sliderDrag = false;
  /** the room above the limit stays while the camera eases back after a drag */
  const settle = () => {
    easing = true;
    window.setTimeout(() => {
      easing = false;
      applyLimit();
    }, 700);
  };
  const camera = (map as unknown as { _camera: { applyTransformChange(change: (tr: { setMaxPitch(p: number): void; setPitch(p: number): void }) => void): void } })._camera;
  let baseMax = tiltLimit(map.getZoom());
  const applyLimit = () => {
    baseMax = tiltLimit(map.getZoom());
    const room = drag || down || easing || ctl.dragging() ? TILT_ROOM : 0;
    const want = Math.min(MAX_ENGINE_PITCH, baseMax + room);
    if (Math.abs(map.getMaxPitch() - want) > 1e-6) {
      camera.applyTransformChange((tr) => tr.setMaxPitch(want));
      map.triggerRepaint();
    }
    ctl.setMaxTilt(baseMax);
    // zoomed back in without having moved: the tilt that was set before the zoom-out comes back
    if (map.getZoom() >= TILT_MIN_ZOOM && !(drag || down || easing || ctl.dragging())) {
      const target = Math.min(wanted, baseMax);
      if (Math.abs(map.getPitch() - target) > 0.05) {
        restoring = true;
        camera.applyTransformChange((tr) => tr.setPitch(target));
        map.triggerRepaint();
        restoring = false;
        ctl.syncPitch(map.getPitch());
      }
    }
  };
  // the tilt the user chose: it survives a zoom-out (which squeezes it to the limit) until the map is moved
  let wanted = map.getPitch();
  let restoring = false;
  map.on('pitch', () => {
    if (!restoring && !easing) wanted = map.getPitch();
  });
  for (const ev of ['dragstart', 'rotatestart'] as const) map.on(ev, () => (wanted = map.getPitch()));
  applyLimit();
  map.on('zoom', applyLimit);
  map.on('zoom', sync);
  // Zoomed out, the drag rotation is our own (MapLibre's cannot be damped from outside): an eighth turn
  // follows the mouse 1:1, beyond that the resistance grows linearly, so the angle ends
  // softly instead of hitting a wall. Tilt (zoom 3–5) is part of the same ctrl/right-button drag.
  const soft = (raw: number) => {
    const a = Math.abs(raw);
    if (a <= ROTATE_FREE) return raw;
    // the resistance (1 / rate) grows linearly with the excess: there is no end, the screen edge is the limit
    const over = a - ROTATE_FREE;
    return Math.sign(raw) * (ROTATE_FREE + ROTATE_SOFT * Math.log(1 + over / ROTATE_SOFT));
  };
  const useOwn = () => map.getZoom() < NORTH_MAX_ZOOM;
  const syncRotate = () => {
    if (useOwn()) map.dragRotate.disable();
    else map.dragRotate.enable();
    // the two-finger tilt would bypass the stretch: off while zoomed out
    if (map.getZoom() < TILT_MIN_ZOOM) map.touchPitch.disable();
    else map.touchPitch.enable();
  };
  map.getCanvasContainer().addEventListener(
    'mousedown',
    (e) => {
      if (!useOwn() || !(e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey)))) return;
      e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, rawB: map.getBearing(), pitch: map.getZoom() < TILT_MIN_ZOOM ? 0 : map.getPitch() };
      applyLimit();
    },
    true,
  );
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    drag.rawB += (e.clientX - drag.x) * 0.8;
    drag.pitch -= (e.clientY - drag.y) * 0.5;
    drag.x = e.clientX;
    drag.y = e.clientY;
    // zoomed out the tilt is only a slight stretch (same kind of resistance), then it rebounds on release
    const rawP = Math.max(0, drag.pitch);
    const stretch = (x: number) => TILT_STRETCH * Math.log(1 + x / TILT_STRETCH);
    const pitch = map.getZoom() < TILT_MIN_ZOOM ? stretch(rawP) : rawP <= baseMax ? rawP : baseMax + stretch(rawP - baseMax);
    map.jumpTo({ bearing: soft(drag.rawB), pitch });
  });
  window.addEventListener('mouseup', () => {
    drag = null;
    applyLimit();
  });
  map.getCanvasContainer().addEventListener('contextmenu', (e) => useOwn() && e.preventDefault());
  map.on('zoom', syncRotate);
  syncRotate();

  // The rebound waits for the pointer to be released (a drag fires move events of its own along the way).
  const rebound = () => {
    if (down || ctl.dragging()) return;
    const z = map.getZoom();
    const pitchNow = map.getPitch();
    const flat = z < TILT_MIN_ZOOM ? pitchNow > 0.5 : pitchNow > baseMax + 0.5;
    const turned = z < NORTH_MAX_ZOOM && Math.abs(map.getBearing()) > 0.5;
    if (flat || turned) {
      settle();
      map.easeTo({ ...(flat ? { pitch: z < TILT_MIN_ZOOM ? 0 : baseMax } : {}), ...(turned ? { bearing: 0 } : {}), duration: 450 });
    }
  };
  map.getCanvasContainer().addEventListener('pointerdown', () => {
    down = true;
    applyLimit();
  });
  // the slider's drag (it stretches beyond its end, too)
  window.addEventListener('pointerdown', () => {
    sliderDrag = ctl.dragging();
    applyLimit();
  });
  window.addEventListener('pointerup', () => {
    if (!sliderDrag) return;
    sliderDrag = false;
    settle();
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    rebound();
    applyLimit();
  });
  window.addEventListener('pointercancel', () => (down = false));
  // zoomed out while rotated/tilted (wheel, buttons): ease back once the camera stops
  map.on('moveend', () => {
    easing = false;
    applyLimit();
    rebound();
  });
  sync();
}
