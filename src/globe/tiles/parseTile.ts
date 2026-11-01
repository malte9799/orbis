import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fixTile } from '../gltf1';

export interface TextureData {
  slot: 'map' | 'normalMap' | 'emissiveMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap' | 'alphaMap';
  image: ImageBitmap;
  wrapS: number;
  wrapT: number;
  magFilter: number;
  minFilter: number;
  srgb: boolean;
}

export interface MaterialData {
  maps: TextureData[];
  color: [number, number, number];
  emissive: [number, number, number];
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  unlit: boolean;
  doubleSided: boolean;
  transparent: boolean;
  opacity: number;
  alphaTest: number;
}

export interface MeshData {
  position: Float32Array;
  normal: Float32Array | null;
  uv: Float32Array | null;
  index: Uint16Array | Uint32Array | null;
  materials: MaterialData[];
  groups: { start: number; count: number; materialIndex: number }[];
}

export interface TileData {
  meshes: MeshData[];
  /** model matrix of the content in the tile's frame, column-major */
  matrix: number[];
  /** centre and lowest vertex of the content in ECEF, for ground placement */
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

function unpack(buf: ArrayBuffer): { glb: ArrayBuffer; rtc: [number, number, number] | null } {
  if (buf.byteLength < 4) throw new Error('Tile zu kurz');
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x6d643362) return { glb: buf, rtc: null };
  if (buf.byteLength < 28) throw new Error('Ungültiger b3dm-Header');
  const ftj = dv.getUint32(12, true);
  const headerEnd = 28 + ftj + dv.getUint32(16, true) + dv.getUint32(20, true) + dv.getUint32(24, true);
  if (headerEnd > buf.byteLength) throw new Error('Ungültige b3dm-Längenangaben');
  let rtc: [number, number, number] | null = null;
  if (ftj > 0) {
    try {
      const ft = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 28, ftj)));
      if (Array.isArray(ft.RTC_CENTER) && ft.RTC_CENTER.length === 3) rtc = ft.RTC_CENTER;
    } catch { /* the feature table may not contain JSON */ }
  }
  return { glb: buf.slice(headerEnd), rtc };
}

const parse = (glb: ArrayBuffer) => new Promise<{ scene: THREE.Group; json: { extensions?: { CESIUM_RTC?: { center: number[] } } } }>((res, rej) => getLoader().parse(glb, '', (g) => res({ scene: g.scene, json: g.parser.json }), rej));

const UP = new THREE.Vector3();
const MAP_SLOTS = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'] as const;

/** Decode one b3dm/glb content payload off the main thread. `upAxis` is the tileset's asset.gltfUpAxis:
 * 'y' is the classic b3dm layout (glTF Y-up, the tile sits on the +x/+z plane), 'z' marks legacy tilesets
 * whose content already stands upright in the tile's own frame (e.g. Basel). */
