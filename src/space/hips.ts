import * as THREE from 'three';
import { ang2pixNest, cellPointDir, radecFromDir } from './healpix';
import { sphereProjection, type Projection, type Vec3 } from './projections';
// HiPS-Layer für die Sterne-Ansicht (Hierarchical Progressive Surveys, IVOA-Empfehlung).
// Lädt JPEG-Kacheln progressiv aus dem HEALPix-Raster und legt sie als Quads
// auf die Himmelskugel (innen/außen) oder in eine flache Kartenprojektion.
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
  tileExt: string; // 'jpg' | 'png'
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
    // jpeg bevorzugen (kleiner); reine PNG-Pakete tragen Transparenz außerhalb der Abdeckung
    tileExt: /jpe?g/i.test(pick('hips_tile_format')[0] ?? '') ? 'jpg' : 'png',
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

// Sicht auf den Himmel: sample(nx, ny) liefert die Himmelsrichtung unter einem Bildpunkt
// (NDC −1..1, y nach oben) oder null (z. B. neben Globus/Karte).
export interface HiPSView {
  pxPerRad: number; // Bildschirmpixel pro Radiant in der Bildmitte
  span: number; // Winkelausdehnung der größeren Bilddimension (rad)
  sample(nx: number, ny: number): Vec3 | null;
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
  renderBase = 10; // Zeichenreihenfolge der Ebene (Überlagerungen höher)
  private urlIdx = 0;
  private texLoader: THREE.TextureLoader;
  private busy = 0;
  private queue: Cell[] = [];
  private cells = new Map<string, Cell>();
  private lru: string[] = [];
  private lastCenter: Vec3 = [0, 0, 0];
  private lastSpan = -1;
  private proj: Projection = sphereProjection;
  private side: THREE.Side = THREE.BackSide;
  private dirty = false; // Kachel fertig geladen -> Sichtbarkeit neu bestimmen, auch ohne Kamerabewegung

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

