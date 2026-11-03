import type { Map as MlMap } from 'maplibre-gl';
import { sampleAt } from './track';
import { assetUrl, loadShipTrack, loadTrack } from './index';
import { pressureBar, profileOf, type KindProfile } from './kind';
import type { IncidentDef, IncidentMedia, Sample, TrackPoint } from './types';
import { embedOf } from './embed';
import { IncidentScene, pitchOf, type IncidentMark } from './layer3d';
import type { GeoFocus } from '../globe/geo3d/focus';
import type { GeoStage, GeoTarget } from '../globe/geo3d/stage';
import { escapeHtml, safeUrl, toast } from '../util';
import { OPTIONS_EVENT } from '../store';
import { altTxt, climbFtTxt, depthTxt, kntTxt, localize } from './units';
import { glyphSvg } from '../globe/icons';
import { tile } from '../globe/sidepanel';
import '../globe/flightpanel.css';
import './panel.css';

// Rechtes Panel zur Rekonstruktion eines Ereignisses: Wiedergabe der Flugspur (Zeitregler, Tempo, Endphase), 3D-Modell
// und Spur auf der Karte, Messwerte, Höhenprofil, Ereignisliste, Funk (eigene Tonspur) und Verweise auf Videos.

export interface IncidentPanelHooks {
  map(): MlMap | null;
  /** schließt die anderen rechten Panels */
  closeOthers(): void;
  /** die Rekonstruktion wurde geöffnet (true) bzw. geschlossen (false): der Marker der Ebene wird klein bzw. groß */
  simulating(on: boolean): void;
  /** der Kamera-Fokus der Karte (src/globe/geo3d/focus.ts): „Folgen“ läuft darüber */
  focus(): GeoFocus | null;
  /** die 3D-Bühne der Karte (src/globe/geo3d), auf der die Rekonstruktion gezeichnet wird */
  stage(): GeoStage | null;
  /** unterer Dock der Karte (Legende/Zeitleiste): die Wiedergabeleiste kommt hierhin */
  dock: HTMLElement;
  /** das Dock hat sich geändert (Handy-Sheet neu anordnen) */
  dockChanged(): void;
}

const SPEEDS = [1, 5, 30, 120, 900, 3600];
/** Der Fokus leitet seinen Abstand zum Flugzeug aus dem Kartenzoom ab. Aus Zoom 16 (Bodenmaßstab) wird bei einem Flugzeug in 10 km Höhe
 *  ein Abstand von fast null: die Seite hängt. Deshalb vor dem Folgen höchstens so weit hineingezoomt. */
