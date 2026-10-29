import { departures, nearbyStops, planConnections, sourceTxt, type Departure, type Itinerary, type Stop } from '../api/connections';
import { delaysConfigured, departuresWithDelays, plannedDeps, withDelays } from '../api/dbdelays';
import { modeStyle } from '../api/transit';
import { LEADS, enablePush, pushState, syncPush, testPush } from '../api/pushnotify';
import { locate } from '../search';
import { store, type SavedRoute, type SavedStop, type SavedTrip } from '../store';
import { escapeHtml as esc, toast } from '../util';
import { HEART, dayTxt, delayTxt, depRow, hm, stopField, timeline } from './fahrplan-ui';

// The "Gemerkt" tab of the Fahrplan: commuter trips (the same ride on chosen weekdays), saved
// routes (start → destination, any time) and saved stops with their departure board.

type Sub = 'trips' | 'routes' | 'stops';

export interface SavedPanel {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
  /** number of saved things (badge of the tab) */
  count(): number;
}

export interface SavedDeps {
  /** open a route in the search tab and search for connections now */
  openRoute(from: SavedStop, to: SavedStop): void;
  /** saved things were added or removed */
  onChange(): void;
}

const REFRESH_MS = 60000;
/** Mon … Sun, with the Date.getDay() number */
const WEEK: [number, string][] = [[1, 'Mo'], [2, 'Di'], [3, 'Mi'], [4, 'Do'], [5, 'Fr'], [6, 'Sa'], [0, 'So']];

export function daysTxt(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'täglich';
  if (!set.size) return 'nie';
  const wk = [1, 2, 3, 4, 5].every((d) => set.has(d));
  if (wk && set.size === 5) return 'Mo–Fr';
  if (wk && set.size === 7 - 1 && set.has(6)) return 'Mo–Sa';
  if (set.size === 2 && set.has(6) && set.has(0)) return 'Sa, So';
  return WEEK.filter(([d]) => set.has(d)).map(([, n]) => n).join(', ');
}

/** The next time the trip runs: today while it is still relevant (a delayed train counts), else the next chosen weekday. */
export function nextRun(t: Pick<SavedTrip, 'hm' | 'days'>, now = new Date()): { dep: number; today: boolean } | null {
  if (!t.days.length) return null;
  const [h, m] = t.hm.split(':').map(Number);
  for (let d = 0; d < 8; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m, 0, 0);
    if (!t.days.includes(day.getDay())) continue;
    if (d === 0 && day.getTime() + 90 * 60000 < now.getTime()) continue;
    return { dep: day.getTime(), today: d === 0 };
  }
  return null;
}

/** The itinerary of a trip around `dep`: same first ride (line) at the same scheduled time. */
export function findTrip(list: Itinerary[], t: Pick<SavedTrip, 'line'>, dep: number): Itinerary | null {
  return (
    list.find((it) => {
      const ride = it.legs.find((l) => l.mode !== 'WALK');
      return !!ride && ride.line === t.line && Math.abs(ride.schedDep - dep) <= 90000;
    }) ?? null
  );
}

interface Resolved {
  run: { dep: number; today: boolean } | null;
  it: Itinerary | null;
  failed?: boolean;
}

