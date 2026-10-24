import type { Map as MlMap } from 'maplibre-gl';
import type { EventKind } from '../api/events';

type Part = { d: string; mode: 'fill' | 'stroke'; width?: number };

export type ExtraGlyph =
  | 'city'
  | 'air'
  | 'gauge'
  | 'warn'
  | 'plane'
  | 'heli'
  | 'glider'
  | 'balloon'
  | 'drone'
  | 'satellite'
  | 'sonde'
  | 'ship'
  | 'cable'
  | 'wind'
  | 'solar'
  | 'plant'
  | 'webcam'
  | 'alpr'
  | 'cone'
  | 'aurora'
  | 'rocket'
  | 'train'
  | 'radiation'
  | 'tsunami'
  | 'bolt'
  | 'airport'
  | 'vessel'
  | 'radio';
export type GlyphId = EventKind | ExtraGlyph;

/** Filled silhouettes (pointing north) for aircraft & objects – used as recolourable SDF icons. */
export const SILHOUETTES: Partial<Record<ExtraGlyph | 'rotor', string>> = {
  plane: 'M12 2c.8 0 1.3.8 1.3 1.8v5.4l7.7 4.6v2l-7.7-2.4v4.8l2.2 1.6v1.7L12 20.6l-3.5 1v-1.7l2.2-1.6v-4.8L3 15.8v-2l7.7-4.6V3.8C10.7 2.8 11.2 2 12 2z',
  // seen from above, the rotor hub in the icon centre: cabin, tail boom and stabiliser (the blades are `rotor`, turned separately)
  heli: 'M12 8.6a2.8 4 0 1 0 0 8a2.8 4 0 1 0 0-8zM11.25 16h1.5v7h-1.5zM9.8 21.6h4.4V23H9.8z',
  rotor: 'M17.87 18.86 L18.86 17.87 L6.13 5.14 L5.14 6.13zM5.14 17.87 L6.13 18.86 L18.86 6.13 L17.87 5.14z',
  glider: 'M11.2 4h1.6v6.5l9.2 1.2v1.6l-9.2-.6V19l2.2 1v1.2H9V20l2.2-1v-6.3l-9.2.6v-1.6l9.2-1.2z',
  balloon: 'M12 2a6 6 0 0 1 6 6c0 3.6-3.4 6.6-5 8h-2c-1.6-1.4-5-4.4-5-8a6 6 0 0 1 6-6zM10 17h4v3.5h-4z',
  drone: 'M5 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm14 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM5 16.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm14 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6.4 5.6L10 9.2h4l3.6-3.6 1.4 1.4-3.6 3.6v2.8l3.6 3.6-1.4 1.4-3.6-3.6h-4l-3.6 3.6L5 17l3.6-3.6v-2.8L5 7z',
  satellite: 'M9 9h6v6H9zM1.5 9.5h6v5h-6zm15 0h6v5h-6zM11.2 4h1.6v5h-1.6zm0 11h1.6v5h-1.6z',
  // ship hull seen from above, bow north
  vessel: 'M12 1.5c2 2 3.3 4.6 3.3 8V20.5c0 1-.8 1.5-1.6 1.5h-3.4c-.8 0-1.6-.5-1.6-1.5V9.5c0-3.4 1.3-6 3.3-8z',
  // viewing direction of a camera: wedge with its tip at the icon centre, opening north
  cone: 'M12 12L6.2 1.6A12 12 0 0 1 17.8 1.6z',
  sonde: 'M12 1.5a5 5 0 0 1 5 5c0 3-2.8 5.3-4.2 6.5h-1.6C9.8 11.8 7 9.5 7 6.5a5 5 0 0 1 5-5zM11.4 13h1.2v5h-1.2zM9.5 18h5v4h-5z',
};

