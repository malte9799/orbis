import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fixTile } from '../gltf1';

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
function unpack(buf: ArrayBuffer): { glb: ArrayBuffer; rtc: [number, number, number] | null } {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x6d643362) return { glb: buf, rtc: null }; // not a b3dm: plain glb
  const ftj = dv.getUint32(12, true);
  const headerEnd = 28 + ftj + dv.getUint32(16, true) + dv.getUint32(20, true) + dv.getUint32(24, true);
  let rtc: [number, number, number] | null = null;
  if (ftj > 0) {
    try {
      const ft = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 28, ftj)));
      if (Array.isArray(ft.RTC_CENTER)) rtc = ft.RTC_CENTER;
    } catch {
      /* no usable feature table */
    }
  }
  return { glb: buf.slice(headerEnd), rtc };
}

const parse = (glb: ArrayBuffer) => new Promise<{ scene: THREE.Group | null; json: { extensions?: { CESIUM_RTC?: { center: number[] } } } }>((res, rej) => getLoader().parse(glb, '', (g) => res({ scene: g.scene ?? null, json: g.parser.json }), rej));

const UP = new THREE.Vector3();

/**
 * Decodes one tile. `transform` is the tile's own transform in ECEF (parents multiplied in), only used to
 * work out where the content lies on the ground.
 */
export async function parseTile(raw: ArrayBuffer, transform: number[], maxTexture = 2048, zUp = false): Promise<{ data: TileData; transfer: Transferable[] }> {
  const { glb, rtc: ftRtc } = unpack(fixTile(raw));
  const { scene, json } = await parse(glb);
  if (!scene) {
    // legal but empty content (a glTF without a default scene, e.g. a stripped NRW leaf tile):
    // nothing to draw — the tile counts as loaded, no retry, no error
    return { data: { meshes: [], matrix: new THREE.Matrix4().toArray(), centre: [0, 0, 0], low: [0, 0, 0], bytes: 0 }, transfer: [] };
  }
  const rtc = json.extensions?.CESIUM_RTC?.center ?? ftRtc ?? [0, 0, 0];
  // glTF is y-up, tiles are z-up (unless the tileset says `asset.gltfUpAxis: "Z"`); the RTC centre is not rotated
  const matrix = new THREE.Matrix4().makeTranslation(rtc[0], rtc[1], rtc[2]).multiply(zUp ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const full = new THREE.Matrix4().fromArray(transform).multiply(matrix);

  scene.updateMatrixWorld(true);
  const meshes: MeshData[] = [];
  const transfer: Transferable[] = [];
  let bytes = 0;
  const sum = new THREE.Vector3();
  let n = 0;
  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const sharedPos = new Map<THREE.BufferGeometry, { position: Float32Array; normal: Float32Array | null; uv: Float32Array | null; colors: Float32Array | null; colorSize: number }>();
  const bake = (g: THREE.BufferGeometry, world: THREE.Matrix4) => {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const position = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(world);
      position.set([v.x, v.y, v.z], i * 3);
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
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    let arrays = sharedPos.get(g);
    if (!arrays) sharedPos.set(g, (arrays = bake(g, mesh.matrixWorld)));
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
