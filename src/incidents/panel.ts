import type { Map as MlMap } from 'maplibre-gl';
import { sampleAt } from './track';
import { assetUrl, loadTrack } from './index';
import type { IncidentDef, IncidentMedia, Sample, TrackPoint } from './types';
import { embedOf } from './embed';
import { IncidentScene, ftToM, pitchOf, type IncidentMark } from './layer3d';
import type { GeoStage } from '../globe/geo3d/stage';
import { escapeHtml, safeUrl, toast } from '../util';
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
  /** die 3D-Bühne der Karte (src/globe/geo3d), auf der die Rekonstruktion gezeichnet wird */
  stage(): GeoStage | null;
  /** unterer Dock der Karte (Legende/Zeitleiste): die Wiedergabeleiste kommt hierhin */
  dock: HTMLElement;
  /** das Dock hat sich geändert (Handy-Sheet neu anordnen) */
  dockChanged(): void;
}

const SPEEDS = [1, 5, 30, 120];
const pad2 = (n: number) => String(n).padStart(2, '0');
/** "17:48:39" in UTC bzw. mit Versatz in Stunden (Florida: −5) */
const clock = (t: number, offsetH = 0) => {
  const d = new Date((t + offsetH * 3600) * 1000);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};
const ftTxt = (v: number | null) => (v == null ? '–' : `${Math.round(v).toLocaleString('de-DE')} ft`);

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
  private layer: IncidentScene | null = null;
  private lastIdx = -2;
  private lastGone = false;
  private t = 0;
  private from = 0;
  private to = 0;
  private win: 'all' | 'end' = 'end';
  private speed = 5;
  private playing = false;
  private follow = true;
  private raf = 0;
  private last = 0;
  private lastUi = 0;
  private open_ = new Set<string>(['events', 'funk']);

  constructor(
    parent: HTMLElement,
    private h: IncidentPanelHooks,
  ) {
    this.root.className = 'fp incident';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('plane', '#ef5350', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
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
      else if (act === 'follow') this.setFollow(!this.follow);
      else if (act === 'tilt') this.tilt();
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
    this.root.hidden = false;
    this.root.querySelector('.fp-title')!.textContent = def.title;
    this.root.querySelector('.fp-sub')!.textContent = def.subtitle;
    this.body.innerHTML = '<div class="fp-note">Flugspur wird geladen …</div>';
    try {
      this.pts = await loadTrack(def);
    } catch {
      if (this.def !== def) return;
      this.body.innerHTML = '<div class="fp-note">Die Flugspur konnte nicht geladen werden.</div>';
      toast('Flugspur nicht erreichbar.', 'error');
      return;
    }
    if (this.def !== def) return; // inzwischen geschlossen/anderes Ereignis
    const lastEvent = Math.max(...def.events.map((e) => e.t));
    this.from = this.pts[0][0];
    this.to = Math.max(this.pts[this.pts.length - 1][0], lastEvent);
    this.win = 'end';
    this.t = def.focus.from;
    this.speed = 5;
    this.follow = true;
    const stage = this.h.stage();
    if (!stage) return;
    this.layer = new IncidentScene(map);
    stage.add(this.layer);
    this.lastIdx = -2;
    this.layer.setFullTrack(this.pts.map((p, i) => [p[2], p[1], ftToM(p[3] ?? sampleAt(this.pts, this.pts[i][0]).alt ?? 0)]));
    this.layer.setMarks(this.markList());
    if (def.audio?.startUnix != null) {
      this.audio = new Audio(assetUrl(def.audio.src));
      this.audio.preload = 'auto';
      this.audio.muted = this.muted;
    }
    this.bar.hidden = false;
    this.dockOn(true);
    this.render();
    const s = sampleAt(this.pts, this.t);
    map.easeTo({ center: [s.lon, s.lat], zoom: 9.5, pitch: Math.max(map.getPitch(), 60), duration: 1200 });
    this.apply(true);
  }

  close() {
    this.setPlaying(false);
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    this.audio = null;
    this.def = null;
    this.root.hidden = true;
    this.bar.hidden = true;
    this.dockOn(false);
    if (this.layer) this.h.stage()?.remove(this.layer);
    this.layer = null;
  }

  private get win_() {
    const d = this.def!;
    return this.win === 'end' ? { from: d.focus.from, to: Math.min(d.focus.to, this.to) } : { from: this.from, to: this.to };
  }

  /** Ereignismarken in der Höhe der Spur zur Zeit des Ereignisses (mit eigenem Ort, z. B. der Einschlag: am Boden dort) */
  private markList(): IncidentMark[] {
    const color = { radio: 0xab47bc, impact: 0xef5350, weather: 0x42a5f5, flight: 0xffffff, info: 0xffffff } as const;
    const ev = this.def!.events.map((e) => {
      const s = sampleAt(this.pts, e.t);
      const at = e.at ?? s;
      return { lon: at.lon, lat: at.lat, altM: e.at ? 0 : ftToM(s.alt ?? 0), color: color[e.kind] };
    });
    // Videos mit Zeit und/oder Ort (von Hand gesetzt): mit Ort am Boden, sonst auf der Spur zur Zeit der Aufnahme
    const vid = this.def!.media
      .filter((m) => m.at || m.t != null)
      .map((m) => {
        const s = sampleAt(this.pts, m.t ?? this.pts[this.pts.length - 1][0]);
        const at = m.at ?? s;
        return { lon: at.lon, lat: at.lat, altM: m.at ? 0 : ftToM(s.alt ?? 0), color: 0x26c6da };
      });
    return [...ev, ...vid];
  }

  /** Dock: die Radar-/Vorhersage-Zeitleiste weicht, solange die Rekonstruktion läuft */
  private dockOn(on: boolean) {
    this.h.dock.classList.toggle('inc-on', on);
    this.h.dockChanged();
  }

  private setSpeed(v: number) {
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
    this.playing = on;
    cancelAnimationFrame(this.raf);
    this.last = 0;
    if (on) {
      if (this.t >= this.win_.to - 0.5) this.t = this.win_.from;
      this.raf = requestAnimationFrame((n) => this.frame(n));
    }
    this.syncAudio();
    this.syncPlayBtn();
  }

  private frame(now: number) {
    if (!this.playing || !this.def) return;
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    const before = this.t;
    this.t += dt * this.speed;
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
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  private seek(t: number, fromSlider = false) {
    if (!this.def) return;
    this.t = Math.min(this.win_.to, Math.max(this.win_.from, t));
    this.apply(!fromSlider);
    this.syncAudio(true);
  }

  private setWindow(w: 'all' | 'end') {
    this.win = w;
    this.t = Math.min(this.win_.to, Math.max(this.win_.from, this.t));
    this.render();
    this.apply(true);
  }

  private setFollow(on: boolean) {
    this.follow = on;
    this.bar.querySelector('[data-act=follow]')?.classList.toggle('on', on);
  }

  private tilt() {
    const map = this.h.map();
    if (map) map.easeTo({ pitch: map.getPitch() > 20 ? 0 : 65, duration: 600 });
  }

  /** Zustand zur Zeit this.t auf Karte, 3D-Ebene und im Panel */
  private apply(ui = false) {
    const map = this.h.map();
    if (!map || !this.def) return;
    const s = sampleAt(this.pts, this.t);
    const end = this.pts[this.pts.length - 1][0];
    // nach dem letzten Punkt bleibt das Flugzeug an dessen Position und sinkt weiter (Höhe fortgeschrieben) bis zum Boden
    const alt = s.alt ?? 0;
    const gone = this.t > end && alt <= 0;
    const scene = this.layer;
    if (!scene) return;
    // die Spur wird neu gebaut, wenn ein Punkt dazukommt; dazwischen bewegt sich nur ihr Kopf mit dem Flugzeug
    if (s.i !== this.lastIdx || gone !== this.lastGone) {
      this.lastIdx = s.i;
      this.lastGone = gone;
      scene.setTrail(this.trailTo(s));
    }
    scene.setPose(gone ? null : { lon: s.lon, lat: s.lat, altM: ftToM(alt), track: s.trk, pitch: this.pitchAt(s) });
    // jumpTo/panBy würden eine laufende Kamerafahrt (Öffnen, „Ansicht kippen“) abbrechen: währenddessen nicht nachführen
    if (this.follow && !gone && !map.isMoving()) {
      // das Modell schwebt in der Höhe: bei gekippter Karte liegt der Bodenpunkt (Schatten) woanders auf dem Bild,
      // also die Kamera um den Bildschirmabstand zum Modell verschieben, nicht auf den Bodenpunkt zentrieren
      const off = scene.offsetToCentre();
      const canvas = map.getCanvas();
      // unplausible Werte (Modell weit außerhalb des Bildes) nie als Verschiebung nehmen: dann auf den Bodenpunkt zentrieren
      if (off && Math.hypot(off[0], off[1]) < Math.max(canvas.clientWidth, canvas.clientHeight)) {
        if (Math.hypot(off[0], off[1]) > 0.5) map.panBy(off, { duration: 0 });
      } else map.jumpTo({ center: [s.lon, s.lat] });
    }
    const now = performance.now();
    if (ui || now - this.lastUi > 90) {
      this.lastUi = now;
      this.readout(s);
    }
  }

  /** Nickwinkel = Winkel der gezeigten Bahn: Höhenänderung gegen den zurückgelegten Weg in einem kurzen Fenster um t */
  private pitchAt(s: Sample): number {
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
      out.push([p[2], p[1], ftToM(p[3] ?? sampleAt(this.pts, p[0]).alt ?? 0)]);
    }
    out.push([s.lon, s.lat, ftToM(s.alt ?? 0)]);
    return out;
  }

  private readout(s: Sample) {
    const q = <T extends HTMLElement>(sel: string) => this.body.querySelector<T>(sel);
    const bq = <T extends HTMLElement>(sel: string) => this.bar.querySelector<T>(sel);
    const readoutTxt = [s.alt == null ? null : ftTxt(s.alt) + (s.altHeld ? ' *' : ''), `${Math.round(s.gs)} kn`, s.vs == null ? null : `${Math.round(s.vs).toLocaleString('de-DE')} ft/min`].filter(Boolean).join(' · ');
    const head = bq('.tl-head');
    if (head) head.innerHTML = `<b>${clock(this.t)} UTC</b><span>${clock(this.t, -5)} Florida · ${readoutTxt}</span>`;
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
      if (el) el.textContent = v;
    };
    set('alt', s.alt == null ? '–' : ftTxt(s.alt) + (s.altHeld ? ' *' : ''));
    set('gs', `${Math.round(s.gs)} kn`);
    set('vs', s.vs == null ? '–' : `${Math.round(s.vs).toLocaleString('de-DE')} ft/min`);
    set('trk', `${Math.round(s.trk)}°`);
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

  private yOf(ft: number) {
    return 58 - (Math.min(ft, 42000) / 42000) * 54;
  }

  private chart(): string {
    const w = this.win_;
    const seg = this.pts.filter((p) => p[0] >= w.from && p[0] <= w.to && p[3] != null);
    if (seg.length < 2) return '';
    const stride = Math.max(1, Math.floor(seg.length / 300));
    const xy = seg.filter((_, i) => i % stride === 0).map((p) => `${(((p[0] - w.from) / Math.max(1, w.to - w.from)) * 300).toFixed(1)},${this.yOf(p[3]!).toFixed(1)}`);
    return `<svg class="ic-chart" viewBox="0 0 300 62" preserveAspectRatio="none" role="img" aria-label="Höhenprofil">
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
    const mediaRow = (m: IncidentMedia, i: number) => {
      const can = !!m.file || !!embedOf(m.url);
      return `<li class="ic-media"><div class="ic-mh"><b>${escapeHtml(m.title)}</b><span>${escapeHtml(m.platform)}${m.note ? ` · ${escapeHtml(m.note)}` : ''}</span></div>
        <div class="ic-mb">
          ${can ? `<button type="button" data-act="embed" data-i="${i}">▶ Hier abspielen</button>` : '<span class="ic-nolink">nur als Link</span>'}
          ${m.t != null ? `<button type="button" data-act="jump" data-t="${m.t}">Zur Stelle</button>` : ''}
          ${link({ label: 'Original', url: m.url })}
        </div><div class="ic-embed" data-i="${i}" hidden></div></li>`;
    };
    const groups = [...new Set(d.media.map((m) => m.group ?? ''))];
    const media = d.media.length
      ? groups
          .map((g) => `${g ? `<div class="ic-mg">${escapeHtml(g)}</div>` : ''}<ul class="ic-medias">${d.media.map((m, i) => ((m.group ?? '') === g ? mediaRow(m, i) : '')).join('')}</ul>`)
          .join('') + `<div class="fp-note">Die Videos gehören den Urhebern (Quelle: „Original“). ${d.media.some((m) => !m.file && embedOf(m.url)) ? 'Eingebettete Player laden beim Abspielen vom jeweiligen Anbieter und können Cookies setzen.' : ''}</div>`
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
      : '<div class="fp-note">Kein Funkverkehr hinterlegt.</div>';
    this.body.innerHTML = `
      ${this.chart()}
      <div class="sp-tiles" style="margin-top:8px">
        ${tile('Höhe', '–', { metric: 'alt' })}${tile('Tempo (über Grund)', '–', { metric: 'gs' })}
        ${tile('Steigen/Sinken', '–', { metric: 'vs' })}${tile('Kurs', '–', { metric: 'trk' })}
      </div>
      ${detail('events', 'Ereignisse', `<ul class="ic-events">${ev.map((e) => `<li><button type="button" data-act="jump" data-t="${e.t}" class="${e.kind}"><b>${escapeHtml(e.label)}</b><time>${clock(e.t)}</time>${e.text ? `<span>${escapeHtml(e.text)}</span>` : ''}</button></li>`).join('')}</ul>`)}
      ${detail('funk', 'Funkverkehr', audio)}
      ${detail('media', 'Videos & Berichte', media)}
      ${detail('info', 'Zum Ereignis', `<div class="fp-note">${escapeHtml(d.summary)}<br>${escapeHtml(d.aircraft.type)} ${escapeHtml(d.aircraft.reg)} · ${escapeHtml(d.aircraft.from)} → ${escapeHtml(d.aircraft.to)}</div>`)}
      ${detail('notes', 'Hinweise zu den Daten', `<ul class="ic-notes">${d.dataNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul><div class="fp-note">* Höhe fortgeschrieben (letzte bekannte Sinkrate), keine Messung</div>`)}
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
      .map((e) => `<i class="${e.kind}" style="left:${pos(e.t)}%" title="${escapeHtml(e.label)}"></i>`)
      .join('');
    const mticks = d.media
      .filter((m) => m.t != null && m.t >= w.from && m.t <= w.to)
      .map((m) => `<i class="video" style="left:${pos(m.t!)}%" title="${escapeHtml(`${m.title} (${m.platform})`)}"></i>`)
      .join('');
    const labels = d.events
      .filter((e) => e.kind === 'impact' && e.t >= w.from && e.t <= w.to)
      .map((e) => `<span style="left:${pos(e.t)}%">Einschlag</span>`)
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
        <button type="button" class="ti-chip ${this.win === 'all' ? 'on' : ''}" data-act="win" data-v="all" data-tip="Von Austin bis zum Einschlag">Ganzer Flug</button>
        ${d.audio?.startUnix != null ? btn('mute', 'Ton an/aus', '', 'ti-mute') : ''}
        ${btn('follow', 'Kamera folgt dem Flugzeug', svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'), this.follow ? 'on' : '')}
        ${btn('tilt', 'Karte kippen / aufrichten', svg('<path d="M3 17l9-12 9 12z"/>'))}
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
    const m = this.def?.media[i];
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
