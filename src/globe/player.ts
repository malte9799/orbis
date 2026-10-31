import { escapeHtml, safeUrl } from '../util';
import { t } from '../i18n';
import { stationClick } from '../api/radio';

// Small floating radio player shared by all map views.

export interface PlayableStation {
  id: string;
  name: string;
  stream: string;
  favicon?: string;
  place?: string;
}

let root: HTMLDivElement | null = null;
let audio: HTMLAudioElement | null = null;
let current: PlayableStation | null = null;

function ensure() {
  if (root) return;
  audio = new Audio();
  audio.preload = 'none';
  root = document.createElement('div');
  root.className = 'radio-player';
  root.hidden = true;
  root.innerHTML = `
    <img class="rp-logo" alt="" referrerpolicy="no-referrer">
    <div class="rp-text"><b class="rp-name"></b><span class="rp-state small muted"></span></div>
    <button type="button" class="btn icon-btn rp-toggle" aria-label="${t('map.radio.ariaPause')}"></button>
    <input type="range" class="rp-vol" min="0" max="1" step="0.05" value="0.8" aria-label="${t('map.radio.ariaVol')}">
    <button type="button" class="btn icon-btn rp-close" aria-label="${t('hud.close')}">✕</button>`;
  document.body.append(root);
  const state = root.querySelector<HTMLElement>('.rp-state')!;
  const toggle = root.querySelector<HTMLButtonElement>('.rp-toggle')!;
  const icon = () => {
    const playing = audio && !audio.paused;
    toggle.innerHTML = playing ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    toggle.setAttribute('aria-label', playing ? t('map.radio.ariaPause') : t('map.radio.ariaPlay'));
  };
  audio.addEventListener('playing', () => {
    state.textContent = current?.place ? t('map.radio.state', { live: t('map.radio.live'), place: current.place }) : t('map.radio.live');
    icon();
  });
  audio.addEventListener('waiting', () => (state.textContent = t('map.radio.buffering')));
  audio.addEventListener('pause', icon);
  audio.addEventListener('error', () => {
    state.textContent = t('map.radio.error');
    toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  });
  toggle.addEventListener('click', () => {
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  });
  root.querySelector<HTMLInputElement>('.rp-vol')!.addEventListener('input', (e) => {
    if (audio) audio.volume = Number((e.target as HTMLInputElement).value);
  });
  root.querySelector('.rp-close')!.addEventListener('click', stopRadio);
  audio.volume = 0.8;
}

export function playStation(s: PlayableStation) {
  ensure();
  current = s;
  const r = root!;
  r.hidden = false;
  r.querySelector<HTMLElement>('.rp-name')!.textContent = s.name;
  r.querySelector<HTMLElement>('.rp-state')!.textContent = t('map.radio.connecting');
  const logo = r.querySelector<HTMLImageElement>('.rp-logo')!;
  const fav = safeUrl(s.favicon);
  logo.hidden = !fav;
  if (fav) logo.src = fav;
  logo.onerror = () => (logo.hidden = true);
  audio!.src = s.stream;
  void audio!.play().catch(() => undefined);
  void stationClick(s.id);
}

export function stopRadio() {
  audio?.pause();
  if (audio) audio.removeAttribute('src');
  audio?.load();
  if (root) root.hidden = true;
  current = null;
}

export function radioPopupExtra(p: Record<string, unknown>): string {
  const home = safeUrl(p.homepage);
  const rows = [
    [t('map.radio.rows.place'), p.place],
    [t('map.radio.rows.genre'), p.tags],
    [t('map.radio.rows.language'), p.language],
    [t('map.radio.rows.format'), p.codec],
  ].filter(([, v]) => v);
  const play = p.playable
    ? `<button type="button" class="btn small primary rp-play">▶ ${t('map.radio.listen')}</button>`
    : `<a class="btn small" href="${escapeHtml(safeUrl(p.stream) ?? home ?? '#')}" target="_blank" rel="noopener noreferrer">▶ ${t('map.radio.listenTab')}</a>`;
  return `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>
    <div class="rp-actions">${play}${home ? `<a class="btn small" href="${escapeHtml(home)}" target="_blank" rel="noopener noreferrer">${t('map.radio.website')}</a>` : ''}</div>`;
}
