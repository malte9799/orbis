import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fixGlb } from '../gltf1';

// Turns the bytes of one tile (b3dm or glb) into plain typed arrays: runs in a worker (tileWorker.ts) and,
// where that is not possible, on the main thread. Nothing in the result is a three.js object, so it can be
// handed over without copying.

export interface MeshData {
  position: Float32Array;
  normal: Float32Array | null;
  uv: Float32Array | null;
  /** vertex colours (COLOR_0), `colorSize` components each */
  colors: Float32Array | null;
  colorSize: number;
  index: Uint16Array | Uint32Array | null;
  /** the picture of the material, decoded (ImageBitmap) */
  image: ImageBitmap | null;
  color: [number, number, number];
  unlit: boolean;
  doubleSided: boolean;
  /** alphaMode BLEND */
  transparent: boolean;
  /** alphaMode MASK: the cutoff, else 0 */
  alphaTest: number;
}

export interface TileData {
  meshes: MeshData[];
  /** model matrix of the content in the tile's frame (RTC centre, up-axis), column-major */
  matrix: number[];
  /** centre and lowest vertex of the content in ECEF (after the tile transform), for the ground height */
  centre: [number, number, number];
  low: [number, number, number];
  bytes: number;
}

const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
let loader: GLTFLoader | undefined;
const getLoader = () => {
  if (loader) return loader;
  loader = new GLTFLoader();
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_PATH));
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
};

/** the glb inside a b3dm, and the RTC centre of its feature table (if any) */
const B3DM = 0x6d643362; // 'b3dm'
const I3DM = 0x6d643369; // 'i3dm'
const CMPT = 0x74706d63; // 'cmpt'

/** the RTC centre from an embedded JSON table of the container (feature table JSON) */
function tableRtc(buf: ArrayBuffer, at: number, length: number): [number, number, number] | null {
  try {
    const t = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, at, length)));
    return Array.isArray(t.RTC_CENTER) ? t.RTC_CENTER : null;
  } catch {
    return null;
  }
}

/**
 * One tile file holds one piece of content (b3dm / glb / i3dm — the glb behind header + tables)
 * or a composite (cmpt) of several such pieces. An i3dm carries its model embedded (gltfFormat 1,
 * the common case) or as a URI in the body, then it is fetched next to the tile itself.
 */
async function unpackTile(buf: ArrayBuffer, base: string): Promise<{ glb: ArrayBuffer; rtc: [number, number, number] | null }[]> {
  const dv = new DataView(buf);
  const magic = dv.getUint32(0, true);
  if (magic === CMPT) {
    const out: { glb: ArrayBuffer; rtc: [number, number, number] | null }[] = [];
    let at = 16;
    for (let i = 0, count = dv.getUint32(12, true); i < count && at < buf.byteLength; i++) {
      out.push(...(await unpackTile(buf.slice(at, at + dv.getUint32(at + 8, true)), base)));
      at += dv.getUint32(at + 8, true);
    }
    return out;
  }
  if (magic === I3DM) {
    const headerEnd = 32 + dv.getUint32(12, true) + dv.getUint32(16, true) + dv.getUint32(20, true) + dv.getUint32(24, true);
    if (dv.getUint8(28) !== 1) { // model by URI
      const uri = new TextDecoder().decode(new Uint8Array(buf, headerEnd)).replace(/[\0 ]+$/, '').trim();
      if (!base) throw new Error('i3dm mit externem Modell (Basis-URL fehlt)');
      return [{ glb: await (await fetch(new URL(uri, base))).arrayBuffer(), rtc: null }];
    }
    return [{ glb: buf.slice(headerEnd), rtc: tableRtc(buf, 32, dv.getUint32(12, true)) }];
  }
  if (magic !== B3DM) return [{ glb: buf, rtc: null }]; // plain glb
  const headerEnd = 28 + dv.getUint32(12, true) + dv.getUint32(16, true) + dv.getUint32(20, true) + dv.getUint32(24, true);
  return [{ glb: buf.slice(headerEnd), rtc: tableRtc(buf, 28, dv.getUint32(12, true)) }];
}

const parse = (glb: ArrayBuffer) => new Promise<{ scene: THREE.Group | null; json: { extensions?: { CESIUM_RTC?: { center: number[] } } } }>((res, rej) => getLoader().parse(glb, '', (g) => res({ scene: g.scene ?? null, json: g.parser.json }), rej));