/** White glyphs on a 24×24 grid, drawn on top of a data-driven coloured circle. */
const GLYPHS: Record<GlyphId, Part[]> = {
  fire: [{ mode: 'fill', d: 'M12 2C13 6 17.5 8 17.5 13.5A5.5 5.5 0 0 1 6.5 13.5C6.5 11 7.8 9.2 9.3 8.2C9.4 10 10.3 11.3 11.4 11.7C10.9 8.4 11.2 5 12 2Z' }],
  storm: [
    { mode: 'stroke', width: 2.4, d: 'M14.5 12a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0M14.5 11.5C15 6 9.5 3.5 5 5.5M9.5 12.5C9 18 14.5 20.5 19 18.5' },
  ],
  tornado: [{ mode: 'stroke', width: 2.4, d: 'M3.5 5h17M5.5 9h13M8 13h8M10 17h4.5M11.5 21h2' }],
  quake: [{ mode: 'stroke', width: 2.2, d: 'M2 13h4l2-5 3 10 3-13 3 10 1.5-2H22' }],
  volcano: [
    { mode: 'fill', d: 'M2.5 21L9 10.5l2 2 2-2L21.5 21Z' },
    { mode: 'stroke', width: 1.8, d: 'M10.5 7.5c0-2 2-2 2-4.5M14 8c0-1.6 1.6-1.8 1.6-3.8' },
  ],
  flood: [{ mode: 'stroke', width: 2.2, d: 'M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0' }],
  drought: [
    { mode: 'stroke', width: 2.2, d: 'M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8' },
  ],
  ice: [{ mode: 'stroke', width: 2.2, d: 'M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5' }],
  dust: [{ mode: 'stroke', width: 2.2, d: 'M3 8.5h11a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 16.5h7' }],
  landslide: [{ mode: 'fill', d: 'M3 20L12 6l3.5 5.5L18 9l3 11Z' }],
  heat: [{ mode: 'stroke', width: 2.2, d: 'M12 3a2 2 0 0 0-2 2v9a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2zM12 10v6' }],
  other: [{ mode: 'stroke', width: 2.8, d: 'M12 5v9M12 18.5v.5' }],
  city: [{ mode: 'fill', d: 'M3 21V10l5-3v3l5-3v3h2V3h5v18z' }],
  air: [{ mode: 'stroke', width: 2.2, d: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7' }],
  gauge: [{ mode: 'stroke', width: 2.2, d: 'M8 3v18M8 6h4M8 10h3M8 14h4M8 18h3M15 9l2-3 2 3M17 6v8' }],
  warn: [{ mode: 'stroke', width: 2.4, d: 'M12 3L2.5 20h19zM12 9.5v5M12 17.5v.3' }],
  plane: [{ mode: 'fill', d: SILHOUETTES.plane! }],
  heli: [{ mode: 'fill', d: SILHOUETTES.heli! + SILHOUETTES.rotor! }],
  glider: [{ mode: 'fill', d: SILHOUETTES.glider! }],
  balloon: [{ mode: 'fill', d: SILHOUETTES.balloon! }],
  drone: [{ mode: 'fill', d: SILHOUETTES.drone! }],
  satellite: [{ mode: 'fill', d: SILHOUETTES.satellite! }],
  sonde: [{ mode: 'fill', d: SILHOUETTES.sonde! }],
  ship: [{ mode: 'fill', d: 'M11 2h2v4h4l1 6H6l1-6h4zM2.5 14h19l-3.5 6.5h-12z' }],
  cable: [{ mode: 'stroke', width: 2.2, d: 'M3 17c3-6 6 2 9-4s6 2 9-4M3 17v.1M21 9v.1M7 5h10' }],
  wind: [{ mode: 'stroke', width: 2, d: 'M12 11v11M9 22h6M12 11L12 2.5M12 11l7.5 4.3M12 11l-7.5 4.3' }],
  solar: [{ mode: 'stroke', width: 1.8, d: 'M3 18l3-10h12l3 10zM4.5 13h15M9.3 8l-1.3 10M14.7 8l1.3 10M12 18v4' }],
  plant: [{ mode: 'fill', d: 'M2 21V11l5 3v-3l5 3v-3l5 3V4h4v17z' }],
  webcam: [
    { mode: 'stroke', width: 2, d: 'M17 9.5a5 5 0 1 1-10 0a5 5 0 1 1 10 0M8.5 15.5L7 21h10l-1.5-5.5' },
    { mode: 'fill', d: 'M13.8 9.5a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0' },
  ],
  alpr: [
    { mode: 'fill', d: 'M3 7h13l5-2.5v9L16 11H3z' },
    { mode: 'stroke', width: 2, d: 'M6 11v5M3 19h7' },
  ],
  cone: [{ mode: 'fill', d: 'M12 12L6.2 1.6A12 12 0 0 1 17.8 1.6z' }],
  aurora: [{ mode: 'stroke', width: 2, d: 'M3 18c3-9 6-12 9-12s6 3 9 12M6 18c2-6 4-8 6-8s4 2 6 8M10 18c.6-2 1.2-3 2-3s1.4 1 2 3' }],
  rocket: [
    { mode: 'fill', d: 'M12 1.5c3 2.5 4 6 4 10v4.5H8v-4.5c0-4 1-7.5 4-10z' },
    { mode: 'fill', d: 'M8 12.5l-3 3.5v3l3-1.5zM16 12.5l3 3.5v3l-3-1.5zM10.5 17h3l-.5 4h-2z' },
  ],
  train: [
    { mode: 'fill', d: 'M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z' },
    { mode: 'stroke', width: 2, d: 'M8 21l2-3M16 21l-2-3' },
  ],
  radiation: [
    { mode: 'fill', d: 'M12 10.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6zM10.4 9.2L7.3 3.8A9 9 0 0 0 3 12h6.2a2.8 2.8 0 0 1 1.2-2.8zM13.6 9.2l3.1-5.4A9 9 0 0 1 21 12h-6.2a2.8 2.8 0 0 0-1.2-2.8zM10.6 14.8l-3.1 5.4a9 9 0 0 0 9 0l-3.1-5.4a2.8 2.8 0 0 1-2.8 0z' },
  ],
  bolt: [{ mode: 'fill', d: 'M13.5 2L5 13.5h5.5L9.5 22 19 9.5h-5.8z' }],
  tsunami: [{ mode: 'stroke', width: 2.2, d: 'M2.5 19c3 0 3.5-1.5 6-1.5S12 19 14.5 19s4-1 7-1M3 14.5C6 7 12 4 17.5 6c-3 .5-4.5 3-3.5 5.5 1 2.4 4 2.6 6 1.3' }],
  airport: [{ mode: 'fill', d: SILHOUETTES.plane! }],
  vessel: [{ mode: 'fill', d: SILHOUETTES.vessel! }],
  radio: [
    { mode: 'fill', d: 'M4 9h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 21H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 9z' },
    { mode: 'stroke', width: 2, d: 'M6 8.5L17 3.5' },
  ],
};

const SIZE = 48; // px at pixelRatio 2 → 24 css px

/**
 * Recolourable silhouettes for aircraft, balloons and satellites (`sil-<name>`). MapLibre's
 * SDF icons expect a signed distance field (edge at alpha 0.75), so we compute one from the
 * rasterised shape – this keeps the shapes crisp and lets `icon-halo` work.
 */
export function registerSilhouettes(map: MlMap) {
  const PAD = 6;
  const N = SIZE + 2 * PAD;
  const R = 6; // distance field radius in px
  for (const [name, d] of Object.entries(SILHOUETTES)) {
    const id = `sil-${name}`;
    if (map.hasImage(id)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(PAD, PAD);
    ctx.scale(SIZE / 24, SIZE / 24);
    ctx.fillStyle = '#fff';
    ctx.fill(new Path2D(d));
    const src = ctx.getImageData(0, 0, N, N).data;
    const inside = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) inside[i] = src[i * 4 + 3] > 127 ? 1 : 0;
    const out = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const me = inside[y * N + x];
        let best = R;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= N) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= N || inside[yy * N + xx] === me) continue;
            const dist = Math.hypot(dx, dy) - 0.5;
            if (dist < best) best = dist;
          }
        }
        const signed = me ? -best : best;
        const o = (y * N + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = Math.max(0, Math.min(255, Math.round(255 - 255 * (signed / R + 0.25))));
      }
    }
    map.addImage(id, { width: N, height: N, data: out }, { pixelRatio: 2, sdf: true });
  }
}

