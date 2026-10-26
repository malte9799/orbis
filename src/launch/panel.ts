import type { Map as MlMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { LaunchDetail } from './tracker';
import { flightPhase, flightEndSec, getReminder, notifSupported, notifyPermission, requestNotifyPermission, setReminder, trackFeatures, tLabel } from './tracker';
import { escapeHtml, fmt, safeUrl, toast } from '../util';
import { clockTxt, speedTxt, distTxt } from '../units';
import { glyphSvg } from '../globe/icons';
import { tile } from '../globe/sidepanel';
import { countdown as relCountdown } from '../api/transport';
import '../globe/flightpanel.css';
import './panel.css';

// Right-hand panel with live tracking of a rocket launch: big countdown, reminder
// (browser notifications), embedded live stream (splitscreen) and simulated ascent
// telemetry on the map. The procedural 3D model (src/launch/model.ts) stays in the
// repo but is not shown in the panel.

export interface LaunchPanelHooks {
  map(): MlMap | null;
  /** moves the simulated live track + rocket symbol on the map (null = remove) */
  live(data: { line: FeatureCollection; pos: FeatureCollection } | null): void;
}

const STATUS_COLOR: Record<string, string> = {
  Go: '#66bb6a',
  TBD: '#c3ccd9',
  TBC: '#ffd600',
  Hold: '#ffd600',
  'In Flight': '#ff6e40',
  Success: '#4dd0e1',
  Failure: '#ef5350',
};

const youtubeId = (url?: string): string | null => (/^https?:\/\/(?:www\.|m\.)?(youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|live\/|shorts\/|embed\/))([\w-]{8,})/.exec(safeUrl(url ?? '') ?? '') ?? [])[2] ?? null;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Big clock face from a positive remaining time: "1 T 04:33:21" / "04:33:21" */
function fmtBig(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400);
  const r = s % 86400;
  const time = `${pad2(Math.floor(r / 3600))}:${pad2(Math.floor((r % 3600) / 60))}:${pad2(r % 60)}`;
  return d ? `${d} T ${time}` : time;
}