export async function parseTile(raw: ArrayBuffer, transform: number[], maxTexture = 4096, upAxis: 'y' | 'z' = 'y'): Promise<{ data: TileData; transfer: Transferable[] }> {
  const { glb, rtc: ftRtc } = unpack(fixTile(raw));
  const { scene, json } = await parse(glb);
  const rtc = json.extensions?.CESIUM_RTC?.center ?? ftRtc ?? [0, 0, 0];
  const contentMatrix = new THREE.Matrix4().makeTranslation(rtc[0], rtc[1], rtc[2])
    .multiply(upAxis === 'z' ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const tileTransform = new THREE.Matrix4().fromArray(transform);
  const full = tileTransform.clone().multiply(contentMatrix);

  scene.updateMatrixWorld(true);
  const meshes: MeshData[] = [];
  const transfer = new Set<Transferable>();
  const imageResize = new Map<ImageBitmap, ImageBitmap>();
  let bytes = 0;
  const sum = new THREE.Vector3();
  let sampled = 0;
  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    const sourceMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
    if (!g.getAttribute('normal') && sourceMaterials.some((mat) => (mat as unknown as THREE.Material).type !== 'MeshBasicMaterial')) g.computeVertexNormals();
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const position = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(contentMatrix);
      position.set([v.x, v.y, v.z], i * 3);
    }
    let normal: Float32Array | null = null;
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    if (nrm) {
      normal = new Float32Array(nrm.count * 3);
      normalMatrix.getNormalMatrix(new THREE.Matrix4().multiplyMatrices(contentMatrix, mesh.matrixWorld));
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
    let index: Uint16Array | Uint32Array | null = null;
    if (g.index) index = pos.count > 65535 ? Uint32Array.from(g.index.array) : Uint16Array.from(g.index.array);

    const materials: MaterialData[] = sourceMaterials.map((mat) => {
      const maps: MaterialData['maps'] = [];
      for (const slot of MAP_SLOTS) {
        const texture = mat[slot] as THREE.Texture | null;
        const image = texture?.image as ImageBitmap | undefined;
        if (!texture || !image || typeof ImageBitmap === 'undefined' || !(image instanceof ImageBitmap)) continue;
        const resized = imageResize.get(image);
        if (resized) {
          maps.push({ slot, image: resized, wrapS: texture.wrapS, wrapT: texture.wrapT, magFilter: texture.magFilter, minFilter: texture.minFilter, srgb: slot === 'map' || slot === 'emissiveMap' });
          continue;
        }
        maps.push({ slot, image, wrapS: texture.wrapS, wrapT: texture.wrapT, magFilter: texture.magFilter, minFilter: texture.minFilter, srgb: slot === 'map' || slot === 'emissiveMap' });
      }
      return {
        maps,
        color: [mat.color?.r ?? 1, mat.color?.g ?? 1, mat.color?.b ?? 1],
        emissive: [mat.emissive?.r ?? 0, mat.emissive?.g ?? 0, mat.emissive?.b ?? 0],
        emissiveIntensity: mat.emissiveIntensity ?? 1,
        metalness: mat.metalness ?? 0,
        roughness: mat.roughness ?? 1,
        unlit: (mat as unknown as THREE.Material).type === 'MeshBasicMaterial',
        doubleSided: mat.side === THREE.DoubleSide,
        transparent: mat.transparent,
        opacity: mat.opacity,
        alphaTest: mat.alphaTest,
      };
    });
    meshes.push({ position, normal, uv, index, materials, groups: g.groups.map(({ start, count, materialIndex }) => ({ start, count, materialIndex: materialIndex ?? 0 })) });
    transfer.add(position.buffer);
    if (normal) transfer.add(normal.buffer);
    if (uv) transfer.add(uv.buffer);
    if (index) transfer.add(index.buffer);
    bytes += position.byteLength + (normal?.byteLength ?? 0) + (uv?.byteLength ?? 0) + (index?.byteLength ?? 0);

    const step = Math.max(1, Math.floor(pos.count / 40));
    for (let i = 0; i < pos.count; i += step) {
      v.set(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]).applyMatrix4(tileTransform);
      sum.add(v);
      sampled++;
    }
  });

  // Resize shared images once, away from the render thread, and retain glTF texture sampler/material data.
  for (const mesh of meshes) for (const material of mesh.materials) for (const map of material.maps) {
    let image = imageResize.get(map.image) ?? map.image;
    if (Math.max(image.width, image.height) > maxTexture) {
      const original = image;
      const k = maxTexture / Math.max(original.width, original.height);
      image = await createImageBitmap(original, { resizeWidth: Math.round(original.width * k), resizeHeight: Math.round(original.height * k), resizeQuality: 'high' });
      imageResize.set(original, image);
      original.close();
    }
    map.image = image;
    transfer.add(image);
    bytes += image.width * image.height * 4 * 1.33;
  }

  const centre = sampled ? sum.divideScalar(sampled) : new THREE.Vector3().setFromMatrixPosition(full);
  UP.copy(centre).normalize();
  let lowest = Infinity;
  const low = centre.clone();
  for (const mesh of meshes) for (let i = 0; i < mesh.position.length; i += 3) {
    v.set(mesh.position[i], mesh.position[i + 1], mesh.position[i + 2]).applyMatrix4(tileTransform);
    const h = v.dot(UP);
    if (h < lowest) { lowest = h; low.copy(v); }
  }

  return {
    data: { meshes, matrix: new THREE.Matrix4().identity().toArray(), centre: [centre.x, centre.y, centre.z], low: [low.x, low.y, low.z], bytes },
    transfer: [...transfer],
  };
}
