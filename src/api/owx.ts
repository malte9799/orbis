// OWX decoding (format: docs/WETTERDATEN-FORMAT.md). Kept free of other imports so a Web Worker can use it.

export interface OwxHeader {
  var: string;
  nt: number;
  ny: number;
  nx: number;
  lat0: number;
  lon0: number;
  dx: number;
  dy: number;
  wrap: boolean;
  scale: number;
  offset: number;
  nodata: number;
}

export interface RawTile {
  header: OwxHeader;
  q: Int16Array;
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inverse of encode() in scripts/wx-icon.py: the quantised 16-bit numbers as they are stored. */
export async function decodeOwxRaw(buf: ArrayBuffer): Promise<RawTile> {
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0x4f || bytes[1] !== 0x57 || bytes[2] !== 0x58 || bytes[3] !== 0x31) throw new Error('kein OWX-Format');
  const hl = new DataView(buf).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hl))) as OwxHeader;
  const { nt, ny, nx } = header;
  const planes = await gunzip(bytes.subarray(8 + hl));
  const n = ny * nx;
  const total = nt * n;
  if (planes.length !== total * 2) throw new Error('OWX: unerwartete Länge');
  const q = new Int16Array(total);
  const s = new Int16Array(n); // spatial residual plane of the current step (int16 wraps like the encoder)
  const run = new Int16Array(n); // running sum over time
  for (let t = 0; t < nt; t++) {
    const o = t * n;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        const z = planes[o + i] | (planes[total + o + i] << 8);
        const d = (z >>> 1) ^ -(z & 1);
        s[i] = y === 0 ? (x === 0 ? d : s[i - 1] + d) : x === 0 ? s[i - nx] + d : d + s[i - 1] + s[i - nx] - s[i - nx - 1];
      }
    }
    for (let i = 0; i < n; i++) {
      run[i] = t === 0 ? s[i] : run[i] + s[i];
      q[o + i] = run[i];
    }
  }
  return { header, q };
}

