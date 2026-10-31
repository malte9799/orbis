import type { GlFrame } from './radargl';
import { t as m } from '../i18n';

// Radar data for the WebGL layer (src/globe/radargl.ts): the tiles are read back into *values*,
// the colours come from one scale (LUT) in the shader.
//   RainViewer  measurements worldwide. Their tiles carry a fixed colour ramp (weak echoes tan with
//               growing alpha, then light → dark blue, then yellow → red → pink); it is read back
//               into a rain rate here.

/** first byte value that means "no measurement" (the composites write 255) */
export const NODATA_MIN = 250;

// mm/h → colour. Interpolated on a log scale, so light rain stays readable and heavy rain glows.
// Zoom Earth's legend: blue → violet → magenta → salmon → yellow.
const STOPS: [number, [number, number, number, number]][] = [
  [0.002, [150, 205, 255, 0]],
  [0.01, [150, 205, 255, 175]], // even 0.01 mm/h is a clearly blue veil, bright enough over dark imagery
  [0.05, [140, 198, 255, 195]],
  [0.2, [120, 180, 252, 210]],
  [0.6, [100, 158, 246, 222]],
  [1.5, [85, 120, 238, 230]],
  [3, [125, 90, 225, 236]],
  [6, [190, 75, 180, 242]],
  [10, [228, 85, 135, 246]],
  [20, [244, 130, 100, 249]],
  [40, [250, 190, 85, 252]],
  [80, [255, 240, 95, 255]],
];

/** byte value → RGBA (0 and ≥ NODATA_MIN stay transparent) */
export const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let v = 1; v < NODATA_MIN; v++) {
    const mmh = (v / 25) ** 2;
    let k = 0;
    while (k < STOPS.length - 2 && mmh > STOPS[k + 1][0]) k++;
    const [m0, c0] = STOPS[k];
    const [m1, c1] = STOPS[k + 1];
    const t = Math.max(0, Math.min(1, Math.log(mmh / m0) / Math.log(m1 / m0)));
    for (let c = 0; c < 4; c++) lut[v * 4 + c] = c0[c] + (c1[c] - c0[c]) * t;
  }
  return lut;
})();

export const rainRate = (byte: number) => (byte / 25) ** 2;

export function rainLabel(mmh: number): string {
  if (mmh < 0.5) return m('map.rain.l1');
  if (mmh < 2.5) return m('map.rain.l2');
  if (mmh < 10) return m('map.rain.l3');
  if (mmh < 50) return m('map.rain.l4');
  return m('map.rain.l5');
}

// ---- RainViewer ----------------------------------------------------------------------------
const rateByte = (mmh: number) => (mmh < 0.002 ? 0 : Math.min(NODATA_MIN - 1, Math.round(Math.sqrt(mmh) * 25)));

/** weakest RainViewer haze that is still drawn (alpha < 100 is not shown by zoom.earth either) */
const TAN_MIN_ALPHA = 100;

const WARM: [number, number, number, number][] = [
  [255, 238, 0, 36],
  [255, 170, 0, 42],
  [255, 68, 0, 48],
  [193, 0, 0, 55],
  [255, 170, 255, 62],
];

/** RGBA of a RainViewer tile pixel → rain rate [mm/h] (rough dBZ anchors, Marshall-Palmer) */
function rainviewerRate(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 0;
  let dbz: number;
  if (a < 255 && b <= g) {
    if (a < TAN_MIN_ALPHA) return 0;
    dbz = 2 + ((a - 20) / 170) * 13; // tan: 2 … 15 dBZ
  } else if (r > 150 && !(b > r && g < 200)) {
    let best = WARM[0];
    let bd = Infinity;
    for (const w of WARM) {
      const d = (w[0] - r) ** 2 + (w[1] - g) ** 2 + (w[2] - b) ** 2;
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    dbz = best[3];
  } else {
    // blues: R falls 136 → 0, then G falls 163 → 85
    const p = r > 0 ? ((136 - r) / 136) * 0.25 : 0.25 + ((163 - g) / (163 - 85)) * 0.75;
    dbz = 15 + Math.max(0, Math.min(1, p)) * 20;
  }
  return (10 ** (dbz / 10) / 200) ** 0.625;
}

/** pixels of an image blob (RGBA) */
async function readPixels(blob: Blob): Promise<{ data: Uint8ClampedArray; size: number }> {
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const cx = c.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(bmp, 0, 0);
  return { data: cx.getImageData(0, 0, bmp.width, bmp.height).data, size: bmp.width };
}

/** One RainViewer step as a source of value tiles for the WebGL layer. */
export function rainviewerFrame(host: string, path: string, timeMs: number, maxzoom: number): GlFrame {
  return {
    time: timeMs,
    key: `rv:${host}${path}`,
    maxzoom,
    async fetchTile(z, x, y) {
      const res = await fetch(`${host}${path}/256/${z}/${x}/${y}/2/1_0.png`);
      if (res.status === 404) return null; // no tile there: no rain
      if (!res.ok) throw new Error(`HTTP ${res.status}`); // 429 / 5xx: the layer asks again later
      const { data, size } = await readPixels(await res.blob());
      const bytes = new Uint8Array(size * size);
      for (let i = 0; i < bytes.length; i++) bytes[i] = rateByte(rainviewerRate(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]));
      return { bytes, size };
    },
  };
}
