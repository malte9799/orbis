import type { Position } from 'geojson';
import { escapeHtml } from '../util';
import { outlineShape } from './quizitems';
import { ringArea, type SizeItem } from './sizeduel';

// Size scale: country A stays as it is, country B starts at a wrong size – drag it (or use the slider) until it fits.

export interface SizeScaleOptions {
  items: SizeItem[];
  rounds: number;
}

export interface SizeScale {
  destroy(): void;
}

const KM = 111.195; // km per degree
const F_MIN = 0.2;
const F_MAX = 2.5;
const F_ROOM = 2; // B can be dragged beyond this, the scene just overflows a little
const POINTS_RANGE = 2.2; // |ln(area ratio error)| at which a round is worth 0 points

const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

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
        <div class="fg-text"><small class="sc-ask"></small></div>
        <svg class="sc-svg" role="img" aria-label="Größenvergleich"></svg>
        <input class="sc-slider" type="range" min="${Math.log(F_MIN)}" max="${Math.log(F_MAX)}" step="0.005" aria-label="Größe" />
        <div class="gm-feedback" aria-live="polite"></div>
        <button class="btn btn-primary sc-check" type="button">Prüfen</button>
        <button class="btn btn-primary sc-next" type="button" hidden>Weiter</button>
      </div>
      <div class="gm-actions">
        <button class="btn sc-giveup" type="button">Aufgeben</button>
        <button class="btn sc-menu" type="button">Menü</button>
      </div>
    </div>`;
  host.append(root);
  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const svg = $<SVGSVGElement>('.sc-svg');
  const slider = $<HTMLInputElement>('.sc-slider');
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
    $('.sc-score').textContent = `${round} / ${total} · ${points} Punkte`;
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

  function setF(v: number) {
    f = Math.min(F_MAX, Math.max(F_MIN, v));
    slider.value = String(Math.log(f));
    bG?.setAttribute('transform', `translate(${bx} 0) scale(${f})`);
  }
  let bx = 0;

  function next() {
    if (round >= total) return finish();
    const { a, b } = pick();
    sa = shape(a);
    sb = shape(b);
    if (!sa || !sb) return next();
    cur = { a, b, ratio: sb.area / sa.area };
    checked = false;
    const bw = sb.w * F_ROOM;
    const bh = sb.h * F_ROOM;
    const gap = (sa.w + bw) * 0.08;
    const W = sa.w + gap + bw;
    const H = Math.max(sa.h, bh);
    const fs = Math.max(W, H) * 0.05;
    const pad = fs * 2.5;
    const ax = -W / 2 + sa.w / 2;
    bx = W / 2 - bw / 2;
    svg.setAttribute('viewBox', `${-W / 2 - pad} ${-H / 2 - pad} ${W + pad * 2} ${H + pad * 2 + fs * 1.6}`);
    svg.innerHTML = `
      <g transform="translate(${ax} 0)"><path class="sc-a" d="${sa.d}" fill-rule="evenodd" /></g>
      <g class="sc-b"><path d="${sb.d}" fill-rule="evenodd" /></g>
      <g class="sc-true" style="display:none" transform="translate(${bx} 0)"><path d="${sb.d}" fill-rule="evenodd" /></g>
      <text class="sc-label" font-size="${fs}" x="${ax}" y="${H / 2 + fs * 1.2}" text-anchor="middle">${escapeHtml(a.name)}</text>
      <text class="sc-label sc-label-b" font-size="${fs}" x="${bx}" y="${H / 2 + fs * 1.2}" text-anchor="middle">${escapeHtml(b.name)}</text>`;
    bG = svg.querySelector<SVGGElement>('.sc-b');
    const start = Math.exp((Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5));
    setF(start);
    $('.sc-ask').innerHTML = `Ziehe <b>${escapeHtml(b.name)}</b> auf die richtige Größe – <b>${escapeHtml(a.name)}</b> bleibt, wie es ist.`;
    slider.disabled = false;
    checkBtn.hidden = false;
    nextBtn.hidden = true;
    say('');
    score();
  }

  // dragging B away from / towards its centre scales it
  let drag: { cx: number; cy: number; r0: number; f0: number } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    if (checked || !(e.target as Element).closest('.sc-b')) return;
    const r = bG!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    drag = { cx, cy, r0: Math.max(30, Math.hypot(e.clientX - cx, e.clientY - cy)), f0: f };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (drag) setF(drag.f0 * (Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) / drag.r0));
  });
  const endDrag = () => (drag = null);
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  slider.addEventListener('input', () => setF(Math.exp(Number(slider.value))));

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
    slider.disabled = true;
    const rel = cur.ratio >= 1 ? `${nf.format(cur.ratio)}× so groß wie` : `${nf.format(1 / cur.ratio)}× kleiner als`;
    say(`${pts} Punkte – du lagst bei ${nf.format(f * f * cur.ratio)}× (Fläche von ${cur.a.name}). Richtig: ${cur.b.name} ist ${rel} ${cur.a.name}.`, pts >= 60 ? 'ok' : 'bad');
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
        <h2>${gaveUp ? 'Aufgegeben' : 'Geschafft!'}</h2>
        <div class="gm-big">${points} <span>von ${total * 100} Punkten (${Math.round((points / max) * 100)} %)</span></div>
        <p>Zeit ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</p>
        ${log.length ? `<details open><summary>Deine Runden</summary><p class="gm-missed">${log.map((l) => `${escapeHtml(l.b)} (${l.f >= 1 ? 'zu groß' : 'zu klein'}, ${l.pts} P.)`).join(' · ')}</p></details>` : ''}
        <div class="gm-actions"><button class="btn btn-primary sc-again" type="button">Nochmal</button><button class="btn sc-menu" type="button">Menü</button></div>
      </div>`;
    root.querySelector('.sc-again')!.addEventListener('click', () => {
      destroy();
      Object.assign(handle, startSizeScale(host, o, onExit));
    });
    root.querySelector('.sc-menu')!.addEventListener('click', onExit);
  }

  function destroy() {
    clearInterval(timer);
    root.remove();
  }

  const handle: SizeScale = { destroy };
  next();
  return handle;
}
