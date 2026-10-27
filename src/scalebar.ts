/** Map scale bar: a rounded track with alternating light/dark segments, the distances above it and the zoom level below. */
import type { Map as MlMap } from 'maplibre-gl';
import { opt } from './units';

const MAX_PX = 170;
/** labels need room: a segment is at least this wide */
const MIN_SEG_PX = 32;
const EARTH_RADIUS_M = 6371008.8;

interface Unit {
  big: [string, number]; // label, metres
  small: [string, number];
}
const UNITS: Record<string, Unit> = {
  km: { big: ['km', 1000], small: ['m', 1] },
  mi: { big: ['mi', 1609.344], small: ['ft', 0.3048] },
  nmi: { big: ['sm', 1852], small: ['ft', 0.3048] },
};

const fmt = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** ground distance in metres between two points on a sphere of the given radius */
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }, r: number): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** the scale steps as [segment length, segment count] per decade, at most 3 segments:
 *  (0 5 10) (0 5 10 15) (0 12,5) (0 12,5 25) (0 12,5 25 37,5) (0 25 50) (0 25 50 75) (0 50 100) (0 50 100 150), then ×10 … */
const STEPS: [number, number][] = [
  [5, 2],
  [5, 3],
  [12.5, 1],
  [12.5, 2],
  [12.5, 3],
  [25, 2],
  [25, 3],
  [50, 2],
  [50, 3],
];
const DECADES = [0.001, 0.01, 0.1, 1, 10];

/** a single 12,5-segment only shows up after the 15 step (10 · 15 · 12,5 · 25 …), so it enters later than its length says */
const enter = (total: number, n: number) => (n === 1 ? total * 1.6 : total);

/** the step (in `unit`) that is due at `maxUnits`, with room for the labels */
function fit(maxUnits: number): { seg: number; n: number } {
  const pow = 10 ** Math.floor(Math.log10(maxUnits));
  let best = { seg: 0, n: 1 };
  let bestAt = 0;
  for (const d of DECADES) {
    for (const [m, n] of STEPS) {
      const seg = m * pow * d;
      const total = seg * n;
      const at = enter(total, n);
      if (at <= maxUnits && (seg / maxUnits) * MAX_PX >= MIN_SEG_PX && at > bestAt) (best = { seg, n }), (bestAt = at);
    }
  }
  if (!best.seg) {
    // no step has room for its labels: take the widest one that fits anyway
    for (const d of DECADES) for (const [m, n] of STEPS) if (m * pow * d * n <= maxUnits && m * pow * d * n > best.seg * best.n) best = { seg: m * pow * d, n };
  }
  return best;
}

/** radius: body radius in metres (Earth by default) */
export function createScaleBar(map: MlMap, radius: () => number = () => EARTH_RADIUS_M, position: 'bottom-left' | 'bottom-right' = 'bottom-left') {
  const el = document.createElement('div');
  el.className = 'maplibregl-ctrl scalebar';
  el.setAttribute('aria-hidden', 'true');

  const update = () => {
    // measured around the middle of the map: there the globe is always under the points, even zoomed far out
    const c = map.getContainer();
    const x = c.clientWidth / 2;
    const y = c.clientHeight / 2;
    const meters = haversine(map.unproject([x - MAX_PX / 2, y]), map.unproject([x + MAX_PX / 2, y]), radius());
    if (!Number.isFinite(meters) || meters <= 0) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const u = UNITS[opt('dist') ?? 'km'] ?? UNITS.km;
    const [label, perUnit] = meters >= u.big[1] ? u.big : u.small;
    const { seg, n } = fit(meters / perUnit);
    const width = ((seg * n * perUnit) / meters) * MAX_PX;
    const segW = width / n;
    const marks = Array.from({ length: n + 1 }, (_, i) => {
      // the last label starts at its tick (there is room to the right on the left side of the map), otherwise it ends at the bar
      const pos = i === 0 ? 'left:0' : i === n ? (position === 'bottom-left' ? `left:${i * segW - 7}px` : 'right:0') : `left:${i * segW}px;transform:translateX(-50%)`;
      return `<span style="${pos}">${fmt(seg * i)}${i === n ? ` ${label}` : ''}</span>`;
    }).join('');
    const bar = Array.from({ length: n }, (_, i) => `<i class="${i % 2 ? 'dk' : 'lt'}" style="width:${segW}px"></i>`).join('');
    el.style.width = `${width}px`;
    el.innerHTML = `<div class="sb-marks">${marks}</div><div class="sb-bar">${bar}</div><div class="sb-zoom">Zoom ${map.getZoom().toFixed(1).replace('.', ',')}</div>`;
  };

  map.addControl({ onAdd: () => { update(); map.on('move', update); map.on('resize', update); return el; }, onRemove: () => { map.off('move', update); map.off('resize', update); el.remove(); } }, position);
  return { update };
}
