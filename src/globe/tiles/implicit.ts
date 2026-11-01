// OGC 3D Tiles 1.1 implicit tiling (quadtree): the tile tree exists only as availability bits in
// "subtree" files. This turns tile coordinates into bits and back and reads those files, so the
// engine can materialise the tree chunk by chunk (see engine.ts).

export interface ImplicitScheme {
  /** subtree levels per chunk (the root tile of a chunk is part of its own chunk's bits) */
  subtreeLevels: number;
  /** how many levels of the whole tree can have tiles at all */
  availableLevels: number;
  /** template for the subtree files, with {level}, {x}, {y} resolved */
  subtreeUri: string;
  /** template for the tile content ({level}/{x}/{y}.glb or the like), null if the tileset has no content template */
  contentUri: string | null;
  /** the root tile's declared geometric error; tile errors derive from it (rootGe / 2 ^ level) */
  rootGe: number;
}

export interface ImplicitCoord {
  level: number;
  x: number;
  y: number;
}

/** the availability bits of one subtree file */
export interface SubtreeBits {
  /** 1 bit per possible tile, for the levels 0 … subtreeLevels-1 of the chunk (Morton order, packed LSB first) */
  tile: Uint8Array | null;
  /** when the tile availability is a constant, all tiles exist or none */
  tileConstant: boolean;
  /** per content: its bits, or constant=true/false for every tile of the chunk */
  content: { bits: Uint8Array | null; constant: boolean }[];
  /** which of the next chunk's roots (4 ^ subtreeLevels) exist; same Morton order in that one level */
  child: Uint8Array | null;
  childConstant: boolean;
}

const TEXT = new TextDecoder();

/** bit lengths per level of a quadtree chunk: 1, 4, 16 … */
export const levelTileCount = (level: number): number => 4 ** level;

/** the bits of a bitstream are packed lowest bit first in every byte */
const bitSet = (bits: Uint8Array, i: number): boolean => ((bits[i >> 3] >> (i & 7)) & 1) === 1;

/** bit index of the tile at `morton` of a chunk's relative level `r` */
export const tileBitIndex = (r: number, morton: number): number => {
  let i = 0;
  for (let l = 0; l < r; l++) i += levelTileCount(l);
  return i + morton;
};

/** Morton index of `(x, y): x takes the even bit positions, y the odd ones */
export const morton = (x: number, y: number): number => {
  let m = 0;
  let shift = 0;
  while (x > 0 || y > 0) {
    m |= (x & 1) << (2 * shift);
    m |= (y & 1) << (2 * shift + 1);
    x >>= 1;
    y >>= 1;
    shift++;
  }
  return m;
};

/** x and y (within an addition of `bits` each) from the Morton index */
export const coordsOfMorton = (bits: number, m: number): [number, number] => {
  let x = 0;
  let y = 0;
  for (let i = 0; i < bits && m !== 0; i++) {
    x |= (m & 1) << i;
    m >>= 1;
    y |= (m & 1) << i;
    m >>= 1;
  }
  return [x, y];
};

/** `{level}`, `{x}` and `{y}` in a template are replaced by a tile's coordinates */
export const useTemplate = (name: string, t: ImplicitCoord): string =>
  name.replace(/\{(?:level|z)\}/g, String(t.level)).replace(/\{x\}/g, String(t.x)).replace(/\{y\}/g, String(t.y));