/** Weather icons (the same SVGs as in the forecast) as map images: `wx-<code>-<d|n>`. */
export async function ensureWeatherIcons(map: MlMap, keys: { code: number; isDay: boolean }[], svgFor: (code: number, isDay: boolean) => string) {
  const todo = new Map<string, { code: number; isDay: boolean }>();
  for (const k of keys) {
    const id = `wx-${k.code}-${k.isDay ? 'd' : 'n'}`;
    if (!map.hasImage(id)) todo.set(id, k);
  }
  await Promise.all(
    [...todo].map(async ([id, k]) => {
      const svg = svgFor(k.code, k.isDay).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      const img = new Image(64, 64);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      try {
        await img.decode();
      } catch {
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 64, 64);
      if (!map.hasImage(id)) {
        const data = ctx.getImageData(0, 0, 64, 64);
        map.addImage(id, { width: 64, height: 64, data: new Uint8Array(data.data.buffer) }, { pixelRatio: 2 });
      }
    }),
  );
}

export function registerEventIcons(map: MlMap) {
  for (const [kind, parts] of Object.entries(GLYPHS)) {
    const id = `glyph-${kind}`;
    if (map.hasImage(id)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SIZE / 24, SIZE / 24);
    // Shrink glyph slightly so it sits inside the circle
    ctx.translate(12, 12);
    ctx.scale(0.62, 0.62);
    ctx.translate(-12, -12);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of parts) {
      const path = new Path2D(p.d);
      if (p.mode === 'fill') ctx.fill(path);
      else {
        ctx.lineWidth = p.width ?? 2;
        ctx.stroke(path);
      }
    }
    const img = ctx.getImageData(0, 0, SIZE, SIZE);
    map.addImage(id, { width: SIZE, height: SIZE, data: new Uint8Array(img.data.buffer) }, { pixelRatio: 2 });
  }
}

/** Same glyphs as inline SVG for the layer panel. */
export function glyphSvg(kind: GlyphId, color: string, size = 22): string {
  const parts = GLYPHS[kind]
    .map((p) =>
      p.mode === 'fill'
        ? `<path d="${p.d}" fill="#fff"/>`
        : `<path d="${p.d}" fill="none" stroke="#fff" stroke-width="${p.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${color}"/><g transform="translate(12 12) scale(.62) translate(-12 -12)">${parts}</g></svg>`;
}
