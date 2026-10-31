import type { Position } from 'geojson';
import { escapeHtml } from '../util';
import { areaVal, areaUnit } from '../units';
import { outlineShape } from './quizitems';
import { ringArea, type SizeItem } from './sizeduel';
import { t as m, fmtLocale } from '../i18n';

// Size scale: country A stays as it is, country B starts at a wrong size – drag its corner handle until it fits.

export interface SizeScaleOptions {
  items: SizeItem[];
  rounds: number;
}

export interface SizeScale {
  destroy(): void;
}

const KM = 111.195; // km per degree
const F_MIN = 0.15;
const F_ROOM = 2.4; // minimum room of the scene: B can be pulled up to this size (more if the right answer needs it) – the view never zooms
const POINTS_RANGE = 2.2; // |ln(area ratio error)| at which a round is worth 0 points

const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
/** locale-aware number formatters (built per call: the language can change) */
const nf = () => new Intl.NumberFormat(fmtLocale(), { maximumFractionDigits: 1 });
const nfa = () => new Intl.NumberFormat(fmtLocale(), { maximumFractionDigits: 0 });
const nf2 = () => new Intl.NumberFormat(fmtLocale(), { maximumFractionDigits: 2 });

/** silhouette in km, centred on its bounding box, plus its visible area (km²) */
function shape(item: SizeItem) {
  const sh = outlineShape(item.geom);
  if (!sh) return null;
  const cx = (sh.bb[0] + sh.bb[2]) / 2;
  const cy = (sh.bb[1] + sh.bb[3]) / 2;
  const pt = ([x, y]: Position) => `${((x - cx) * sh.k * KM).toFixed(1)} ${((cy - y) * KM).toFixed(1)}`;
  return {
    d: sh.keep.flatMap((p) => p.map((r) => `M${r.map(pt).join('L')}Z`)).join(''),
    w: sh.w * KM,
    h: sh.h * KM,
    area: sh.keep.reduce((t, p) => t + ringArea(p[0]) - p.slice(1).reduce((x, r) => x + ringArea(r), 0), 0),
  };
}

/** archipelagos and micro-states make poor silhouettes: the drawn parts must cover most of the real area */
const usable = (i: SizeItem) => {
  const sh = shape(i);
  return !!sh && i.area >= 3000 && sh.area / i.area >= 0.7;
};