/** resolves a (possibly relative) template URI without URL-encoding the `{level}` braces */
const resolveTemplate = (p: string, base: string): string => {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return p;
  if (p.startsWith('//')) return 'https:' + p;
  const segs = (base.replace(/[^/]*$/, '') + p).split('/');
  const out: string[] = [];
  for (const seg of segs) {
    if (seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
};

/** `raw` is a tile with `implicitTiling`; the tileset must also give it a region bounding volume */
export const parseScheme = (raw: Record<string, any>, base: string): ImplicitScheme | null => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const imp = raw.implicitTiling as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!imp) return null;
  // only quadtrees are needed so far (buildings); regions are what the tilesets in use have
  if (String(imp.subdivisionScheme ?? 'QUADTREE').toUpperCase() !== 'QUADTREE') return null;
  if (!(raw.boundingVolume as { region?: number[] } | undefined)?.region) return null;
  const uri = imp.subtrees?.uri;
  if (!uri) return null;
  const content = raw.content as { uri?: string; url?: string } | undefined;
  const contentUri = content?.uri ?? content?.url;
  return {
    subtreeLevels: Math.max(1, imp.subtreeLevels ?? 1),
    availableLevels: Math.max(1, imp.availableLevels ?? 1),
    subtreeUri: resolveTemplate(uri, base),
    contentUri: contentUri ? resolveTemplate(contentUri, base) : null,
    rootGe: raw.geometricError ?? 0,
  };
};

/** whether the chunk marks the tile `(r, morton)` as existing */
export const available = (b: SubtreeBits, r: number, m: number): boolean => {
  if (b.tileConstant || b.tile === null) return true; // constant true, or no bitstream at all
  return bitSet(b.tile, tileBitIndex(r, m));
};

/** whether the chunk says the tile `(r, morton)` has content (first content only; multiple contents are rare) */
export const hasContent = (b: SubtreeBits, r: number, m: number): boolean => {
  const c = b.content[0];
  if (!c) return false;
  if (c.bits === null) return c.constant;
  return bitSet(c.bits, tileBitIndex(r, m));
};

/** whether the child chunk rooted at the local Morton index `m` below the last level exists */
export const childAvailable = (b: SubtreeBits, m: number): boolean => {
  if (b.child === null) return b.childConstant;
  return bitSet(b.child, m);
};

/** parses a `.subtree` file: a JSON chunk plus (optionally) a binary chunk with the bitstreams */
export const parseSubtree = (buf: ArrayBuffer): SubtreeBits | null => {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x74627573) return null; // magic "subt"
  if (dv.getUint32(4, true) !== 1) return null; // version
  const jsonLen = dv.getUint32(8, true);
  let binStart = 24 + jsonLen;
  if (binStart % 8) binStart += 8 - (binStart % 8);
  let binLen = dv.getUint32(12, true);
  if (binLen === 0) binLen = Math.max(0, buf.byteLength - binStart);
  const bin = binLen ? new Uint8Array(buf, binStart, binLen) : null;
  const json = JSON.parse(TEXT.decode(new Uint8Array(buf, 24, jsonLen))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const readBits = (av: Record<string, any> | undefined): { bits: Uint8Array | null; constant: boolean } => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (av === null || av === undefined) return { bits: null, constant: false };
    if (typeof av.constant === 'boolean') return { bits: null, constant: av.constant };
    if (av.constant !== undefined) return { bits: null, constant: !!av.constant };
    const bvI = av.bitstream ?? av.bufferView;
    if (bvI !== undefined) {
      const bv = json.bufferViews?.[bvI] as { buffer?: number; byteOffset?: number; byteLength?: number } | undefined;
      if (bv && (bv.buffer ?? 0) === 0 && bin) {
        const start = Math.min(bv.byteOffset ?? 0, bin.byteLength);
        const len = Math.min(bv.byteLength ?? 0, bin.byteLength - start);
        return { bits: bin.subarray(start, start + len), constant: false };
      }
    }
    return { bits: null, constant: false };
  };
  const rawContent = json.contentAvailability;
  const contents = Array.isArray(rawContent) ? rawContent : rawContent ? [rawContent] : [];
  const tileAv = readBits(json.tileAvailability);
  return {
    tile: tileAv.bits,
    tileConstant: tileAv.constant,
    content: contents.map((c) => readBits(c)),
    child: readBits(json.childSubtreeAvailability).bits,
    childConstant: readBits(json.childSubtreeAvailability).constant,
  };
};

export const fetchSubtree = async (url: string): Promise<SubtreeBits | null> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return parseSubtree(await res.arrayBuffer());
};
