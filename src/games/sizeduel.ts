import type { Geometry, Position } from 'geojson';
import { loadData, SCOPES, scopeOf, type Feat } from './data';
import { escapeHtml } from '../util';
import { t as m, fmtLocale } from '../i18n';
import { areaVal, areaUnit } from '../units';
import { flagUrl, outlineSvg } from './quizitems';

// Size duel: two countries (or regions) are shown, you pick the bigger one – by area or by population.

export type Metric = 'area' | 'pop';

export interface SizeItem {
  id: string;
  name: string;
  flag?: string;
  svg: string;
  geom: Geometry;
  /** km² */
  area: number;
  pop?: number;
}

export interface SizeDuelOptions {
  items: SizeItem[];
  metric: Metric;
  /** 0 = until the first mistake */
  rounds: number;
}

export interface SizeDuel {
  destroy(): void;
}

const R = 6371.0088;
const rad = Math.PI / 180;
/** area (km²) of a ring on the sphere */
export function ringArea(r: Position[]): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += (r[i + 1][0] - r[i][0]) * rad * (2 + Math.sin(r[i][1] * rad) + Math.sin(r[i + 1][1] * rad));
  return Math.abs((s * R * R) / 2);
}
export function areaKm2(g: Geometry): number {
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return parts.reduce((t, p) => t + ringArea(p[0]) - p.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
}

/** scope = a SCOPES id, or `regions:<ISO>`; population is only known for countries */
export async function sizeItems(scope: string, metric: Metric): Promise<SizeItem[]> {
  const toItem = (f: Feat): SizeItem => ({
    id: f.properties.id, name: f.properties.name, flag: f.properties.flag, svg: outlineSvg(f.geometry), geom: f.geometry, area: areaKm2(f.geometry), pop: f.properties.pop,
  });
  if (scope.startsWith('regions:')) return ((await loadData(`admin1/${scope.slice(8)}.json`)).features as Feat[]).map(toItem).filter((i) => i.area > 0);
  const sc = scopeOf(scope) ?? SCOPES[0];
  return ((await loadData('countries.json')).features as Feat[])
    .filter((f) => f.properties.sov && (!sc.filter || sc.filter(f.properties)) && (metric === 'area' || f.properties.pop))
    .map(toItem);
}

const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
/** locale-aware number formatters (built per call: the language can change) */
const nf = () => new Intl.NumberFormat(fmtLocale(), { maximumFractionDigits: 0 });
const cf = () => new Intl.NumberFormat(fmtLocale(), { notation: 'compact', maximumFractionDigits: 1 });
const ratioF = () => new Intl.NumberFormat(fmtLocale(), { maximumFractionDigits: 1 });

export function startSizeDuel(host: HTMLElement, o: SizeDuelOptions, onExit: () => void): SizeDuel {
  const val = (i: SizeItem) => (o.metric === 'area' ? i.area : i.pop!);
  const fmt = (i: SizeItem) => (o.metric === 'area' ? `${nf().format(Math.round(areaVal(i.area)))} ${areaUnit()}` : `${cf().format(i.pop!)} ${m('games.residents', { count: i.pop! }, { count: i.pop! })}`);
  const total = o.rounds > 0 ? Math.min(o.rounds, Math.floor(o.items.length / 2)) : 0;
  const used = new Set<string>();

  const root = document.createElement('div');
  root.className = 'fg';
  root.innerHTML = `
    <div class="gm-hud fg-hud">
      <div class="gm-stats"><span class="sd-score"></span><span class="sd-time">0:00</span></div>
      <div class="fg-stage">
        <div class="fg-text"><small>${o.metric === 'area' ? m('games.askArea') : m('games.askPop')}</small></div>
        <div class="sd-cards"></div>
        <div class="gm-feedback" aria-live="polite"></div>
        <button class="btn btn-primary sd-next" type="button" hidden>${m('games.next')}</button>
        <small class="gm-note sd-hint">${m('games.silhouetteNote')}</small>
      </div>
      <div class="gm-actions">
        <button class="btn sd-giveup" type="button">${m('games.giveUp')}</button>
        <button class="btn sd-menu" type="button">${m('games.menu')}</button>
      </div>
    </div>`;
  host.append(root);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const cards = $('.sd-cards');
  const msg = $('.gm-feedback');
  const nextBtn = $<HTMLButtonElement>('.sd-next');
  $('.sd-hint').hidden = o.metric !== 'area';

  let round = 0;
  let right = 0;
  let streak = 0;
  let best = 0;
  let answered = true;
  let pair: [SizeItem, SizeItem] | null = null;
  const t0 = Date.now();
  const wrong: [SizeItem, SizeItem][] = [];

  const clock = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('.sd-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const timer = window.setInterval(clock, 500);
  const score = () => {
    $('.sd-score').textContent = `${total ? `${round} / ${total} · ` : ''}${m('games.rightCount', { count: right })}${streak > 1 ? ` · 🔥 ${streak}` : ''}`;
  };
  const say = (t: string, kind: '' | 'ok' | 'bad' = '') => {
    msg.textContent = t;
    msg.className = `gm-feedback ${kind}`;
  };

  /** pairs start easy (very different sizes) and get closer the longer the game runs */
  function pick(): [SizeItem, SizeItem] {
    let fresh = o.items.filter((i) => !used.has(i.id));
    if (fresh.length < 2) {
      used.clear();
      fresh = o.items;
    }
    const a = shuffle(fresh)[0];
    const maxRatio = Math.max(1.4, 10 - round * 0.7);
    const ratio = (b: SizeItem) => Math.max(val(a), val(b)) / Math.min(val(a), val(b));
    const others = shuffle(o.items.filter((i) => i !== a));
    const b = others.find((i) => ratio(i) >= 1.15 && ratio(i) <= maxRatio) ?? others.find((i) => ratio(i) > 1.02) ?? others[0];
    used.add(a.id);
    used.add(b.id);
    return shuffle([a, b]) as [SizeItem, SizeItem];
  }

  const cardHtml = (i: SizeItem, k: number) =>
    `<button type="button" class="sd-card" data-k="${k}">${i.svg}<span class="sd-name">${i.flag ? `<img class="fg-thumb" alt="" src="${flagUrl(i.flag)}" />` : ''}${escapeHtml(i.name)}</span><small class="sd-val" hidden></small></button>`;

  function next() {
    if (total && round >= total) return finish();
    pair = pick();
    answered = false;
    cards.innerHTML = pair.map(cardHtml).join('');
    nextBtn.hidden = true;
    say('');
    score();
  }

  function settle(k: number) {
    if (answered || !pair) return;
    answered = true;
    const [a, b] = pair;
    const win = val(a) >= val(b) ? 0 : 1;
    const ok = k === win;
    round++;
    cards.querySelectorAll<HTMLButtonElement>('.sd-card').forEach((c, i) => {
      c.disabled = true;
      c.classList.add(i === win ? 'right' : 'wrong');
      const v = c.querySelector<HTMLElement>('.sd-val')!;
      v.textContent = fmt(pair![i]);
      v.hidden = false;
    });
    const [big, small] = win === 0 ? [a, b] : [b, a];
    const x = ratioF().format(val(big) / val(small));
    const detail = o.metric === 'area' ? m('games.duelDetailArea', { a: big.name, x, b: small.name }) : m('games.duelDetailPop', { a: big.name, x, b: small.name });
    if (ok) {
      right++;
      streak++;
      best = Math.max(best, streak);
      say(`${m('games.correctCheer')} ${detail}`, 'ok');
    } else {
      streak = 0;
      wrong.push([big, small]);
      say(detail, 'bad');
    }
    score();
    if (!ok && !total) return finish();
    nextBtn.hidden = false;
    nextBtn.focus();
  }

  cards.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.sd-card');
    if (c) settle(Number(c.dataset.k));
  });
  nextBtn.addEventListener('click', next);
  $('.sd-giveup').addEventListener('click', () => finish(true));
  $('.sd-menu').addEventListener('click', onExit);

  function finish(gaveUp = false) {
    clearInterval(timer);
    const s = Math.round((Date.now() - t0) / 1000);
    root.innerHTML = `
      <div class="gm-result">
        <h2>${gaveUp ? m('games.gaveUp') : total ? m('games.done') : m('games.streakOver')}</h2>
        <div class="gm-big">${right}${total ? ` / ${total}` : ''} <span>${total ? `(${Math.round((right / Math.max(total, 1)) * 100)} %)` : m('games.streakDone')}</span></div>
        <p>${m('games.timeShort', { when: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })} · ${m('games.longestStreak', { n: best })}</p>
        ${wrong.length ? `<details open><summary>${m('games.wrongCount', { count: wrong.length })}</summary><p class="gm-missed">${wrong.map(([big, small]) => `${escapeHtml(big.name)} &gt; ${escapeHtml(small.name)}`).join(' · ')}</p></details>` : ''}
        <div class="gm-actions"><button class="btn btn-primary sd-again" type="button">${m('games.again')}</button><button class="btn sd-menu" type="button">${m('games.menu')}</button></div>
      </div>`;
    root.querySelector('.sd-again')!.addEventListener('click', () => {
      destroy();
      Object.assign(handle, startSizeDuel(host, o, onExit));
    });
    root.querySelector('.sd-menu')!.addEventListener('click', onExit);
  }

  function destroy() {
    clearInterval(timer);
    root.remove();
  }

  const handle: SizeDuel = { destroy };
  next();
  return handle;
}
