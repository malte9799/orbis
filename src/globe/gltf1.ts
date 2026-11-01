// Some older 3D Tiles (Lille 2016) carry glTF 1.0 inside their b3dm tiles, which three.js cannot
// read. This converts such a tile to glTF 2.0 in memory: geometry, textures and the RTC centre are
// kept, the material becomes an unlit texture (photogrammetry already has its light baked in).

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

/** keys of a glTF 1.0 dictionary in order, with the index each one gets in the 2.0 array */
const indexOf = (dict: J | undefined) => new Map(Object.keys(dict ?? {}).map((k, i) => [k, i]));

function convertJson(j: J, binLength: number): J {
  const views = indexOf(j.bufferViews);
  const accessors = indexOf(j.accessors);
  const images = indexOf(j.images);
  const samplers = indexOf(j.samplers);
  const textures = indexOf(j.textures);
  const materials = indexOf(j.materials);
  const meshes = indexOf(j.meshes);
  const nodes = indexOf(j.nodes);

  const out: J = { asset: { version: '2.0' }, buffers: [{ byteLength: binLength }] };
  const stride = new Map<string, number>();
  for (const a of Object.values<J>(j.accessors ?? {})) {
    const tight = COMPONENT_BYTES[a.componentType] * TYPE_COUNT[a.type];
    if (a.byteStride && a.byteStride !== tight) stride.set(a.bufferView, a.byteStride);
  }
  out.bufferViews = Object.entries<J>(j.bufferViews ?? {}).map(([name, v]) => ({
    buffer: 0,
    byteOffset: v.byteOffset ?? 0,
    byteLength: v.byteLength,
    ...(stride.has(name) ? { byteStride: stride.get(name) } : {}),
  }));
  out.accessors = Object.values<J>(j.accessors ?? {}).map((a) => ({
    bufferView: views.get(a.bufferView),
    byteOffset: a.byteOffset ?? 0,
    componentType: a.componentType,
    count: a.count,
    type: a.type,
    ...(a.min ? { min: a.min } : {}),
    ...(a.max ? { max: a.max } : {}),
  }));
  out.images = Object.values<J>(j.images ?? {}).map((im) => {
    const ext = im.extensions?.KHR_binary_glTF;
    return { bufferView: views.get(ext.bufferView), mimeType: ext.mimeType };
  });
  out.samplers = Object.values<J>(j.samplers ?? {}).map((s) => ({ ...s }));
  out.textures = Object.values<J>(j.textures ?? {}).map((t) => ({ source: images.get(t.source), ...(samplers.has(t.sampler) ? { sampler: samplers.get(t.sampler) } : {}) }));
  out.materials = Object.values<J>(j.materials ?? {}).map((m) => {
    // the texture sits under "diffuse" (Lille) or any other name ("tex": Helsinki Sompasaari)
    const values = Object.values<unknown>(m.values ?? {});
    const tex = values.find((v): v is string => typeof v === 'string' && textures.has(v));
    const d = m.values?.diffuse;
    const pbr: J = { metallicFactor: 0, roughnessFactor: 1 };
    if (tex) pbr.baseColorTexture = { index: textures.get(tex) };
    else if (Array.isArray(d)) pbr.baseColorFactor = d;
    return { pbrMetallicRoughness: pbr, doubleSided: true, extensions: { KHR_materials_unlit: {} } };
  });
  out.meshes = Object.values<J>(j.meshes ?? {}).map((m) => ({
    primitives: m.primitives.map((p: J) => ({
      attributes: Object.fromEntries(Object.entries<string>(p.attributes).map(([k, a]) => [k, accessors.get(a)])),
      ...(p.indices ? { indices: accessors.get(p.indices) } : {}),
      mode: p.mode ?? 4,
      ...(materials.has(p.material) ? { material: materials.get(p.material) } : {}),
    })),
  }));
  // a 1.0 node may hold several meshes, a 2.0 node one: the extra ones become child nodes
  const outNodes: J[] = [];
  for (const [, n] of Object.entries<J>(j.nodes ?? {})) {
    const node: J = {};
    for (const k of ['matrix', 'translation', 'rotation', 'scale']) if (n[k]) node[k] = n[k];
    const kids: number[] = (n.children ?? []).map((c: string) => nodes.get(c)!);
    const ms: string[] = n.meshes ?? [];
    if (ms.length === 1) node.mesh = meshes.get(ms[0]);
    else ms.forEach((m) => kids.push(-1 - meshes.get(m)!)); // resolved below once all nodes exist
    node.children = kids;
    outNodes.push(node);
  }
  for (const node of [...outNodes]) {
    if (!node.children) continue;
    node.children = node.children.map((c: number) => {
      if (c >= 0) return c;
      outNodes.push({ mesh: -1 - c });
      return outNodes.length - 1;
    });
    if (!node.children.length) delete node.children;
  }
  out.nodes = outNodes;
  const scene = j.scenes?.[j.scene] ?? Object.values<J>(j.scenes ?? {})[0];
  out.scenes = [{ nodes: (scene?.nodes ?? []).map((n: string) => nodes.get(n)) }];
  out.scene = 0;
  out.extensionsUsed = ['KHR_materials_unlit'];
  if (j.extensions?.CESIUM_RTC) {
    out.extensions = { CESIUM_RTC: j.extensions.CESIUM_RTC };
    out.extensionsUsed.push('CESIUM_RTC');
    out.extensionsRequired = ['CESIUM_RTC'];
  }
  return out;
}