export function startSizeScale(host: HTMLElement, o: SizeScaleOptions, onExit: () => void): SizeScale {
  const filtered = o.items.filter(usable);
  const items = filtered.length >= 4 ? filtered : o.items;
  const total = Math.min(o.rounds, Math.floor(items.length / 2));
  const used = new Set<string>();

  const root = document.createElement('div');
  root.className = 'fg';
  root.innerHTML = `
    <div class="gm-hud fg-hud">
      <div class="gm-stats"><span class="sc-score"></span><span class="sc-time">0:00</span></div>
      <div class="fg-stage">
        <div class="sc-vs"><small class="sc-vs-label">${m('games.areaShort')}</small><div class="sc-vs-names"></div><small class="sc-vs-areas"></small></div>
        <svg class="sc-svg" role="img" aria-label="${m('games.sizeA11y')}" preserveAspectRatio="xMidYMax meet"></svg>
        <div class="gm-feedback" aria-live="polite"></div>
        <button class="btn btn-primary sc-check" type="button">${m('games.check')}</button>
        <button class="btn btn-primary sc-next" type="button" hidden>${m('games.next')}</button>
      </div>
      <div class="gm-actions">
        <button class="btn sc-giveup" type="button">${m('games.giveUp')}</button>
        <button class="btn sc-menu" type="button">${m('games.menu')}</button>
      </div>
    </div>`;
  host.append(root);
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const svg = $<SVGSVGElement>('.sc-svg');
  const msg = $<HTMLElement>('.gm-feedback');
  const checkBtn = $<HTMLButtonElement>('.sc-check');
  const nextBtn = $<HTMLButtonElement>('.sc-next');

  let round = 0;
  let points = 0;
  let checked = true;
  let f = 1;
  let cur: { a: SizeItem; b: SizeItem; ratio: number } | null = null;
  const t0 = Date.now();
  const log: { a: string; b: string; f: number; pts: number }[] = [];

  const clock = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('.sc-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const timer = window.setInterval(clock, 500);
  const score = () => {
    $('.sc-score').textContent = `${round} / ${total} · ${m('games.points', { count: points })}`;
  };
  const say = (t: string, kind: '' | 'ok' | 'bad' = '') => {
    msg.textContent = t;
    msg.className = `gm-feedback ${kind}`;
  };

  function pick(): { a: SizeItem; b: SizeItem } {
    let fresh = items.filter((i) => !used.has(i.id));
    if (fresh.length < 2) {
      used.clear();
      fresh = items;
    }
    const a = shuffle(fresh)[0];
    const r = (b: SizeItem) => Math.max(a.area, b.area) / Math.min(a.area, b.area);
    const others = shuffle(items.filter((i) => i !== a));
    const b = others.find((i) => r(i) >= 1.3 && r(i) <= 8) ?? others[0];
    used.add(a.id);
    used.add(b.id);
    return { a, b };
  }

  let sa: ReturnType<typeof shape> = null;
  let sb: ReturnType<typeof shape> = null;
  let bG: SVGGElement | null = null;
  let handle: SVGGElement | null = null;
  let ground: SVGLineElement | null = null;
  let bx = 0; // left edge of B
  let fs = 1; // font size / handle size in scene units
  let roomMax = F_ROOM; // how far B can be pulled in this round (fixed scene, no zooming)

  /** B grows from its bottom-left corner; the handle sits on the top-right corner of its frame */
  function setF(v: number) {
    f = Math.min(roomMax, Math.max(F_MIN, v));
    if (!sa || !sb) return;
    bG?.setAttribute('transform', `translate(${bx} 0) scale(${f}) translate(${sb.w / 2} ${-sb.h / 2})`);
    // the scene is sized once per round for the largest B, so nothing zooms while dragging
    const room = roomMax;
    const z = 1;
    const right = bx + sb.w * room;
    const top = Math.max(sa.h, sb.h * room) + fs * 5 * z;
    svg.setAttribute('viewBox', `${-fs * 2} ${-top} ${right + fs * 4 * z} ${top + fs * 2.2 * z}`);
    ground?.setAttribute('x2', String(right + fs * 2 * z));
    handle?.setAttribute('transform', `translate(${bx + sb.w * f} ${-sb.h * f}) scale(${z})`);
  }

  /** "Land vs Land" stays on one line: shrink the font until it fits the width */
  function fitNames() {
    const n = $<HTMLElement>('.sc-vs-names');
    n.style.fontSize = '';
    const avail = n.parentElement!.clientWidth;
    let size = parseFloat(getComputedStyle(n).fontSize);
    while (n.scrollWidth > avail && size > 14) {
      size -= 1;
      n.style.fontSize = `${size}px`;
    }
  }
  const onResize = () => {
    fitNames();
    setF(f);
  };
  window.addEventListener('resize', onResize);

  function next() {
    if (round >= total) return finish();
    const { a, b } = pick();
    sa = shape(a);
    sb = shape(b);
    if (!sa || !sb) return next();
    cur = { a, b, ratio: sb.area / sa.area };
    checked = false;
    roomMax = Math.max(F_ROOM, Math.sqrt(cur.ratio) * 1.4);
    const bw = sb.w * roomMax;
    const gap = (sa.w + bw) * 0.1;
    fs = Math.max(sa.w + gap + bw, sa.h, sb.h * roomMax) * 0.035;
    bx = sa.w + gap;
    svg.innerHTML = `
      <line class="sc-ground" x1="${-fs * 2}" x2="0" y1="0" y2="0" />
      <g transform="translate(${sa.w / 2} ${-sa.h / 2})"><path class="sc-a" d="${sa.d}" fill-rule="evenodd" /></g>
      <g class="sc-true" style="display:none" transform="translate(${bx + sb.w / 2} ${-sb.h / 2})"><path d="${sb.d}" fill-rule="evenodd" /></g>
      <g class="sc-b"></g>
      <g class="sc-handle"><circle r="${fs * 0.9}" /><path d="M${-fs * 0.35} ${fs * 0.35}L${fs * 0.35} ${-fs * 0.35}M${fs * 0.35} ${-fs * 0.05}V${-fs * 0.35}H${-fs * 0.05}M${-fs * 0.35} ${fs * 0.05}V${fs * 0.35}H${fs * 0.05}" /></g>`;
    ground = svg.querySelector<SVGLineElement>('.sc-ground');
    bG = svg.querySelector<SVGGElement>('.sc-b');
    bG!.innerHTML = `<path d="${sb.d}" fill-rule="evenodd" /><rect class="sc-frame" x="${-sb.w / 2}" y="${-sb.h / 2}" width="${sb.w}" height="${sb.h}" />`;
    handle = svg.querySelector<SVGGElement>('.sc-handle');
    // unpredictable start size (log scale): sometimes close to right (but never exact), mostly medium off,
    // now and then far off – too small or too big
    const roll = Math.random();
    const off = roll < 0.25 ? 0.03 + Math.random() * 0.15 : roll < 0.7 ? 0.25 + Math.random() * 0.5 : 0.8 + Math.random() * 0.8;
    let dir = Math.random() < 0.5 ? -1 : 1;
    if (Math.exp(dir * off) > roomMax * 0.92) dir = -1; // would not fit the scene: go small instead
    setF(Math.exp(dir * off));
    $('.sc-vs-names').innerHTML = `<span class="sc-na">${escapeHtml(a.name)}</span> <i>vs</i> <span class="sc-nb">${escapeHtml(b.name)}</span>`;
    $('.sc-vs-areas').textContent = '';
    fitNames();
    checkBtn.hidden = false;
    nextBtn.hidden = true;
    say('');
    score();
  }

  // dragging the corner handle (or the shape itself) scales B around its bottom-left corner
  let drag = 0; // pointer position relative to B's frame when grabbed (≈1 on the handle), so nothing jumps
  const rel = (e: PointerEvent) => {
    const r = bG!.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width + (r.bottom - e.clientY) / r.height) / 2;
  };
  svg.addEventListener('pointerdown', (e) => {
    if (checked || !(e.target as Element).closest('.sc-b, .sc-handle')) return;
    drag = rel(e);
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    // measured against B as it is drawn right now, because zooming out changes its on-screen size
    setF((f * rel(e)) / drag);
  });
  const endDrag = () => (drag = 0);
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  checkBtn.addEventListener('click', () => {
    if (checked || !cur) return;
    checked = true;
    round++;
    // linear factor f → area factor f²; 1 means exactly right
    const err = Math.abs(2 * Math.log(f));
    const pts = Math.round(100 * Math.max(0, 1 - err / POINTS_RANGE));
    points += pts;
    log.push({ a: cur.a.name, b: cur.b.name, f, pts });
    svg.querySelector<SVGGElement>('.sc-true')!.style.display = '';
    handle!.style.display = 'none';
    const trueArea = `${nfa().format(Math.round(areaVal(cur.b.area)))} ${areaUnit()}`;
    $('.sc-vs-areas').textContent = `${nfa().format(Math.round(areaVal(cur.a.area)))} ${areaUnit()} vs ${trueArea}`;
    const r = cur.ratio; // B's real area relative to A
    const mine = f * f * r; // what the drawing shows
    const x = (v: number) => (v >= 10 ? nfa() : v >= 1 ? nf() : nf2()).format(v) + '×';
    const verdict = pts >= 90 ? m('games.perfect') : pts >= 60 ? m('games.close') : pts >= 30 ? m('games.slightlyOff') : m('games.far');
    const detail = r >= 1
      ? m('games.scaleBigger', { b: cur.b.name, factor: x(r), a: cur.a.name, mine: x(mine) })
      : m('games.scaleSmaller', { b: cur.b.name, factor: x(r), a: cur.a.name, mine: x(mine) });
    say(`${verdict} +${m('games.points', { count: pts })}. ${detail}`, pts >= 60 ? 'ok' : 'bad');
    checkBtn.hidden = true;
    nextBtn.hidden = false;
    nextBtn.focus();
    score();
  });
  nextBtn.addEventListener('click', next);
  $('.sc-giveup').addEventListener('click', () => finish(true));
  $('.sc-menu').addEventListener('click', onExit);

  function finish(gaveUp = false) {
    clearInterval(timer);
    const s = Math.round((Date.now() - t0) / 1000);
    const max = Math.max(round, 1) * 100;
    root.innerHTML = `
      <div class="gm-result">
        <h2>${gaveUp ? m('games.gaveUp') : m('games.done')}</h2>
        <div class="gm-big">${points} <span>${m('games.scoreOf', { points, total: total * 100, pct: Math.round((points / max) * 100) }, { count: total * 100 })}</span></div>
        <p>${m('games.timeShort', { when: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })}</p>
        ${log.length ? `<details open><summary>${m('games.yourRounds')}</summary><p class="gm-missed">${log.map((l) => `${escapeHtml(l.b)} (${l.f >= 1 ? m('games.tooBig') : m('games.tooSmall')}, ${m('games.ptsAbbr', { count: l.pts })})`).join(' · ')}</p></details>` : ''}
        <div class="gm-actions"><button class="btn btn-primary sc-again" type="button">${m('games.again')}</button><button class="btn sc-menu" type="button">${m('games.menu')}</button></div>
      </div>`;
    root.querySelector('.sc-again')!.addEventListener('click', () => {
      destroy();
      Object.assign(api, startSizeScale(host, o, onExit));
    });
    root.querySelector('.sc-menu')!.addEventListener('click', onExit);
  }

  function destroy() {
    clearInterval(timer);
    window.removeEventListener('resize', onResize);
    root.remove();
  }

  const api: SizeScale = { destroy };
  next();
  return api;
}
