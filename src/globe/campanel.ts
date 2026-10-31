import { Marker, type Map as MlMap } from 'maplibre-gl';
import { escapeHtml, fmt, safeUrl } from '../util';
import { glyphSvg } from './icons';
import { attachHls } from './hls';
import { CamViewLayer } from './camview3d';
import { CARDINAL } from './layers/shared/cams';
import { category, tile } from './sidepanel';
import { camdirWritable, cloudKey, hasRemoteDir, previewDir, removeCamDir, saveCamDir } from '../api/camdircloud';
import './flightpanel.css';

// Right-hand panel of the selected webcam (like the flight and ship panel): live picture, viewing
// direction and source. The 3D board with the picture stands on the map as long as the panel is open.
// Editing happens on the map itself: the camera is dragged to its place, a grip at the end of the view cone turns
// the viewing direction, the panel holds the exact direction value.

export interface CamPanelHooks {
  map(): MlMap | null;
}

export interface CamSelection {
  /** properties of the clicked camera feature */
  p: Record<string, unknown>;
  lng: number;
  lat: number;
}

const COLOR = '#00bfa5';

const M_LAT = 110574; // metres per degree of latitude
const GRIP_PX = 70; // distance of the direction grip from the camera on screen

interface Field {
  id: 'dir';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  dec: number;
}
const FIELDS: Field[] = [
  { id: 'dir', label: 'Richtung', unit: '°', min: 0, max: 360, step: 0.5, dec: 1 },
];
const row = (f: Field, key: string) =>
  `<label class="ce-row" data-f="${key}"><span>${f.label}</span><input type="range" min="${f.min}" max="${f.max}" step="${f.step}"><input type="number" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${f.label}"><i>${f.unit}</i></label>`;

/** state of the camera being edited on the map */
interface Edit {
  key: string;
  /** where the camera was found (before any move) */
  olng: number;
  olat: number;
  lng: number;
  lat: number;
  dir: number;
  saved: boolean;
  pin: Marker;
  grip: Marker;
  raf: number;
}
const norm = (d: number) => (Math.round((((d % 360) + 360) % 360) * 10) / 10) % 360;