const pad4 = (n: number) => (n + 3) & ~3;

/** glb 1.0 → glb 2.0 (returns the input when it already is 2.0 or not a glb) */
function glbToV2(glb: Uint8Array): Uint8Array {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (glb.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67 /* glTF */ || dv.getUint32(4, true) !== 1) return glb;
  const jsonLen = dv.getUint32(12, true);
  const json: J = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)));
  const bin = glb.subarray(20 + jsonLen, dv.getUint32(8, true));
  const text = new TextEncoder().encode(JSON.stringify(convertJson(json, bin.length)));
  const jsonPadded = pad4(text.length);
  const binPadded = pad4(bin.length);
  const total = 12 + 8 + jsonPadded + 8 + binPadded;
  const out = new Uint8Array(total).fill(0x20); // JSON padding is spaces
  const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true);
  o.setUint32(4, 2, true);
  o.setUint32(8, total, true);
  o.setUint32(12, jsonPadded, true);
  o.setUint32(16, 0x4e4f534a /* JSON */, true);
  out.set(text, 20);
  const binAt = 20 + jsonPadded;
  out.fill(0, binAt + 8, total); // BIN padding is zeros
  o.setUint32(binAt, binPadded, true);
  o.setUint32(binAt + 4, 0x004e4942 /* BIN */, true);
  out.set(bin, binAt + 8);
  return out;
}

/**
 * Some exporters (TerraExplorer: CRAIG, Helsinki …) use KHR_materials_unlit on a material without
 * listing it in `extensionsUsed`; three.js then only registers the extension handler when it is
 * listed and fails with "getMaterialType of undefined" – the whole tile is lost. List it.
 */
function listUnlit(glb: Uint8Array): Uint8Array {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (glb.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2 || dv.getUint32(16, true) !== 0x4e4f534a) return glb;
  const jsonLen = dv.getUint32(12, true);
  const text = new TextDecoder().decode(glb.subarray(20, 20 + jsonLen));
  if (!text.includes('KHR_materials_unlit')) return glb;
  const json: J = JSON.parse(text);
  const used: string[] = (json.extensionsUsed ??= []);
  if (used.includes('KHR_materials_unlit')) return glb;
  used.push('KHR_materials_unlit');
  const enc = new TextEncoder().encode(JSON.stringify(json));
  const padded = pad4(enc.length);
  const rest = glb.subarray(20 + jsonLen);
  const out = new Uint8Array(20 + padded + rest.length).fill(0x20);
  out.set(glb.subarray(0, 20));
  out.set(enc, 20);
  out.set(rest, 20 + padded);
  const o = new DataView(out.buffer);
  o.setUint32(8, out.length, true);
  o.setUint32(12, padded, true);
  return out;
}

/** the two fixes of `fixTile` on a bare glb (used per content piece in cmpt/i3dm composites) */
export function fixGlb(glb: Uint8Array): Uint8Array {
  return listUnlit(glbToV2(glb));
}

/**
 * Makes a tile loadable for three.js: glTF 1.0 becomes 2.0, and unlit materials get listed.
 * Works on b3dm (the glb sits behind the header and tables) and on plain glb; anything else is
 * returned unchanged.
 */
export function fixTile(buf: ArrayBuffer): ArrayBuffer {
  const dv = new DataView(buf);
  if (buf.byteLength < 28) return buf;
  const magic = dv.getUint32(0, true);
  const isB3dm = magic === 0x6d643362; /* b3dm */
  if (!isB3dm && magic !== 0x46546c67) return buf;
  const headerEnd = isB3dm ? 28 + dv.getUint32(12, true) + dv.getUint32(16, true) + dv.getUint32(20, true) + dv.getUint32(24, true) : 0;
  const glb = new Uint8Array(buf, headerEnd);
  const fixed = listUnlit(glbToV2(glb));
  if (fixed === glb) return buf;
  const out = new Uint8Array(headerEnd + fixed.length);
  out.set(new Uint8Array(buf, 0, headerEnd));
  out.set(fixed, headerEnd);
  if (isB3dm) new DataView(out.buffer).setUint32(8, out.length, true);
  return out.buffer;
}
