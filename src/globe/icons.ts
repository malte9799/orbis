import type { Map as MlMap } from 'maplibre-gl';
import type { EventKind } from '../api/events';

type Part = { d: string; mode: 'fill' | 'stroke'; width?: number };

/** White glyphs on a 24×24 grid, drawn on top of a data-driven coloured circle. */
const GLYPHS: Record<EventKind, Part[]> = {
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
};

const SIZE = 48; // px at pixelRatio 2 → 24 css px

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
export function glyphSvg(kind: EventKind, color: string, size = 22): string {
  const parts = GLYPHS[kind]
    .map((p) =>
      p.mode === 'fill'
        ? `<path d="${p.d}" fill="#fff"/>`
        : `<path d="${p.d}" fill="none" stroke="#fff" stroke-width="${p.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${color}"/><g transform="translate(12 12) scale(.62) translate(-12 -12)">${parts}</g></svg>`;
}