export class CamPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private sel: CamSelection | null = null;
  private view = new CamViewLayer();
  private open_ = new Set<string>();
  private ed: Edit | null = null;
  private media: { video?: HTMLVideoElement; image?: string } = {};
  /** called when the panel opens, so the other panels can step aside */
  onOpen?: () => void;

  constructor(
    parent: HTMLElement,
    private h: CamPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head" style="--c:${COLOR}"><i class="fp-ic">${glyphSvg('webcam', COLOR, 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions">
        <button type="button" data-act="tilt">In 3D ansehen</button>
        <button type="button" data-act="zoom">Heranzoomen</button>
        <button type="button" data-act="edit" hidden>Auf Karte bearbeiten</button>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act === 'zoom') this.fly(false);
      else if (act === 'tilt') this.fly(true);
      else if (act === 'edit') this.edit();
    });
    this.body.addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        if (d.dataset.key) d.open ? this.open_.add(d.dataset.key) : this.open_.delete(d.dataset.key);
      },
      true,
    );
  }

  open(sel: CamSelection) {
    this.endEdit();
    this.sel = sel;
    this.onOpen?.();
    this.root.hidden = false;
    this.render();
  }

  close() {
    if (!this.sel) return;
    this.endEdit();
    this.sel = null;
    this.view.hide();
    // removing the video from the page also stops the stream (see hls.ts)
    this.body.innerHTML = '';
    this.root.hidden = true;
  }

  private key(): string {
    const s = this.sel!;
    return typeof s.p.ckey === 'string' ? s.p.ckey : cloudKey(s.p.id, s.lng, s.lat);
  }

  /** editing on the map: pin to drag, grip for the direction, values in the panel */
  private edit() {
    const s = this.sel;
    const map = this.h.map();
    if (!s || !map || this.ed) return;
    const p = s.p;
    const d = this.dir();
    const key = this.key();
    const pin = document.createElement('div');
    pin.className = 'ce-pin';
    pin.title = 'Ziehen, um die Kamera zu verschieben';
    const grip = document.createElement('div');
    grip.className = 'ce-grip';
    grip.title = 'Ziehen, um die Blickrichtung zu drehen';
    for (const el of [pin, grip]) el.addEventListener('click', (e) => e.stopPropagation());
    const ed: Edit = {
      key,
      olng: Number.isFinite(Number(p.olon)) ? Number(p.olon) : s.lng,
      olat: Number.isFinite(Number(p.olat)) ? Number(p.olat) : s.lat,
      lng: s.lng,
      lat: s.lat,
      dir: d >= 0 ? norm(d) : 0,
      saved: hasRemoteDir(key),
      pin: new Marker({ element: pin, draggable: true }).setLngLat([s.lng, s.lat]).addTo(map),
      grip: new Marker({ element: grip, draggable: true }).setLngLat([s.lng, s.lat]).addTo(map),
      raf: 0,
    };
    this.ed = ed;
    ed.pin.on('drag', () => {
      const ll = ed.pin.getLngLat();
      ed.lng = ll.lng;
      ed.lat = ll.lat;
      this.placeGrip();
      this.changed();
    });
    ed.grip.on('drag', () => {
      const ll = ed.grip.getLngLat();
      const kx = 111320 * Math.cos((ed.lat * Math.PI) / 180);
      ed.dir = norm((Math.atan2((ll.lng - ed.lng) * kx, (ll.lat - ed.lat) * M_LAT) * 180) / Math.PI);
      this.changed();
    });
    ed.grip.on('dragend', () => this.placeGrip());
    map.on('zoom', this.onZoom);
    this.placeGrip();
    this.renderEdit();
    this.changed();
  }

  private onZoom = () => this.placeGrip();

  /** the grip stands in the viewing direction at a fixed distance on screen */
  private placeGrip() {
    const ed = this.ed;
    const map = this.h.map();
    if (!ed || !map) return;
    const m = (GRIP_PX * 78271.517 * Math.cos((ed.lat * Math.PI) / 180)) / 2 ** map.getZoom();
    const a = (ed.dir * Math.PI) / 180;
    const kx = 111320 * Math.cos((ed.lat * Math.PI) / 180);
    ed.grip.setLngLat([ed.lng + (Math.sin(a) * m) / kx, ed.lat + (Math.cos(a) * m) / M_LAT]);
  }

  /** position of the camera if it was moved away from where it was found */
  private movedPos(ed: Edit): [number, number] | undefined {
    const m = Math.hypot((ed.lng - ed.olng) * 111320 * Math.cos((ed.lat * Math.PI) / 180), (ed.lat - ed.olat) * M_LAT);
    return m > 0.3 ? [Math.round(ed.lng * 1e6) / 1e6, Math.round(ed.lat * 1e6) / 1e6] : undefined;
  }

  /** something changed: show it on the map (3D board, cone) and in the panel */
  private changed() {
    const ed = this.ed;
    const s = this.sel;
    if (!ed || !s) return;
    this.syncEdit();
    // the layer data follows at most once per frame
    cancelAnimationFrame(ed.raf);
    // any pose stored in the cloud stays untouched (the 3D ground projection is off for now)
    ed.raf = requestAnimationFrame(() => previewDir(ed.key, ed.dir, undefined, this.movedPos(ed)));
    this.view.update({ lon: ed.lng, lat: ed.lat, dir: ed.dir, ...this.media, anchor: this.root });
  }

  private syncEdit() {
    const ed = this.ed;
    if (!ed) return;
    const vals: Record<string, number> = { dir: ed.dir };
    for (const [id, val] of Object.entries(vals)) {
      const r = this.body.querySelector(`[data-f="${id}"]`);
      if (!r) continue;
      const f = FIELDS.find((x) => x.id === id)!;
      const [range, num] = r.querySelectorAll('input');
      range.value = String(val);
      if (document.activeElement !== num) num.value = val.toFixed(f.dec);
    }
    const out = this.body.querySelector('.ce-pos');
    if (out) {
      const mv = this.movedPos(ed);
      const dist = Math.hypot((ed.lng - ed.olng) * 111320 * Math.cos((ed.lat * Math.PI) / 180), (ed.lat - ed.olat) * M_LAT);
      out.textContent = `${fmt.num(ed.lat, 5)}, ${fmt.num(ed.lng, 5)}${mv ? ` · ${Math.round(dist * 10) / 10} m verschoben` : ''}`;
    }
  }

  private setField(id: Field['id'], val: number) {
    const ed = this.ed;
    if (!ed || !Number.isFinite(val)) return;
    if (id === 'dir') {
      ed.dir = norm(val);
      this.placeGrip();
    }
    this.changed();
  }

  /** wires the sliders / number fields (the direction) */
  private bindRows() {
    this.body.querySelectorAll<HTMLElement>('.ce-row').forEach((r) => {
      const id = r.dataset.f!;
      const [range, num] = r.querySelectorAll('input');
      range.addEventListener('input', () => this.setField(id as Field['id'], Number(range.value)));
      num.addEventListener('change', () => this.setField(id as Field['id'], Number(num.value)));
    });
  }

  private renderEdit() {
    const ed = this.ed!;
    // the live picture stays on top and keeps playing (it is part of what is lined up with the map)
    const keep = this.body.querySelector('.cam-media');
    this.body.replaceChildren(...(keep ? [keep] : []));
    this.body.insertAdjacentHTML('beforeend', `<div class="ce">
      <div class="sp-note">Die Kamera (großer Punkt) auf der Karte verschieben, den weißen Griff ziehen, um die Blickrichtung zu drehen. Die genauen Werte stehen hier.</div>
      <div class="ce-pos"></div>
      ${FIELDS.map((f) => row(f, f.id)).join('')}
      <div class="ce-btns"><button type="button" data-e="save" class="primary">Speichern</button><button type="button" data-e="cancel">Abbrechen</button><button type="button" data-e="reset" ${ed.saved ? '' : 'hidden'}>Zurücksetzen</button></div>
      <div class="ce-msg" role="status"></div>
    </div>`);
    this.root.querySelector<HTMLElement>('.fp-actions')!.hidden = true;
    this.bindRows();
    this.body.querySelector('.ce-btns')!.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.e;
      if (a === 'cancel') this.cancelEdit();
      else if (a === 'save') this.saveEdit();
      else if (a === 'reset') this.resetEdit();
    });
    this.syncEdit();
  }

  /** leaves edit mode without saving: map and layer are as stored */
  private endEdit() {
    const ed = this.ed;
    if (!ed) return;
    this.ed = null;
    cancelAnimationFrame(ed.raf);
    this.h.map()?.off('zoom', this.onZoom);
    ed.pin.remove();
    ed.grip.remove();
    previewDir(ed.key, null);
    this.root.querySelector<HTMLElement>('.fp-actions')!.hidden = false;
  }

  private cancelEdit() {
    this.endEdit();
    this.render();
  }

  private busy(on: boolean, text = '') {
    this.body.querySelectorAll<HTMLButtonElement>('.ce-btns button').forEach((b) => (b.disabled = on));
    const m = this.body.querySelector('.ce-msg');
    if (m) m.textContent = text;
  }

  private async saveEdit() {
    const ed = this.ed;
    const s = this.sel;
    if (!ed || !s) return;
    const pos = this.movedPos(ed);
    this.busy(true, 'Wird gesendet …');
    try {
      await saveCamDir(ed.key, ed.dir, undefined, pos);
    } catch (err) {
      this.busy(false, `Fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      return;
    }
    if (this.ed !== ed) return;
    this.endEdit();
    s.lng = pos?.[0] ?? ed.olng;
    s.lat = pos?.[1] ?? ed.olat;
    // the stored pose (if any) is not shown anywhere right now, but stays in the cloud
    const flat = { pdown: undefined, palt: undefined, proll: undefined, pfov: undefined };
    s.p = { ...s.p, dir: ed.dir, dirset: true, ...flat, ...(pos ? { ckey: ed.key, olon: ed.olng, olat: ed.olat } : { ckey: undefined, olon: undefined, olat: undefined }) };
    this.render();
  }

  private async resetEdit() {
    const ed = this.ed;
    const s = this.sel;
    if (!ed || !s) return;
    this.busy(true, 'Wird gesendet …');
    try {
      await removeCamDir(ed.key);
    } catch (err) {
      this.busy(false, `Fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      return;
    }
    if (this.ed !== ed) return;
    this.endEdit();
    s.lng = ed.olng;
    s.lat = ed.olat;
    s.p = { ...s.p, dir: undefined, dirset: undefined, pdown: undefined, palt: undefined, proll: undefined, pfov: undefined, ckey: undefined, olon: undefined, olat: undefined };
    this.render();
  }

  private dir(): number {
    const d = Number(this.sel?.p.dir);
    return Number.isFinite(d) && d >= 0 ? d : -1;
  }

  /** zoom to the camera; with `tilt` the map looks along the camera, the board standing above it */
  private fly(tilt: boolean) {
    const map = this.h.map();
    const s = this.sel;
    if (!map || !s) return;
    const dir = this.dir();
    if (tilt && dir >= 0) {
      map.easeTo({ center: [s.lng, s.lat], bearing: dir, pitch: 62, zoom: Math.max(map.getZoom(), 16), offset: [0, Math.round(map.getContainer().clientHeight * 0.22)], duration: 1200 });
    } else {
      map.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
    }
  }

  private render() {
    const s = this.sel!;
    const p = s.p;
    const dir = this.dir();
    // road cameras of the feeds: the direction is the road's direction of travel or an estimate
    const est = p.kind === 'road' && !p.dirset;
    const img = safeUrl(p.image);
    // still images are cached by browsers – add a cache-buster (not for signed Windy URLs)
    const src = img && p.kind === 'road' ? `${img}${img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}` : img;
    const video = safeUrl(p.video);
    const hls = safeUrl(p.hls);
    const link = safeUrl(p.url);
    this.root.querySelector('.fp-title')!.textContent = String(p.title ?? 'Webcam');
    this.root.querySelector('.fp-sub')!.textContent = String(p.subtitle ?? '');
    const still = src ? `<a class="pop-cam" href="${escapeHtml(link ?? img ?? '#')}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="Webcam-Bild" referrerpolicy="no-referrer"></a>` : '<div class="fp-note">Livestream gerade nicht verfügbar</div>';
    // the 3D board uses the playing video as a texture: HLS plays via hls.js from a blob: URL, the plain video is loaded with CORS
    const media = hls
      ? `<video class="pop-cam" ${src ? `poster="${escapeHtml(src)}"` : ''} autoplay muted playsinline controls></video>`
      : video
        ? `<video class="pop-cam" crossorigin="anonymous" src="${escapeHtml(video)}" ${src ? `poster="${escapeHtml(src)}"` : ''} autoplay muted loop playsinline controls></video>`
        : still;
    const tiles = `<div class="sp-tiles">${tile('Blickrichtung', dir >= 0 ? `${est ? 'ca. ' : ''}${Math.round(dir)}° ${CARDINAL[Math.round(dir / 45) % 8]}` : 'unbekannt')}${tile('Bild', hls || video ? 'Livestream' : 'Standbild')}</div>`;
    const note = dir >= 0 ? `<div class="sp-note">Das Bild steht als 3D-Tafel in Blickrichtung auf der Karte${est ? ' – die Richtung ist ein Näherungswert (Fahrtrichtung der Straße)' : ''}.</div>` : '<div class="sp-note">Zu dieser Kamera ist keine Blickrichtung bekannt, daher gibt es keine 3D-Tafel.</div>';
    const date = typeof p.updated === 'string' && p.updated ? [['Aktualisiert', `${escapeHtml(fmt.dateTime(p.updated))} (${escapeHtml(fmt.relative(p.updated))})`] as [string, string]] : [];
    const cats = category('cam', 'Kamera', [['Standort', `${fmt.num(s.lat, 4)}, ${fmt.num(s.lng, 4)}`], ...date], this.open_);
    const source = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">${escapeHtml(String(p.source ?? ''))}${link ? ` · <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Webcam öffnen ↗</a>` : ''}</div></details>`;
    this.body.innerHTML = `<div class="cam-media">${media}</div>${tiles}${note}${cats}${source}`;
    this.bindRows();
    (this.root.querySelector('[data-act="tilt"]') as HTMLElement).hidden = dir < 0;
    // own worker + token in the settings: the direction can be corrected
    const edit = this.root.querySelector<HTMLElement>('[data-act="edit"]')!;
    edit.hidden = !camdirWritable();
    this.root.querySelector('.fp-actions')!.classList.toggle('three', !edit.hidden && dir >= 0);
    const el = this.body.querySelector<HTMLVideoElement>('video.pop-cam');
    // stream not playable (offline, blocked): fall back to the still image
    if (el && hls) attachHls(el, hls, () => (el.outerHTML = still));
    const map = this.h.map();
    this.media = { video: el ?? undefined, image: img ?? undefined };
    if (map && dir >= 0) this.view.show(map, { lon: s.lng, lat: s.lat, dir, ...this.media, anchor: this.root });
    else this.view.hide();
  }
}
