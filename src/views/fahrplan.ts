import { departures, durationTxt, nearbyStops, inTxt, legColor, planConnections, searchStops, type Departure, type Itinerary, type Stop } from '../api/connections';
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
  root.innerHTML = `<label><span>${esc(label)}</span><input type="text" autocomplete="off" spellcheck="false" placeholder="Haltestelle oder Ort" role="combobox" aria-expanded="false" aria-autocomplete="list"/></label><ul class="suggestions" role="listbox" hidden></ul>`;
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
      <div class="fp-ft">
        <div class="fp-from"></div>
        <button type="button" class="btn icon-btn fp-swap" title="Start und Ziel tauschen" aria-label="Start und Ziel tauschen"><svg viewBox="0 0 24 24"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg></button>
        <div class="fp-to"></div>
      </div>
      <div class="fp-opts">
        <select class="fp-mode" aria-label="Abfahrt oder Ankunft"><option value="dep">Abfahrt</option><option value="arr">Ankunft</option></select>
        <input type="datetime-local" class="fp-time" aria-label="Zeitpunkt"/>
        <button type="button" class="btn small fp-now">Jetzt</button>
        <select class="fp-tr" aria-label="Umstiege"><option value="">Beliebig viele Umstiege</option><option value="0">Direkt</option><option value="1">Max. 1 Umstieg</option><option value="2">Max. 2 Umstiege</option></select>
      </div>
      <button type="button" class="btn primary wide fp-go">Verbindungen suchen</button>
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
  const goBtn = q<HTMLButtonElement>('.fp-go');
  timeIn.value = localInput(Date.now());

  // ---- connection search ----
  let from: Stop | null = null;
  let to: Stop | null = null;
  // the last chosen stops stay filled in (a cleared field keeps the stored one until a new stop is picked)
  const remember = (key: 'from' | 'to', s: Stop) => store.setLastRoute({ ...store.getLastRoute(), [key]: { id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area } });
  const fromField = stopField('Von', (s) => {
    from = s;
    if (s) remember('from', s);
  });
  const toField = stopField('Nach', (s) => {
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

  const legHtml = (l: Itinerary['legs'][number]) => {
    const late = l.delayMin != null && l.delayMin > 0 ? ` <span class="fp-late">+${l.delayMin}</span>` : '';
    const name = l.mode === 'WALK' ? `Fußweg${l.walkM != null ? ` · ${l.walkM} m` : ''}` : esc(l.line || modeStyle(l.mode).label);
    return `<li class="fp-leg${l.cancelled ? ' cancelled' : ''}" style="--c:${legColor(l)}">
      <span class="fp-t">${hm(l.dep)}${late}</span>
      <span class="fp-pt"><b>${esc(l.from)}</b>${l.track ? ` <small>Gl. ${esc(l.track)}</small>` : ''}</span>
      <span class="fp-ln"><i class="fp-badge">${name}</i>${l.headsign ? ` <small>→ ${esc(l.headsign)}</small>` : ''}${l.cancelled ? ' <small class="fp-late">entfällt</small>' : ''}</span>
      <span class="fp-t">${hm(l.arr)}</span>
      <span class="fp-pt"><b>${esc(l.to)}</b></span>
    </li>`;
  };
  const itinHtml = (it: Itinerary) => {
    const trains = it.legs.filter((l) => l.mode !== 'WALK');
    const badges = trains.map((l) => `<i class="fp-badge" style="--c:${legColor(l)}">${esc(l.line || modeStyle(l.mode).label)}</i>`).join('');
    const delay = trains[0]?.delayMin;
    return `<details class="fp-itin">
      <summary>
        <span class="fp-times"><b>${hm(it.dep)}</b> → <b>${hm(it.arr)}</b>${delay && delay > 0 ? ` <span class="fp-late">+${delay}</span>` : ''}</span>
        <span class="fp-sum">${esc(durationTxt(it.arr - it.dep))} · ${it.transfers === 0 ? 'direkt' : `${it.transfers} Umstieg${it.transfers > 1 ? 'e' : ''}`}</span>
        <span class="fp-badges">${badges}</span>
      </summary>
      <ul class="fp-legs">${it.legs.map(legHtml).join('')}</ul>
    </details>`;
  };

  let searchSeq = 0;
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
      const list = await planConnections(from, to, { time: t, arriveBy: modeSel.value === 'arr', maxTransfers: trSel.value === '' ? undefined : Number(trSel.value) });
      if (my !== searchSeq) return;
      res.innerHTML = list.length
        ? `<p class="fp-day">${esc(dayTxt(list[0].dep))} · ${esc(from.name)} → ${esc(to.name)}</p>${list.map(itinHtml).join('')}`
        : '<p class="fp-hint">Keine Verbindung gefunden.</p>';
    } catch {
      if (my === searchSeq) res.innerHTML = '<p class="fp-hint">Verbindungssuche nicht erreichbar – bitte später erneut versuchen.</p>';
    } finally {
      if (my === searchSeq) goBtn.disabled = false;
    }
  }
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

  const addField = stopField('Haltestelle merken', (s) => {
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
