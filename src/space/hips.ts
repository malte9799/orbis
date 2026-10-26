import * as THREE from 'three';
import { ang2pixNest, cellCornersRadec, dirFromRadec, radecFromDir } from './healpix';
// HiPS-Layer für die Sterne-Ansicht (Hierarchical Progressive Surveys, IVOA-Empfehlung).
// Lädt JPEG-Kacheln progressiv aus dem HEALPix-Raster und legt sie als Quads
// auf die Innenseite der Himmelskugel. Basis bleibt die NASA Deep Star Map;
// Kinder-Kacheln ersetzen ihre Eltern, sobald alle geladen sind (kein Pop-in).

export interface HiPSConfig {
  url: string; // Basis-URL (laut properties, mit Spiegel-Fallbacks)
  maxOrder: number;
  tileWidth: number;
  orderMin: number;
  frame: string; // 'equatorial' | 'galactic'
  label: string;
  credit: string;
}

const CONCURRENCY = 4;
const TEX_CAP = 160; // LRU-Obergrenze für Kachel-Texturen

interface HiPSProps {
  serviceUrls: string[]; // Master + Spiegel, Priorität = Reihenfolge
  order: number;
  orderMin: number;
  tileWidth: number;
  frame: string;
  title: string;
  ack: string;
}

