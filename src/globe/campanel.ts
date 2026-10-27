import type { Map as MlMap } from 'maplibre-gl';
import { escapeHtml, fmt, safeUrl } from '../util';
import { glyphSvg } from './icons';
import { attachHls } from './hls';
import { CamViewLayer } from './camview3d';
import { CARDINAL } from './layers/shared/cams';
import { category, tile } from './sidepanel';
import { camdirWritable, cloudKey, hasRemoteDir } from '../api/camdircloud';
import { openCamDirModal } from './camdirmodal';
import './flightpanel.css';

// Right-hand panel of the selected webcam (like the flight and ship panel): live picture, viewing
// direction and source. The 3D board with the picture stands on the map as long as the panel is open.

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

export class CamPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private sel: CamSelection | null = null;
  private view = new CamViewLayer();
  private open_ = new Set<string>();
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
        <button type="button" data-act="edit" hidden>Richtung bearbeiten</button>
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
    this.sel = sel;
    this.onOpen?.();
    this.root.hidden = false;
    this.render();
  }

  close() {
    if (!this.sel) return;
    this.sel = null;
    this.view.hide();
    // removing the video from the page also stops the stream (see hls.ts)
    this.body.innerHTML = '';
    this.root.hidden = true;
  }

  /** opens the editor: picture next to a satellite map with the viewing direction */
  private edit() {
    const s = this.sel;
    if (!s) return;
    const p = s.p;
    const img = safeUrl(p.image);
    openCamDirModal({
      title: String(p.title ?? 'Webcam'),
      lng: s.lng,
      lat: s.lat,
      dir: this.dir(),
      image: img ? `${img}${img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}` : undefined,
      hls: safeUrl(p.hls) ?? undefined,
      key: cloudKey(p.id, s.lng, s.lat),
      saved: hasRemoteDir(cloudKey(p.id, s.lng, s.lat)),
      // the layer data carries the new direction after the save – the panel follows
      onChange: (dir) => {
        if (this.sel !== s) return;
        s.p = dir === null ? { ...p, dir: undefined, dirset: undefined } : { ...p, dir, dirset: true };
        this.render();
      },
    });
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
    (this.root.querySelector('[data-act="tilt"]') as HTMLElement).hidden = dir < 0;
    // own worker + token in the settings: the direction can be corrected
    const edit = this.root.querySelector<HTMLElement>('[data-act="edit"]')!;
    edit.hidden = !camdirWritable();
    this.root.querySelector('.fp-actions')!.classList.toggle('three', !edit.hidden && dir >= 0);
    const el = this.body.querySelector<HTMLVideoElement>('video.pop-cam');
    // stream not playable (offline, blocked): fall back to the still image
    if (el && hls) attachHls(el, hls, () => (el.outerHTML = still));
    const map = this.h.map();
    if (map && dir >= 0) this.view.show(map, { lon: s.lng, lat: s.lat, dir, video: el ?? undefined, image: img ?? undefined, anchor: this.root });
    else this.view.hide();
  }
}
