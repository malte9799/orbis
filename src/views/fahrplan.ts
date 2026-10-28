import { MODE_GROUPS, departures, durationTxt, nearbyStops, inTxt, legColor, planConnections, searchStops, type PlanResult, type Departure, type Itinerary, type Leg, type PlanOptions, type Stop } from '../api/connections';
import { modeStyle } from '../api/transit';
import { locate } from '../search';
import { store, type SavedStop } from '../store';
import { debounce, escapeHtml as esc, toast } from '../util';

// Fahrplan – connection search (like the DB Navigator) and departure boards of saved stops.

export interface FahrplanView {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
}

const BOARD_REFRESH_MS = 60000;
const hm = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const dayTxt = (t: number) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
/** value of an <input type="datetime-local"> for a timestamp (local time) */
const localInput = (t: number) => {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9.2C1.2 8.6 3 5 6.5 5c2 0 3.7 1.2 5.5 3.2C13.8 6.2 15.5 5 17.5 5 21 5 22.8 8.6 21.3 11.8 19 16.400 12 21 12 21z"/></svg>';

/** stop picker: text box with suggestions; `pick` is called with the chosen stop */
function stopField(label: string, onPick: (s: Stop | null) => void) {
  const root = document.createElement('div');
  root.className = 'fp-field';
  root.innerHTML = `<input type="text" autocomplete="off" spellcheck="false" placeholder="${esc(label)}" aria-label="${esc(label)}" role="combobox" aria-expanded="false" aria-autocomplete="list"/><ul class="suggestions" role="listbox" hidden></ul>`;
  const input = root.querySelector('input')!;
  const list = root.querySelector('ul')!;
  let results: Stop[] = [];
  let seq = 0;
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const choose = (s: Stop) => {
    input.value = s.name;
    close();
    onPick(s);
  };
  const run = debounce(async (q: string) => {
    const my = ++seq;
    try {
      const r = await searchStops(q);
      if (my !== seq) return;
      results = r.slice(0, 8);
      list.innerHTML = results.length
        ? results.map((s, i) => `<li role="option" data-i="${i}"><span class="s-name">${esc(s.name)}</span><span class="s-meta">${esc(s.area ?? '')}</span></li>`).join('')
        : '<li class="empty">Keine Haltestelle gefunden</li>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    } catch {
      if (my === seq) {
        list.innerHTML = '<li class="empty">Suche nicht verfügbar</li>';
        list.hidden = false;
      }
    }
  }, 250);
  input.addEventListener('input', () => {
    onPick(null);
    const q = input.value.trim();
    if (q.length < 2) {
      seq++;
      close();
    } else run(q);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !list.hidden && results[0]) {
      e.preventDefault();
      choose(results[0]);
    } else if (e.key === 'Escape') close();
  });
  list.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('li[data-i]');
    if (li) {
      e.preventDefault();
      choose(results[Number(li.dataset.i)]);
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  return {
    el: root,
    set(s: Stop) {
      input.value = s.name;
      onPick(s);
    },
  };
}

export function createFahrplanView(): FahrplanView {
  const el = document.createElement('main');
  el.className = 'view fahrplan-view';
  el.hidden = true;
  el.innerHTML = `
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
      <div class="fp-res" aria-live="polite"></div>
    </section>
    <section class="fp-card fp-stations" aria-label="Gemerkte Haltestellen">
      <h2>Gemerkte Haltestellen</h2>
      <p class="fp-hint">Haltestelle suchen und mit dem Herz merken – hier siehst du dann, was als Nächstes abfährt.</p>
      <div class="fp-add"></div>
      <div class="fp-chips" role="tablist"></div>
      <div class="fp-board" aria-live="polite"></div>
    </section>`;

  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const res = q('.fp-res');
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
  const remember = (key: 'from' | 'to', s: Stop) => store.setLastRoute({ ...store.getLastRoute(), [key]: { id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area } });
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

  /** time cell: scheduled time, and the real-time one below it when it differs (green ≤ 5 min late, red beyond) */
  const timeCell = (actual: number, sched: number, delay: number | null) => {
    if (delay == null) return `<span class="fp-tm"><b>${hm(actual)}</b></span>`;
    const cls = delay <= 5 ? 'ok' : 'late';
    return delay === 0 ? `<span class="fp-tm"><b class="${cls}">${hm(actual)}</b></span>` : `<span class="fp-tm"><b>${hm(sched)}</b><b class="${cls}">${hm(actual)}</b></span>`;
  };
  const stationRow = (name: string, track: string | undefined, actual: number, sched: number, delay: number | null, color: string) =>
    `<div class="fp-row" style="--c:${color}">${timeCell(actual, sched, delay)}<span class="fp-dot"></span><div class="fp-st"><b>${esc(name)}</b>${track ? `<small>Gleis ${esc(track)}</small>` : ''}</div></div>`;
  const walkTxt = (legs: Leg[]) => {
    const w = legs.reduce((n, l) => n + (l.walkM ?? 0), 0);
    return `Fußweg${w ? ` · ${w} m` : ''} · ${durationTxt(legs.reduce((n, l) => n + (l.arr - l.dep), 0))}`;
  };
  const gap = (cls: string, color: string, label: string, mins: string, icon: string) =>
    `<div class="fp-gap ${cls}" style="--c:${color}"><span class="fp-gm">${esc(mins)}</span><span class="fp-gl"></span><div class="fp-gb"><span class="fp-gi">${icon}</span>${esc(label)}</div></div>`;
  const ICON_WALK = '<svg viewBox="0 0 24 24"><circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2-6 3 2v4M11 15l1-5-3 1-1 3M12 10l2 2h3"/></svg>';
  const ICON_SWAP = '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>';

  const legBody = (l: Leg) => {
    const stops = l.via.length
      ? `<details class="fp-stops"><summary>${l.via.length} Haltestelle${l.via.length > 1 ? 'n' : ''}</summary><ul>${l.via
          .map((v) => `<li><span class="fp-tm"><b${v.delayMin != null ? ` class="${v.delayMin <= 5 ? 'ok' : 'late'}"` : ''}>${Number.isFinite(v.time) ? hm(v.time) : ''}</b></span><span>${esc(v.name)}</span></li>`)
          .join('')}</ul></details>`
      : '';
    return `<div class="fp-body${l.cancelled ? ' cancelled' : ''}"><span class="fp-badge">${esc(l.line || modeStyle(l.mode).label)}</span>${l.cancelled ? ' <small class="fp-late">entfällt</small>' : ''}${l.headsign ? `<p class="fp-nach">nach ${esc(l.headsign)}</p>` : ''}${stops}</div>`;
  };

  /** the connection as a timeline: station rows, the ride between them and the transfers */
  const timeline = (it: Itinerary) => {
    const out: string[] = [];
    const rides = it.legs.filter((l) => l.mode !== 'WALK');
    let walks: Leg[] = [];
    let prev: Leg | null = null;
    if (!rides.length) {
      const l = it.legs[0];
      if (l) out.push(stationRow(l.from, undefined, l.dep, l.schedDep, null, '#8a93a8'), gap('walk', '#8a93a8', walkTxt(it.legs), '', ICON_WALK), stationRow(it.legs[it.legs.length - 1].to, undefined, it.arr, it.arr, null, '#8a93a8'));
      return out.join('');
    }
    for (const l of it.legs) {
      if (l.mode === 'WALK') {
        walks.push(l);
        continue;
      }
      const c = legColor(l);
      if (prev) {
        const wait = Math.max(0, l.dep - prev.arr);
        out.push(gap('swap', '#8a93a8', walks.length ? walkTxt(walks) : 'Umstieg', durationTxt(wait), walks.length ? ICON_WALK : ICON_SWAP));
      } else if (walks.length) {
        out.push(stationRow(walks[0].from, undefined, walks[0].dep, walks[0].schedDep, null, '#8a93a8'), gap('walk', '#8a93a8', walkTxt(walks), '', ICON_WALK));
      }
      walks = [];
      out.push(stationRow(l.from, l.track, l.dep, l.schedDep, l.delayMin, c));
      out.push(`<div class="fp-ride" style="--c:${c}"><span class="fp-gm">${esc(durationTxt(l.arr - l.dep))}</span><span class="fp-gl"></span>${legBody(l)}</div>`);
      out.push(stationRow(l.to, l.toTrack, l.arr, l.schedArr, l.arrDelayMin, c));
      prev = l;
    }
    if (walks.length) out.push(gap('walk', '#8a93a8', walkTxt(walks), '', ICON_WALK), stationRow(walks[walks.length - 1].to, undefined, it.arr, it.arr, null, '#8a93a8'));
    return out.join('');
  };

  const itinHtml = (it: Itinerary) => {
    const rides = it.legs.filter((l) => l.mode !== 'WALK');
    const first = rides[0] ?? it.legs[0];
    const last = rides[rides.length - 1] ?? it.legs[it.legs.length - 1];
    const live = first?.delayMin != null || last?.arrDelayMin != null;
    const cls = (d: number | null | undefined) => (d == null || d <= 5 ? 'ok' : 'late');
    const total = Math.max(1, it.arr - it.dep);
    const bar = it.legs
      .map((l) => {
        const w = Math.max(6, ((l.arr - l.dep) / total) * 100);
        return l.mode === 'WALK'
          ? `<span class="fp-seg walk" style="flex:${w}" title="Fußweg"></span>`
          : `<span class="fp-seg" style="flex:${w};--c:${legColor(l)}">${esc(l.line || modeStyle(l.mode).label)}</span>`;
      })
      .join('');
    return `<details class="fp-itin">
      <summary>
        <span class="fp-l1"><b>${hm(it.dep)} – ${hm(it.arr)}</b><span>| ${esc(durationTxt(it.arr - it.dep))}${it.transfers ? ` | ${it.transfers} Umst.` : ''}</span></span>
        ${live ? `<span class="fp-l2"><b class="${cls(first?.delayMin)}">${hm(first?.dep ?? it.dep)}</b><b class="${cls(last?.arrDelayMin)}">${hm(last?.arr ?? it.arr)}</b></span>` : ''}
        <span class="fp-bar">${bar}</span>
        <span class="fp-von">von ${esc(first?.from ?? '')}${first?.track ? ` · Gleis ${esc(first.track)}` : ''}</span>
      </summary>
      <div class="fp-detail"><div class="fp-dh"><span>${esc(dayTxt(it.dep))}</span><span>Dauer: ${esc(durationTxt(it.arr - it.dep))}</span></div>${timeline(it)}</div>
    </details>`;
  };

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
    compactBtn.hidden = !on;
    if (on) q('.fp-cs').textContent = `${from?.name ?? ''} → ${to?.name ?? ''} · ${modeSel.value === 'arr' ? 'an ' : ''}${hm(lastOpts?.time ?? Date.now())}`;
  }
  compactBtn.addEventListener('click', () => setCompact(false));

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
        return head + itinHtml(it);
      })
      .join('');
    res.innerHTML = `<div class="fp-route">${esc(from?.name ?? '')} → ${esc(to?.name ?? '')}</div>
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
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.fp-page');
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

  // ---- saved stops + departure board ----
  const chips = q('.fp-chips');
  const board = q('.fp-board');
  let current: SavedStop | null = null;
  let boardSeq = 0;
  let timer: number | undefined;

  const addField = stopField('Haltestelle suchen und merken', (s) => {
    if (s) showStop(s);
  });
  q('.fp-add').append(addField.el);

  function renderChips() {
    const all = store.getStations();
    chips.innerHTML = all.length
      ? all.map((s) => `<button type="button" role="tab" class="fp-chip${current?.id === s.id ? ' on' : ''}" data-id="${esc(s.id)}" aria-selected="${current?.id === s.id}">${esc(s.name)}</button>`).join('')
      : '';
  }

  const depRow = (d: Departure) => {
    const late = d.delayMin != null && d.delayMin > 0 ? `<span class="fp-late">+${d.delayMin}</span>` : d.delayMin === 0 ? '<span class="fp-ok">pünktlich</span>' : '';
    return `<li class="fp-dep${d.cancelled ? ' cancelled' : ''}" style="--c:${modeStyle(d.mode).color}">
      <span class="fp-in">${d.cancelled ? '–' : esc(inTxt(d.time))}</span>
      <span class="fp-badge">${esc(d.line || modeStyle(d.mode).label)}</span>
      <span class="fp-to-txt">${esc(d.headsign)}${d.cancelled ? ' <small class="fp-late">entfällt</small>' : ''}</span>
      <span class="fp-at">${hm(d.time)} ${late}${d.track ? `<small>Gl. ${esc(d.track)}</small>` : ''}</span>
    </li>`;
  };

  async function loadBoard(initial: boolean) {
    const s = current;
    if (!s) return;
    const my = ++boardSeq;
    if (initial) board.innerHTML = '<p class="fp-hint">Lade Abfahrten …</p>';
    try {
      const list = await departures(s.id, 25);
      if (my !== boardSeq || current?.id !== s.id) return;
      board.innerHTML = headHtml(s) + (list.length ? `<ul class="fp-deps">${list.map(depRow).join('')}</ul><p class="fp-hint">Stand ${hm(Date.now())} · aktualisiert sich jede Minute</p>` : '<p class="fp-hint">Keine Abfahrten in nächster Zeit.</p>');
    } catch {
      if (my === boardSeq && initial) board.innerHTML = headHtml(s) + '<p class="fp-hint">Abfahrten nicht erreichbar – bitte später erneut versuchen.</p>';
    }
  }

  function headHtml(s: SavedStop) {
    const saved = store.isStation(s.id);
    return `<div class="fp-bh"><div><b>${esc(s.name)}</b>${s.area ? `<small>${esc(s.area)}</small>` : ''}</div>
      <button type="button" class="btn icon-btn fp-save${saved ? ' on' : ''}" data-act="save" title="${saved ? 'Nicht mehr merken' : 'Haltestelle merken'}" aria-pressed="${saved}" aria-label="${saved ? 'Nicht mehr merken' : 'Haltestelle merken'}">${HEART}</button></div>`;
  }

  function showStop(s: SavedStop) {
    current = s;
    renderChips();
    loadBoard(true);
  }

  chips.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.fp-chip');
    const s = b && store.getStations().find((x) => x.id === b.dataset.id);
    if (s) showStop(s);
  });
  board.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-act="save"]') || !current) return;
    const s = current;
    const now = store.toggleStation({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area });
    toast(now ? `„${s.name}“ gemerkt` : `„${s.name}“ entfernt`);
    renderChips();
    const head = board.querySelector('.fp-bh');
    if (head) head.outerHTML = headHtml(s);
  });

  // nearest stop to the user as a shortcut
  const nearBtn = document.createElement('button');
  nearBtn.type = 'button';
  nearBtn.className = 'btn small fp-near';
  nearBtn.textContent = 'Haltestellen in meiner Nähe';
  q('.fp-add').append(nearBtn);
  nearBtn.addEventListener('click', async () => {
    try {
      const p = await locate();
      const r = await nearbyStops(p.lat, p.lon);
      if (r[0]) {
        addField.set(r[0]);
        showStop(r[0]);
      } else toast('Keine Haltestelle in der Nähe gefunden.', 'error');
    } catch {
      toast('Standort nicht verfügbar.', 'error');
    }
  });

  function startTimer() {
    stopTimer();
    timer = window.setInterval(() => {
      if (!document.hidden && current) loadBoard(false);
    }, BOARD_REFRESH_MS);
  }
  function stopTimer() {
    if (timer != null) clearInterval(timer);
    timer = undefined;
  }

  return {
    el,
    activate() {
      el.hidden = false;
      const saved = store.getStations();
      if (!current && saved.length) current = saved[0];
      renderChips();
      if (current) loadBoard(true);
      else board.innerHTML = '';
      startTimer();
    },
    deactivate() {
      stopTimer();
    },
  };
}
