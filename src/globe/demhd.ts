import { addProtocol } from 'maplibre-gl';

/**
 * Hybrid-Höhenmodell: Mapterhorn zuerst (LIDAR-Genauigkeit ab z13 in Deutschland/Europa, global
 * z0–12 Copernicus), darunter AWS Terrain Tiles als Fallback (globale Abdeckung bis z15, auch auf
 * See). Für z16 wird die z15-Elternkachel hochskaliert. Terrarium-Kodierung, 512 px Kacheln.
 */
const MAPTERHORN = 'https://tiles.mapterhorn.com';
const AWS = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

/** Tile-URL für die raster-dem-Quelle */
export const DEM_TILES = 'orbis-dem://{z}/{x}/{y}';
/** letzte Zoomstufe mit echten (nativ angefragten) Kacheln – darunter wird in MapLibre überzeichnet */
export const DEM_NATIVE_ZOOM = 16;
const PROTOCOL = 'orbis-dem';
const SIZE = 512;

let registered = false;

/** registriert das Tile-Protokoll einmalig; wird vor dem ersten Kartenstart aufgerufen */
export function registerDemTiles() {
  if (registered) return;
  registered = true;
  addProtocol(PROTOCOL, async (params, abortController) => {
    const [z, x, y] = params.url.split(`${PROTOCOL}://`)[1].split('/').map(Number);
    const signal = abortController.signal;
    try {
      // 1) echte Mapterhorn-Kachel (detaillierteste Lösung)
      const mh = await fetch(`${MAPTERHORN}/${z}/${x}/${y}.webp`, { signal });
      if (mh.ok) return { data: await mh.arrayBuffer() };

      // 2) z16 deckt AWS nicht ab: detaillierteste Elternkachel (Mapterhorn ab z13, sonst AWS z15)
      //    hochskalieren – nur der passende Quadrant kommt in die Kachel
      if (z === DEM_NATIVE_ZOOM) {
        for (let pz = z - 1; pz >= 13; pz--) {
          for (const [base, ext] of [[MAPTERHORN, '.webp'], [AWS, '.png']] as const) {
            const tile = await fetchTile(base, pz, x, y, z, ext, signal);
            if (tile) {
              const out = await upscaleQuadrant(tile, x, y, z - pz);
              tile.close();
              return { data: out };
            }
          }
        }
      }

      // 3) AWS-Terrarium deckt z0–15 weltweit inkl. Meer ab (256 px → auf 512 skalieren)
      const aws = await fetch(`${AWS}/${z}/${x}/${y}.png`, { signal });
      if (aws.ok) {
        const bmp = await createImageBitmap(await aws.blob());
        const out = await upscaleFull(bmp);
        bmp.close();
        return { data: out };
      }
    } catch (e) {
      if (aborted(signal)) throw e;
    }
    throw new Error(`DEM-Kachel ${z}/${x}/${y} nicht verfügbar`);
  });
}

const aborted = (signal?: AbortSignal | null) => signal !== null && signal !== undefined && signal.aborted;

/** Kinderkachel x/y (Zoom z) aus der Elternkachel Zoom pz herausholen; null wenn nicht ladbar */
async function fetchTile(base: string, pz: number, x: number, y: number, z: number, ext: string, signal?: AbortSignal | null): Promise<ImageBitmap | null> {
  try {
    const r = await fetch(`${base}/${pz}/${x >> (z - pz)}/${y >> (z - pz)}${ext}`, { signal });
    return r.ok ? await createImageBitmap(await r.blob()) : null;
  } catch (e) {
    if (aborted(signal)) throw e;
    return null;
  }
}

/** Quadrat-Ausschnitt der Elternkachel auf 512 px hochskalieren – nearest, Terrarium-Encoding bleibt exakt */
async function upscaleQuadrant(bmp: ImageBitmap, x: number, y: number, levels: number): Promise<ArrayBuffer> {
  const n = 1 << levels;
  const px = x & (n - 1), py = y & (n - 1);
  const c = new OffscreenCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bmp, (px * bmp.width) / n, (py * bmp.height) / n, bmp.width / n, bmp.height / n, 0, 0, SIZE, SIZE);
  return c.convertToBlob({ type: 'image/png' }).then((b) => b.arrayBuffer());
}

/** ganze Kachel auf 512 px hochskalieren (AWS-Tiles sind 256 px, die DEM-Quelle erwartet 512) */
async function upscaleFull(bmp: ImageBitmap): Promise<ArrayBuffer> {
  const c = new OffscreenCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, 0, SIZE, SIZE);
  return c.convertToBlob({ type: 'image/png' }).then((b) => b.arrayBuffer());
}
