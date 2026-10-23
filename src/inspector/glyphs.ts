import { rawFetch } from './capture';

// Mockup: MapLibre glyph files (/fonts/<stack>/<from>-<to>.pbf) hold one signed-distance-field bitmap per character.
// The view renders sample texts with them and lists every glyph of the range.

interface Glyph {
  id: number;
  bitmap: Uint8Array;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
}

interface Stack {
  name: string;
  range: string;
  glyphs: Map<number, Glyph>;
}

const BUFFER = 3; // SDF border around every bitmap, in px
const SIZE = 24; // font size the glyphs were generated at
const K = 2; // render scale (bitmaps are drawn at 2x for crisp edges)
const SHOW = 32; // font size of the sample text on screen
const EDGE = 191.25; // SDF value of the glyph outline (255 * 0.75)

export const isGlyphUrl = (url: string) => /\/fonts\/[^?#]+\/\d+-\d+\.pbf(\?|$)/.test(url);

const SAMPLES: { title: string; text: string }[] = [
  { title: 'Großbuchstaben', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { title: 'Kleinbuchstaben', text: 'abcdefghijklmnopqrstuvwxyz' },
  { title: 'Ziffern', text: '0123456789' },
  { title: 'Sonderzeichen', text: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ äöüß ÄÖÜ € £ © ° ± ×' },
  { title: 'Pangramme', text: 'The quick brown fox jumps over the lazy dog. Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich. 0123456789' },
];

async function parse(buf: ArrayBuffer): Promise<Stack> {
  const { PbfReader } = await import('pbf');
  const stack: Stack = { name: '', range: '', glyphs: new Map() };
  new PbfReader(new Uint8Array(buf)).readFields(
    (tag, _, pbf) => {
      if (tag !== 1) return;
      pbf.readMessage(
        (t, st: Stack, p) => {
          if (t === 1) st.name = p.readString();
          else if (t === 2) st.range = p.readString();
          else if (t === 3) {
            const g = p.readMessage(
              (gt, o: Glyph, gp) => {
                if (gt === 1) o.id = gp.readVarint();
                else if (gt === 2) o.bitmap = gp.readBytes();
                else if (gt === 3) o.width = gp.readVarint();
                else if (gt === 4) o.height = gp.readVarint();
                else if (gt === 5) o.left = gp.readSVarint();
                else if (gt === 6) o.top = gp.readSVarint();
                else if (gt === 7) o.advance = gp.readVarint();
              },
              { id: 0, bitmap: new Uint8Array(0), width: 0, height: 0, left: 0, top: 0, advance: 0 },
            );
            st.glyphs.set(g.id, g);
          }
        },
        stack,
      );
    },
    stack,
  );
  return stack;
}

/** SDF -> anti-aliased white-on-transparent canvas, sampled bilinearly at K times the source resolution */
function render(g: Glyph): HTMLCanvasElement | null {
  const bw = g.width + 2 * BUFFER;
  const bh = g.height + 2 * BUFFER;
  if (!g.width || !g.height || g.bitmap.length < bw * bh) return null;
  const c = document.createElement('canvas');
  c.width = bw * K;
  c.height = bh * K;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  const at = (x: number, y: number) => g.bitmap[Math.max(0, Math.min(bh - 1, y)) * bw + Math.max(0, Math.min(bw - 1, x))];
  for (let oy = 0; oy < c.height; oy++) {
    const sy = (oy + 0.5) / K - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let ox = 0; ox < c.width; ox++) {
      const sx = (ox + 0.5) / K - 0.5;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const v = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
      const a = Math.max(0, Math.min(1, ((v - EDGE) * K) / 32 + 0.5));
      const i = (oy * c.width + ox) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function loadGlyphView(url: string): Promise<HTMLElement> {
  const res = await rawFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const stack = await parse(buf);
  const cache = new Map<number, HTMLCanvasElement | null>();
  const bmp = (g: Glyph) => {
    if (!cache.has(g.id)) cache.set(g.id, render(g));
    return cache.get(g.id)!;
  };

  const el = document.createElement('div');
  el.className = 'rdi-gl';
  const head = document.createElement('div');
  head.className = 'rdi-gl-head';
  head.innerHTML = `<b></b><span></span>`;
  // the stack name lists the font plus its fallbacks ("Noto Sans Bold, Noto Naskh Arabic Bold, …")
  const names = (stack.name || decodeURIComponent(url.split('/fonts/')[1]?.split('/')[0] ?? '')).split(',').map((n) => n.trim());
  head.querySelector('b')!.textContent = names[0];
  head.querySelector('span')!.textContent = `Bereich ${stack.range} · ${stack.glyphs.size} Zeichen · ${(buf.byteLength / 1024).toFixed(1)} kB · SDF ${SIZE} px${names.length > 1 ? ` · +${names.length - 1} Ersatzschriften` : ''}`;
  el.append(head);

  // ----- sample texts -----
  const f = SHOW / SIZE;
  const maxW = 680 / f;
  for (const s of SAMPLES) {
    const chars = [...s.text];
    if (!chars.some((ch) => stack.glyphs.has(ch.codePointAt(0)!))) continue;
    // words -> lines
    const lines: string[][] = [[]];
    let w = 0;
    for (const word of s.text.split(/(?<= )/)) {
      const ww = [...word].reduce((n, ch) => n + (stack.glyphs.get(ch.codePointAt(0)!)?.advance ?? SIZE * 0.4), 0);
      if (w + ww > maxW && lines[lines.length - 1].length) {
        lines.push([]);
        w = 0;
      }
      lines[lines.length - 1].push(word);
      w += ww;
    }
    const sec = document.createElement('section');
    sec.innerHTML = `<h4></h4>`;
    sec.querySelector('h4')!.textContent = s.title;
    for (const words of lines) {
      const text = [...words.join('')];
      const adv = text.reduce((n, ch) => n + (stack.glyphs.get(ch.codePointAt(0)!)?.advance ?? SIZE * 0.4), 0);
      const lh = SIZE * 1.6;
      const c = document.createElement('canvas');
      c.width = Math.ceil(adv * K) + 8;
      c.height = Math.ceil(lh * K);
      c.style.width = `${c.width * f / K}px`;
      c.style.height = `${c.height * f / K}px`;
      const ctx = c.getContext('2d')!;
      let x = 0;
      // fontnik measures `top` from the line's top edge: the baseline is 26 px below it
      const base = 2;
      for (const ch of text) {
        const g = stack.glyphs.get(ch.codePointAt(0)!);
        if (!g) {
          x += SIZE * 0.4;
          continue;
        }
        const b = bmp(g);
        if (b) ctx.drawImage(b, (x + g.left - BUFFER) * K, (base - g.top - BUFFER) * K);
        x += g.advance;
      }
      sec.append(c);
    }
    el.append(sec);
  }

  // ----- every glyph of the file -----
  const atlas = document.createElement('section');
  atlas.innerHTML = `<h4>Alle Zeichen dieser Datei</h4>`;
  const grid = document.createElement('div');
  grid.className = 'rdi-gl-grid';
  for (const g of [...stack.glyphs.values()].sort((a, b) => a.id - b.id)) {
    const cell = document.createElement('div');
    cell.className = 'rdi-gl-cell';
    const id = `U+${g.id.toString(16).toUpperCase().padStart(4, '0')}`;
    cell.title = `${id} · ${String.fromCodePoint(g.id)} · ${g.width}×${g.height} px · Vorschub ${g.advance}`;
    const b = bmp(g);
    if (b) {
      b.style.width = `${b.width / K}px`;
      b.style.height = `${b.height / K}px`;
      const wrap = document.createElement('div');
      wrap.className = 'rdi-gl-bmp';
      const c2 = document.createElement('canvas');
      c2.width = b.width;
      c2.height = b.height;
      c2.getContext('2d')!.drawImage(b, 0, 0);
      c2.style.width = b.style.width;
      c2.style.height = b.style.height;
      wrap.append(c2);
      cell.append(wrap);
    } else cell.insertAdjacentHTML('beforeend', '<div class="rdi-gl-bmp muted">leer</div>');
    const lab = document.createElement('small');
    lab.textContent = id;
    cell.append(lab);
    grid.append(cell);
  }
  atlas.append(grid);
  el.append(atlas);
  return el;
}