async function fetchProps(base: string): Promise<HiPSProps> {
  const res = await fetch(`${base.replace(/\/+$/, '')}/properties`);
  if (!res.ok) throw new Error(`HiPS properties nicht ladebar (${res.status})`);
  const text = await res.text();
  const pick = (k: string): string[] => {
    const out: string[] = [];
    const re = new RegExp(`^${k}(?:_(\\d+))?\\s*=\\s*(.*)$`, 'gm');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push(m[2].trim());
    return out;
  };
  const num = (k: string, def: number): number => {
    const v = Number(pick(k)[0]);
    return Number.isFinite(v) ? v : def;
  };
  return {
    // ohne echte Liste: die eigene Basis-URL ist der Master-Server; ggf. bekannte
    // Spiegel (alaskybis/ESA) hinzufügen, falls der properties-Block sie nennt
    serviceUrls: pick('hips_service_url').length ? pick('hips_service_url') : [base],
    order: num('hips_order', 0),
    orderMin: num('hips_order_min', 0),
    tileWidth: num('hips_tile_width', 512),
    frame: pick('hips_frame')[0] ?? 'equatorial',
    title: pick('obs_title')[0] ?? base,
    ack: (pick('obs_copyright')[0] ?? pick('obs_ack')[0] ?? '').replace(/^["']|["']$/g, ''),
  };
}

export async function createHiPSLayer(base: string, maxUseOrder?: number): Promise<HiPSLayer> {
  const p = await fetchProps(base);
  if (!p.order) throw new Error(`hips_order fehlt in ${base}`);
  const l = new HiPSLayer(p, maxUseOrder);
  return l;
}

interface Cell {
  order: number;
  ipix: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  ready: boolean;
  animId?: number;
}

export class HiPSLayer {
  group = new THREE.Group();
  opacity = 1;
  active = false;

  private props: HiPSProps;
  maxUseOrder: number;
  private urlIdx = 0;
  private texLoader: THREE.TextureLoader;
  private busy = 0;
  private queue: Cell[] = [];
  private cells = new Map<string, Cell>();
  private lru: string[] = [];
  private lastFov = -1;
  private lastRa = -999;
  private lastDec = -999;
  private lastViewPx = 800;

  constructor(props: HiPSProps, maxUseOrder?: number) {
    this.props = props;
    this.maxUseOrder = Math.min(maxUseOrder ?? props.order, props.order);
    this.texLoader = new THREE.TextureLoader();
    this.texLoader.setCrossOrigin('anonymous');
    this.group.visible = false;
  }

  get credit(): string {
    return this.props.ack;
  }
  get label(): string {
    return this.props.title;
  }

  setActive(on: boolean) {
    this.active = on;
    this.group.visible = on;
  }

  setOpacity(o: number) {
    this.opacity = o;
    for (const [, c] of this.cells) {
      if (c.ready) c.mat.opacity = o;
    }
  }

  // Pro Frame aufrufen; intern gedrosselt (nur bei Richtungs-/FOV-Änderung).
  // viewPx = kleine Bildschirmdimension in Pixeln (Zoom-Metrik)
  update(camera: THREE.PerspectiveCamera, viewPx = 800) {
    if (!this.active) return;
    this.lastViewPx = viewPx;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const { ra, dec } = radecFromDir(fwd.toArray() as [number, number, number]);
    const dRa = Math.abs(ra - this.lastRa + 540) % 360 - 180;
    const dDec = Math.abs(dec - this.lastDec);
    const dFov = Math.abs(camera.fov - this.lastFov);
    if (this.cells.size && dRa < 1 && dDec < 1 && dFov < 0.5) return;
    this.lastFov = camera.fov;
    this.lastRa = ra;
    this.lastDec = dec;

    try {
      const k = this.targetOrder(camera);
      const want = this.visibleIpix(camera, k);
      this.refresh(k, want);
    } catch (e) {
      // nie den Render-Loop der Ansicht mitreißen lassen
      console.warn('HiPS update Fehler', e);
    }
  }

  // Ziel-Ordnung: Kachelauflösung soll Bildschirmauflösung decken
  private targetOrder(camera: THREE.PerspectiveCamera): number {
    const half = THREE.MathUtils.degToRad(camera.fov) / 2;
    const ppRad = 0.5 * this.viewPx() / Math.tan(half); // Screen-Pixel pro Radiant
    // Zelle der Ordnung k ≈ 58,6°/2^k groß, Kachel = 512 px breit
    const texPerRad = (k: number) => this.props.tileWidth * 2 ** k / (58.6 * Math.PI / 180);
    let k = this.props.orderMin;
    while (k < this.maxUseOrder && texPerRad(k) < ppRad * 1.25) k++;
    return k;
  }

  private viewPx(): number {
    return Math.max(384, this.lastViewPx); // kleinere Bildschirmdimension
  }

  // ipix-Liste der Zellen, die das Blickfeld schneiden (Probenraster)
  private visibleIpix(camera: THREE.PerspectiveCamera, k: number): number[] {
    const nside = 1 << k;
    const cellDeg = 58.6 / 2 ** k;
    const n = Math.min(9, Math.max(2, Math.ceil(2 / cellDeg * THREE.MathUtils.radToDeg(camera.fov) / 2)));
    const found = new Set<number>();
    const v = new THREE.Vector3();
    for (let iy = 0; iy <= n; iy++) {
      for (let ix = 0; ix <= n; ix++) {
        v.set((ix / n) * 2 - 1, (iy / n) * 2 - 1, 0.5).unproject(camera).normalize();
        const { ra, dec } = radecFromDir(v.toArray() as [number, number, number]);
        found.add(ang2pixNest(nside, ra, dec));
      }
    }
    return [...found];
  }

  private refresh(k: number, want: number[]) {
    // Zielzellen + deren Elternkette bereitstellen
    for (const ipix of want) this.ensureChain(k, ipix);
    // Sichtbarkeit: je Zielzelle die feinste bereits geladene Ahnen-Kachel zeigen
    // (Eltern bleiben stehen, bis die Kinder da sind – keine Löcher, kein Pop-in)
    const show = new Set<string>();
    for (const ipix of want) {
      for (let lvl = k; lvl >= 0; lvl--) {
        const key = `${lvl}/${Math.floor(ipix / 4 ** (k - lvl))}`;
        if (this.cells.get(key)?.ready) { show.add(key); break; }
      }
    }
    for (const [key, cell] of this.cells) cell.mesh.visible = this.active && show.has(key);
    this.evictStale(want);
  }

  private ensureChain(k: number, ipix: number) {
    // Basiszelle + binären Pfad bis Ordnung k laden (Kinder überdecken die Eltern)
    let cur = Math.floor(ipix / 4 ** k);
    let rem = ipix - cur * 4 ** k;
    for (let lvl = 0; lvl <= k; lvl++) {
      this.queueCell(lvl, cur);
      if (lvl === k) break;
      const p = 4 ** (k - lvl - 1);
      const digit = Math.floor(rem / p);
      rem -= digit * p;
      cur = cur * 4 + digit;
    }
  }

  private queueCell(order: number, ipix: number) {
    const key = `${order}/${ipix}`;
    let cell = this.cells.get(key);
    if (cell) {
      // LRU-Touch + falls 404-Platzhalter: nicht erneut laden (Spiegel nicht nötig)
      touchLru(this.lru, key);
      return;
    }
    cell = this.buildCell(order, ipix);
    this.cells.set(key, cell);
    touchLru(this.lru, key);
    this.queue.push(cell);
    this.pump();
  }

  private buildCell(order: number, ipix: number): Cell {
    const n = 1 << order;
    const cs = cellCornersRadec(n, ipix);
    const c00 = dirFromRadec(cs[0].ra, cs[0].dec);
    const c10 = dirFromRadec(cs[1].ra, cs[1].dec);
    const c11 = dirFromRadec(cs[3].ra, cs[3].dec);
    const c01 = dirFromRadec(cs[2].ra, cs[2].dec);
    const geo = quadGeometry(c00, c10, c11, c01);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 10 + order;
    mesh.visible = false;
    const cell: Cell = { order, ipix, mesh, mat, ready: false };
    this.group.add(mesh);
    return cell;
  }

  private pump() {
    while (this.busy < CONCURRENCY && this.queue.length) {
      const cell = this.queue.shift()!;
      this.busy++;
      this.loadTile(cell, this.urlIdx);
    }
  }

  private loadTile(cell: Cell, urlIdx: number) {
    // HiPS-Pfad: bei hohen Ordnungen liegt die Kachel in Dir<block> (Blöcke à 10000)
    const block = Math.floor(cell.ipix / 10000) * 10000;
    const ipixInDir = cell.ipix % 10000;
    const url = `${this.props.serviceUrls[urlIdx % this.props.serviceUrls.length].replace(/\/+$/, '')}/Norder${cell.order}/Dir${block}/Npix${ipixInDir}.jpg`;
    this.texLoader.load(
      url,
      (tex) => {
        this.busy--;
        if (this.busy < 0) this.busy = 0;
        if (!this.cells.has(`${cell.order}/${cell.ipix}`)) { tex.dispose(); this.pump(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        cell.mat.map = tex;
        cell.mat.needsUpdate = true;
        cell.ready = true;
        this.fadeIn(cell);
        this.pump();
      },
      undefined,
      () => {
        this.busy--;
        // Nächster Spiegel, falls vorhanden
        if (urlIdx + 1 < this.props.serviceUrls.length) {
          this.loadTile(cell, urlIdx + 1);
          this.pump();
          return;
        }
        // dauerhaft fehlend: Zelle unsichtbar lassen (Eltern/Base zeigt durch)
        cell.ready = false;
        cell.mesh.visible = false;
        this.pump();
      },
    );
  }

  private fadeIn(cell: Cell) {
    cancelAnimationFrame(cell.animId!);
    const start = performance.now();
    const tick = () => {
      const el = Math.min(1, (performance.now() - start) / 350);
      cell.mat.opacity = this.opacity * el * el;
      if (el < 1 && cell.ready) cell.animId = requestAnimationFrame(tick);
      else cell.mat.opacity = this.opacity;
    };
    cell.animId = requestAnimationFrame(tick);
  }

  // Entfernte Zellen disposen (nur tiefere Ordnungen + außerhalb des letzten Blickfelds)
  private evictStale(want: number[]) {
    while (this.lru.length > TEX_CAP + want.length) {
      const key = this.lru.shift()!;
      const cell = this.cells.get(key);
      if (!cell) continue;
      if (cell.animId) cancelAnimationFrame(cell.animId);
      this.cells.delete(key);
      this.group.remove(cell.mesh);
      cell.mat.map?.dispose();
      cell.mat.dispose();
      cell.mesh.geometry.dispose();
    }
  }

  dispose() {
    for (const [, cell] of this.cells) {
      if (cell.animId) cancelAnimationFrame(cell.animId);
      cell.mat.map?.dispose();
      cell.mat.dispose();
      cell.mesh.geometry.dispose();
    }
    this.cells.clear();
    this.lru = [];
    this.queue = [];
    this.group.clear();
  }
}

function touchLru(lru: string[], key: string) {
  const i = lru.indexOf(key);
  if (i >= 0) lru.splice(i, 1);
  lru.push(key);
}

// Sphärisches Bilinear-Quad zwischen vier Eck-Richtungen
function quadGeometry(
  c00: [number, number, number],
  c10: [number, number, number],
  c11: [number, number, number],
  c01: [number, number, number],
): THREE.BufferGeometry {
  const seg = 8;
  const v00 = new THREE.Vector3(...c00);
  const v10 = new THREE.Vector3(...c10);
  const v11 = new THREE.Vector3(...c11);
  const v01 = new THREE.Vector3(...c01);
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let j = 0; j <= seg; j++) {
    const t = j / seg;
    for (let i = 0; i <= seg; i++) {
      const s = i / seg;
      tmpA.copy(v00).lerp(v10, s).normalize();
      tmpB.copy(v01).lerp(v11, s).normalize();
      p.copy(tmpA).lerp(tmpB, t).normalize();
      pos.push(p.x, p.y, p.z);
      uvs.push(s, t);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + 1;
      const c = a + (seg + 1);
      const d = c + 1;
      idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  return geo;
}
