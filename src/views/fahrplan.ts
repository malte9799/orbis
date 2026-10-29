import { MODE_GROUPS, planConnections, type Itinerary, type PlanOptions, type PlanResult, type Stop } from '../api/connections';
import { store, routeId, type SavedStop } from '../store';
import { escapeHtml as esc, toast } from '../util';
import { syncPush } from '../api/pushnotify';
import { createSavedPanel, asSaved } from './fahrplan-saved';
import { dayTxt, hm, itinHtml, localInput, stopField } from './fahrplan-ui';

// Fahrplan – connection search (like the DB Navigator) and the "Gemerkt" tab: commuter trips,
// saved routes and saved stops with their departure boards.

export interface FahrplanView {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
}

const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>';
const ICON_SAVED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';

export function createFahrplanView(): FahrplanView {
  const el = document.createElement('main');
  el.className = 'view fahrplan-view';
  el.hidden = true;
  el.dataset.tab = 'search';
  el.innerHTML = `
    <nav class="fp-tabs" role="tablist" aria-label="Fahrplan">
      <button type="button" role="tab" class="fp-tab on" data-tab="search" aria-selected="true">${ICON_SEARCH}<span>Verbindungssuche</span></button>
      <button type="button" role="tab" class="fp-tab" data-tab="saved" aria-selected="false">${ICON_SAVED}<span>Gemerkt</span><i class="fp-count" hidden></i></button>
    </nav>
    <div class="fp-pane fp-pane-search">
    <div class="fp-side">
    <section class="fp-card fp-search" aria-label="Verbindungssuche">
      <h2>Verbindung suchen</h2>
      <button type="button" class="fp-compact" hidden aria-label="Suche ändern"><span class="fp-cs"></span><span class="fp-ce">Ändern</span></button>
      <div class="fp-form">
      <div class="fp-ft">
        <div class="fp-from"></div>
        <button type="button" class="btn icon-btn fp-swap" title="Start und Ziel tauschen" aria-label="Start und Ziel tauschen"><svg viewBox="0 0 24 24"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg></button>
        <div class="fp-to"></div>
      </div>
      <div class="fp-opts">
        <select class="fp-mode" aria-label="Abfahrt oder Ankunft"><option value="dep">Abfahrt</option><option value="arr">Ankunft</option></select>
        <input type="datetime-local" class="fp-time" aria-label="Zeitpunkt"/>
        <button type="button" class="btn small fp-now">Jetzt</button>
        <button type="button" class="btn small fp-optbtn" aria-expanded="false">Optionen</button>
        <button type="button" class="btn primary fp-go">Suchen</button>
      </div>
      <div class="fp-optpanel" hidden>
        <div class="fp-og"><span class="fp-oh">Verkehrsmittel</span><div class="fp-mchips">${MODE_GROUPS.map((g) => `<button type="button" class="fp-mchip on" data-g="${g.id}" aria-pressed="true">${g.label}</button>`).join('')}</div></div>
        <label class="fp-og"><span class="fp-oh">Umstiege</span><select class="fp-tr"><option value="">Beliebig viele</option><option value="0">Direkt</option><option value="1">Max. 1 Umstieg</option><option value="2">Max. 2 Umstiege</option></select></label>
        <label class="fp-og"><span class="fp-oh">Umstiegszeit</span><select class="fp-xt"><option value="0">Normal</option><option value="5">+5 min</option><option value="10">+10 min</option></select></label>
        <label class="fp-og"><span class="fp-oh">Fußweg zur Haltestelle</span><select class="fp-walk"><option value="">Standard</option><option value="5">bis 5 min</option><option value="10">bis 10 min</option><option value="20">bis 20 min</option></select></label>
        <label class="fp-chk"><input type="checkbox" class="fp-wc"/> Stufenfrei (Rollstuhl, Kinderwagen)</label>
        <button type="button" class="btn small fp-reset">Zurücksetzen</button>
      </div>
      </div>
    </section>
    </div>
    <section class="fp-card fp-results empty" aria-label="Verbindungen">
      <div class="fp-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l2 3M7 17l-2 3M4 11h16M8 14h.01M16 14h.01M7 3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10"/></svg><b>Wohin soll es gehen?</b><p>Start und Ziel eingeben, Zeit wählen und „Suchen“ – die Verbindungen erscheinen hier, mit Verspätungen, Gleisen und Umstiegen.</p></div>
      <div class="fp-res" aria-live="polite"></div>
    </section>
    </div>
    <div class="fp-pane fp-pane-saved"></div>`;

  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const res = q('.fp-res');
  const resSection = q('.fp-results');
  const timeIn = q<HTMLInputElement>('.fp-time');
  const modeSel = q<HTMLSelectElement>('.fp-mode');
  const trSel = q<HTMLSelectElement>('.fp-tr');
  const xtSel = q<HTMLSelectElement>('.fp-xt');
  const walkSel = q<HTMLSelectElement>('.fp-walk');
  const wcChk = q<HTMLInputElement>('.fp-wc');
  const optBtn = q<HTMLButtonElement>('.fp-optbtn');
  const optPanel = q('.fp-optpanel');
  const chipsOf = () => [...el.querySelectorAll<HTMLButtonElement>('.fp-mchip')];

  // options (persisted): modes switched off, transfers, extra transfer time, walking limit, step-free
  const optsState = () => ({
    off: chipsOf().filter((c) => !c.classList.contains('on')).map((c) => c.dataset.g!),
    tr: trSel.value,
    xt: xtSel.value,
    walk: walkSel.value,
    wc: wcChk.checked,
  });
  const activeOptions = () => {
    const o = optsState();
    return o.off.length + (o.tr !== '' ? 1 : 0) + (o.xt !== '0' ? 1 : 0) + (o.walk !== '' ? 1 : 0) + (o.wc ? 1 : 0);
  };
  const syncOptBtn = () => {
    const n = activeOptions();
    optBtn.textContent = n ? `Optionen (${n})` : 'Optionen';
    optBtn.classList.toggle('on', n > 0);
  };
  const applyOptions = (o: Partial<ReturnType<typeof optsState>>) => {
    const off = new Set(o.off ?? []);
    chipsOf().forEach((c) => {
      const on = !off.has(c.dataset.g!);
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    });
    trSel.value = o.tr ?? '';
    xtSel.value = o.xt ?? '0';
    walkSel.value = o.walk ?? '';
    wcChk.checked = !!o.wc;
    syncOptBtn();
  };
  applyOptions(store.getFpOptions() as Partial<ReturnType<typeof optsState>>);
  const optsChanged = () => {
    store.setFpOptions(optsState());
    syncOptBtn();
  };
  optBtn.addEventListener('click', () => {
    optPanel.hidden = !optPanel.hidden;
    optBtn.setAttribute('aria-expanded', String(!optPanel.hidden));
  });
  optPanel.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.fp-mchip');
    if (c) {
      // the last remaining mode stays on
      if (c.classList.contains('on') && chipsOf().filter((x) => x.classList.contains('on')).length === 1) return;
      c.classList.toggle('on');
      c.setAttribute('aria-pressed', String(c.classList.contains('on')));
      optsChanged();
    } else if ((e.target as HTMLElement).closest('.fp-reset')) {
      applyOptions({});
      optsChanged();
    }
  });
  optPanel.addEventListener('change', optsChanged);
  const goBtn = q<HTMLButtonElement>('.fp-go');
  timeIn.value = localInput(Date.now());

  // ---- connection search ----
  let from: Stop | null = null;
  let to: Stop | null = null;
  // the last chosen stops stay filled in (a cleared field keeps the stored one until a new stop is picked)
  const remember = (key: 'from' | 'to', s: Stop) => store.setLastRoute({ ...store.getLastRoute(), [key]: { id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area, src: s.src } });
  const fromField = stopField('Von: Haltestelle oder Ort', (s) => {
    from = s;
    if (s) remember('from', s);
  });
  const toField = stopField('Nach: Haltestelle oder Ort', (s) => {
    to = s;
    if (s) remember('to', s);
  });
  q('.fp-from').append(fromField.el);
  q('.fp-to').append(toField.el);
  const last = store.getLastRoute();
  if (last.from) fromField.set(last.from);
  if (last.to) toField.set(last.to);
  q('.fp-swap').addEventListener('click', () => {
    const a = from;
    const b = to;
    if (b) fromField.set(b);
    if (a) toField.set(a);
  });
  q('.fp-now').addEventListener('click', () => (timeIn.value = localInput(Date.now())));

  // all connections found so far (earlier / later pages are merged into it) and the paging cursors
  let items: Itinerary[] = [];
  let cursors: { prev?: string; next?: string } = {};
  let lastOpts: PlanOptions | null = null;
  let searchSeq = 0;
  const section = q('.fp-search');
  const compactBtn = q<HTMLButtonElement>('.fp-compact');
  /** after a search the form folds into one summary line (tap to edit) – saves room on phones */
  function setCompact(on: boolean) {
    section.classList.toggle('compact', on);
    el.classList.toggle('is-compact', on);
    compactBtn.hidden = !on;
    if (on) q('.fp-cs').textContent = `${from?.name ?? ''} → ${to?.name ?? ''} · ${modeSel.value === 'arr' ? 'an ' : ''}${hm(lastOpts?.time ?? Date.now())}`;
  }
  compactBtn.addEventListener('click', () => setCompact(false));

  const itKey = (it: Itinerary) => `${it.dep}-${it.arr}`;
  /** the commuter trip a connection stands for: its first ride at its scheduled time */
  function tripOf(it: Itinerary) {
    const rides = it.legs.filter((l) => l.mode !== 'WALK');
    if (!rides.length || !from || !to) return null;
    const first = rides[0];
    const last = rides[rides.length - 1];
    const f = asSaved(from);
    const t = asSaved(to);
    const hmTxt = hm(first.schedDep);
    return { id: `${routeId(f, t)}|${first.line}|${hmTxt}`, from: f, to: t, hm: hmTxt, arrHm: hm(last.schedArr), line: first.line, days: [1, 2, 3, 4, 5] };
  }

  function renderResults() {
    if (!items.length) {
      res.innerHTML = '<p class="fp-hint">Keine Verbindung gefunden.</p>';
      return;
    }
    let day = '';
    const rows = items
      .map((it) => {
        const d = dayTxt(it.dep);
        const head = d !== day ? `<p class="fp-day">${esc(d)}</p>` : '';
        day = d;
        const t = tripOf(it);
        return head + itinHtml(it, t ? { key: itKey(it), saved: store.hasTrip(t.id) } : undefined);
      })
      .join('');
    const routeSaved = !!from && !!to && store.isRoute(asSaved(from), asSaved(to));
    res.innerHTML = `<div class="fp-route"><span>${esc(from?.name ?? '')} → ${esc(to?.name ?? '')}</span><button type="button" class="fp-rtbtn${routeSaved ? ' on' : ''}" data-act="saveroute" aria-pressed="${routeSaved}">${ICON_SAVED}<span>${routeSaved ? 'Route gemerkt' : 'Route merken'}</span></button></div>
      ${cursors.prev ? '<button type="button" class="btn small fp-page" data-page="prev">Früher</button>' : ''}${rows}${cursors.next ? '<button type="button" class="btn small fp-page" data-page="next">Später</button>' : ''}`;
  }

  /** the filters of the options panel as API options */
  function planExtras(): Partial<PlanOptions> {
    const o = optsState();
    const off = new Set(o.off);
    return {
      modes: off.size ? MODE_GROUPS.filter((g) => !off.has(g.id)).flatMap((g) => g.modes) : undefined,
      extraTransferMin: Number(o.xt) || undefined,
      maxWalkMin: o.walk === '' ? undefined : Number(o.walk),
      wheelchair: o.wc || undefined,
    };
  }

  async function search() {
    if (!from || !to) {
      toast('Bitte Start und Ziel aus der Vorschlagsliste wählen.', 'error');
      return;
    }
    const t = timeIn.value ? new Date(timeIn.value).getTime() : Date.now();
    const my = ++searchSeq;
    goBtn.disabled = true;
    resSection.classList.remove('empty');
    res.innerHTML = '<p class="fp-hint">Suche läuft …</p>';
    try {
      lastOpts = { time: t, arriveBy: modeSel.value === 'arr', maxTransfers: trSel.value === '' ? undefined : Number(trSel.value), ...planExtras() };
      const r = await planConnections(from, to, lastOpts);
      if (my !== searchSeq) return;
      items = r.list;
      cursors = { prev: r.prev, next: r.next };
      renderResults();
      setCompact(true);
    } catch {
      if (my === searchSeq) res.innerHTML = '<p class="fp-hint">Verbindungssuche nicht erreichbar – bitte später erneut versuchen.</p>';
    } finally {
      if (my === searchSeq) goBtn.disabled = false;
    }
  }

  res.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const act = target.closest<HTMLButtonElement>('[data-act]');
    if (act?.dataset.act === 'saveroute' && from && to) {
      const now = store.toggleRoute(asSaved(from), asSaved(to));
      act.classList.toggle('on', now);
      act.setAttribute('aria-pressed', String(now));
      act.querySelector('span')!.textContent = now ? 'Route gemerkt' : 'Route merken';
      toast(now ? 'Route gemerkt' : 'Route entfernt');
      updateCount();
      return;
    }
    if (act?.dataset.act === 'savetrip') {
      const it = items.find((i) => itKey(i) === act.dataset.key);
      const t = it && tripOf(it);
      if (!t) return;
      const now = store.toggleTrip(t);
      act.classList.toggle('on', now);
      act.setAttribute('aria-pressed', String(now));
      act.querySelector('span')!.textContent = now ? 'Pendler-Verbindung gemerkt' : 'Als Pendler-Verbindung merken';
      toast(now ? `${t.line} um ${t.hm} gemerkt (Mo–Fr) – unter „Gemerkt“ anpassen` : 'Pendler-Verbindung entfernt');
      updateCount();
      return;
    }
    const btn = target.closest<HTMLButtonElement>('.fp-page');
    if (!btn || !from || !to || !lastOpts) return;
    const dir = btn.dataset.page as 'prev' | 'next';
    const cursor = cursors[dir];
    if (!cursor) return;
    const my = searchSeq;
    btn.disabled = true;
    try {
      const r: PlanResult = await planConnections(from, to, lastOpts, cursor);
      if (my !== searchSeq) return;
      const key = (i: Itinerary) => `${i.dep}-${i.arr}`;
      const seen = new Set(items.map(key));
      const fresh = r.list.filter((i) => !seen.has(key(i)));
      if (dir === 'prev') {
        items = [...fresh, ...items];
        cursors.prev = r.prev;
      } else {
        items = [...items, ...fresh];
        cursors.next = r.next;
      }
      renderResults();
    } catch {
      btn.disabled = false;
      toast('Weitere Verbindungen konnten nicht geladen werden.', 'error');
    }
  });
  goBtn.addEventListener('click', search);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).closest('.fp-search') && (e.target as HTMLElement).tagName === 'INPUT' && from && to) search();
  });

  // ---- tabs: search / saved ----
  const tabBtns = [...el.querySelectorAll<HTMLButtonElement>('.fp-tab')];
  const countEl = q('.fp-count');
  const saved = createSavedPanel({
    openRoute(f: SavedStop, t: SavedStop) {
      fromField.set(f);
      toField.set(t);
      timeIn.value = localInput(Date.now());
      modeSel.value = 'dep';
      setTab('search');
      void search();
    },
    onChange: () => updateCount(),
  });
  q('.fp-pane-saved').append(saved.el);

  function updateCount() {
    const n = saved.count();
    countEl.textContent = String(n);
    countEl.hidden = n === 0;
  }
  function setTab(tab: 'search' | 'saved') {
    el.dataset.tab = tab;
    tabBtns.forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (tab === 'saved') saved.activate();
    else saved.deactivate();
    window.scrollTo({ top: 0 });
  }
  tabBtns.forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab as 'search' | 'saved')));
  updateCount();

  return {
    el,
    activate() {
      el.hidden = false;
      updateCount();
      void syncPush().catch(() => {});
      if (el.dataset.tab === 'saved') saved.activate();
    },
    deactivate() {
      saved.deactivate();
    },
  };
}
