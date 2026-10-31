import { durationTxt, inTxt, legColor, searchStops, stableKey, type DelaySource, type Departure, type Itinerary, type Leg, type Stop } from '../api/connections';
import { rufbusInfo, telHref } from '../api/rufbus';
import { modeStyle } from '../api/transit';
import { store } from '../store';
import { debounce, escapeHtml as esc } from '../util';

// Building blocks of the Fahrplan view that are shared between the search and the saved tab.

export const hm = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
/** "Donnerstag, 29.10." – the weekday written out, for the day headings of the connections */
export const dayLong = (t: number) => new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric' });
export const dayTxt = (t: number) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
/** value of an <input type="datetime-local"> for a timestamp (local time) */
export const localInput = (t: number) => {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9.2C1.2 8.6 3 5 6.5 5c2 0 3.7 1.2 5.5 3.2C13.8 6.2 15.5 5 17.5 5 21 5 22.8 8.6 21.3 11.8 19 16.4 12 21 12 21z"/></svg>';
export const BOOKMARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';

/** suggestions found earlier (kept in the browser for a year): read with a text, written with a text and a list */
function stopMemory(q: string, list?: Stop[]): Stop[] | null {
  const key = q.trim().toLowerCase();
  const all = store.cacheGet<Record<string, Stop[]>>('fpstops', 365 * 86400000) ?? {};
  if (!list) return all[key] ?? null;
  const next = { ...Object.fromEntries(Object.entries(all).slice(-79)), [key]: list.slice(0, 8) };
  store.cacheSet('fpstops', next);
  return list;
}

/** stop picker: text box with suggestions; `pick` is called with the chosen stop */
export function stopField(label: string, onPick: (s: Stop | null) => void) {
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
    store.pushRecentStop({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, area: s.area, src: s.src });
    input.value = s.name;
    close();
    onPick(s);
  };
  const show = (r: Stop[]) => {
    results = r.slice(0, 8);
    list.innerHTML = results.length
      ? results.map((s, i) => `<li role="option" data-i="${i}"><span class="s-name">${esc(s.name)}</span><span class="s-meta">${esc(s.area ?? '')}</span></li>`).join('')
      : '<li class="empty">Keine Haltestelle gefunden</li>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const run = debounce(async (q: string) => {
    const my = ++seq;
    // what was found for this text before is shown at once, the fresh answer replaces it
    const known = stopMemory(q);
    if (known) show(known);
    try {
      const r = await searchStops(q);
      stopMemory(q, r);
      if (my === seq) show(r);
    } catch {
      if (my === seq && !known) {
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
  // an empty field offers the stops used lately
  input.addEventListener('focus', () => {
    if (input.value.trim() || !store.getRecentStops().length) return;
    seq++;
    show(store.getRecentStops());
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

/** time cell: scheduled time, and the real-time one below it when it differs (green ≤ 5 min late, red beyond) */
const timeCell = (actual: number, sched: number, delay: number | null) => {
  if (delay == null) return `<span class="fp-tm"><b>${hm(actual)}</b></span>`;
  const cls = delay <= 5 ? 'ok' : 'late';
  return delay === 0 ? `<span class="fp-tm"><b class="${cls}">${hm(actual)}</b></span>` : `<span class="fp-tm"><b>${hm(sched)}</b><b class="${cls}">${hm(actual)}</b></span>`;
};
const stationRow = (name: string, track: string | undefined, actual: number, sched: number, delay: number | null, color: string, changed = false) =>
  `<div class="fp-row" style="--c:${color}">${timeCell(actual, sched, delay)}<span class="fp-dot"></span><div class="fp-st"><b>${esc(name)}</b>${track ? `<small class="fp-gl-badge${changed ? ' changed' : ''}" title="Gleis ${esc(track)}${changed ? ' (Gleiswechsel)' : ''}">Gl. ${esc(track)}</small>` : ''}</div></div>`;
const walkTxt = (legs: Leg[]) => {
  const w = legs.reduce((n, l) => n + (l.walkM ?? 0), 0);
  return `Fußweg${w ? ` · ${w} m` : ''} · ${durationTxt(legs.reduce((n, l) => n + (l.arr - l.dep), 0))}`;
};
const gap = (cls: string, color: string, label: string, mins: string, icon: string) =>
  `<div class="fp-gap ${cls}" style="--c:${color}"><span class="fp-gm">${esc(mins)}</span><span class="fp-gl"></span><div class="fp-gb"><span class="fp-gi">${icon}</span>${esc(label)}</div></div>`;
const ICON_WALK = '<svg viewBox="0 0 24 24"><circle cx="13" cy="4.5" r="2" fill="currentColor" stroke="none"/><path d="M9 21l2-6 3 2v4M11 15l1-5-3 1-1 3M12 10l2 2h3"/></svg>';
const ICON_PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
const ICON_SWAP = '<svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>';

/** on-demand bus: the number to call and when to call it */
const bookingHtml = (l: Leg) => {
  const b = l.mode === 'ODM' || l.mode === 'FLEX' ? rufbusInfo(l.agency, l.reservation) : null;
  if (!b) return '';
  const call = b.tel ? ` <a class="fp-tel" href="${telHref(b.tel)}">${ICON_PHONE}${esc(b.tel)}</a>` : '';
  const when = b.leadMin ? `<p class="fp-nach">Anruf ${b.leadMin} min vor Abfahrt</p>` : b.tel ? '' : '<p class="fp-nach">Anmeldung erforderlich</p>';
  return `${call}${when}`;
};

const legBody = (l: Leg) => {
  const stops = l.via.length
    ? `<details class="fp-stops"><summary>${l.via.length} Haltestelle${l.via.length > 1 ? 'n' : ''}</summary><ul>${l.via
        .map((v) => `<li><span class="fp-tm"><b${v.delayMin != null ? ` class="${v.delayMin <= 5 ? 'ok' : 'late'}"` : ''}>${Number.isFinite(v.time) ? hm(v.time) : ''}</b></span><span>${esc(v.name)}</span></li>`)
        .join('')}</ul></details>`
    : '';
  return `<div class="fp-legbody${l.cancelled ? ' cancelled' : ''}"><span class="fp-badge" style="${fg(l.mode)}">${esc(lineName(l.mode, l.line))}</span>${l.cancelled ? ' <small class="fp-late">entfällt</small>' : ''}${bookingHtml(l)}${l.headsign ? `<p class="fp-nach">nach ${esc(l.headsign)}</p>` : ''}${stops}</div>`;
};

/** the connection as a timeline: station rows, the ride between them and the transfers */
export const timeline = (it: Itinerary) => {
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
    out.push(stationRow(l.from, l.track, l.dep, l.schedDep, l.delayMin, c, l.trackChanged));
    out.push(`<div class="fp-ride" style="--c:${c}"><span class="fp-gm">${esc(durationTxt(l.arr - l.dep))}</span><span class="fp-gl"></span>${legBody(l)}</div>`);
    out.push(stationRow(l.to, l.toTrack, l.arr, l.schedArr, l.arrDelayMin, c, l.toTrackChanged));
    prev = l;
  }
  if (walks.length) out.push(gap('walk', '#8a93a8', walkTxt(walks), '', ICON_WALK), stationRow(walks[walks.length - 1].to, undefined, it.arr, it.arr, null, '#8a93a8'));
  return out.join('');
};

/** summary line of a status: "+14 min" red / "pünktlich" green, empty without real-time data */
export const delayTxt = (d: number | null | undefined) => (d == null ? '' : d > 0 ? `<span class="${d <= 5 ? 'fp-ok' : 'fp-late'}">+${d} min</span>` : '<span class="fp-ok">pünktlich</span>');

/** tiny mark next to a delay: where the real-time data comes from (DB timetable data or Transitous) */
export const srcIcon = (src?: DelaySource) => `<i class="fp-src${src === 'db' ? ' db' : ''}" title="Echtzeit: ${src === 'db' ? 'DB' : 'Transitous'}" aria-label="Echtzeit: ${src === 'db' ? 'DB' : 'Transitous'}">${src === 'db' ? 'DB' : 'T'}</i>`;

export const depRow = (d: Departure) => {
  const late = d.delayMin != null && d.delayMin > 0 ? `<span class="fp-late">+${d.delayMin}</span>` : d.delayMin === 0 ? '<span class="fp-ok">pünktlich</span>' : '';
  const src = d.delayMin != null ? srcIcon(d.delaySrc) : '';
  return `<li class="fp-dep${d.cancelled ? ' cancelled' : ''}" style="--c:${modeStyle(d.mode).color}">
    <span class="fp-in">${d.cancelled ? '–' : esc(inTxt(d.time))}</span>
    <span class="fp-badge" style="${fg(d.mode)}">${esc(lineName(d.mode, d.line))}</span>
    <span class="fp-to-txt">${esc(d.headsign)}${d.cancelled ? ' <small class="fp-late">entfällt</small>' : ''}</span>
    <span class="fp-at">${hm(d.time)} ${late}${src}${d.track ? `<small${d.trackChanged ? ' class="fp-gl-chg"' : ''}>Gl. ${esc(d.track)}</small>` : ''}</span>
  </li>`;
};

/** button that saves / removes a connection as a commuter trip (state is toggled in place by the caller) */
/** label of the save button: the long text where there is room, the short one otherwise (see .fp-dh) */
export const tripTxt = (saved: boolean) => `<span class="fp-lg">${saved ? 'Verbindung gemerkt' : 'Verbindung merken'}</span><span class="fp-shrt">${saved ? 'Gemerkt' : 'Merken'}</span>`;
export const tripBtn = (key: string, saved: boolean) =>
  `<button type="button" class="fp-trip${saved ? ' on' : ''}" data-act="savetrip" data-key="${esc(key)}" aria-pressed="${saved}">${BOOKMARK}${tripTxt(saved)}</button>`;

/** name of a line as shown: city buses only carry a number ("245"), so they get their "Bus " in front */
/** dark text on the yellow on-demand buses (white everywhere else) */
const fg = (mode: string) => (mode === 'ODM' || mode === 'FLEX' ? 'color:#2b2300;' : '');
export const lineName = (mode: string, line: string) => {
  if (!line) return modeStyle(mode).label;
  if (mode === 'BUS' && !/^bus/i.test(line)) return `Bus ${line}`;
  return mode === 'ODM' || mode === 'FLEX' ? 'RUF' : line; // on-demand buses: just "RUF"
};

/** bar label: "RE8 (13188)" → the train number wraps to a clipped second line when it does not fit, so it disappears instead of ending in "…" */
const segLabel = (line: string) => {
  // "RE8 (13188)", "ICE 581", "Bus 235": the number goes after the name and is the first part to be dropped
  const m = /^(.*?)\s*(\(\d+\))$/.exec(line) ?? /^(\S+)\s+(\S.*)$/.exec(line);
  return m && m[1] ? `<span class="fp-sn">${esc(m[1])}</span><span class="fp-sn">${esc(m[2])}</span>` : `<span class="fp-sn">${esc(line)}</span>`;
};

/** "in 12 min" / "in 1 h 05" / "jetzt" / "abgefahren" for an instant */
export const cdTxt = (t: number, now = Date.now()) => {
  if (Math.round((t - now) / 60000) < -1) return 'abgefahren';
  const x = inTxt(t, now);
  return x === 'jetzt' ? x : `in ${x}`;
};

/** one connection as an expandable card; `trip` adds the commuter button inside, `hero` makes it the big "next connection" card (phone) */
export const itinHtml = (it: Itinerary, trip?: { key: string; saved: boolean }, hero = false) => {
  const rides = it.legs.filter((l) => l.mode !== 'WALK');
  const first = rides[0] ?? it.legs[0];
  const last = rides[rides.length - 1] ?? it.legs[it.legs.length - 1];
  const live = first?.delayMin != null || last?.arrDelayMin != null;
  // white: the planned times (also for the duration), the real-time ones follow below in green / red
  const planDep = first?.schedDep ?? it.dep;
  const planArr = last?.schedArr ?? it.arr;
  const cls = (d: number | null | undefined) => (d == null || d <= 5 ? 'ok' : 'late');
  const total = Math.max(1, it.arr - it.dep);
  const bar = it.legs
    .map((l) => {
      const w = Math.max(6, ((l.arr - l.dep) / total) * 100);
      return l.mode === 'WALK'
        ? `<span class="fp-seg walk" title="Fußweg" aria-label="Fußweg">${ICON_WALK}</span>`
        : `<span class="fp-seg" style="flex:${w};--c:${legColor(l)};${fg(l.mode)}">${segLabel(lineName(l.mode, l.line))}</span>`;
    })
    .join('');
  const cancelled = it.legs.some((l) => l.cancelled);
  const dl = first?.delayMin;
  const rawTag = cancelled ? '<span class="fp-dtag late">entfällt</span>' : dl == null ? '' : dl > 0 ? `<span class="fp-dtag ${dl <= 5 ? 'ok' : 'late'}">+${dl} min</span>` : '<span class="fp-dtag ok">pünktlich</span>';
  const depSrc = !cancelled && dl != null ? srcIcon(first?.delaySrc) : '';
  const arrSrc = !cancelled && last?.arrDelayMin != null ? srcIcon(last?.arrDelaySrc) : '';
  // the icon sits in the time line (list) and in the status tag (big card, where the time line is hidden)
  const tag = depSrc ? rawTag.replace(/<\/span>$/, `${depSrc}</span>`) : rawTag;
  const lines = rides.map((l) => `<span class="fp-badge" style="--c:${legColor(l)};${fg(l.mode)}">${esc(lineName(l.mode, l.line))}</span>`).join('');
  const startT = first?.dep ?? it.dep;
  return `<details class="fp-itin${hero ? ' fp-hero' : ''}" data-k="${esc(stableKey(it))}">
    <summary>
      ${hero ? '<span class="fp-hero-lbl">Nächste Verbindung</span>' : ''}${first?.track ? `<small class="fp-gl-badge fp-sum-gl${hero ? ' fp-hero-gl' : ''}${first.trackChanged ? ' changed' : ''}" title="Gleis ${esc(first.track)}${first.trackChanged ? ' (Gleiswechsel)' : ''}">Gl. ${esc(first.track)}</small>` : ''}<span class="fp-cd" data-t="${startT}">${esc(cdTxt(startT))}</span>
      <span class="fp-rt"><span>${esc(hm(startT))} ${esc(first?.from ?? '')}</span><span class="fp-rt-to">${esc(hm(last?.arr ?? it.arr))} ${esc(last?.to ?? '')}</span></span>
      <span class="fp-lines">${lines}</span>${tag}
      <span class="fp-l1"><b>${hm(planDep)} – ${hm(planArr)}</b><span>| ${esc(durationTxt(planArr - planDep))}${it.transfers ? ` | ${it.transfers} Umst.` : ''}</span></span>
      ${live ? `<span class="fp-l2"><b class="${cls(first?.delayMin)}">${hm(first?.dep ?? it.dep)}</b>${depSrc}<b class="${cls(last?.arrDelayMin)}">${hm(last?.arr ?? it.arr)}</b>${arrSrc}</span>` : ''}
      <span class="fp-bar">${bar}</span>
      <span class="fp-von">von ${esc(first?.from ?? '')}</span>
    </summary>
    <div class="fp-detail"><div class="fp-dh"><span>${esc(dayLong(it.dep))}</span><span><span class="fp-dl">Dauer: </span>${esc(durationTxt(planArr - planDep))}</span>${trip ? tripBtn(trip.key, trip.saved) : ''}</div>${timeline(it)}</div>
  </details>`;
};