export function createSavedPanel(deps: SavedDeps): SavedPanel {
  const el = document.createElement('div');
  el.className = 'fp-saved';
  el.innerHTML = `
    <section class="fp-card fp-sl">
      <div class="fp-subs" role="tablist" aria-label="Gemerkt"></div>
      <div class="fp-sadd"></div>
      <div class="fp-slist"></div>
    </section>
    <section class="fp-card fp-sd">
      <button type="button" class="fp-back">‹ Zurück</button>
      <div class="fp-sdbody"></div>
    </section>`;
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const subsEl = q('.fp-subs');
  const addEl = q('.fp-sadd');
  const listEl = q('.fp-slist');
  const bodyEl = q('.fp-sdbody');

  let sub: Sub = 'trips';
  let selected: string | null = null;
  let timer: number | undefined;
  let active = false;
  const cache = new Map<string, { at: number; r: Resolved }>();

  const total = () => store.getTrips().length + store.getRoutes().length + store.getStations().length;
  const wide = () => window.matchMedia('(min-width: 900px)').matches;

  // ---- trips: resolve against the live timetable ----
  async function resolve(t: SavedTrip, force = false): Promise<Resolved> {
    const hit = cache.get(t.id);
    if (!force && hit && Date.now() - hit.at < REFRESH_MS) return hit.r;
    const run = nextRun(t);
    let r: Resolved = { run, it: null };
    if (run) {
      try {
        let cursor: string | undefined;
        for (let page = 0; page < 2 && !r.it; page++) {
          const res = await planConnections(t.from, t.to, { time: run.dep - 15 * 60000, arriveBy: false }, cursor);
          r = { run, it: findTrip(res.list, t, run.dep) };
          cursor = res.next;
          if (!cursor) break;
        }
        // the exact delay comes from the DB timetable data (when our worker is set up)
        if (r.it) r = { run, it: (await withDelays([r.it]))[0] };
      } catch {
        r = { run, it: null, failed: true };
      }
    }
    cache.set(t.id, { at: Date.now(), r });
    return r;
  }

  const tripStatus = (res: Resolved | undefined): string => {
    if (!res) return '<span class="fp-hint">…</span>';
    if (!res.run) return '<span class="fp-hint">kein Tag gewählt</span>';
    const when = res.run.today ? '' : `<small>${esc(dayTxt(res.run.dep))}</small> `;
    if (res.failed) return `${when}<span class="fp-hint">nicht erreichbar</span>`;
    if (!res.it) return `${when}<span class="fp-hint">nicht gefunden</span>`;
    const ride = res.it.legs.find((l) => l.mode !== 'WALK');
    if (ride?.cancelled) return `${when}<span class="fp-late">entfällt</span>`;
    return `${when}${delayTxt(ride?.arrDelayMin ?? ride?.delayMin) || '<span class="fp-hint">planmäßig</span>'}`;
  };

  // ---- rendering ----
  function renderSubs() {
    const items: [Sub, string, number][] = [['trips', 'Verbindungen', store.getTrips().length], ['routes', 'Routen', store.getRoutes().length], ['stops', 'Haltestellen', store.getStations().length]];
    subsEl.innerHTML = items.map(([id, label, n]) => `<button type="button" role="tab" class="fp-gsub${sub === id ? ' on' : ''}" data-sub="${id}" aria-selected="${sub === id}">${label}${n ? `<i>${n}</i>` : ''}</button>`).join('');
  }

  const tripItem = (t: SavedTrip) => `<li><button type="button" class="fp-si${selected === t.id ? ' on' : ''}" data-id="${esc(t.id)}">
      <span class="fp-sit"><b>${esc(t.hm)}</b><small>${esc(t.arrHm)}</small></span>
      <span class="fp-sim"><span class="fp-badge" style="--c:${modeStyle('RAIL').color}">${esc(t.line || 'Fahrt')}</span><b>${esc(t.from.name)} → ${esc(t.to.name)}</b><small>${esc(daysTxt(t.days))}${t.notify ? ` · Nachricht ${esc(t.notify.leads.join('/'))} min vorher` : ''}</small></span>
      <span class="fp-sis" data-status="${esc(t.id)}">${tripStatus(cache.get(t.id)?.r)}</span></button></li>`;

  const routeItem = (r: SavedRoute) => `<li class="fp-sr"><button type="button" class="fp-si" data-id="${esc(r.id)}"><span class="fp-sim"><b>${esc(r.from.name)} → ${esc(r.to.name)}</b><small>Jetzt suchen</small></span></button>
      <button type="button" class="btn icon-btn fp-del" data-del="${esc(r.id)}" aria-label="Route entfernen" title="Route entfernen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`;

  const stopItem = (s: SavedStop) => `<li class="fp-sr"><button type="button" class="fp-si${selected === s.id ? ' on' : ''}" data-id="${esc(s.id)}"><span class="fp-sim"><b>${esc(s.name)}</b>${s.area ? `<small>${esc(s.area)}</small>` : ''}</span></button>
      <button type="button" class="btn icon-btn fp-del" data-del="${esc(s.id)}" aria-label="Haltestelle entfernen" title="Haltestelle entfernen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`;

  const EMPTY: Record<Sub, string> = {
    trips: 'Noch keine Pendler-Verbindung. Suche eine Verbindung, öffne sie und tippe auf „Merken“ – hier siehst du dann täglich auf einen Blick, ob dein Zug pünktlich ist.',
    routes: 'Noch keine Route. Nach einer Suche kannst du Start und Ziel mit „Route merken“ speichern – die Uhrzeit wählst du jedes Mal neu.',
    stops: 'Noch keine Haltestelle. Such oben eine Haltestelle und tippe auf das Herz.',
  };

  function renderList() {
    renderSubs();
    const items = sub === 'trips' ? store.getTrips().map(tripItem) : sub === 'routes' ? store.getRoutes().map(routeItem) : store.getStations().map(stopItem);
    listEl.innerHTML = items.length ? `<ul class="fp-sitems">${items.join('')}</ul>` : `<p class="fp-hint fp-sempty">${EMPTY[sub]}</p>`;
    if (sub === 'trips') void fillStatus();
  }

  /** statuses of all trips, one after the other (the service is rate limited) */
  async function fillStatus() {
    for (const t of store.getTrips()) {
      if (!active || sub !== 'trips') return;
      const r = await resolve(t);
      listEl.querySelector(`[data-status="${CSS.escape(t.id)}"]`)?.replaceChildren(...htmlNodes(tripStatus(r)));
    }
  }
  const htmlNodes = (h: string) => {
    const t = document.createElement('template');
    t.innerHTML = h;
    return [...t.content.childNodes];
  };

  // ---- push notifications of a trip ----
  const NOTIFY_MSG: Record<string, string> = {
    unsupported: 'Dieser Browser kann keine Push-Nachrichten. Auf dem iPhone muss Orbis erst zum Home-Bildschirm hinzugefügt werden.',
    unconfigured: 'Der Push-Dienst ist noch nicht eingerichtet (README „Fahrplan: Bahn-Verspätungen & Benachrichtigungen“).',
    denied: 'Benachrichtigungen sind im Browser blockiert – in den Seiteneinstellungen erlauben.',
  };

  const notifyHtml = (t: SavedTrip) => {
    const st = pushState();
    const n = t.notify;
    return `<div class="fp-notify"><label class="fp-chk"><input type="checkbox" data-act="notify"${n ? ' checked' : ''}${st === 'ready' || n ? '' : ' disabled'}/> Vor der Abfahrt benachrichtigen</label>
      ${st !== 'ready' ? `<p class="fp-hint">${NOTIFY_MSG[st]}</p>` : ''}
      ${
        n
          ? `<div class="fp-leads" role="group" aria-label="Minuten vor Abfahrt">${LEADS.map((m) => `<button type="button" class="fp-lead${n.leads.includes(m) ? ' on' : ''}" data-lead="${m}" aria-pressed="${n.leads.includes(m)}">${m} min</button>`).join('')}</div>
        <label class="fp-chk"><input type="checkbox" data-act="onlydelay"${n.onlyDelay ? ' checked' : ''}/> Nur bei Verspätung oder Ausfall</label>
        <div class="fp-nrow"><button type="button" class="btn small" data-act="testpush">Test-Nachricht senden</button></div>
        <p class="fp-hint">Die Nachrichten kommen auch, wenn die App geschlossen ist.</p>`
          : ''
      }</div>`;
  };

  /** tells the push worker what to watch; errors only matter when the user is looking */
  const pushSync = (loud = false) =>
    syncPush().catch(() => {
      if (loud) toast('Der Push-Dienst ist gerade nicht erreichbar.', 'error');
    });

  // ---- detail: trip ----
  async function showTrip(id: string, force = false) {
    const t = store.getTrips().find((x) => x.id === id);
    if (!t) return;
    selected = id;
    el.classList.add('has-detail');
    const days = `<div class="fp-days" role="group" aria-label="Wochentage">${WEEK.map(([d, n]) => `<button type="button" class="fp-day-btn${t.days.includes(d) ? ' on' : ''}" data-d="${d}" aria-pressed="${t.days.includes(d)}">${n}</button>`).join('')}</div>`;
    const head = `<div class="fp-th"><div><b>${esc(t.from.name)} → ${esc(t.to.name)}</b><small>${esc(t.line)} · ${esc(t.hm)} → ${esc(t.arrHm)}</small></div>
      <button type="button" class="btn small" data-act="openroute">In Suche öffnen</button></div>${days}${notifyHtml(t)}`;
    const foot = '<button type="button" class="btn small fp-rm" data-act="rmtrip">Pendler-Verbindung entfernen</button>';
    const cached = cache.get(id)?.r;
    bodyEl.innerHTML = head + (cached ? tripBody(cached) : '<p class="fp-hint">Lade Verbindung …</p>') + foot;
    const r = await resolve(t, force);
    if (selected !== id) return;
    bodyEl.innerHTML = head + tripBody(r) + foot;
    listEl.querySelector(`[data-status="${CSS.escape(id)}"]`)?.replaceChildren(...htmlNodes(tripStatus(r)));
  }

  function tripBody(r: Resolved): string {
    if (!r.run) return '<p class="fp-hint">Wähle mindestens einen Wochentag.</p>';
    const day = `<p class="fp-day">${r.run.today ? 'Heute' : 'Nächste Fahrt'}, ${esc(dayTxt(r.run.dep))}</p>`;
    if (r.failed) return `${day}<p class="fp-hint">Fahrplan gerade nicht erreichbar.</p>`;
    if (!r.it) return `${day}<p class="fp-hint">Die Fahrt wurde im Fahrplan nicht gefunden (kein Verkehr an dem Tag oder die Linie hat sich geändert).</p>`;
    return `${day}<div class="fp-detail fp-open">${timeline(r.it)}</div><p class="fp-hint">Stand ${hm(Date.now())} · aktualisiert sich jede Minute · ${esc(sourceTxt(r.it.delaySrc))}</p>`;
  }

  // ---- detail: stop board ----
  let boardSeq = 0;
  let current: SavedStop | null = null;

  const headHtml = (s: SavedStop) => {
    const saved = store.isStation(s.id);
    return `<div class="fp-bh"><div><b>${esc(s.name)}</b>${s.area ? `<small>${esc(s.area)}</small>` : ''}</div>
      <button type="button" class="btn icon-btn fp-save${saved ? ' on' : ''}" data-act="save" title="${saved ? 'Nicht mehr merken' : 'Haltestelle merken'}" aria-pressed="${saved}" aria-label="${saved ? 'Nicht mehr merken' : 'Haltestelle merken'}">${HEART}</button></div>`;
  };

  async function showStop(s: SavedStop, initial = true) {
    current = s;
    selected = s.id;
    el.classList.add('has-detail');
    const my = ++boardSeq;
    if (initial) bodyEl.innerHTML = headHtml(s) + '<p class="fp-hint">Lade Abfahrten …</p>';
    try {
      const list = await departures(s, 25);
      if (my !== boardSeq || current?.id !== s.id) return;
      const render = (l: Departure[], loading: boolean) => {
        bodyEl.innerHTML =
          headHtml(s) +
          (l.length
            ? `${loading ? '<p class="fp-hint fp-live" role="status"><i class="fp-spin"></i>Verspätungen der Bahn werden geladen …</p>' : ''}<ul class="fp-deps">${l.map(depRow).join('')}</ul><p class="fp-hint">Stand ${hm(Date.now())} · aktualisiert sich jede Minute · ${esc(sourceTxt(l.some((d) => d.delaySrc) ? 'db' : undefined))}</p>`
            : '<p class="fp-hint">Keine Abfahrten in nächster Zeit.</p>');
      };
      // Transitous first, the exact rail delays follow (a refresh renders once, with them)
      const wait = delaysConfigured();
      if (initial && wait) render(plannedDeps(list), true);
      const merged = wait ? await departuresWithDelays(s.name, list) : list;
      if (my !== boardSeq || current?.id !== s.id) return;
      render(merged, false);
    } catch {
      if (my === boardSeq && initial) bodyEl.innerHTML = headHtml(s) + '<p class="fp-hint">Abfahrten nicht erreichbar – bitte später erneut versuchen.</p>';
    }
  }

  const hint = (h: string) => {
    selected = null;
    current = null;
    el.classList.remove('has-detail');
    bodyEl.innerHTML = `<div class="fp-sdhint">${h}</div>`;
  };

  function renderAdd() {
    addEl.innerHTML = '';
    if (sub !== 'stops') return;
    const f = stopField('Haltestelle suchen und merken', (s) => {
      if (s) {
        renderList();
        void showStop(s);
      }
    });
    const near = document.createElement('button');
    near.type = 'button';
    near.className = 'btn small fp-near';
    near.textContent = 'Haltestellen in meiner Nähe';
    near.addEventListener('click', async () => {
      try {
        const p = await locate();
        const r = await nearbyStops(p.lat, p.lon);
        if (r[0]) {
          f.set(r[0]);
          void showStop(r[0]);
        } else toast('Keine Haltestelle in der Nähe gefunden.', 'error');
      } catch {
        toast('Standort nicht verfügbar.', 'error');
      }
    });
    addEl.append(f.el, near);
  }

  function selectFirst() {
    if (!wide()) return;
    if (sub === 'trips') {
      const t = store.getTrips()[0];
      if (t) void showTrip(t.id);
    } else if (sub === 'stops') {
      const s = store.getStations()[0];
      if (s) void showStop(s);
    }
  }

  function setSub(next: Sub) {
    sub = next;
    selected = null;
    current = null;
    ++boardSeq;
    el.classList.remove('has-detail');
    renderAdd();
    renderList();
    hint(
      sub === 'trips'
        ? '<b>Pendler-Verbindungen</b><p>Wähle links eine Verbindung – hier siehst du den aktuellen Stand deines Zuges.</p>'
        : sub === 'routes'
          ? '<b>Routen</b><p>Tippe auf eine Route, um sie mit der aktuellen Uhrzeit zu suchen.</p>'
          : '<b>Haltestellen</b><p>Wähle eine Haltestelle – hier siehst du, was als Nächstes abfährt.</p>',
    );
    selectFirst();
    renderList();
  }

  // ---- events ----
  subsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.fp-gsub');
    if (b) setSub(b.dataset.sub as Sub);
  });

  listEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const del = t.closest<HTMLElement>('[data-del]');
    if (del) {
      const id = del.dataset.del!;
      if (sub === 'routes') {
        const r = store.getRoutes().find((x) => x.id === id);
        if (r) store.toggleRoute(r.from, r.to);
      } else {
        const s = store.getStations().find((x) => x.id === id);
        if (s) store.toggleStation(s);
        if (current?.id === id) hint('<b>Haltestellen</b><p>Wähle eine Haltestelle – hier siehst du, was als Nächstes abfährt.</p>');
      }
      renderList();
      deps.onChange();
      return;
    }
    const item = t.closest<HTMLElement>('.fp-si');
    if (!item) return;
    const id = item.dataset.id!;
    if (sub === 'trips') void showTrip(id).then(renderList);
    else if (sub === 'routes') {
      const r = store.getRoutes().find((x) => x.id === id);
      if (r) deps.openRoute(r.from, r.to);
    } else {
      const s = store.getStations().find((x) => x.id === id);
      if (s) {
        void showStop(s);
        renderList();
      }
    }
  });

  bodyEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const day = t.closest<HTMLElement>('.fp-day-btn');
    const trip = sub === 'trips' ? store.getTrips().find((x) => x.id === selected) : undefined;
    const lead = t.closest<HTMLElement>('.fp-lead');
    if (lead && trip?.notify) {
      const m = Number(lead.dataset.lead);
      const has = trip.notify.leads.includes(m);
      if (has && trip.notify.leads.length === 1) return; // at least one time stays
      const leads = (has ? trip.notify.leads.filter((x) => x !== m) : [...trip.notify.leads, m]).sort((a, b) => b - a);
      store.updateTrip(trip.id, { notify: { ...trip.notify, leads } });
      void pushSync(true);
      void showTrip(trip.id).then(renderList);
    } else if (t.closest('[data-act="testpush"]') && trip?.notify) {
      void (async () => {
        try {
          await syncPush();
          await testPush();
          toast('Test-Nachricht ist unterwegs.');
        } catch {
          toast('Test fehlgeschlagen – ist der Push-Dienst erreichbar?', 'error');
        }
      })();
    } else if (day && trip) {
      const d = Number(day.dataset.d);
      const days = trip.days.includes(d) ? trip.days.filter((x) => x !== d) : [...trip.days, d];
      store.updateTrip(trip.id, { days });
      cache.delete(trip.id);
      void pushSync();
      void showTrip(trip.id, true).then(renderList);
      renderList();
    } else if (t.closest('[data-act="rmtrip"]') && trip) {
      store.toggleTrip(trip);
      cache.delete(trip.id);
      void pushSync();
      hint('<b>Pendler-Verbindungen</b><p>Wähle links eine Verbindung – hier siehst du den aktuellen Stand deines Zuges.</p>');
      renderList();
      deps.onChange();
      toast('Pendler-Verbindung entfernt');
    } else if (t.closest('[data-act="openroute"]') && trip) {
      deps.openRoute(trip.from, trip.to);
    } else if (t.closest('[data-act="save"]') && current) {
      const s = current;
      const now = store.toggleStation({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area, src: s.src });
      toast(now ? `„${s.name}“ gemerkt` : `„${s.name}“ entfernt`);
      const head = bodyEl.querySelector('.fp-bh');
      if (head) head.outerHTML = headHtml(s);
      renderList();
      deps.onChange();
    }
  });

  bodyEl.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    const trip = sub === 'trips' ? store.getTrips().find((x) => x.id === selected) : undefined;
    if (!trip || !box.dataset.act) return;
    if (box.dataset.act === 'notify') {
      void (async () => {
        if (box.checked) {
          try {
            await enablePush();
            store.updateTrip(trip.id, { notify: { leads: [30, 10], onlyDelay: false } });
            await syncPush();
            toast('Benachrichtigung ist an – du bekommst eine Nachricht 30 und 10 min vor Abfahrt.');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Benachrichtigung konnte nicht eingerichtet werden.', 'error');
          }
        } else {
          store.updateTrip(trip.id, { notify: undefined });
          void pushSync();
        }
        void showTrip(trip.id).then(renderList);
      })();
    } else if (box.dataset.act === 'onlydelay' && trip.notify) {
      store.updateTrip(trip.id, { notify: { ...trip.notify, onlyDelay: box.checked } });
      void pushSync(true);
    }
  });

  q('.fp-back').addEventListener('click', () => {
    selected = null;
    current = null;
    ++boardSeq;
    el.classList.remove('has-detail');
    renderList();
  });

  function refresh() {
    if (document.hidden || !active) return;
    if (sub === 'trips') {
      for (const t of store.getTrips()) cache.delete(t.id);
      if (selected) void showTrip(selected, true);
      void fillStatus();
    } else if (sub === 'stops' && current) void showStop(current, false);
  }

  return {
    el,
    count: total,
    activate() {
      active = true;
      void pushSync();
      // start on the part that has something in it
      if (!store.getTrips().length) sub = store.getStations().length ? 'stops' : store.getRoutes().length ? 'routes' : 'trips';
      setSub(sub);
      window.clearInterval(timer);
      timer = window.setInterval(refresh, REFRESH_MS);
    },
    deactivate() {
      active = false;
      window.clearInterval(timer);
      timer = undefined;
    },
  };
}

/** a stop the picker found as a plain saved stop */
export const asSaved = (s: Stop): SavedStop => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area, src: s.src });