  setMaxOrder(n: number) {
    this.maxUseOrder = Math.min(n, this.props.order);
    this.lastSpan = -1;
    this.dirty = true;
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

  // Projektion/Seite wechseln: alle Zellen neu aufbauen (Kugel innen/außen, flache Karte)
  setProjection(proj: Projection, side: THREE.Side) {
    this.proj = proj;
    this.side = side;
    for (const [, c] of this.cells) {
      c.mesh.geometry.dispose();
      c.mesh.geometry = cellGeometry(1 << c.order, c.ipix, proj);
      c.mat.side = side;
    }
    this.lastSpan = -1;
    this.dirty = true;
  }

  // Pro Frame aufrufen; intern gedrosselt (nur bei Verschiebung/Zoom-Änderung).
  update(view: HiPSView) {
    if (!this.active) return;
    const c = view.sample(0, 0) ?? ([1, 0, 0] as Vec3);
    const dot = c[0] * this.lastCenter[0] + c[1] * this.lastCenter[1] + c[2] * this.lastCenter[2];
    const moved = Math.acos(Math.max(-1, Math.min(1, dot))) > 0.05 * view.span;
    const zoomed = Math.abs(Math.log(view.span / this.lastSpan)) > 0.025;
    if (!this.dirty && this.cells.size && !moved && !zoomed) return;
    this.dirty = false;
    this.lastCenter = c;
    this.lastSpan = view.span;

    try {
      const k = this.targetOrder(view.pxPerRad);
      const want = this.visibleIpix(view, k);
      this.refresh(k, want);
    } catch (e) {
      // nie den Render-Loop der Ansicht mitreißen lassen
      console.warn('HiPS update Fehler', e);
    }
  }

  // Ziel-Ordnung: Kachelauflösung soll Bildschirmauflösung decken
  private targetOrder(ppRad: number): number {
    // Zelle der Ordnung k ≈ 58,6°/2^k groß, Kachel = 512 px breit
    const texPerRad = (k: number) => this.props.tileWidth * 2 ** k / (58.6 * Math.PI / 180);
    let k = this.props.orderMin;
    while (k < this.maxUseOrder && texPerRad(k) < ppRad * 1.25) k++;
    return k;
  }

  // ipix-Liste der Zellen, die das Blickfeld schneiden (Probenraster)
  private visibleIpix(view: HiPSView, k: number): number[] {
    const nside = 1 << k;
    const cellRad = (58.6 * Math.PI / 180) / 2 ** k;
    const n = Math.min(48, Math.max(4, Math.ceil(view.span / cellRad * 4)));
    const found = new Set<number>();
    for (let iy = 0; iy <= n; iy++) {
      for (let ix = 0; ix <= n; ix++) {
        const d = view.sample((ix / n) * 2 - 1, (iy / n) * 2 - 1);
        if (!d) continue;
        const { ra, dec } = radecFromDir(d);
        found.add(ang2pixNest(nside, ra, dec));
      }
    }
    return [...found];
  }

  private refresh(k: number, want: number[]) {
    // Zielzellen + deren Elternkette bereitstellen
    for (const ipix of want) this.ensureChain(k, ipix);
    // Veraltete, noch nicht gestartete Anfragen (z. B. aus früheren Zoomstufen) verwerfen,
    // damit die aktuell gebrauchten Kacheln nicht hinter ihnen warten
    const needed = new Set<string>();
    for (const ipix of want) for (let lvl = 0; lvl <= k; lvl++) needed.add(`${lvl}/${Math.floor(ipix / 4 ** (k - lvl))}`);
    this.queue = this.queue.filter((cell) => {
      const key = `${cell.order}/${cell.ipix}`;
      if (needed.has(key)) return true;
      this.cells.delete(key);
      const i = this.lru.indexOf(key);
      if (i >= 0) this.lru.splice(i, 1);
      this.group.remove(cell.mesh);
      cell.mat.dispose();
      cell.mesh.geometry.dispose();
      return false;
    });
    // Sichtbarkeit: je Zielzelle die feinste bereits geladene Ahnen-Kachel zeigen
    // (Eltern bleiben stehen, bis die Kinder da sind – keine Löcher, kein Pop-in)
    const show = new Set<string>();
    for (const ipix of want) {
      // feinste fertige Kachel + nächstgröbere darunter: die Eltern bleiben stehen,
      // solange die Kinder einblenden (sonst kurz schwarz)
      let found = 0;
      for (let lvl = k; lvl >= 0 && found < 2; lvl--) {
        const key = `${lvl}/${Math.floor(ipix / 4 ** (k - lvl))}`;
        if (this.cells.get(key)?.ready) { show.add(key); found++; }
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
    const geo = cellGeometry(1 << order, ipix, this.proj);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, side: this.side,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = this.renderBase + order;
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
    // HiPS-Pfad: bei hohen Ordnungen liegt die Kachel in Dir<block> (Blöcke à 10000), der Dateiname trägt den vollen Index
    const block = Math.floor(cell.ipix / 10000) * 10000;
    const url = `${this.props.serviceUrls[urlIdx % this.props.serviceUrls.length].replace(/\/+$/, '')}/Norder${cell.order}/Dir${block}/Npix${cell.ipix}.${this.props.tileExt}`;
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
        this.dirty = true;
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

// Zelle als Gitter exakt auf der Kugel bzw. in der Kartenprojektion. Kachelbild: Spalte ↔ iy,
// Zeile (von oben) ↔ ix (per Abgleich mit der Basiskarte ermittelt), daher u = t, v = 1 − s.
function cellGeometry(nside: number, ipix: number, proj: Projection): THREE.BufferGeometry {
  const seg = 8;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const s = i / seg;
      const t = j / seg;
      const [x, y, z] = proj.project(cellPointDir(nside, ipix, s, t));
      pos.push(x, y, z);
      uvs.push(t, 1 - s);
    }
  }
  const crosses = (a: number, b: number, c: number) => {
    if (!isFinite(proj.seam)) return false;
    const xs = [pos[a * 3], pos[b * 3], pos[c * 3]];
    return Math.max(...xs) - Math.min(...xs) > proj.seam;
  };
  const tri = (a: number, b: number, c: number) => {
    if (!crosses(a, b, c)) idx.push(a, b, c);
  };
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + 1;
      const c = a + (seg + 1);
      const d = c + 1;
      tri(a, b, c); tri(b, d, c); tri(a, c, b); tri(b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  return geo;
}