const MAX_START_ZOOM = 10;
const pad2 = (n: number) => String(n).padStart(2, '0');
/** "17:48:39" in UTC bzw. mit Versatz in Stunden (Florida: −5) */
const clock = (t: number, offsetH = 0) => {
  const d = new Date((t + offsetH * 3600) * 1000);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

export class IncidentPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  /** Wiedergabeleiste unten (gleiche Optik wie die Radar-/Vorhersage-Zeitleiste) */
  private bar = document.createElement('div');
  private audio: HTMLAudioElement | null = null;
  private muted = false;
  private curEvent: HTMLElement | null = null;
  private def: IncidentDef | null = null;
  private pts: TrackPoint[] = [];
  private shipPts: TrackPoint[] = [];
  private kind: KindProfile = profileOf({});
  private layer: IncidentScene | null = null;
  private lastIdx = -2;
  private lastGone = false;
  private t = 0;
  private from = 0;
  private to = 0;
  private win: 'all' | 'end' = 'end';
  private speed = 5;
  private playing = false;
  /** die Kamera folgt dem Flugzeug (Zustand des Fokus) */
  private following = false;
  /** Wiedergabezeit als Funktion der Uhr: ab `at` (ms, performance.now) läuft sie von `t` aus mit `speed` weiter */
  private base = { t: 0, at: 0 };
  private target: GeoTarget | null = null;
  /** Hover und Klick auf die Marken der 3D-Szene */
  private markCleanup: (() => void) | null = null;
  private raf = 0;
  private lastUi = 0;
  private open_ = new Set<string>(['events', 'funk']);

  constructor(
    parent: HTMLElement,
    private h: IncidentPanelHooks,
  ) {
    this.root.className = 'fp incident';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic"></i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.body.addEventListener('toggle', (e) => {
      const d = e.target as HTMLDetailsElement;
      if (d.dataset.key) d.open ? this.open_.add(d.dataset.key) : this.open_.delete(d.dataset.key);
    }, true);
    // Wiedergabeleiste: eigene Zeile im Dock, nutzt die Klassen der Zeitleiste (tl-play, tl-range …)
    this.bar.className = 'timeline tl-inc';
    this.bar.hidden = true;
    h.dock.append(this.bar);
    const click = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      if (act === 'play') this.setPlaying(!this.playing);
      else if (act === 'win') this.setWindow(el.dataset.v === 'all' ? 'all' : 'end');
      else if (act === 'follow') this.setFollow(!this.following);
      else if (act === 'mute') this.setMuted(!this.muted);
      else if (act === 'close') this.close();
      else if (act === 'jump') this.seek(Number(el.dataset.t));
      else if (act === 'cue') this.seekCue(Number(el.dataset.i));
      else if (act === 'embed') this.toggleEmbed(Number(el.dataset.i), el);
    };
    this.body.addEventListener('click', click);
    this.bar.addEventListener('click', click);
    this.bar.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.classList.contains('tl-range')) this.seek(Number(el.value), true);
    });
    // Einheiten in den Einstellungen geändert: Texte und Werte neu setzen
    window.addEventListener(OPTIONS_EVENT, () => {
      if (!this.def || !this.layer) return;
      this.render();
      this.apply(true);
    });
    this.bar.addEventListener('change', (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.classList.contains('ic-speed')) this.setSpeed(Number(el.value));
    });
  }

  async open(def: IncidentDef) {
    const map = this.h.map();
    if (!map) return;
    this.h.closeOthers();
    this.close();
    this.def = def;
    this.kind = profileOf(def);
    this.root.hidden = false;
    this.root.querySelector('.fp-ic')!.innerHTML = glyphSvg(this.kind.glyph, this.kind.color, 30);
    this.root.querySelector('.fp-title')!.textContent = def.title;
    this.root.querySelector('.fp-sub')!.textContent = def.subtitle;
    this.body.innerHTML = `<div class="fp-note">${this.kind.trackName} wird geladen …</div>`;
    try {
      [this.pts, this.shipPts] = await Promise.all([loadTrack(def), loadShipTrack(def)]);
    } catch {
      if (this.def !== def) return;
      this.body.innerHTML = `<div class="fp-note">Die ${this.kind.trackName} konnte nicht geladen werden.</div>`;
      toast(`${this.kind.trackName} nicht erreichbar.`, 'error');
      return;
    }
    if (this.def !== def) return; // inzwischen geschlossen/anderes Ereignis
    const lastEvent = Math.max(...def.events.map((e) => e.t));
    const firstEvent = Math.min(...def.events.map((e) => e.t));
    this.from = Math.min(this.pts[0][0], this.shipPts[0]?.[0] ?? Infinity, firstEvent);
    this.to = Math.max(this.pts[this.pts.length - 1][0], lastEvent);
    this.win = 'end';
    this.t = def.focus.from;
    this.speed = 5;
    this.rebase();
    const stage = this.h.stage();
    if (!stage) return;
    this.layer = new IncidentScene(map, def.kind);
    this.target = this.makeTarget(def);
    this.layer.target = this.target;
    stage.add(this.layer);
    this.lastIdx = -2;
    this.layer.setFullTrack(this.pts.map((p, i) => [p[2], p[1], this.m(p[3] ?? sampleAt(this.pts, this.pts[i][0]).alt ?? 0)]));
    if (this.shipPts.length) this.layer.setShipRoute(this.shipPts.map((p) => [p[2], p[1], 0]));
    this.layer.setMarks(this.markList());
    this.bindMarks(map);
    if (def.audio?.startUnix != null) {
      this.audio = new Audio(assetUrl(def.audio.src));
      this.audio.preload = 'auto';
      this.audio.muted = this.muted;
    }
    this.bar.hidden = false;
    this.dockOn(true);
    this.h.simulating(true);
    this.render();
    this.apply(true);
    // die Kamera folgt über den Fokus der Karte; gekippt starten
    const focus = this.h.focus();
    if (focus) {
      this.startFocus(focus);
      focus.setPitch(60, true);
    }
  }

  close() {
    // ohne offenes Ereignis nichts zu tun (die Ebene ruft das bei jedem Anwenden, solange sie aus ist)
    if (!this.def) return;
    this.markCleanup?.();
    this.markCleanup = null;
    this.setPlaying(false);
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    this.audio = null;
    this.def = null;
    this.root.hidden = true;
    this.bar.hidden = true;
    this.dockOn(false);
    this.h.simulating(false);
    const focus = this.h.focus();
    if (focus?.target === this.target && this.target) focus.stop();
    this.target = null;
    this.following = false;
    if (this.layer) this.h.stage()?.remove(this.layer);
    this.layer = null;
  }

  /** Wert der Spur (ft bzw. Tiefe in m, negativ) in Metern über dem Meeresspiegel/Boden */
  private m(v: number) {
    return this.kind.toM(v);
  }

  private get win_() {
    const d = this.def!;
    return this.win === 'end' ? { from: d.focus.from, to: Math.min(d.focus.to, this.to) } : { from: this.from, to: this.to };
  }

  /** die Videos des Ereignisses */
  private media(): IncidentMedia[] {
    return this.def?.media ?? [];
  }

  /** Hover (Tooltip mit Vorschaubild) und Klick auf die Marken, die in der 3D-Szene schweben */
  private bindMarks(map: MlMap) {
    this.markCleanup?.();
    const box = map.getCanvasContainer();
    const tip = document.createElement('div');
    tip.className = 'ic-tip';
    tip.hidden = true;
    box.append(tip);
    /** das angeheftete Tooltip einer Video-Marke, in dem das Video läuft */
    let pin: { el: HTMLDivElement; ref: NonNullable<IncidentMark['ref']> } | null = null;
    let down: { x: number; y: number } | null = null;
    const local = (e: MouseEvent): [number, number] => {
      const r = box.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    // über der Marke, mittig; fehlt oben der Platz, darunter. Maße vom Canvas: der Container der Karte hat selbst keine Höhe
    const place = (el: HTMLElement, at: [number, number]) => {
      const canvas = map.getCanvas();
      const [w, h] = [el.offsetWidth, el.offsetHeight];
      const left = Math.max(4, Math.min(canvas.clientWidth - w - 4, at[0] - w / 2));
      const above = at[1] - h - 16;
      el.style.left = `${left}px`;
      el.style.top = `${above >= 4 ? above : Math.min(canvas.clientHeight - h - 4, at[1] + 16)}px`;
    };
    const unpin = () => {
      if (!pin) return;
      pin.el.querySelector('video')?.pause();
      pin.el.remove();
      pin = null;
    };
    const pinMark = (mark: IncidentMark & { screen: [number, number] }) => {
      const ref = mark.ref;
      if (!ref || ref.kind !== 'media') return;
      unpin();
      const m = this.media()[ref.i];
      if (m.t != null) this.seek(m.t);
      // der Funk-Ton und das Video sollen sich nicht überlagern
      this.setPlaying(false);
      const e = m.file ? null : embedOf(m.url);
      const body = m.file
        ? `<video controls autoplay playsinline src="${escapeHtml(assetUrl(m.file))}"></video>`
        : e
          ? `<iframe src="${escapeHtml(e.src)}" style="height:${Math.min(e.height, 360)}px" title="${escapeHtml(`${m.title} (${m.platform})`)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
          : `<div class="ic-tip-none">${escapeHtml(m.platform)}</div>`;
      const el = document.createElement('div');
      el.className = 'ic-tip ic-pin';
      el.innerHTML = `${body}<div class="ic-pin-h"><div class="ic-tip-t"><b>${escapeHtml(m.title)}</b><span>${escapeHtml(m.platform)}${m.note ? ` · ${escapeHtml(m.note)}` : ''}${m.t != null ? ` · ${clock(m.t)} UTC` : ''}</span></div><button type="button" class="ic-pin-x" aria-label="Schließen">✕</button></div>`;
      el.querySelector('.ic-pin-x')!.addEventListener('click', unpin);
      box.append(el);
      pin = { el, ref };
      tip.hidden = true;
      place(el, mark.screen);
      // das Tooltip wächst auf die Größe des ganzen Videos (Hoch- und Querformat), soweit der Bildschirm es zulässt
      const video = el.querySelector('video');
      video?.addEventListener('loadedmetadata', () => {
        if (!video.videoWidth || !video.videoHeight) return;
        const canvas = map.getCanvas();
        const maxW = Math.min(480, canvas.clientWidth - 40);
        // Platz für Titelzeile und Rahmen abziehen
        const maxH = Math.max(160, Math.min(canvas.clientHeight * 0.72, 640) - 70);
        const k = Math.min(maxW / video.videoWidth, maxH / video.videoHeight);
        video.style.width = `${Math.round(video.videoWidth * k)}px`;
        video.style.height = `${Math.round(video.videoHeight * k)}px`;
        place(el, this.layer?.screenOf(ref) ?? mark.screen);
      });
    };
    const onMove = (e: PointerEvent) => {
      if (pin) return;
      const [x, y] = local(e);
      const mark = this.layer?.markAt(x, y) ?? null;
      box.style.cursor = mark ? 'pointer' : '';
      if (!mark) {
        tip.hidden = true;
        return;
      }
      this.fillTip(tip, mark);
      tip.hidden = false;
      place(tip, mark.screen);
    };
    const onLeave = () => {
      tip.hidden = true;
      box.style.cursor = '';
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onClick = (e: MouseEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      // im angehefteten Tooltip (Player, Schließen): nicht anfassen
      if (pin?.el.contains(e.target as Node)) return;
      const [x, y] = local(e);
      const mark = this.layer?.markAt(x, y);
      if (mark?.ref?.kind === 'media') {
        // die Karte bekommt den Klick nicht (sonst Wetter-Popup oder Fokus auf etwas dahinter)
        e.stopPropagation();
        e.preventDefault();
        pinMark(mark);
        return;
      }
      // woanders hingeklickt: das Video endet, der Klick geht normal weiter
      unpin();
      if (!mark?.ref) return;
      e.stopPropagation();
      e.preventDefault();
      tip.hidden = true;
      this.activate(mark);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') unpin();
    };
    // das angeheftete Tooltip bleibt an der Marke, auch wenn die Karte sich bewegt; ist sie nicht zu sehen, pausiert das Video
    const onRender = () => {
      if (!pin) return;
      const at = this.layer?.screenOf(pin.ref) ?? null;
      pin.el.style.visibility = at ? '' : 'hidden';
      if (at) place(pin.el, at);
      else pin.el.querySelector('video')?.pause();
    };
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', onLeave);
    box.addEventListener('pointerdown', onDown, true);
    box.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    map.on('render', onRender);
    this.markCleanup = () => {
      unpin();
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointerdown', onDown, true);
      box.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
      map.off('render', onRender);
      box.style.cursor = '';
      tip.remove();
    };
  }

  /** Inhalt des Tooltips einer Marke: bei Videos das Vorschaubild, sonst Titel und Zeit */
  private fillTip(tip: HTMLElement, mark: IncidentMark) {
    const ref = mark.ref;
    if (!ref || !this.def) return;
    const key = `${ref.kind}:${ref.i}`;
    if (tip.dataset.key === key) return;
    tip.dataset.key = key;
    if (ref.kind === 'media') {
      const m = this.media()[ref.i];
      const src = m.thumb ? assetUrl(m.thumb) : null;
      const vid = !src && m.file ? assetUrl(m.file) : null;
      // das erste Bild der Videodatei dient als Vorschau (#t=0.1): kein eigenes Vorschaubild nötig
      const pic = src
        ? `<img src="${escapeHtml(src)}" alt="" loading="lazy">`
        : vid
          ? `<video src="${escapeHtml(vid)}#t=0.1" muted playsinline preload="metadata"></video>`
          : `<div class="ic-tip-none">${escapeHtml(m.platform)}</div>`;
      tip.innerHTML = `${pic}<div class="ic-tip-t"><b>${escapeHtml(m.title)}</b><span>${escapeHtml(m.platform)}${m.note ? ` · ${escapeHtml(m.note)}` : ''}</span>${m.t != null ? `<span>${clock(m.t)} UTC</span>` : ''}</div>`;
    } else {
      const e = this.def.events[ref.i];
      tip.innerHTML = `<div class="ic-tip-t"><b>${localize(escapeHtml(e.label), true)}</b><span>${clock(e.t)} UTC</span></div>`;
    }
  }

  /** Klick auf eine Marke: Ereignis → zur Zeit springen; Video → Abschnitt öffnen, zur Zeit springen, Player starten */
  private activate(mark: IncidentMark) {
    const ref = mark.ref;
    if (!ref || !this.def) return;
    if (ref.kind === 'event') {
      this.seek(this.def.events[ref.i].t);
      return;
    }
  }

  /** Ereignismarken in der Höhe der Spur zur Zeit des Ereignisses (mit eigenem Ort, z. B. der Einschlag: am Boden dort) */
  private markList(): IncidentMark[] {
    const color = { radio: 0xab47bc, impact: 0xef5350, weather: 0x42a5f5, flight: 0xffffff, info: 0xffffff } as const;
    const ev: IncidentMark[] = this.def!.events.map((e, i) => {
      const s = sampleAt(this.pts, e.t);
      const at = e.at ?? s;
      return { lon: at.lon, lat: at.lat, altM: e.at ? 0 : this.m(s.alt ?? 0), color: color[e.kind], ref: { kind: 'event' as const, i } };
    });
    // Videos mit Zeit und/oder Ort: mit Ort am Boden, sonst auf der Spur zur Zeit der Aufnahme
    const vid: IncidentMark[] = this.media()
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.at || m.t != null)
      .map(({ m, i }) => {
        const s = sampleAt(this.pts, m.t ?? this.pts[this.pts.length - 1][0]);
        const at = m.at ?? s;
        return { lon: at.lon, lat: at.lat, altM: m.at ? 0 : this.m(s.alt ?? 0), color: 0x26c6da, ref: { kind: 'media' as const, i } };
      });
    return [...ev, ...vid];
  }

  /** Dock: die Radar-/Vorhersage-Zeitleiste weicht, solange die Rekonstruktion läuft */
  private dockOn(on: boolean) {
    this.h.dock.classList.toggle('inc-on', on);
    this.h.dockChanged();
  }

  private rebase(now = performance.now()) {
    this.base = { t: this.t, at: now };
  }

  /** Wiedergabezeit zu einem Zeitpunkt der Uhr (ms): beim Abspielen aus dem Anker, sonst die stehende Zeit */
  private timeAt(now: number): number {
    if (!this.playing || !this.def) return this.t;
    return Math.min(this.win_.to, this.base.t + ((now - this.base.at) / 1000) * this.speed);
  }

  private setSpeed(v: number) {
    this.rebase();
    this.speed = v;
    const sel = this.bar.querySelector<HTMLSelectElement>('.ic-speed');
    if (sel) sel.value = String(v);
    this.syncAudio();
  }

  private setMuted(on: boolean) {
    this.muted = on;
    if (this.audio) this.audio.muted = on;
    this.syncMuteBtn();
  }

  private setPlaying(on: boolean) {
    cancelAnimationFrame(this.raf);
    if (on && this.t >= this.win_.to - 0.5) this.t = this.win_.from;
    this.playing = on;
    this.rebase();
    if (on) this.raf = requestAnimationFrame(() => this.frame());
    this.syncAudio();
    this.syncPlayBtn();
  }

  private frame() {
    if (!this.playing || !this.def) return;
    const before = this.t;
    this.t = this.timeAt(performance.now());
    // Beginn des Funk-Clips erreicht: ab hier 1× (der Ton läuft nur in Echtzeit mit)
    const start = this.def.audio?.startUnix;
    if (start != null && before < start && this.t >= start && this.speed !== 1) {
      this.t = start;
      this.setSpeed(1);
    }
    if (this.t >= this.win_.to) {
      this.t = this.win_.to;
      this.apply();
      this.setPlaying(false);
      return;
    }
    this.apply();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  private seek(t: number, fromSlider = false) {
    if (!this.def) return;
    this.t = Math.min(this.win_.to, Math.max(this.win_.from, t));
    this.rebase();
    this.apply(!fromSlider);
    this.syncAudio(true);
  }

  private setWindow(w: 'all' | 'end') {
    this.win = w;
    this.t = Math.min(this.win_.to, Math.max(this.win_.from, this.t));
    this.rebase();
    this.render();
    this.apply(true);
  }

  /** Der Kamera-Fokus hat gewechselt (auch durch Ziehen, andere Objekte, Navigation): Knopf folgt */
  focusChanged(on: boolean) {
    this.following = on;
    this.bar.querySelector('[data-act=follow]')?.classList.toggle('on', on);
  }

  /** Karte vor dem Fokus auf einen sinnvollen Zoom bringen (siehe MAX_START_ZOOM) */
  private startFocus(focus: GeoFocus) {
    const map = this.h.map();
    if (map && map.getZoom() > MAX_START_ZOOM) map.jumpTo({ zoom: MAX_START_ZOOM });
    focus.start(this.target!);
  }

  private setFollow(on: boolean) {
    const focus = this.h.focus();
    if (!focus || !this.target) return;
    if (on) this.startFocus(focus);
    else if (focus.target === this.target) focus.stop();
  }

  /** Fokus-Ziel: das Flugzeug zur Wiedergabezeit; der Fokus fragt es in jedem Frame ab */
  private makeTarget(def: IncidentDef): GeoTarget {
    return {
      source: 'incident',
      slug: def.id,
      label: def.craft.callsign,
      position: (now) => {
        const s = sampleAt(this.pts, this.timeAt(now));
        // Tauchboot: die Kamera zielt auf die Wasseroberfläche darüber (unter Wasser gibt es nichts zu sehen als das Boot selbst)
        return [s.lon, s.lat, this.kind.sub ? 0 : this.m(s.alt ?? 0)];
      },
    };
  }

  /** Zustand zur Zeit this.t auf Karte, 3D-Ebene und im Panel */
  private apply(ui = false) {
    if (!this.def) return;
    const s = sampleAt(this.pts, this.t);
    const end = this.pts[this.pts.length - 1][0];
    // nach dem letzten Punkt bleibt das Flugzeug an dessen Position und sinkt weiter (Höhe fortgeschrieben) bis zum Boden
    const alt = s.alt ?? 0;
    // Tauchboot: vor dem Ablegen noch an Bord, nach der Implosion nicht mehr da
    const gone = this.kind.sub ? this.t > end || this.t < this.pts[0][0] : this.t > end && alt <= 0;
    const scene = this.layer;
    if (!scene) return;
    // die Spur wird neu gebaut, wenn ein Punkt dazukommt; dazwischen bewegt sich nur ihr Kopf mit dem Flugzeug
    if (s.i !== this.lastIdx || gone !== this.lastGone) {
      this.lastIdx = s.i;
      this.lastGone = gone;
      scene.setTrail(this.trailTo(s));
    }
    scene.setPose(gone ? null : { lon: s.lon, lat: s.lat, altM: this.m(alt), track: s.trk, pitch: this.pitchAt(s) });
    if (this.shipPts.length) {
      const sh = sampleAt(this.shipPts, this.t);
      scene.setShipPose({ lon: sh.lon, lat: sh.lat, track: sh.trk });
    }
    const now = performance.now();
    if (ui || now - this.lastUi > 90) {
      this.lastUi = now;
      this.readout(s);
    }
  }

  /** Nickwinkel = Winkel der gezeigten Bahn: Höhenänderung gegen den zurückgelegten Weg in einem kurzen Fenster um t */
  private pitchAt(s: Sample): number {
    if (this.kind.sub) return 0;
    const first = this.pts[0][0];
    const end = this.pts[this.pts.length - 1][0];
    const t1 = Math.min(end, s.t + 0.25);
    const t0 = Math.max(first, Math.min(s.t - 0.25, t1 - 0.5));
    const a = sampleAt(this.pts, t0);
    const b = sampleAt(this.pts, t1);
    if (a.alt == null || b.alt == null || t1 - t0 < 0.1) return pitchOf(s.vs, s.gs);
    const dh = Math.hypot((b.lon - a.lon) * Math.cos((s.lat * Math.PI) / 180) * 111320, (b.lat - a.lat) * 110540);
    const dz = (b.alt - a.alt) * 0.3048;
    return Math.max(-85, Math.min(85, (Math.atan2(dz, Math.max(dh, 0.01)) * 180) / Math.PI));
  }

  private trailTo(s: Sample): [number, number, number][] {
    const out: [number, number, number][] = [];
    const step = Math.max(1, Math.floor(s.i / 400));
    for (let i = 0; i <= s.i; i += step) {
      const p = this.pts[i];
      out.push([p[2], p[1], this.m(p[3] ?? sampleAt(this.pts, p[0]).alt ?? 0)]);
    }
    out.push([s.lon, s.lat, this.m(s.alt ?? 0)]);
    return out;
  }

  private readout(s: Sample) {
    const q = <T extends HTMLElement>(sel: string) => this.body.querySelector<T>(sel);
    const bq = <T extends HTMLElement>(sel: string) => this.bar.querySelector<T>(sel);
    const sub = this.kind.sub;
    const alt = (v: number) => (sub ? depthTxt(-v, true) : altTxt(v, true));
    const rate = (v: number) => climbFtTxt(sub ? v / 0.3048 : v, true);
    const readoutTxt = [s.alt == null ? null : alt(s.alt) + (s.altHeld ? ' *' : ''), sub ? null : kntTxt(s.gs), s.vs == null ? null : rate(s.vs)].filter(Boolean).join(' · ');
    const head = bq('.tl-head');
    const lt = this.def?.localTime;
    if (head) head.innerHTML = `<b>${clock(this.t)} UTC</b><span>${lt ? `${clock(this.t, lt.offsetH)} ${escapeHtml(lt.label)} · ` : ''}${readoutTxt}</span>`;
    const tl = bq('.tl-time');
    if (tl) tl.innerHTML = `<b>${clock(this.t)}</b><small>UTC</small>`;
    const range = bq<HTMLInputElement>('.tl-range');
    if (range) {
      if (document.activeElement !== range) range.value = String(this.t);
      const w0 = this.win_;
      range.style.setProperty('--p', `${((this.t - w0.from) / Math.max(1, w0.to - w0.from)) * 100}%`);
    }
    const set = (k: string, v: string) => {
      const el = q(`[data-metric="${k}"] b`);
      if (el) el.innerHTML = v;
    };
    set('alt', s.alt == null ? '–' : alt(s.alt) + (s.altHeld ? ' *' : ''));
    set('gs', kntTxt(s.gs));
    set('vs', s.vs == null ? '–' : rate(s.vs));
    set('trk', `${Math.round(s.trk)}°`);
    if (sub) {
      const depth = Math.max(0, -(s.alt ?? 0));
      const bar = pressureBar(depth);
      set('bar', `${Math.round(bar).toLocaleString('de-DE')} bar <small class="ic-ft">(${Math.round(bar * 14.5038).toLocaleString('de-DE')} psi)</small>`);
      const seabed = this.def?.seabedM;
      set('above', seabed ? depthTxt(Math.max(0, seabed - depth), true) : '–');
    }
    const cur = this.body.querySelector<SVGElement>('.ic-chart .cursor');
    const dot = this.body.querySelector<SVGElement>('.ic-chart .dot');
    const w = this.win_;
    const x = ((this.t - w.from) / Math.max(1, w.to - w.from)) * 300;
    cur?.setAttribute('x1', String(x));
    cur?.setAttribute('x2', String(x));
    if (dot) {
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(this.yOf(s.alt ?? 0)));
    }
    const au = this.def?.audio;
    if (au?.startUnix != null && au.cues) {
      const pos = this.t - au.startUnix;
      // Untertitel über der Leiste: die gerade gesprochene Zeile
      const cap = bq('.ti-cap');
      if (cap) {
        const c = au.cues.find((x) => pos >= x.s && pos < x.e + 0.4);
        if (c) {
          if (cap.textContent !== c.text) cap.textContent = c.text;
          cap.hidden = false;
        } else cap.hidden = true;
      }
      this.body.querySelectorAll<HTMLElement>('.ic-cues button').forEach((b, i) => {
        const c = au.cues![i];
        b.classList.toggle('now', pos >= c.s && pos < c.e + 0.4);
      });
    }
    // aktuelles Ereignis: das letzte, dessen Zeit erreicht ist
    let curEv: HTMLElement | null = null;
    for (const b of this.body.querySelectorAll<HTMLElement>('.ic-events button')) {
      const on = Number(b.dataset.t) <= this.t;
      if (on) curEv = b;
      b.classList.remove('now');
    }
    curEv?.classList.add('now');
    if (curEv && curEv !== this.curEvent) curEv.scrollIntoView({ block: 'nearest' });
    this.curEvent = curEv;
  }

  /** Höhenprofil: Flugzeug steigt nach oben, Tauchboot sinkt nach unten (Meeresspiegel oben) */
  private yOf(v: number) {
    if (this.kind.sub) return 4 + (Math.min(Math.max(-v, 0), this.def?.seabedM ?? 3800) / (this.def?.seabedM ?? 3800)) * 54;
    return 58 - (Math.min(v, 42000) / 42000) * 54;
  }

  private chart(): string {
    const w = this.win_;
    const seg = this.pts.filter((p) => p[0] >= w.from && p[0] <= w.to && p[3] != null);
    if (seg.length < 2) return '';
    const stride = Math.max(1, Math.floor(seg.length / 300));
    const xy = seg.filter((_, i) => i % stride === 0).map((p) => `${(((p[0] - w.from) / Math.max(1, w.to - w.from)) * 300).toFixed(1)},${this.yOf(p[3]!).toFixed(1)}`);
    return `<svg class="ic-chart${this.kind.sub ? ' deep' : ''}" viewBox="0 0 300 62" preserveAspectRatio="none" role="img" aria-label="${this.kind.sub ? 'Tiefenprofil' : 'Höhenprofil'}">
      <polyline class="area" points="${xy.join(' ')}"/><line class="cursor" x1="0" x2="0" y1="0" y2="62"/><circle class="dot" cx="0" cy="58" r="3"/></svg>`;
  }

  private render() {
    const d = this.def;
    if (!d) return;
    const ev = [...d.events].sort((a, b) => a.t - b.t);
    const detail = (key: string, title: string, inner: string) => `<details data-key="${key}" ${this.open_.has(key) ? 'open' : ''}><summary>${title}</summary><div class="sp-rows">${inner}</div></details>`;
    const link = (l: { label: string; url: string }) => {
      const u = safeUrl(l.url);
      return u ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)} ↗</a>` : escapeHtml(l.label);
    };
    const vids = this.media();
    const mediaRow = (m: IncidentMedia, i: number) => {
      const can = !!m.file || !!embedOf(m.url);
      return `<li class="ic-media"><div class="ic-mh"><b>${escapeHtml(m.title)}</b><span>${escapeHtml(m.platform)}${m.note ? ` · ${escapeHtml(m.note)}` : ''}</span></div>
        <div class="ic-mb">
          ${can ? `<button type="button" data-act="embed" data-i="${i}">▶ Hier abspielen</button>` : '<span class="ic-nolink">nur als Link</span>'}
          ${m.t != null ? `<button type="button" data-act="jump" data-t="${m.t}">Zur Stelle</button>` : ''}
          ${link({ label: 'Original', url: m.url })}
        </div><div class="ic-embed" data-i="${i}" hidden></div></li>`;
    };
    const groups = [...new Set(vids.map((m) => m.group ?? ''))];
    const media = vids.length
      ? groups
          .map((g) => `${g ? `<div class="ic-mg">${escapeHtml(g)}</div>` : ''}<ul class="ic-medias">${vids.map((m, i) => ((m.group ?? '') === g ? mediaRow(m, i) : '')).join('')}</ul>`)
          .join('') +
        `<div class="fp-note">Die Videos gehören den Urhebern (Quelle: „Original“). ${vids.some((m) => !m.file && embedOf(m.url)) ? 'Eingebettete Player laden beim Abspielen vom jeweiligen Anbieter und können Cookies setzen.' : ''}</div>`
      : '<div class="fp-note">Noch keine Videos eingetragen.</div>';
    const a = d.audio;
    const cues = a?.cues?.length
      ? `<ol class="ic-cues">${a.cues.map((c, i) => `<li><button type="button" data-act="cue" data-i="${i}"><time>${Math.floor(c.s / 60)}:${pad2(Math.floor(c.s % 60))}</time><span>${escapeHtml(c.text)}</span></button></li>`).join('')}</ol>`
      : '';
    const audio = a
      ? `${a.startUnix != null ? '' : `<audio controls preload="none" src="${escapeHtml(assetUrl(a.src))}"></audio>`}
         <div class="fp-note">${escapeHtml(a.title)} · Quelle: ${link(a.credit)}${
           a.startUnix != null ? '<br>Der Ton läuft synchron zur Spur (nur bei Tempo 1×); Stummschaltung in der Leiste unten.' : '<br>Noch nicht mit der Spur synchronisiert (Startzeit des Clips unbekannt) – er läuft für sich.'
         }</div>${cues ? `<div class="fp-note">Transkript (Englisch, Untertitel zum Clip, ungeprüft):</div>${cues}` : ''}`
      : `<div class="fp-note">${this.kind.sub ? 'Keine Tonaufnahme hinterlegt.' : 'Kein Funkverkehr hinterlegt.'}</div>`;
    this.body.innerHTML = `
      ${this.chart()}
      <div class="sp-tiles" style="margin-top:8px">
        ${
          this.kind.sub
            ? `${tile('Tiefe', '–', { metric: 'alt' })}${tile('Sinken', '–', { metric: 'vs' })}${tile('Wasserdruck (ca.)', '–', { metric: 'bar' })}${tile('Über dem Meeresboden', '–', { metric: 'above' })}`
            : `${tile('Höhe', '–', { metric: 'alt' })}${tile('Steigen/Sinken', '–', { metric: 'vs' })}${tile('Tempo (über Grund)', '–', { metric: 'gs' })}${tile('Kurs', '–', { metric: 'trk' })}`
        }
      </div>
      ${detail('events', 'Ereignisse', `<ul class="ic-events">${ev.map((e) => `<li><button type="button" data-act="jump" data-t="${e.t}" class="${e.kind}"><b>${localize(escapeHtml(e.label), true)}</b><time>${clock(e.t)}</time>${e.text ? `<span>${localize(escapeHtml(e.text), true)}</span>` : ''}</button></li>`).join('')}</ul>`)}
      ${detail('funk', this.kind.sub ? 'Ton' : 'Funkverkehr', audio)}
      ${detail('media', 'Videos & Berichte', media)}
      ${detail('info', 'Zum Ereignis', `<div class="fp-note">${localize(escapeHtml(d.summary), true)}<br>${escapeHtml(d.craft.type)} ${escapeHtml(d.craft.reg)} · ${escapeHtml(d.craft.from)} → ${escapeHtml(d.craft.to)}</div>`)}
      ${detail('notes', 'Hinweise zu den Daten', `<ul class="ic-notes">${d.dataNotes.map((n) => `<li>${localize(escapeHtml(n), true)}</li>`).join('')}</ul><div class="fp-note">${this.kind.sub ? '* Wert berechnet, keine Messung' : '* Höhe fortgeschrieben (letzte bekannte Sinkrate), keine Messung'}</div>`)}
      ${detail('src', 'Quellen', `<ul class="ic-notes">${d.sources.map((s) => `<li>${link(s)}</li>`).join('')}</ul>`)}`;
    this.renderBar();
    this.readout(sampleAt(this.pts, this.t));
  }

  /** Wiedergabeleiste: Abspielen, Uhr, Regler mit Ereignismarken, Tempo, Ausschnitt, Ton, Kamera */
  private renderBar() {
    const d = this.def;
    if (!d) return;
    const w = this.win_;
    const pos = (t: number) => ((t - w.from) / Math.max(1, w.to - w.from)) * 100;
    const ticks = d.events
      .filter((e) => e.t >= w.from && e.t <= w.to)
      .map((e) => `<i class="${e.kind}" style="left:${pos(e.t)}%" title="${escapeHtml(localize(e.label))}"></i>`)
      .join('');
    const mticks = this.media()
      .filter((m) => m.t != null && m.t >= w.from && m.t <= w.to)
      .map((m) => `<i class="video" style="left:${pos(m.t!)}%" title="${escapeHtml(`${m.title} (${m.platform})`)}"></i>`)
      .join('');
    const labels = d.events
      .filter((e) => e.kind === 'impact' && e.t >= w.from && e.t <= w.to)
      .map((e) => `<span style="left:${pos(e.t)}%">${this.kind.impact}</span>`)
      .join('');
    const btn = (act: string, label: string, inner: string, extra = '') => `<button type="button" class="btn icon-btn ti-b ${extra}" data-act="${act}" aria-label="${label}" data-tip="${label}">${inner}</button>`;
    const svg = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    this.bar.innerHTML = `
      <div class="ti-cap" hidden></div>
      <button class="btn icon-btn tl-play" data-act="play" aria-label="Abspielen" data-tip="Abspielen"></button>
      <div class="tl-head"></div>
      <div class="tl-track">
        <input type="range" class="tl-range" min="${w.from}" max="${w.to}" step="0.5" value="${this.t}" aria-label="Zeit">
        <div class="tl-days">${ticks}${mticks}${labels}</div>
      </div>
      <span class="tl-time"></span>
      <div class="ti-ctl">
        <select class="ic-speed" aria-label="Wiedergabetempo" title="Wiedergabetempo (Ton nur bei 1×)">${SPEEDS.map((v) => `<option value="${v}" ${v === this.speed ? 'selected' : ''}>${v}×</option>`).join('')}</select>
        <button type="button" class="ti-chip ${this.win === 'end' ? 'on' : ''}" data-act="win" data-v="end" data-tip="Nur die letzten Minuten">Endphase</button>
        <button type="button" class="ti-chip ${this.win === 'all' ? 'on' : ''}" data-act="win" data-v="all" data-tip="${this.kind.full.tip}">${this.kind.full.label}</button>
        ${d.audio?.startUnix != null ? btn('mute', 'Ton an/aus', '', 'ti-mute') : ''}
        ${btn('follow', this.kind.followTip, svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'), this.following ? 'on' : '')}
        ${btn('close', 'Rekonstruktion schließen', svg('<path d="M6 6l12 12M18 6L6 18"/>'))}
      </div>`;
    this.syncPlayBtn();
    this.syncMuteBtn();
  }

  private syncPlayBtn() {
    const b = this.bar.querySelector('.tl-play');
    if (!b) return;
    b.innerHTML = this.playing ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
    b.setAttribute('aria-label', this.playing ? 'Pause' : 'Abspielen');
    b.setAttribute('data-tip', this.playing ? 'Pause' : 'Abspielen');
  }

  private syncMuteBtn() {
    const b = this.bar.querySelector('.ti-mute');
    if (!b) return;
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${this.muted ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'}</svg>`;
    b.setAttribute('aria-label', this.muted ? 'Ton einschalten' : 'Stummschalten');
    b.setAttribute('data-tip', this.muted ? 'Ton einschalten' : 'Stummschalten');
    b.classList.toggle('on', !this.muted);
  }

  /** Funk läuft nur mit Echtzeit und bekannter Startzeit des Clips synchron zur Spur */
  private syncAudio(seeked = false) {
    const a = this.audio;
    const start = this.def?.audio?.startUnix;
    if (!a || start == null) return;
    const pos = this.t - start;
    if (!this.playing || this.speed !== 1 || pos < 0 || (a.duration && pos > a.duration)) {
      a.pause();
      return;
    }
    if (seeked || Math.abs(a.currentTime - pos) > 0.5) a.currentTime = pos;
    void a.play().catch(() => {});
  }

  /** Video des Hosters eingebettet zeigen bzw. wieder einklappen (lädt erst beim Klick, vorher kein Kontakt zum Anbieter) */
  private toggleEmbed(i: number, btn: HTMLElement) {
    const m = this.media()[i];
    const box = this.body.querySelector<HTMLElement>(`.ic-embed[data-i="${i}"]`);
    const e = m ? embedOf(m.url) : null;
    if (!m || !box || (!e && !m.file)) return;
    if (!box.hidden) {
      box.hidden = true;
      box.innerHTML = '';
      btn.textContent = '▶ Hier abspielen';
      return;
    }
    // ein Video zur Zeit: die anderen und den Funk-Ton anhalten
    for (const o of this.body.querySelectorAll<HTMLElement>('.ic-embed:not([hidden])')) {
      o.hidden = true;
      o.innerHTML = '';
    }
    for (const b of this.body.querySelectorAll<HTMLElement>('[data-act=embed]')) b.textContent = '▶ Hier abspielen';
    this.setPlaying(false);
    box.innerHTML = m.file
      ? `<video controls autoplay playsinline preload="metadata" src="${escapeHtml(assetUrl(m.file))}" title="${escapeHtml(`${m.title} (${m.platform})`)}"></video>`
      : `<iframe src="${escapeHtml(e!.src)}" style="height:${e!.height}px" title="${escapeHtml(`${m.title} (${m.platform})`)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    box.hidden = false;
    btn.textContent = '✕ Schließen';
  }

  /** Klick auf eine Zeile des Transkripts: zur Stelle springen (Spur und Clip) */
  private seekCue(i: number) {
    const au = this.def?.audio;
    const c = au?.cues?.[i];
    if (!au || !c) return;
    if (au.startUnix != null) {
      this.seek(au.startUnix + c.s);
      return;
    }
    const a = this.body.querySelector('audio');
    if (a) a.currentTime = c.s;
  }
}