const UP = new THREE.Vector3();

/** glTF 1.0 → 2.0 plus listed unlit, per content piece (b3dm bodies and cmpt children alike) */
function fixContent(raw: ArrayBuffer): ArrayBuffer {
  const fixed = fixGlb(new Uint8Array(raw));
  return fixed.buffer === raw ? raw : (fixed.slice().buffer as ArrayBuffer);
}

/**
 * Decodes one tile. `transform` is the tile's own transform in ECEF (parents multiplied in), only used to
 * work out where the content lies on the ground.
 */
export async function parseTile(raw: ArrayBuffer, transform: number[], maxTexture = 2048, zUp = false, base = ''): Promise<{ data: TileData; transfer: Transferable[] }> {
  const pieces = await unpackTile(raw, base);
  const meshes: MeshData[] = [];
  const transfer: Transferable[] = [];
  let bytes = 0;
  let rtc: [number, number, number] | null = null;
  let built = false;
  const full = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const sum = new THREE.Vector3();
  let n = 0;
  const normalMatrix = new THREE.Matrix3();
  const sharedPos = new Map<THREE.BufferGeometry, { position: Float32Array; normal: Float32Array | null; uv: Float32Array | null; colors: Float32Array | null; colorSize: number }>();
  const sceneUp = new THREE.Vector3();
  let matrix = new THREE.Matrix4();

  const bake = (g: THREE.BufferGeometry, world: THREE.Matrix4, offset: THREE.Vector3 | null) => {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const position = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(world);
      position.set([v.x, v.y, v.z], i * 3);
    }
    if (offset) for (let i = 0; i < pos.count * 3; i += 3) {
      position[i] += offset.x;
      position[i + 1] += offset.y;
      position[i + 2] += offset.z;
    }
    let normal: Float32Array | null = null;
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (nrm) {
      normal = new Float32Array(nrm.count * 3);
      normalMatrix.getNormalMatrix(world);
      for (let i = 0; i < nrm.count; i++) {
        v.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
        normal.set([v.x, v.y, v.z], i * 3);
      }
    }
    const uvAttr = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    let uv: Float32Array | null = null;
    if (uvAttr) {
      uv = new Float32Array(uvAttr.count * 2);
      for (let i = 0; i < uvAttr.count; i++) uv.set([uvAttr.getX(i), uvAttr.getY(i)], i * 2);
    }
    const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
    let colors: Float32Array | null = null;
    if (col) {
      colors = new Float32Array(col.count * col.itemSize);
      for (let i = 0; i < col.count; i++) for (let k = 0; k < col.itemSize; k++) colors[i * col.itemSize + k] = col.getComponent(i, k);
    }
    return { position, normal, uv, colors, colorSize: col?.itemSize ?? 3 };
  };

  // Several pieces (a cmpt composite, an i3dm batch) share the tile transform, but each piece keeps
  // its own RTC centre. Everything merges into one TileData on the RTC of the first piece; the other
  // pieces carry their offset baked into the vertex positions (translation only, normals stay).
  for (const piece of pieces) {
    const { scene, json } = await parse(fixContent(piece.glb));
    if (!scene) continue; // empty piece (some NRW leaves): nothing to draw
    const pieceRtc = (json.extensions?.CESIUM_RTC?.center ?? piece.rtc ?? [0, 0, 0]) as [number, number, number];
    let offset: THREE.Vector3 | null = null;
    if (!built) {
      rtc = pieceRtc;
      // glTF is y-up, tiles are z-up (unless the tileset says `asset.gltfUpAxis: "Z"`); the RTC centre is not rotated
      matrix = new THREE.Matrix4().makeTranslation(rtc[0], rtc[1], rtc[2]).multiply(zUp ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationX(Math.PI / 2));
      full.fromArray(transform).multiply(matrix);
      built = true;
    } else {
      // glTF is y-up, tiles are z-up (unless the tileset says `asset.gltfUpAxis: "Z"`); the RTC centre is not rotated
      offset = sceneUp.set(pieceRtc[0] - rtc![0], pieceRtc[1] - rtc![1], pieceRtc[2] - rtc![2]);
    }
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    let arrays = sharedPos.get(g);
    if (!arrays) sharedPos.set(g, (arrays = bake(g, mesh.matrixWorld, offset)));
    // a mesh with several materials is split by its groups: one entry per material, sharing the vertex arrays
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const parts = mats.length > 1 && g.groups.length ? g.groups.map((gr) => ({ mat: mats[gr.materialIndex ?? 0], start: gr.start, count: gr.count })) : [{ mat: mats[0], start: 0, count: Infinity }];
    for (const part of parts) {
      let index: Uint16Array | Uint32Array | null = null;
      const total = g.index ? g.index.count : pos.count;
      const count = Math.min(part.count, total - part.start);
      if (g.index) {
        const src = g.index.array.subarray(part.start, part.start + count);
        index = pos.count > 65535 ? Uint32Array.from(src) : Uint16Array.from(src);
      } else if (part.count !== Infinity) {
        index = pos.count > 65535 ? Uint32Array.from({ length: count }, (_, i) => part.start + i) : Uint16Array.from({ length: count }, (_, i) => part.start + i);
      }
      const mat = part.mat as THREE.MeshStandardMaterial;
      const image = (mat.map?.image as ImageBitmap | undefined) ?? null;
      meshes.push({
        position: arrays.position,
        normal: arrays.normal,
        uv: arrays.uv,
        colors: arrays.colors,
        colorSize: arrays.colorSize,
        index,
        image: image && typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ? image : null,
        color: [mat.color?.r ?? 1, mat.color?.g ?? 1, mat.color?.b ?? 1],
        unlit: (mat as unknown as THREE.Material).type === 'MeshBasicMaterial',
        doubleSided: mat.side === THREE.DoubleSide,
        transparent: !!mat.transparent,
        alphaTest: mat.alphaTest ?? 0,
      });
    }
    // sample a few vertices for the centre
    const step = Math.max(1, Math.floor(pos.count / 40));
    for (let i = 0; i < pos.count; i += step) {
      v.set(arrays.position[i * 3], arrays.position[i * 3 + 1], arrays.position[i * 3 + 2]).applyMatrix4(full);
      sum.add(v);
      n++;
    }
    });
  }
  if (!built) {
    // legal but empty content (a glTF without a default scene, e.g. a stripped NRW leaf tile):
    // nothing to draw — the tile counts as loaded, no retry, no error
    return { data: { meshes: [], matrix: new THREE.Matrix4().toArray(), centre: [0, 0, 0], low: [0, 0, 0], bytes: 0 }, transfer: [] };
  }
  // Pictures larger than the screen can use only cost memory and upload time: shrink them here, off the main thread.
  // A picture shared by several meshes is shrunk once and handed over once (a transferable may only be listed once).
  const resized = new Map<ImageBitmap, ImageBitmap>();
  for (const m of meshes) {
    if (!m.image) continue;
    let img = resized.get(m.image);
    if (!img) {
      const src = m.image;
      img = src;
      if (Math.max(src.width, src.height) > maxTexture) {
        const k = maxTexture / Math.max(src.width, src.height);
        img = await createImageBitmap(src, { resizeWidth: Math.round(src.width * k), resizeHeight: Math.round(src.height * k), resizeQuality: 'high' });
        src.close();
      }
      resized.set(src, img);
    }
    m.image = img;
  }
  const seen = new Set<unknown>();
  const once = (x: { buffer: ArrayBufferLike } | ImageBitmap | null): number => {
    if (!x) return 0;
    const key = x instanceof ImageBitmap ? x : x.buffer;
    if (seen.has(key)) return 0;
    seen.add(key);
    transfer.push(key as Transferable);
    return x instanceof ImageBitmap ? x.width * x.height * 4 * 1.33 : (x as ArrayBufferView).byteLength;
  };
  for (const m of meshes) bytes += once(m.position) + once(m.normal) + once(m.uv) + once(m.colors) + once(m.index) + once(m.image);
  const centre = n ? sum.divideScalar(n) : new THREE.Vector3().setFromMatrixPosition(full);
  UP.copy(centre).normalize();
  let lowest = Infinity;
  const low = centre.clone();
  for (const m of meshes) {
    for (let i = 0; i < m.position.length; i += 3) {
      v.set(m.position[i], m.position[i + 1], m.position[i + 2]).applyMatrix4(full);
      const h = v.dot(UP);
      if (h < lowest) {
        lowest = h;
        low.copy(v);
      }
    }
  }
  return {
    data: { meshes, matrix: matrix.toArray(), centre: [centre.x, centre.y, centre.z], low: [low.x, low.y, low.z], bytes },
    transfer,
  };
}
