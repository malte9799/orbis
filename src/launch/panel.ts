import type { Map as MlMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { LaunchDetail } from './tracker';
import { flightPhase, flightEndSec, getReminder, notifSupported, notifyPermission, requestNotifyPermission, setReminder, statusTxt, trackFeatures, tLabel } from './tracker';
import { t as m } from '../i18n';
import { escapeHtml, fmt, safeUrl, toast } from '../util';
import { clockTxt, distTxt, heightTxt, speedTxt } from '../units';
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
  return d ? `${d} ${m('launch.tfDay')} ${time}` : time;
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
      <div class="fp-head"><i class="fp-ic">${glyphSvg('rocket', '#ff6e40', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="${escapeHtml(m('common.close'))}">×</button></div>
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
      `<span class="lp-status" style="--c:${color}">${escapeHtml(statusTxt(d) || m('launch.statusUnknown'))}</span> · ` +
      ([d.provider, d.rocket].filter(Boolean).map((v) => escapeHtml(v)).join(' · ') || m('launch.noRocket'));
    const stream = this.root.querySelector('.lp-stream')!;
    if (this.streamId) {
      stream.innerHTML = `
        <button type="button" class="lp-play" data-act="play">${m('launch.watchLive')}</button>
        <div class="lp-frame" hidden></div>
        <span class="lp-badge">${m('launch.splitHint')}</span>`;
      stream.querySelector('[data-act=play]')!.addEventListener('click', () => {
        stream.querySelector('.lp-play')!.toggleAttribute('hidden', true);
        const frame = stream.querySelector<HTMLDivElement>('.lp-frame')!;
        frame.hidden = false;
        frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.streamId)}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${m('launch.streamTitle')}"></iframe>`;
      });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fp-split';
      btn.dataset.act = 'split';
      btn.title = m('launch.splitTitle');
      btn.innerHTML = '⤢';
      this.root.querySelector('.fp-head')!.append(btn);
      btn.addEventListener('click', () => {
        this.root.classList.toggle('split');
        btn.classList.toggle('on', this.root.classList.contains('split'));
      });
    } else if (d.video) {
      stream.innerHTML = `<a class="lp-link" href="${escapeHtml(safeUrl(d.video)!)}" target="_blank" rel="noopener noreferrer">${m('launch.openYt')}</a>`;
    } else {
      stream.innerHTML = '';
    }
    this.body.innerHTML = `
      <details data-key="mission" ${this.open_.has('mission') ? 'open' : ''}><summary>${m('launch.mission')}</summary><div class="sp-rows"><div class="fp-note">${escapeHtml(d.desc || d.missionName || m('launch.noMissionDesc'))}</div></div></details>
      <details data-key="track" ${this.open_.has('track') ? 'open' : ''}><summary>${m('launch.liveData')}</summary>
        <div class="lp-track">
          <div class="sp-tiles">
            ${tile('T+', '–', { metric: 't' })}
            ${tile(m('launch.alt'), '–', { metric: 'alt' })}
            ${tile(m('launch.speed'), '–', { metric: 'v' })}
            ${tile(m('launch.downrange'), '–', { metric: 'r' })}
          </div>
          <div class="lp-tracknote"></div>
          <button type="button" class="btn small" data-act="follow">${m('launch.follow')}</button>
        </div></details>
      <details data-key="remind" ${this.open_.has('remind') ? 'open' : ''}><summary>${m('launch.remind')}</summary><div class="sp-rows">
        <div class="lp-remind"><select aria-label="${escapeHtml(m('launch.remindA11y'))}">
          <option value="">${m('launch.remindNone')}</option>
          <option value="0">${m('launch.remindAt')}</option>
          <option value="10">${m('launch.remind10')}</option>
          <option value="30">${m('launch.remind30')}</option>
          <option value="10,0">${m('launch.remind10At')}</option>
          <option value="30,10,0">${m('launch.remind3010')}</option>
        </select><div class="lp-perm"></div></div></div></details>
      <details data-key="pad" ${this.open_.has('pad') ? 'open' : ''}><summary>${m('launch.pad')}</summary><div class="sp-rows">${this.padRows(d)}</div></details>
      <div class="fp-actions lp-foot">
        <button type="button" data-act="zoom">${m('launch.toPad')}</button>
      </div>
      <div class="fp-note lp-simnote">${m('launch.simNote', { orbit: d.orbit || m('launch.orbitNone') })}</div>
      <div class="fp-note">${m('launch.sourceLabel')} <a href="https://thespacedevs.com/launch/${escapeHtml(d.id)}" target="_blank" rel="noopener noreferrer">${m('launch.details')}</a></div>`;
    this.hydrateRemind();
    this.syncFollowLabel();
  }

  private padRows(d: LaunchDetail): string {
    const clockOf = (iso: string) => {
      const t = new Date(iso);
      return escapeHtml(clockTxt(t));
    };
    const rows: [string, string][] = [
      [m('launch.win'), d.windowStart !== d.windowEnd ? `${clockOf(d.windowStart)} – ${clockOf(d.windowEnd)}` : clockOf(d.net)],
      [m('launch.netTime'), `${escapeHtml(d.net ? fmt.dateTime(d.net) : '?')} (${escapeHtml(relCountdown(d.net))})`],
      [m('launch.orbit'), escapeHtml([d.orbit, d.orbitName].filter(Boolean).join(' – ') + (d.altKm ? ` · ≈ ${distTxt(d.altKm, 0)}` : ''))],
    ];
    if (d.pad) rows.push([m('launch.ramp'), escapeHtml(d.pad)]);
    if (d.place) rows.push([m('launch.place'), escapeHtml(d.place)]);
    if (d.incDeg) rows.push([m('launch.incl'), `${d.incDeg.toFixed(1)}°`]);
    if (d.probability != null) rows.push([m('launch.probability'), `${d.probability} %`]);
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
        perm === 'granted' ? `<span class="ok">${m('launch.permOk')}</span>` : `<button type="button" class="btn small">${m('launch.permAsk')}</button>`;
    } else {
      sel.disabled = false;
      this.body.querySelector('.lp-perm')!.innerHTML = `<span class="muted small">${m('launch.permNo')}</span>`;
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
    toast(minutes.length ? m('launch.remindOn', { list: this.describe(minutes) }, { count: minutes.length }) : m('launch.remindOff'), 'info');
    this.hydratePerm();
  }

  private describe(minutes: number[]): string {
    const parts = minutes
      .filter((m) => m > 0)
      .sort((a, b) => b - a)
      .map((m) => `${m} min`);
    return [...parts, ...(minutes.includes(0) ? [m('launch.atStart')] : [])].join(' + ');
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
    if (b) b.textContent = this.following ? m('launch.followStop') : m('launch.follow');
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
      tp.textContent = m('launch.startIn', { when: relCountdown(d.net) });
    } else if (p.phase === 'active') {
      dot.style.background = '#ff6e40';
      cd.textContent = `T+ ${tLabel(p.tSec)}`;
      tp.textContent = p.at ? `${d.orbit ? `${m('launch.orbitPrefix', { orbit: d.orbit })} · ` : ''}${m('launch.cutoff', { t: tLabel(endSec) })}` : '';
    } else {
      dot.style.background = Date.parse(d.net) + endSec * 1000 < Date.now() ? '#4dd0e1' : '#c3ccd9';
      cd.textContent = p.tSec <= endSec + 300 ? m('launch.orbitReached') : `T+ ${tLabel(p.tSec)}`;
      tp.textContent = m('launch.secondary', { orbit: d.orbitName || d.orbit || m('launch.orbitNone') });
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
      tileText('alt', p.at.altKm < 1 ? heightTxt(p.at.altKm * 1000) : distTxt(p.at.altKm, 0));
      tileText('v', speedTxt(p.at.speedKmh));
      tileText('r', distTxt(p.at.downrangeKm, 0));
    } else {
      tileText('t', p.phase === 'pre' ? '–' : '–');
      tileText('alt', p.phase === 'pre' ? '–' : m('launch.inOrbit'));
      tileText('v', p.phase === 'pre' ? '–' : '…');
      tileText('r', p.phase === 'pre' ? '–' : '…');
    }
    const note = this.body.querySelector('.lp-tracknote');
    if (note) {
      note.innerHTML = p.phase === 'pre'
        ? escapeHtml(m('launch.countdownNote', { when: relCountdown(d.net) }))
        : p.phase === 'active'
          ? escapeHtml(m('launch.trackNote', { place: d.place || d.pad || '', orbit: d.orbit || m('launch.orbitNone') }))
          : escapeHtml(m('launch.coastNote', { t: tLabel(endSec) }));
    }
  }
}

function mapOf(h: LaunchPanelHooks): MlMap | null {
  return h.map();
}