export class LaunchPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private detail: LaunchDetail | null = null;
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private following = false;
  private open_ = new Set<string>(['remind', 'track']);
  private streamId = '';

  constructor(
    parent: HTMLElement,
    private h: LaunchPanelHooks,
  ) {
    this.root.className = 'fp launch';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('rocket', '#ff6e40', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body">
        <div class="lp-media">
          <div class="lp-count"><span class="dot"></span><span class="cd"></span><span class="lp-tplus"></span></div>
          <div class="lp-stream"></div>
        </div>
        <div class="lp-info"></div>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.lp-info')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.body.addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        if (d.dataset.key) d.open ? this.open_.add(d.dataset.key) : this.open_.delete(d.dataset.key);
      },
      true,
    );
    this.body.addEventListener('click', (e) => {      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'follow') this.setFollow(!this.following);
      if (act === 'zoom') {
        const d = this.detail;
        if (d && mapOf(this.h)) mapOf(this.h)!.easeTo({ center: [d.lon, d.lat], zoom: Math.max(mapOf(this.h)!.getZoom(), 6), duration: 800 });
      }
    });
  }

  open(d: LaunchDetail) {
    this.detail = d;
    this.root.hidden = false;
    this.streamId = youtubeId(d.video) ?? '';
    this.root.classList.toggle('split', false);
    this.root.querySelector('.fp-split')?.remove();
    this.render();
    clearInterval(this.refresh);
    this.refresh = window.setInterval(() => this.tick(), 1000);
    const mp = mapOf(this.h);
    if (mp && Number.isFinite(d.lat) && (d.lat || d.lon)) mp.easeTo({ center: [d.lon, d.lat], zoom: Math.max(mp.getZoom(), 4.5), duration: 800 });
  }

  close() {
    this.detail = null;
    clearInterval(this.refresh);
    clearInterval(this.followTimer);
    this.following = false;
    this.setLive(null);
    this.root.hidden = true;
  }

  /** keep the countdown ticking after returning from another tab of the app */
  awaken() {
    if (this.detail && !this.root.hidden) this.tick();
  }

  private setLive(data: { line: FeatureCollection; pos: FeatureCollection } | null) {
    this.h.live(data);
  }

  private render() {
    const d = this.detail;
    if (!d) return;
    this.root.querySelector('.fp-title')!.textContent = d.name;
    const color = STATUS_COLOR[d.status] ?? '#c3ccd9';
    this.root.querySelector('.fp-sub')!.innerHTML =
      `<span class="lp-status" style="--c:${color}">${escapeHtml(d.statusDe || d.status || 'Status offen')}</span> · ` +
      ([d.provider, d.rocket].filter(Boolean).map((v) => escapeHtml(v)).join(' · ') || 'Rakete');
    const stream = this.root.querySelector('.lp-stream')!;
    if (this.streamId) {
      stream.innerHTML = `
        <button type="button" class="lp-play" data-act="play">▶ Livestream ansehen</button>
        <div class="lp-frame" hidden></div>
        <span class="lp-badge">Splitscreen über „⤢“ im Kopf aktivieren</span>`;
      stream.querySelector('[data-act=play]')!.addEventListener('click', () => {
        stream.querySelector('.lp-play')!.toggleAttribute('hidden', true);
        const frame = stream.querySelector<HTMLDivElement>('.lp-frame')!;
        frame.hidden = false;
        frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.streamId)}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Livestream"></iframe>`;
      });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-split';
      btn.dataset.act = 'split';
      btn.title = 'Stream und Daten nebeneinander';
      btn.innerHTML = '⤢';
      this.root.querySelector('.fp-head')!.append(btn);
      btn.addEventListener('click', () => {
        this.root.classList.toggle('split');
        btn.classList.toggle('on', this.root.classList.contains('split'));
      });
    } else if (d.video) {
      stream.innerHTML = `<a class="lp-link" href="${escapeHtml(safeUrl(d.video)!)}" target="_blank" rel="noopener noreferrer">▶ Livestream auf YouTube öffnen ↗</a>`;
    } else {
      stream.innerHTML = '';
    }
    this.body.innerHTML = `
      <details data-key="mission" ${this.open_.has('mission') ? 'open' : ''}><summary>Mission</summary><div class="sp-rows"><div class="fp-note">${escapeHtml(d.desc || d.missionName || 'Keine Missionsbeschreibung.')}</div></div></details>
      <details data-key="track" ${this.open_.has('track') ? 'open' : ''}><summary>Live-Daten (Simulation)</summary>
        <div class="lp-track">
          <div class="sp-tiles">
            ${tile('T+', '–', { metric: 't' })}
            ${tile('Höhe', '–', { metric: 'alt' })}
            ${tile('Tempo', '–', { metric: 'v' })}
            ${tile('Über Grund', '–', { metric: 'r' })}
          </div>
          <div class="lp-tracknote"></div>
          <button type="button" class="btn small" data-act="follow">Rakete auf der Karte folgen</button>
        </div></details>
      <details data-key="remind" ${this.open_.has('remind') ? 'open' : ''}><summary>Erinnerung</summary><div class="sp-rows">
        <div class="lp-remind"><select aria-label="Erinnerung">
          <option value="">Keine Erinnerung</option>
          <option value="0">Bei Start (T-0)</option>
          <option value="10">10 min vorher</option>
          <option value="30">30 min vorher</option>
          <option value="10,0">10 min vorher + bei Start</option>
          <option value="30,10,0">30 + 10 min vorher + bei Start</option>
        </select><div class="lp-perm"></div></div></div></details>
      <details data-key="pad" ${this.open_.has('pad') ? 'open' : ''}><summary>Startplatz</summary><div class="sp-rows">${this.padRows(d)}</div></details>
      <div class="fp-actions lp-foot">
        <button type="button" data-act="zoom">Zum Startplatz</button>
      </div>
      <div class="fp-note lp-simnote">Bahndaten sind keine Telemetrie: Höhe, Tempo und Spur sind ein Simulationsmodell aus Startzeit und Zielorbit (${escapeHtml(d.orbit || 'Orbit')}). Echte Positionsdaten gibt es öffentlich nicht.</div>
      <div class="fp-note">Quelle: The Space Devs (Launch Library 2)· <a href="https://thespacedevs.com/launch/${escapeHtml(d.id)}" target="_blank" rel="noopener noreferrer">Details ↗</a></div>`;
    this.hydrateRemind();
    this.syncFollowLabel();
  }

  private padRows(d: LaunchDetail): string {
    const clockOf = (iso: string) => {
      const t = new Date(iso);
      return escapeHtml(clockTxt(t));
    };
    const rows: [string, string][] = [
      ['Startfenster', d.windowStart !== d.windowEnd ? `${clockOf(d.windowStart)} – ${clockOf(d.windowEnd)}` : clockOf(d.net)],
      ['Startzeit', `${escapeHtml(d.net ? fmt.dateTime(d.net) : '?')} (${escapeHtml(relCountdown(d.net))})`],
      ['Zielorbit', escapeHtml([d.orbit, d.orbitName].filter(Boolean).join(' – ') + (d.altKm ? ` · ≈ ${distTxt(d.altKm, 0)}` : ''))],
    ];
    if (d.pad) rows.push(['Rampe', escapeHtml(d.pad)]);
    if (d.place) rows.push(['Ort', escapeHtml(d.place)]);
    if (d.incDeg) rows.push(['Inklination', `${d.incDeg.toFixed(1)}°`]);
    if (d.probability != null) rows.push(['Startwahrscheinlichkeit', `${d.probability} %`]);
    return `<div class="sp-rows">${rows.map(([k, v]) => `<div class="sp-kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  }

  private hydrateRemind() {
    const d = this.detail!;
    const sel = this.body.querySelector<HTMLSelectElement>('.lp-remind select');
    if (!sel) return;
    const current = getReminder(d.id);
    sel.value = current.join(',');
    this.hydratePerm();
    sel.addEventListener('change', () => this.saveRemind(sel.value));
  }

  private hydratePerm() {
    const sel = this.body.querySelector<HTMLSelectElement>('.lp-remind select');
    if (!sel) return;
    if (notifSupported()) {
      const perm = notifyPermission();
      sel.disabled = false;
      this.body.querySelector('.lp-perm')!.innerHTML =
        perm === 'granted' ? '<span class="ok">✅ Mitteilungen erlaubt – auch bei geschlossenem Orbis</span>' : '<button type="button" class="btn small">Mitteilungen erlauben</button>';
    } else {
      sel.disabled = false;
      this.body.querySelector('.lp-perm')!.innerHTML = '<span class="muted small">Der Browser unterstützt keine Mitteilungen; Erinnerungen erscheinen nur als Hinweis in Orbis.</span>';
    }
  }

  private async saveRemind(value: string) {
    const d = this.detail;
    if (!d) return;
    const minutes = value
      .split(',')
      .filter(Boolean)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
    if (minutes.length && notifSupported() && notifyPermission() !== 'granted') await requestNotifyPermission();
    setReminder(d, minutes);
    toast(minutes.length ? `Erinnerung aktiviert: ${this.describe(minutes)}` : 'Erinnerung deaktiviert.', 'info');
    this.hydratePerm();
  }

  private describe(minutes: number[]): string {
    const parts = minutes
      .filter((m) => m > 0)
      .sort((a, b) => b - a)
      .map((m) => `${m} min`);
    return [...parts, ...(minutes.includes(0) ? ['bei Start'] : [])].join(' + ');
  }

  private setFollow(on: boolean) {
    this.following = on;
    clearInterval(this.followTimer);
    if (on) {
      const go = () => {
        const d = this.detail;
        if (d) {
          const p = flightPhase(d);
          if (p.at) mapOf(this.h)?.jumpTo({ center: [p.at.lon, p.at.lat] });
        }
      };
      this.followTimer = window.setInterval(go, 400);
      go();
    }
    this.syncFollowLabel();
  }

  private syncFollowLabel() {
    const b = this.body.querySelector('[data-act=follow]');
    if (b) b.textContent = this.following ? 'Folgen stoppen' : 'Rakete auf der Karte folgen';
    if (b) b.classList.toggle('on', this.following);
  }

  /** per-second refresh: countdown, live tiles, 3D phase, map track */
  private tick() {
    const d = this.detail;
    if (!d) return;
    const p = flightPhase(d, Date.now());
    const count = this.root.querySelector<HTMLElement>('.lp-count')!;
    const cd = count.querySelector('.cd')!;
    const tp = count.querySelector('.lp-tplus')!;
    const dot = count.querySelector<HTMLElement>('.dot')!;
    const endSec = flightEndSec(d);
    if (p.phase === 'pre') {
      const diff = Date.parse(d.net) - Date.now();
      dot.style.background = diff < 10 * 60000 ? '#ff6e40' : '#66bb6a';
      cd.textContent = fmtBig(diff);
      tp.textContent = `Start ${relCountdown(d.net)}`;
    } else if (p.phase === 'active') {
      dot.style.background = '#ff6e40';
      cd.textContent = `T+ ${tLabel(p.tSec)}`;
      tp.textContent = p.at ? `${d.orbit ? 'Ziel ' + d.orbit + ' · ' : ''}Brennschluss ca. T+${tLabel(endSec)}` : '';
    } else {
      dot.style.background = Date.parse(d.net) + endSec * 1000 < Date.now() ? '#4dd0e1' : '#c3ccd9';
      cd.textContent = p.tSec <= endSec + 300 ? 'Orbit erreicht 🛰️' : `T+ ${tLabel(p.tSec)}`;
      tp.textContent = `Sekundär zu ${escapeHtml(d.orbitName || d.orbit || 'Orbit')}`;
    }
    const active = p.phase === 'active' && p.at;
    this.setLive(active ? trackFeatures(d, Date.now()) : null);
    const trackDetails = this.body.parentElement!.querySelector('details[data-key="track"]') as HTMLDetailsElement | null;
    if (trackDetails && active) trackDetails.open = true;
    const tileText = (k: string, v: string) => {
      const t = this.body.querySelector<HTMLElement>(`[data-metric="${k}"]`);
      if (t) t.querySelector('b')!.textContent = v;
    };
    if (p.at) {
      tileText('t', `+${tLabel(p.tSec)}`);
      tileText('alt', p.at.altKm < 1 ? `${Math.round(p.at.altKm * 1000)} m` : distTxt(p.at.altKm, 0));
      tileText('v', speedTxt(p.at.speedKmh));
      tileText('r', distTxt(p.at.downrangeKm, 0));
    } else {
      tileText('t', p.phase === 'pre' ? '–' : '–');
      tileText('alt', p.phase === 'pre' ? '–' : 'in Orbit');
      tileText('v', p.phase === 'pre' ? '–' : '…');
      tileText('r', p.phase === 'pre' ? '–' : '…');
    }
    const note = this.body.querySelector('.lp-tracknote');
    if (note) {
      note.innerHTML = p.phase === 'pre'
        ? `Noch ${escapeHtml(relCountdown(d.net))} – die Live-Spur erscheint bei T-0 auf der Karte.`
        : p.phase === 'active'
          ? `Spur: ${escapeHtml(d.place || d.pad || '')} → ${escapeHtml(d.orbit || 'Orbit')} (angenähert)`
          : `Brennschluss bei T+${tLabel(endSec)} · die Rakete ist in der Zielbahn`;
    }
  }
}

function mapOf(h: LaunchPanelHooks): MlMap | null {
  return h.map();
}
