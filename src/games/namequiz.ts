import { lev, norm } from './data';
import { escapeHtml } from '../util';

// Generic "what is this called?" quiz used by the flag, capital and outline games:
// a prompt (flag, outline, country …) is shown and the answer is picked from four options or typed.

export interface QuizItem {
  id: string;
  /** distractors come from the same group first (e.g. the same continent) */
  group: string;
  /** the answer as shown on a choice button and in the results */
  label: string;
  /** every spelling that counts when typing */
  answers: string[];
  /** HTML of the question */
  prompt: string;
  /** small HTML next to the label in the "missed" list */
  thumb?: string;
}

export interface NameQuizOptions {
  items: QuizItem[];
  mode: 'choice' | 'type';
  /** 0 = all items */
  rounds: number;
  placeholder: string;
}

export interface NameQuiz {
  destroy(): void;
}

const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

export function startNameQuiz(host: HTMLElement, o: NameQuizOptions, onExit: () => void): NameQuiz {
  const pool = o.items;
  const queue = shuffle(pool).slice(0, o.rounds > 0 ? o.rounds : pool.length);
  const total = queue.length;
  const byAnswer = new Map<string, QuizItem>();
  for (const it of pool) for (const a of it.answers) byAnswer.set(norm(a), it);

  // same HUD as the map quiz (views/games.ts): stats on top, question in the middle, actions at the bottom
  const root = document.createElement('div');
  root.className = 'fg';
  root.innerHTML = `
    <div class="gm-hud fg-hud">
      <div class="gm-stats"><span class="fg-score"></span><span class="fg-time">0:00</span></div>
      <div class="fg-stage">
        <div class="fg-flag"></div>
        <div class="fg-choices"></div>
        <form class="fg-type" autocomplete="off"><input class="gm-input" type="text" placeholder="${escapeHtml(o.placeholder)}" autocapitalize="off" autocorrect="off" spellcheck="false" /><button class="btn btn-primary" type="submit">OK</button></form>
        <div class="gm-feedback" aria-live="polite"></div>
        <button class="btn btn-primary fg-next" type="button" hidden>Weiter</button>
      </div>
      <div class="gm-actions">
        <button class="btn fg-skip" type="button">Überspringen</button>
        <button class="btn fg-giveup" type="button">Aufgeben</button>
        <button class="btn fg-menu" type="button">Menü</button>
      </div>
    </div>`;
  host.append(root);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const promptBox = $('.fg-flag');
  const choices = $('.fg-choices');
  const form = $<HTMLFormElement>('.fg-type');
  const input = $<HTMLInputElement>('.gm-input');
  const msg = $('.gm-feedback');
  const nextBtn = $<HTMLButtonElement>('.fg-next');
  choices.hidden = o.mode !== 'choice';
  form.hidden = o.mode !== 'type';

  let right = 0;
  let done = 0;
  let streak = 0;
  let best = 0;
  let answered = true;
  let timeout = 0;
  const t0 = Date.now();
  const wrong: QuizItem[] = [];
  let cur: QuizItem | null = null;

  const clock = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('.fg-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const timer = window.setInterval(clock, 500);
  const score = () => {
    $('.fg-score').textContent = `${done} / ${total} · ${right} richtig${streak > 1 ? ` · 🔥 ${streak}` : ''}`;
  };
  const say = (text: string, kind: '' | 'ok' | 'bad' = '') => {
    msg.textContent = text;
    msg.className = `gm-feedback ${kind}`;
  };

  function next() {
    clearTimeout(timeout);
    cur = queue.shift() ?? null;
    if (!cur) return finish();
    answered = false;
    promptBox.innerHTML = cur.prompt;
    score();
    say('');
    nextBtn.hidden = true;
    if (o.mode === 'choice') {
      const others = pool.filter((f) => f !== cur && f.label !== cur!.label);
      const near = shuffle(others.filter((f) => f.group === cur!.group));
      const far = shuffle(others.filter((f) => f.group !== cur!.group));
      const picked: QuizItem[] = [];
      for (const f of [...near, ...far]) if (picked.length < 3 && !picked.some((p) => p.label === f.label)) picked.push(f);
      const opts = shuffle([cur, ...picked]);
      choices.innerHTML = opts.map((f) => `<button type="button" class="btn fg-opt" data-id="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`).join('');
    } else {
      input.value = '';
      input.disabled = false;
      input.focus();
    }
  }

  function settle(ok: boolean, picked?: string) {
    if (answered || !cur) return;
    answered = true;
    done++;
    if (ok) {
      right++;
      streak++;
      best = Math.max(best, streak);
      say(`Richtig: ${cur.label}`, 'ok');
    } else {
      streak = 0;
      wrong.push(cur);
      say(`Richtig wäre: ${cur.label}`, 'bad');
    }
    score();
    if (o.mode === 'choice') {
      choices.querySelectorAll<HTMLButtonElement>('.fg-opt').forEach((b) => {
        b.disabled = true;
        if (b.dataset.id === cur!.id) b.classList.add('right');
        else if (b.dataset.id === picked) b.classList.add('wrong');
      });
    } else input.disabled = true;
    // right answers continue by themselves, wrong ones wait so the answer can be read
    if (ok) timeout = window.setTimeout(next, 700);
    else {
      nextBtn.hidden = false;
      nextBtn.focus();
    }
  }

  choices.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.fg-opt');
    if (b && cur) settle(b.dataset.id === cur.id, b.dataset.id);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (answered) return next();
    if (!cur) return;
    const q = norm(input.value);
    if (!q) return;
    const hit = byAnswer.get(q);
    let ok = hit === cur;
    if (!ok && !hit && q.length >= 6) ok = cur.answers.some((n) => lev(q, norm(n)) <= 1);
    settle(ok);
  });
  nextBtn.addEventListener('click', next);

  // skipped questions come back at the end
  $('.fg-skip').addEventListener('click', () => {
    if (answered || !cur) return;
    queue.push(cur);
    next();
  });
  $('.fg-giveup').addEventListener('click', () => {
    if (cur && !answered) wrong.push(cur);
    wrong.push(...queue);
    queue.length = 0;
    finish(true);
  });
  $('.fg-menu').addEventListener('click', onExit);

  function finish(gaveUp = false) {
    clearTimeout(timeout);
    clearInterval(timer);
    const s = Math.round((Date.now() - t0) / 1000);
    root.innerHTML = `
      <div class="gm-result">
        <h2>${gaveUp ? 'Aufgegeben' : 'Geschafft!'}</h2>
        <div class="gm-big">${right} / ${total} <span>(${Math.round((right / total) * 100)} %)</span></div>
        <p>Zeit ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · längste Serie ${best}</p>
        ${wrong.length ? `<details open><summary>${wrong.length} nicht gewusst</summary><p class="gm-missed">${wrong.map((f) => `<span class="fg-miss">${f.thumb ?? ''}${escapeHtml(f.label)}</span>`).join(' · ')}</p></details>` : ''}
        <div class="gm-actions"><button class="btn btn-primary fg-again" type="button">Nochmal</button><button class="btn fg-menu" type="button">Menü</button></div>
      </div>`;
    root.querySelector('.fg-again')!.addEventListener('click', () => {
      destroy();
      Object.assign(handle, startNameQuiz(host, o, onExit));
    });
    root.querySelector('.fg-menu')!.addEventListener('click', onExit);
  }

  function destroy() {
    clearTimeout(timeout);
    clearInterval(timer);
    root.remove();
  }

  const handle: NameQuiz = { destroy };
  next();
  return handle;
}
