import { Map as MlMap, NavigationControl, type GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { escapeHtml, toast } from '../util';
import { store } from '../store';
import type { StreetGame } from '../games/streetguess';
import type { NameQuiz } from '../games/namequiz';
import type { SizeDuel } from '../games/sizeduel';
import type { SizeScale } from '../games/sizescale';
import { type Props, type Feat, type BBox, DATA, SCOPES, scopeOf, STYLE, norm, lev, bboxOf, anchor, anchorView, span, loadData, regionHistory, saveRegionHistory, countryAreas, loadRegionIndex } from '../games/data';
import { GAME_CARDS, previewHtml, optIcon, slug } from '../games/menu-art';

// Games – deliberately separate from the layer drawer of the main map: own tab, own (label-free) map.
// Country / region quiz: a name pops up and you click it ("Anklicken"), or you type all names ("Eintippen").

export interface GamesView {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
}

type Mode = 'click' | 'type';
type Status = 'found' | 'missed' | 'wrong' | 'target' | 'hint';

const MAX_TRIES = 1; // one try on the map, then the solution is shown

/** one thing to find: a country/region (one feature) or a continent (all its countries) */
interface Target {
  id: string;
  kind: 'country' | 'continent';
  name: string;
  en: string;
  /** map feature ids that belong to it */
  ids: string[];
  feat?: Feat;
  cont?: string;
}

interface QuizConfig {
  scope: string;
  region?: string;
  sov: boolean;
  /** flag game: four answers to pick from as an extra */
  choice?: boolean;
  /** flag game: number of flags (0 = all) */
  rounds?: number;
  /** map variant of the flag game: the question is a flag instead of a name */
  flag: boolean;
  mode: Mode;
}

/** token baked in at build time (Actions variable MAPILLARY_TOKEN → VITE_MAPILLARY_TOKEN); a token typed in below overrides it */
const BUILT_IN_TOKEN = (import.meta.env?.VITE_MAPILLARY_TOKEN as string | undefined)?.trim() || '';

export function createGamesView(): GamesView {
  const el = document.createElement('div');
  el.className = 'view games-view';
  el.hidden = true;
  el.innerHTML = `
    <div class="gm-map"></div>
    <div class="gm-hud" hidden>
      <div class="gm-stats"><span class="gm-score"></span><span class="gm-time">0:00</span></div>
      <div class="gm-ask" hidden><small>Wo liegt …</small><b class="gm-target"></b></div>
      <form class="gm-type" hidden autocomplete="off"><input class="gm-input" type="text" placeholder="Name eintippen …" autocapitalize="off" autocorrect="off" spellcheck="false" /></form>
      <div class="gm-feedback" aria-live="polite"></div>
      <div class="gm-choices" hidden></div>
      <div class="gm-actions">
        <button class="btn gm-skip" type="button">Überspringen</button>
        <button class="btn gm-giveup" type="button">Aufgeben</button>
        <button class="btn gm-menu" type="button">Menü</button>
      </div>
    </div>

    <div class="gm-hub" data-game="hub">
      <header class="gm-hub-head">
        <h1>Spiele</h1>
        <p>Teste dein Weltwissen – such dir einen Modus aus.</p>
      </header>
      <div class="gm-cards">${GAME_CARDS.map(
        (g) => `
        <button type="button" class="gm-card gm-card-${g.id}" data-g="${g.id}">
          ${previewHtml(g.id)}
          <span class="gm-card-tag">${g.tag}</span>
          <span class="gm-card-body">
            <b>${g.label}</b>
            <span>${g.blurb}</span>
            <span class="gm-card-foot"><span class="gm-chips">${g.chips.map((c) => `<i>${c}</i>`).join('')}</span><em>Spielen →</em></span>
          </span>
        </button>`,
      ).join('')}
      </div>
    </div>

    <div class="gm-panel" data-game="quiz" hidden>
      <div class="gm-games"></div>
      <h2>Länder-Rater</h2>
      <p class="gm-lead">Kennst du alle Namen? Wähle Spielart und Gebiet.</p>
      <div class="gm-field"><span>Spielart</span>
        <div class="gm-seg" data-k="mode">
          <button type="button" data-v="click" class="on">Anklicken<small>Ein Name erscheint, du klickst ihn an</small></button>
          <button type="button" data-v="type">Eintippen<small>Alle Namen aus dem Kopf eintippen</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Gebiet</span>
        <select class="gm-scope"></select>
        <select class="gm-region" hidden></select>
      </div>
      <button class="btn btn-primary gm-start" type="button">Spiel starten</button>
      <p class="gm-note gm-err"></p>
      <p class="gm-note">Kartendaten: Natural Earth (gemeinfrei).</p>
    </div>

    <div class="gm-panel" data-game="flags" hidden>
      <div class="gm-games"></div>
      <h2>Flaggen-Rater</h2>
      <p class="gm-lead">Welche Flagge gehört zu welchem Land?</p>
      <div class="gm-field"><span>Antworten</span>
        <div class="gm-seg" data-k="fhelp">
          <button type="button" data-v="type" class="on">Karte &amp; Eingabe<small>Land anklicken oder Namen tippen – beides immer möglich</small></button>
          <button type="button" data-v="choice">Zusätzlich Auswahl<small>Dazu 4 Antworten zum Antippen</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Gebiet</span><select class="fg-scope"></select></div>
      <div class="gm-field"><span>Runden</span><select class="fg-rounds"><option value="15">15 Flaggen</option><option value="30">30 Flaggen</option><option value="0">Alle</option></select></div>
      <button class="btn btn-primary fg-start" type="button">Spiel starten</button>
      <p class="gm-note fg-err"></p>
      <p class="gm-note">Flaggen: flag-icons (MIT).</p>
    </div>

    <div class="gm-panel" data-game="capitals" hidden>
      <div class="gm-games"></div>
      <h2>Hauptstädte-Rater</h2>
      <p class="gm-lead">Land zur Hauptstadt – oder umgekehrt.</p>
      <div class="gm-field"><span>Frage</span>
        <div class="gm-seg" data-k="cdir">
          <button type="button" data-v="cap" class="on">Land → Hauptstadt<small>Wie heißt die Hauptstadt?</small></button>
          <button type="button" data-v="land">Hauptstadt → Land<small>Zu welchem Land gehört sie?</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Spielart</span>
        <div class="gm-seg" data-k="cmode">
          <button type="button" data-v="choice" class="on">Auswahl<small>4 Antworten</small></button>
          <button type="button" data-v="type">Eintippen<small>Name selbst schreiben</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Gebiet</span><select class="cp-scope"></select></div>
      <div class="gm-field"><span>Runden</span><select class="cp-rounds"><option value="15">15 Fragen</option><option value="30">30 Fragen</option><option value="0">Alle</option></select></div>
      <button class="btn btn-primary cp-start" type="button">Spiel starten</button>
      <p class="gm-note cp-err"></p>
      <p class="gm-note">Hauptstädte: Natural Earth (gemeinfrei).</p>
    </div>

    <div class="gm-panel" data-game="outline" hidden>
      <div class="gm-games"></div>
      <h2>Umrisse-Rater</h2>
      <p class="gm-lead">Erkennst du das Land – oder die Region – an seiner Form?</p>
      <div class="gm-field"><span>Spielart</span>
        <div class="gm-seg" data-k="omode">
          <button type="button" data-v="choice" class="on">Auswahl<small>4 Antworten</small></button>
          <button type="button" data-v="type">Eintippen<small>Name selbst schreiben</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Gebiet</span>
        <select class="ol-scope"></select>
        <select class="ol-region" hidden></select>
      </div>
      <div class="gm-field"><span>Runden</span><select class="ol-rounds"><option value="15">15 Umrisse</option><option value="30">30 Umrisse</option><option value="0">Alle</option></select></div>
      <button class="btn btn-primary ol-start" type="button">Spiel starten</button>
      <p class="gm-note ol-err"></p>
      <p class="gm-note">Grenzen: Natural Earth (gemeinfrei). Sehr kleine Länder fehlen.</p>
    </div>

    <div class="gm-panel" data-game="size" hidden>
      <div class="gm-games"></div>
      <h2>Größenvergleich</h2>
      <p class="gm-lead">Wie groß ist ein Land im Vergleich zu einem anderen? Bei Higher Lower werden die Paare mit der Zeit immer knapper; im Maßstab ziehst du ein Gebiet auf die richtige Größe.</p>
      <div class="gm-field"><span>Spielart</span>
        <div class="gm-seg" data-k="smode">
          <button type="button" data-v="scale" class="on">Maßstab<small>Ein Gebiet fest, das andere ziehst du auf die richtige Größe</small></button>
          <button type="button" data-v="duel">Higher Lower<small>Zwei Gebiete – welches ist größer?</small></button>
        </div>
      </div>
      <div class="gm-field sz-metric"><span>Vergleich</span>
        <div class="gm-seg" data-k="smetric">
          <button type="button" data-v="area" class="on">Fläche<small>Welches ist größer?</small></button>
          <button type="button" data-v="pop">Einwohner<small>Wo leben mehr Menschen?</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Gebiet</span>
        <select class="sz-scope"></select>
        <select class="sz-region" hidden></select>
        <small class="gm-note">Bei Regionen eines Landes und im Maßstab-Modus zählt nur die Fläche.</small>
      </div>
      <div class="gm-field"><span>Runden</span><select class="sz-rounds"><option value="10">10 Runden</option><option value="20">20 Runden</option><option value="5">5 Runden</option><option value="0" class="sz-endless">Bis zum ersten Fehler (Higher Lower)</option></select></div>
      <button class="btn btn-primary sz-start" type="button">Spiel starten</button>
      <p class="gm-note sz-err"></p>
      <p class="gm-note">Flächen aus den Grenzdaten berechnet (Natural Earth), daher nur ungefähr.</p>
    </div>

    <div class="gm-panel" data-game="street" hidden>
      <div class="gm-games"></div>
      <h2>Straßen-Rater</h2>
      <p class="gm-lead">Du stehst mitten in einer 360°-Aufnahme, schaust dich um und tippst auf der Karte, wo du bist. 5 Runden, bis zu 5000 Punkte pro Runde.</p>
      <div class="gm-field"><span>Gebiet</span><select class="sg-scope"></select></div>
      <div class="gm-field"><span>Bewegung</span>
        <div class="gm-seg" data-k="move">
          <button type="button" data-v="1" class="on">Frei<small>Du kannst dich umsehen und weiterfahren</small></button>
          <button type="button" data-v="0">Gesperrt<small>Nur umschauen und zoomen</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Mapillary-Token (${BUILT_IN_TOKEN ? 'optional' : 'kostenlos'})</span>
        <input class="gm-input sg-token" type="password" placeholder="MLY|…" autocomplete="off" spellcheck="false" />
        <small class="gm-note">Client-Token aus <a href="https://www.mapillary.com/dashboard/developers" target="_blank" rel="noopener">mapillary.com/dashboard/developers</a> (Anwendung registrieren). Bleibt nur in diesem Browser gespeichert.${BUILT_IN_TOKEN ? ' Ohne eigenen Token nutzt das Spiel den Token dieser Seite.' : ''}</small>
      </div>
      <button class="btn btn-primary sg-start" type="button">Spiel starten</button>
      <p class="gm-note sg-err"></p>
      <p class="gm-note">Fotos: Mapillary-Mitwirkende (CC BY-SA).</p>
    </div>

    <div class="gm-street-host"></div>
    <div class="gm-result" hidden></div>`;

  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const hud = $('.gm-hud');
  const result = $('.gm-result');
  const ask = $('.gm-ask');
  const typeForm = $<HTMLFormElement>('.gm-type');
  const choicesEl = $('.gm-choices');
  const input = $<HTMLInputElement>('.gm-input');
  const host = $('.gm-street-host');
  const feedback = $('.gm-feedback');

  // ----- menu: game tabs, segmented buttons, scope selects ------------------------------
  const panels = new Map<string, HTMLElement>();
  el.querySelectorAll<HTMLElement>('.gm-panel, .gm-hub').forEach((p) => panels.set(p.dataset.game!, p));
  const showPanel = (id: string) => {
    panels.forEach((p, k) => (p.hidden = k !== id));
    panels.get(id)?.scrollTo({ top: 0 });
  };
  // settings panel = hero (preview, title, lead) + options (stage with every field, foot with start button)
  function buildOpts(p: HTMLElement): HTMLElement {
    const opts = document.createElement('div');
    opts.className = 'gm-opts';
    const stage = document.createElement('div');
    stage.className = 'gm-stage';
    const foot = document.createElement('div');
    foot.className = 'gm-foot';
    for (const k of Array.from(p.children) as HTMLElement[]) {
      if (k.classList.contains('gm-field')) {
        const t = k.querySelector(':scope > span');
        k.dataset.title = t?.textContent ?? '';
        t?.remove();
        stage.append(k);
      } else foot.append(k);
    }
    opts.append(stage, foot);
    return opts;
  }

  for (const [id, p] of panels) {
    if (id === 'hub') continue;
    const card = GAME_CARDS.find((g) => g.id === id)!;
    p.querySelector('.gm-games')!.remove();
    const h2 = p.querySelector('h2')!;
    const lead = p.querySelector('.gm-lead')!;
    const hero = document.createElement('div');
    hero.className = 'gm-hero';
    hero.innerHTML = `${previewHtml(id).replace('class="gm-pv', 'class="gm-pv gm-banner')}
      <div class="gm-hero-txt"><button type="button" class="gm-backhub">← Alle Spiele</button><span class="gm-card-tag">${card.tag}</span></div>`;
    hero.querySelector('.gm-hero-txt')!.append(h2, lead);
    p.append(hero, buildOpts(p));
    hero.querySelector('.gm-backhub')!.addEventListener('click', () => showPanel('hub'));
  }
  el.querySelectorAll<HTMLElement>('.gm-card').forEach((c) => c.addEventListener('click', () => showPanel(c.dataset.g!)));

  const segVal: Record<string, string> = {};
  el.querySelectorAll<HTMLElement>('.gm-seg').forEach((g) => {
    const key = g.dataset.k!;
    segVal[key] = g.querySelector<HTMLElement>('button.on')!.dataset.v!;
    g.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        segVal[key] = b.dataset.v!;
        g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      }),
    );
  });

  const scopeOptions = (extra: string[] = []) => [...SCOPES.map((s) => `<option value="${s.id}">${s.label}</option>`), ...extra].join('');
  const fill = (sel: string, extra?: string[]) => ($<HTMLSelectElement>(sel).innerHTML = scopeOptions(extra));
  const REGIONS_OPT = '<option value="regions">Regionen eines Landes …</option>';
  fill('.fg-scope');
  fill('.cp-scope');
  fill('.sg-scope');
  fill('.ol-scope', [REGIONS_OPT]);
  fill('.sz-scope', [REGIONS_OPT]);
  const scopeSel = $<HTMLSelectElement>('.gm-scope');
  scopeSel.innerHTML = [`<option value="world">${SCOPES[0].label}</option>`, ...SCOPES.slice(1).map((s) => `<option value="${s.id}">${s.label}</option>`), REGIONS_OPT].join('');

  /** "Regionen eines Landes …" shows a country picker (list loaded on demand) */
  function bindRegions(scope: HTMLSelectElement, region: HTMLSelectElement, onChange?: () => void) {
    // the country select stays as the value holder; a search field + grid of flags is what people see
    const pick = document.createElement('div');
    pick.className = 'gm-regpick';
    pick.hidden = true;
    pick.innerHTML = '<input class="gm-input gm-regsearch" type="search" placeholder="Land suchen …" autocomplete="off" spellcheck="false" /><div class="gm-regs"></div><small class="gm-note gm-regempty" hidden>Kein Land gefunden.</small>';
    region.hidden = true;
    region.before(pick);
    const grid = pick.querySelector<HTMLElement>('.gm-regs')!;
    const search = pick.querySelector<HTMLInputElement>('.gm-regsearch')!;
    const empty = pick.querySelector<HTMLElement>('.gm-regempty')!;
    const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const markRegion = () => grid.querySelectorAll<HTMLElement>('button').forEach((b) => b.classList.toggle('on', b.dataset.v === region.value));
    // order (only when the grid opens, never while picking): the chosen country, then the ones picked before, then by size
    const sortGrid = () => {
      const bs = Array.from(grid.querySelectorAll<HTMLElement>('button'));
      const hist = regionHistory();
      const rank = (b: HTMLElement) => (b.dataset.v === region.value ? -1e6 : hist.includes(b.dataset.v!) ? -1e3 + hist.indexOf(b.dataset.v!) : Number(b.dataset.i));
      bs.sort((a, b) => rank(a) - rank(b));
      grid.append(...bs);
      grid.scrollTop = 0;
    };
    search.addEventListener('input', () => {
      const q = norm(search.value.trim());
      let n = 0;
      grid.querySelectorAll<HTMLElement>('button').forEach((b) => {
        const show = !q || b.dataset.n!.includes(q);
        b.hidden = !show;
        if (show) n++;
      });
      empty.hidden = n > 0;
    });
    grid.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      region.value = b.dataset.v!;
      saveRegionHistory(region.value);
      markRegion();
      region.dispatchEvent(new Event('change'));
    });
    scope.addEventListener('change', async () => {
      const regions = scope.value === 'regions';
      pick.hidden = !regions;
      if (regions && grid.childElementCount) sortGrid();
      onChange?.();
      if (regions && !region.options.length) {
        try {
          const area = await countryAreas();
          const sorted = [...(await loadRegionIndex())].sort((a, b) => (area.get(b.id) ?? 0) - (area.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'de'));
          region.innerHTML = sorted.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.n})</option>`).join('');
          const last = regionHistory().find((id) => sorted.some((c) => c.id === id));
          region.value = last ?? (sorted.some((c) => c.id === 'DE') ? 'DE' : sorted[0].id);
          grid.innerHTML = sorted
            .map((c, i) => `<button type="button" data-v="${c.id}" data-i="${i}" data-n="${escapeHtml(norm(c.name))}"><span class="gm-opt-pv"><img alt="" loading="lazy" src="${DATA}previews/regions/${c.id}.svg" /></span><b>${escapeHtml(c.name)}</b><small>${c.n} Regionen</small></button>`)
            .join('');
          sortGrid();
          markRegion();
        } catch (e) {
          pick.hidden = true;
          scope.value = 'world';
          scope.dispatchEvent(new Event('sync'));
          toast((e as Error).message, 'error');
        }
      }
    });
  }
  const regionSel = $<HTMLSelectElement>('.gm-region');
  bindRegions(scopeSel, regionSel);
  bindRegions($<HTMLSelectElement>('.ol-scope'), $<HTMLSelectElement>('.ol-region'));
  bindRegions($<HTMLSelectElement>('.sz-scope'), $<HTMLSelectElement>('.sz-region'));

  // pictures instead of words: every segmented button gets a little drawing, every area select a map picker
  el.querySelectorAll<HTMLElement>('.gm-seg').forEach((g) =>
    g.querySelectorAll<HTMLElement>('button').forEach((b) => {
      const ic = optIcon(g.dataset.k!, b.dataset.v!);
      const tx = document.createElement('span');
      tx.className = 'gm-opt-tx';
      while (b.firstChild) tx.append(b.firstChild);
      b.append(tx);
      if (ic) b.insertAdjacentHTML('afterbegin', `<span class="gm-opt-pv">${ic}</span>`);
    }),
  );
  // area picker: Welt / Kontinente / Regional – with "Kontinente" a second row of toggles (all on at first;
  // the first click picks just that one, after that it toggles). The hidden select keeps the value: world, a SCOPES id,
  // `conts:A,B` or regions.
  el.querySelectorAll<HTMLSelectElement>('select[class$="-scope"]').forEach((sel) => {
    const hasRegions = Array.from(sel.options).some((o) => o.value === 'regions');
    const conts = SCOPES.slice(1);
    const card = (v: string, img: string, label: string) =>
      `<button type="button" data-v="${v}"><span class="gm-opt-pv"><img alt="" loading="lazy" src="${DATA}previews/scope-${img}.svg" /></span><b>${label}</b></button>`;
    const wrap = document.createElement('div');
    wrap.className = 'gm-scope-pick';
    wrap.innerHTML = `<div class="gm-scopes gm-scopes-main">${card('world', 'world', 'Welt')}${hasRegions ? card('regions', 'regions', 'Regional') : ''}</div>
      <div class="gm-scopes gm-scopes-conts">${conts.map((c) => card(c.id, slug(c.id), c.label)).join('')}</div><button type="button" class="gm-all" hidden>Alle</button>`;
    const main = wrap.querySelector<HTMLElement>('.gm-scopes-main')!;
    const row = wrap.querySelector<HTMLElement>('.gm-scopes-conts')!;
    const all = wrap.querySelector<HTMLElement>('.gm-all')!;
    const panel = sel.closest<HTMLElement>('.gm-panel')!;
    let kind = 'world';
    let picked = new Set(conts.map((c) => c.id));
    // "Regional": the area cards shrink by exactly the height of the search bar, so the grid starts where the big cards ended
    let compactNow = false;
    let bigH = 0;
    const fitMain = (regional: boolean) => {
      const pvs = Array.from(main.querySelectorAll<HTMLElement>('.gm-opt-pv'));
      if (!pvs.length || !pvs[0].offsetParent || regional === compactNow) return;
      compactNow = regional;
      if (regional) {
        bigH = pvs[0].offsetHeight;
        const field = sel.closest<HTMLElement>('.gm-field');
        const extra = 44 + (parseFloat(field ? getComputedStyle(field).rowGap : '12') || 12);
        pvs.forEach((x) => {
          x.style.aspectRatio = 'auto';
          x.style.height = `${bigH}px`;
        });
        const btn = pvs[0].closest<HTMLElement>('button')!;
        const bigBtn = btn.offsetHeight;
        void main.offsetHeight;
        pvs.forEach((x) => (x.style.height = `${bigH - extra}px`));
        // the search bar plus the gaps must end exactly where the big cards ended: correct what the estimate missed
        setTimeout(() => {
          const bar = wrap.querySelector<HTMLElement>('.gm-regsearch') ?? sel.closest('.gm-field')?.querySelector<HTMLElement>('.gm-regsearch');
          if (!compactNow || !bar || bar.offsetParent === null) return;
          const diff = bar.getBoundingClientRect().bottom - btn.getBoundingClientRect().top - bigBtn;
          if (Math.abs(diff) > 0.5 && Math.abs(diff) < 60) pvs.forEach((x) => (x.style.height = `${bigH - extra - diff}px`));
        }, 450);
      } else {
        pvs.forEach((x) => (x.style.height = `${bigH}px`));
        setTimeout(() => {
          if (compactNow) return;
          pvs.forEach((x) => {
            x.style.height = '';
            x.style.aspectRatio = '';
          });
        }, 380);
      }
    };
    const apply = () => {
      const ids = conts.map((c) => c.id).filter((id) => picked.has(id));
      const v = kind === 'regions' ? 'regions' : ids.length === conts.length ? 'world' : ids.length === 1 ? ids[0] : `conts:${ids.join(',')}`;
      if (!Array.from(sel.options).some((o) => o.value === v)) sel.add(new Option(v, v));
      sel.value = v;
      main.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === kind));
      row.classList.toggle('open', kind === 'world');
      panel.classList.toggle('gm-compact', kind === 'regions');
      fitMain(kind === 'regions');
      row.querySelectorAll<HTMLElement>('button[data-v]').forEach((b) => b.classList.toggle('on', picked.has(b.dataset.v!)));
      all.hidden = picked.size === conts.length;
      sel.dispatchEvent(new Event('change'));
    };
    main.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      kind = b.dataset.v!;
      apply();
    });
    all.addEventListener('click', () => {
      picked = new Set(conts.map((c) => c.id));
      apply();
    });
    row.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      const id = b.dataset.v!;
      if (picked.size === conts.length) picked = new Set([id]);
      else if (picked.has(id)) picked.size > 1 && picked.delete(id);
      else picked.add(id);
      apply();
    });
    // the select was reset from outside (region list failed to load)
    sel.addEventListener('sync', () => {
      kind = 'world';
      main.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === kind));
      row.classList.add('open');
      panel.classList.remove('gm-compact');
    });
    sel.hidden = true;
    sel.before(wrap);
    main.querySelector('button')!.classList.add('on');
    main.hidden = !hasRegions; // "Welt" alone is no choice – just show the continents
    row.classList.add('open');
    row.querySelectorAll('button[data-v]').forEach((b) => b.classList.add('on'));
  });

  // ----- name quizzes without a map (flags, capitals, outlines) -----------------------------
  let nq: NameQuiz | null = null;
  const leaveNq = (id: string) => () => {
    nq?.destroy();
    nq = null;
    showPanel(id);
  };
  async function launchNameQuiz(panelId: string, errSel: string, build: () => Promise<{ items: import('../games/namequiz').QuizItem[]; mode: 'choice' | 'type'; rounds: number; placeholder: string }>) {
    const err = $(errSel);
    err.textContent = 'Lade …';
    try {
      const [{ startNameQuiz }, cfg] = await Promise.all([import('../games/namequiz'), build()]);
      if (cfg.items.length < 4) throw new Error('zu wenige Einträge in diesem Gebiet');
      nq?.destroy();
      err.textContent = '';
      showPanel('none');
      nq = startNameQuiz(host, cfg, leaveNq(panelId));
    } catch (e) {
      showPanel(panelId);
      err.textContent = `Konnte nicht starten: ${(e as Error).message}`;
    }
  }
  const val = (sel: string) => $<HTMLSelectElement>(sel).value;

  $('.fg-start').addEventListener('click', () => {
    showPanel('none');
    void start({ scope: val('.fg-scope'), sov: true, flag: true, mode: 'click', choice: segVal.fhelp === 'choice', rounds: Number(val('.fg-rounds')) });
  });
  $('.cp-start').addEventListener('click', () =>
    launchNameQuiz('capitals', '.cp-err', async () => {
      const { capitalItems } = await import('../games/quizitems');
      const dir = segVal.cdir as 'cap' | 'land';
      return { items: await capitalItems(val('.cp-scope'), dir), mode: segVal.cmode as 'choice' | 'type', rounds: Number(val('.cp-rounds')), placeholder: dir === 'cap' ? 'Welche Hauptstadt?' : 'Welches Land?' };
    }),
  );
  $('.ol-start').addEventListener('click', () =>
    launchNameQuiz('outline', '.ol-err', async () => {
      const { outlineItems } = await import('../games/quizitems');
      const scope = val('.ol-scope') === 'regions' ? `regions:${val('.ol-region')}` : val('.ol-scope');
      return { items: await outlineItems(scope), mode: segVal.omode as 'choice' | 'type', rounds: Number(val('.ol-rounds')), placeholder: 'Wie heißt das?' };
    }),
  );

  // ----- size duel ------------------------------------------------------------------------
  let duel: SizeDuel | SizeScale | null = null;
  const leaveDuel = () => {
    duel?.destroy();
    duel = null;
    showPanel('size');
  };
  const syncSize = () => {
    const scale = segVal.smode === 'scale';
    $('.sz-metric').hidden = scale;
    $<HTMLOptionElement>('.sz-endless').hidden = scale;
    if (scale && val('.sz-rounds') === '0') $<HTMLSelectElement>('.sz-rounds').value = '10';
  };
  el.querySelectorAll('[data-k="smode"] button').forEach((b) => b.addEventListener('click', syncSize));
  syncSize();
  $('.sz-start').addEventListener('click', async () => {
    const err = $('.sz-err');
    err.textContent = 'Lade …';
    try {
      const regions = val('.sz-scope') === 'regions';
      const scale = segVal.smode === 'scale';
      const metric = regions || scale ? 'area' : (segVal.smetric as 'area' | 'pop');
      const { sizeItems } = await import('../games/sizeduel');
      const items = await sizeItems(regions ? `regions:${val('.sz-region')}` : val('.sz-scope'), metric);
      if (items.length < 4) throw new Error('zu wenige Einträge in diesem Gebiet');
      const rounds = Number(val('.sz-rounds')) || (scale ? 10 : 0);
      duel?.destroy();
      err.textContent = '';
      showPanel('none');
      if (scale) duel = (await import('../games/sizescale')).startSizeScale(host, { items, rounds }, leaveDuel);
      else duel = (await import('../games/sizeduel')).startSizeDuel(host, { items, metric, rounds }, leaveDuel);
    } catch (e) {
      showPanel('size');
      err.textContent = `Konnte nicht starten: ${(e as Error).message}`;
    }
  });

  // ----- street game ----------------------------------------------------------------------
  const tokenInput = $<HTMLInputElement>('.sg-token');
  tokenInput.value = store.getKeys().mapillary ?? '';
  let street: StreetGame | null = null;
  const leaveStreet = () => {
    street?.destroy();
    street = null;
    showPanel('street');
  };
  $('.sg-start').addEventListener('click', async () => {
    const own = tokenInput.value.trim();
    const token = own || BUILT_IN_TOKEN;
    const err = $('.sg-err');
    if (!token) {
      err.textContent = 'Bitte zuerst einen Mapillary-Token eintragen.';
      return;
    }
    if (own) store.setKeys({ ...store.getKeys(), mapillary: own });
    err.textContent = 'Lade …';
    try {
      const { startStreetGame } = await import('../games/streetguess');
      street?.destroy();
      showPanel('none');
      err.textContent = '';
      street = await startStreetGame(host, { token, scope: val('.sg-scope'), move: segVal.move === '1', rounds: 5, panos: true }, leaveStreet);
    } catch (e) {
      showPanel('street');
      err.textContent = `Konnte nicht starten: ${(e as Error).message}`;
    }
  });

  // ----- map ------------------------------------------------------------------
  let map: MlMap | null = null;
  let mapReady: Promise<void> | null = null;
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

  function ensureMap(): Promise<void> {
    if (mapReady) return mapReady;
    map = new MlMap({ container: $('.gm-map'), style: STYLE, center: [10, 30], zoom: 1.4, attributionControl: { compact: true, customAttribution: 'Grenzen: <a href="https://www.naturalearthdata.com/">Natural Earth</a>' }, dragRotate: false, pitchWithRotate: false });
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    mapReady = new Promise((res) => {
      map!.on('load', () => {
        const m = map!;
        m.addSource('areas', { type: 'geojson', data: empty, promoteId: 'id' });
        m.addSource('marks', { type: 'geojson', data: empty, promoteId: 'id' });
        const color: unknown = [
          'match', ['feature-state', 'status'],
          'found', '#2fbf71', 'missed', '#e0555c', 'wrong', '#ff8a3d', 'target', '#ffd23f', 'hint', '#6aa9ff',
          '#2a3a66',
        ];
        m.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': color as never, 'fill-color-transition': { duration: 300, delay: 0 }, 'fill-opacity': 0.95 } });
        m.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#0d1530', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2] } });
        // faint outline of the area under the cursor
        m.addLayer({ id: 'hover-line', type: 'line', source: 'areas', layout: { 'line-join': 'round' }, paint: { 'line-color': '#e9eef8', 'line-width': 1.6, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.6, 0], 'line-opacity-transition': { duration: 120, delay: 0 } } });
        // the right answer after a failed guess: a strong outline
        m.addLayer({ id: 'target-line', type: 'line', source: 'areas', layout: { 'line-join': 'round' }, paint: { 'line-color': '#fff3c4', 'line-width': 3.2, 'line-opacity': ['case', ['==', ['feature-state', 'status'], 'target'], 1, 0], 'line-opacity-transition': { duration: 300, delay: 0 } } });
        // small areas (islands) get a clickable dot, a bit smaller when zoomed far out
        m.addLayer({ id: 'marks-circle', type: 'circle', source: 'marks', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3.5, 6, 8], 'circle-color': color as never, 'circle-stroke-color': '#e9eef8', 'circle-stroke-width': 1.2 } });
        // reveal: dashed lines from the wrong clicks to the right spot
        m.addSource('reveal', { type: 'geojson', data: empty });
        m.addLayer({ id: 'reveal-line', type: 'line', source: 'reveal', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#e9eef8', 'line-width': 2, 'line-dasharray': [2, 2] } });
        m.addLayer({ id: 'reveal-pts', type: 'circle', source: 'reveal', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#0d1530', 'circle-stroke-width': 1.5 } });
        m.on('click', onMapClick);
        m.on('move', () => {
          placeAnswer();
          placeFloats();
          placePop();
        });
        // typing mode: the input stays ready after panning/zooming the map
        m.on('moveend', focusInput);
        m.on('mousemove', (e) => {
          if (!playing || mode !== 'click') return setHover(null);
          const hit = m.queryRenderedFeatures(e.point, { layers: ['marks-circle', 'areas-fill'] })[0];
          m.getCanvas().style.cursor = hit ? 'pointer' : '';
          setHover(hit ? String(hit.properties?.id) : null);
        });
        m.on('mouseout', () => setHover(null));
        res();
      });
    });
    return mapReady;
  }

  let hoverId: string | null = null;
  function setHover(id: string | null) {
    if (id === hoverId || !map) return;
    if (hoverId !== null) map.setFeatureState({ source: 'areas', id: hoverId }, { hover: false });
    hoverId = id;
    if (id !== null) map.setFeatureState({ source: 'areas', id }, { hover: true });
  }
  function setStatus(id: string, status: Status | null) {
    for (const src of ['areas', 'marks']) {
      if (src === 'marks' && !markIds.has(id)) continue;
      map!.setFeatureState({ source: src, id }, { status });
    }
  }
  const paint = (t: Target, status: Status | null) => t.ids.forEach((id) => setStatus(id, status));
  const FIT = { padding: { top: 90, bottom: 140, left: 30, right: 30 }, maxZoom: 8 };

  // ----- game state -------------------------------------------------------------
  let mode: Mode = 'click';
  let promptFlag = false;
  let lastCfg: QuizConfig | null = null;
  let feats: Feat[] = [];
  let byId = new Map<string, Feat>();
  let markIds = new Set<string>();
  let targets: Target[] = [];
  let allCountries: Target[] = [];
  let queue: Target[] = [];
  let current: Target | null = null;
  let tries = 0;
  let playing = false;
  let found = new Set<string>();
  let firstTry = 0;
  let wrongTotal = 0;
  let t0 = 0;
  let timer = 0;
  let lookup = new Map<string, Target>();
  let bounds: BBox | null = null;
  let view: BBox = [-180, -90, 180, 90];
  let phaseNoted = false;

  const clock = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('.gm-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const scoreText = () => {
    $('.gm-score').textContent = mode === 'click' ? `${found.size} / ${targets.length} · ${firstTry} auf Anhieb` : `${found.size} / ${targets.length} gefunden`;
  };
  const say = (msg: string, kind: '' | 'ok' | 'bad' = '') => {
    feedback.textContent = msg;
    feedback.className = `gm-feedback ${kind}`;
  };
  const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  $('.gm-start').addEventListener('click', () => {
    $('.gm-err').textContent = '';
    void start({ scope: scopeSel.value, region: regionSel.value, sov: true, flag: false, mode: segVal.mode as Mode });
  });

  async function start(cfg: QuizConfig | null = lastCfg) {
    if (!cfg) return;
    lastCfg = cfg;
    mode = cfg.mode;
    promptFlag = cfg.flag;
    const errEl = $('.gm-err');
    try {
      await ensureMap();
      const scope = cfg.scope;
      let data: FeatureCollection<Geometry, Props>;
      if (scope === 'regions') data = await loadData(`admin1/${cfg.region}.json`);
      else {
        data = await loadData('countries.json');
        const sc = scopeOf(scope);
        let list = data.features as Feat[];
        // continents contain the dependencies too (Greenland is part of North America)
        if (cfg.sov || cfg.flag) list = list.filter((f) => f.properties.sov && (!cfg.flag || f.properties.flag));
        if (sc?.filter) list = list.filter((f) => sc.filter!(f.properties));
        data = { type: 'FeatureCollection', features: list };
      }
      feats = data.features as Feat[];
      if (feats.length < 2) throw new Error('zu wenige Gebiete');
      byId = new Map(feats.map((f) => [f.properties.id, f]));

      // what is asked: every country / region of the chosen area
      const countries: Target[] = feats.map((f) => ({ id: f.properties.id, kind: 'country', name: f.properties.name, en: f.properties.en, ids: [f.properties.id], feat: f }));
      allCountries = countries;
      queue = shuffle(countries);
      if (cfg.rounds) queue = queue.slice(0, cfg.rounds);
      targets = cfg.rounds ? queue.slice() : countries;
      if (targets.length < 2) throw new Error('zu wenige Gebiete');

      // tiny areas get a clickable dot
      view = scope === 'regions' ? anchorView(feats) : scopeOf(scope)?.view ?? SCOPES[0].view ?? bboxOf(feats);
      // absolute size, so big countries get no dot on the world map; tiny views (regions of a small country) stay relative
      const smallThreshold = Math.min(2, (view[2] - view[0]) / 20);
      const marks: Feature<Point>[] = feats
        .filter((f) => span(f) < Math.max(smallThreshold, 0.01))
        .map((f) => ({ type: 'Feature', properties: { id: f.properties.id }, geometry: { type: 'Point', coordinates: anchor(f) } }));
      markIds = new Set(marks.map((m) => m.properties!.id as string));
      (map!.getSource('areas') as GeoJSONSource).setData(data as FeatureCollection);
      (map!.getSource('marks') as GeoJSONSource).setData({ type: 'FeatureCollection', features: marks });
      for (const f of feats) setStatus(f.properties.id, null);

      lookup = new Map();
      for (const t of allCountries) for (const n of [t.name, t.en]) lookup.set(norm(n), t);
      bounds = view;
      map!.fitBounds(bounds, { ...FIT, duration: 800 });

      found = new Set();
      firstTry = 0;
      wrongTotal = 0;
      phaseNoted = false;
      current = null;
      playing = true;
      showPanel('none');
      result.hidden = true;
      hud.hidden = false;
      ask.hidden = mode !== 'click';
      typeForm.hidden = mode !== 'type' && !promptFlag;
      hud.classList.toggle('gm-flagmode', promptFlag);
      choicesEl.hidden = true;
      $('.gm-skip').hidden = mode !== 'click';
      t0 = Date.now();
      clearInterval(timer);
      timer = window.setInterval(clock, 500);
      clock();
      scoreText();
      say('');
      if (mode === 'click') next();
      else {
        input.value = '';
        input.focus();
        say(`${targets.length} Namen warten auf dich.`);
      }
    } catch (e) {
      errEl.textContent = `Konnte nicht starten: ${(e as Error).message}`;
      playing = false;
      hud.hidden = true;
      showPanel(promptFlag ? 'flags' : 'quiz');
    }
  }

  /** a continent that was skipped / missed is asked again before the countries start */
  function requeue(t: Target) {
    if (t.kind === 'continent') {
      const i = queue.findIndex((q) => q.kind === 'country');
      queue.splice(i < 0 ? queue.length : i, 0, t);
    } else queue.push(t);
  }

  function next() {
    if (current) paint(current, found.has(current.id) ? 'found' : null);
    const prev = current;
    current = queue.shift() ?? null;
    if (!current) return finish();
    tries = 0;
    wrongPts = [];
    // continents done → clear the map for the country round
    if (current.kind === 'country' && !phaseNoted && targets.some((t) => t.kind === 'continent')) {
      phaseNoted = true;
      for (const f of feats) setStatus(f.properties.id, null);
      map!.fitBounds(bounds!, { ...FIT, duration: 600 });
      say('Kontinente geschafft – jetzt die Länder!', 'ok');
    } else if (prev) say('');
    if (promptFlag) $('.gm-target').innerHTML = `<img class="gm-flagq" alt="Flagge" src="${DATA}flags/${current.feat!.properties.flag}.svg" />`;
    else $('.gm-target').textContent = current.name;
    $('.gm-ask small').textContent = promptFlag ? 'Zu welchem Land gehört diese Flagge?' : current.kind === 'continent' ? 'Wo liegt der Kontinent …' : 'Wo liegt …';
    if (promptFlag) {
      input.value = '';
      input.focus({ preventScroll: true });
      choicesEl.hidden = !lastCfg?.choice;
      if (lastCfg?.choice) {
        const cur = current;
        const rest = shuffle(allCountries.filter((t) => t.id !== cur.id));
        const near = rest.filter((t) => t.feat!.properties.cont === cur.feat!.properties.cont);
        const others = [...near, ...rest.filter((t) => !near.includes(t))].slice(0, 3);
        choicesEl.innerHTML = shuffle([cur, ...others]).map((t) => `<button type="button" class="btn" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join('');
      }
    }
  }

  /** the question was answered right (click, typed or picked) */
  function solved(cur: Target) {
    found.add(cur.id);
    if (tries === 0) firstTry++;
    paint(cur, 'found');
    say(tries === 0 ? 'Richtig!' : `Richtig – nach ${tries + 1} Versuchen.`, 'ok');
    scoreText();
    next();
  }
  /** a wrong typed / picked answer (wrong clicks are handled in onMapClick); the third one shows the solution */
  function failedAnswer(cur: Target) {
    tries++;
    wrongTotal++;
    if (tries >= MAX_TRIES) {
      current = null;
      reveal(cur);
    }
  }
  choicesEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || b.disabled || !playing || !current) return;
    if (b.dataset.id === current.id) return solved(current);
    b.disabled = true;
    b.classList.add('bad');
    say(`${b.textContent} ist falsch.`, 'bad');
    failedAnswer(current);
  });

  /** name of the wrongly clicked country, right at the cursor */
  const popEl = document.createElement('div');
  popEl.className = 'gm-pop';
  el.append(popEl);
  let popTimer = 0;
  /** how long the red area and its name stay (the area then fades out, see fill-color-transition) */
  const WRONG_SHOW_MS = 1500;
  let popAt: [number, number] | null = null;
  function placePop() {
    if (!popAt || !map) return;
    const pt = map.project(popAt);
    const w = el.clientWidth;
    popEl.style.left = `${Math.min(Math.max(pt.x, 80), w - 80)}px`;
    popEl.style.top = `${pt.y}px`;
    popEl.classList.toggle('below', pt.y < 70);
  }
  function pop(text: string, at: [number, number]) {
    popEl.textContent = text;
    popAt = at;
    placePop();
    popEl.classList.add('show');
    clearTimeout(popTimer);
    popTimer = window.setTimeout(() => popEl.classList.remove('show'), WRONG_SHOW_MS);
  }

  /** name of the right answer, sitting on its area and following the map while it zooms there */
  const answerEl = document.createElement('div');
  answerEl.className = 'gm-pop gm-answer';
  el.append(answerEl);
  let answerAt: [number, number] | null = null;
  let answerBox: BBox | null = null;
  function placeAnswer() {
    if (!answerAt || !map) return;
    const p = map.project(answerAt);
    answerEl.style.left = `${p.x}px`;
    answerEl.style.top = `${p.y}px`;
    // small areas (islands): the label sits above them instead of covering them
    if (answerBox) {
      const a = map.project([answerBox[0], answerBox[1]]);
      const b = map.project([answerBox[2], answerBox[3]]);
      answerEl.classList.toggle('above', Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) < 80);
    }
  }
  function showAnswer(t: Target) {
    const b = t.kind === 'continent' ? bboxOf(t.ids.map((i) => byId.get(i)!)) : null;
    answerAt = b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : anchor(t.feat!);
    answerBox = bboxOf(t.ids.map((i) => byId.get(i)!));
    answerEl.textContent = t.name;
    placeAnswer();
    answerEl.classList.add('show');
  }
  function hideAnswer() {
    answerEl.classList.remove('show');
  }
  /** the clicks of the current question that went wrong – kept for the reveal */
  let wrongPts: { ll: [number, number]; name: string }[] = [];
  /** labels pinned to map positions (names of the wrong clicks during the reveal) */
  const floats: { el: HTMLElement; at: [number, number] }[] = [];
  function placeFloats() {
    if (!map) return;
    for (const f of floats) {
      const p = map.project(f.at);
      f.el.style.left = `${p.x}px`;
      f.el.style.top = `${p.y}px`;
    }
  }
  function addFloat(text: string, at: [number, number]) {
    const e = document.createElement('div');
    e.className = 'gm-pop show';
    e.textContent = text;
    el.append(e);
    floats.push({ el: e, at });
    placeFloats();
  }
  function clearReveal() {
    floats.forEach((f) => f.el.remove());
    floats.length = 0;
    (map?.getSource('reveal') as GeoJSONSource | undefined)?.setData(empty);
  }
  const wrongTimers = new Map<string, number>();
  const wrongBefore = new Map<string, Status | null>();
  /** a wrong guess (click or typed name): the area flashes, its name floats there, and it counts as a try */
  function flashWrong(id: string, name: string, at: [number, number]) {
    tries++;
    wrongTotal++;
    // the area stays red as long as the name is shown, then fades back (fill-color-transition)
    const prev = (map!.getFeatureState({ source: 'areas', id }).status as Status | undefined) ?? null;
    const before = prev === 'wrong' ? wrongBefore.get(id) ?? null : prev;
    wrongBefore.set(id, before);
    setStatus(id, 'wrong');
    clearTimeout(wrongTimers.get(id));
    wrongTimers.set(
      id,
      window.setTimeout(() => {
        wrongBefore.delete(id);
        setStatus(id, found.has(id) ? 'found' : before);
      }, WRONG_SHOW_MS),
    );
    wrongPts.push({ ll: at, name });
    pop(name, at);
  }
  function onMapClick(e: { point: { x: number; y: number }; lngLat: { lng: number; lat: number } }) {
    if (!playing || mode !== 'click' || !current) return;
    const hit = map!.queryRenderedFeatures(e.point as never, { layers: ['marks-circle', 'areas-fill'] })[0];
    if (!hit) return;
    const id = String(hit.properties?.id);
    const clicked = byId.get(id);
    const cur = current;
    if (!clicked || (cur.kind === 'country' && found.has(id))) return;
    const ok = cur.kind === 'continent' ? clicked.properties.cont === cur.cont : id === cur.id;
    if (ok) {
      solved(cur);
    } else {
      flashWrong(id, clicked.properties.name, [e.lngLat.lng, e.lngLat.lat]);
      if (tries >= MAX_TRIES) {
        // right after the third click: colour the answer, dashed lines from all clicks, zoom so every point is in view
        const t = cur;
        current = null;
        reveal(t);
      }
    }
  }

  /** after too many wrong clicks: dashed lines from every wrong click to the right spot, zoomed so all of them are in view */
  function reveal(t: Target) {
    paint(t, 'target');
    showAnswer(t);
    popEl.classList.remove('show'); // the wrong names are pinned to their clicks now
    const goal = answerAt!;
    const pts = wrongPts;
    const feats: Feature[] = [
      ...pts.map((w) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [w.ll, goal] } })),
      ...pts.map((w) => ({ type: 'Feature' as const, properties: { color: '#ff8a3d' }, geometry: { type: 'Point' as const, coordinates: w.ll } })),
      { type: 'Feature' as const, properties: { color: '#ffd23f' }, geometry: { type: 'Point' as const, coordinates: goal } },
    ];
    (map!.getSource('reveal') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
    pts.forEach((w) => addFloat(w.name, w.ll));
    // frame the whole right country plus every click
    const own = bboxOf(t.ids.map((i) => byId.get(i)!));
    const all = [goal, ...pts.map((w) => w.ll), [own[0], own[1]], [own[2], own[3]]];
    const box: BBox = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
    map!.fitBounds(box, { ...FIT, padding: { top: 120, bottom: 160, left: 90, right: 90 }, duration: 900, maxZoom: 6 });
    current = null;
    window.setTimeout(() => {
      if (!playing) return;
      clearReveal();
      hideAnswer();
      paint(t, t.kind === 'continent' ? null : 'missed');
      requeue(t); // asked again later
      next();
      map!.fitBounds(bounds!, { ...FIT, duration: 600 });
    }, 3200);
  }

  $('.gm-skip').addEventListener('click', () => {
    if (!playing || !current) return;
    const t = current;
    current = null;
    paint(t, null);
    requeue(t);
    next();
  });

  // ----- typing mode ------------------------------------------------------------
  function focusInput() {
    if (playing && (mode === 'type' || promptFlag) && document.activeElement !== input) input.focus({ preventScroll: true });
  }
  // typing anywhere on the page goes into the input
  document.addEventListener('keydown', (e) => {
    if (el.hidden || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (/^(input|textarea|select)$/i.test((document.activeElement as HTMLElement | null)?.tagName ?? '')) return;
    focusInput();
  });
  // Esc in a settings panel goes back to the games hub
  document.addEventListener('keydown', (e) => {
    if (el.hidden || e.key !== 'Escape') return;
    const open = Array.from(panels).find(([k, p]) => k !== 'hub' && !p.hidden);
    if (!open) return;
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement && t.type === 'search' && t.value) {
      t.value = '';
      t.dispatchEvent(new Event('input'));
      return;
    }
    showPanel('hub');
  });
  typeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!playing) return;
    const q = norm(input.value);
    if (!q) return;
    if (promptFlag) {
      // flag game: the typed name has to match the current flag; the typed country lights up either way
      if (!current) return;
      let t = lookup.get(q);
      if (!t && q.length >= 6) {
        let best = 2;
        for (const [k, v] of lookup) {
          if (k.length < 6) continue;
          const d = lev(q, k);
          if (d < best) { best = d; t = v; }
        }
      }
      if (!t) {
        say(`„${input.value.trim()}“ kenne ich nicht.`, 'bad');
        input.select();
        return;
      }
      input.value = '';
      if (t.id === current.id) return solved(current);
      if (found.has(t.id)) return say(`${t.name} hattest du schon.`);
      const cur = current;
      flashWrong(t.id, t.name, anchor(t.feat!));
      if (tries >= MAX_TRIES) {
        current = null;
        reveal(cur);
      }
      return;
    }
    if (mode !== 'type') return;
    let t = lookup.get(q);
    if (!t && q.length >= 6) {
      let best = 2;
      for (const [k, v] of lookup) {
        if (k.length < 6) continue;
        const d = lev(q, k);
        if (d < best) { best = d; t = v; }
      }
    }
    if (!t) {
      say(`„${input.value.trim()}“ kenne ich nicht.`, 'bad');
      input.select();
      return;
    }
    if (found.has(t.id)) {
      say(`${t.name} hattest du schon.`);
    } else {
      found.add(t.id);
      // a typed continent tints the countries that are not found yet
      if (t.kind === 'continent') t.ids.forEach((id) => !found.has(id) && setStatus(id, 'hint'));
      else paint(t, 'found');
      say(t.name, 'ok');
      scoreText();
      if (found.size === targets.length) return finish();
    }
    input.value = '';
  });

  // ----- end ----------------------------------------------------------------------
  function finish(gaveUp = false) {
    playing = false;
    clearInterval(timer);
    clock();
    for (const t of targets) if (t.kind === 'country' && !found.has(t.id)) paint(t, 'missed');
    const missed = targets.filter((t) => !found.has(t.id));
    const time = $('.gm-time').textContent;
    const pct = Math.round((found.size / targets.length) * 100);
    result.hidden = false;
    hud.hidden = true;
    result.innerHTML = `
      <h2>${gaveUp ? 'Aufgegeben' : 'Geschafft!'}</h2>
      <div class="gm-big">${found.size} / ${targets.length} <span>(${pct} %)</span></div>
      <p>Zeit ${time}${mode === 'click' ? ` · ${firstTry} auf Anhieb · ${wrongTotal} Fehlklicks` : ''}</p>
      ${missed.length ? `<details open><summary>${missed.length} nicht gewusst</summary><p class="gm-missed">${missed.map((t) => escapeHtml(t.name)).sort((a, b) => a.localeCompare(b, 'de')).join(' · ')}</p></details>` : ''}
      <div class="gm-actions"><button class="btn btn-primary gm-again" type="button">Nochmal</button><button class="btn gm-back" type="button">Menü</button></div>`;
    result.querySelector('.gm-again')!.addEventListener('click', () => void start());
    result.querySelector('.gm-back')!.addEventListener('click', toMenu);
  }

  function toMenu() {
    playing = false;
    setHover(null);
    hideAnswer();
    clearReveal();
    clearInterval(timer);
    result.hidden = true;
    hud.hidden = true;
    showPanel(promptFlag ? 'flags' : 'quiz');
  }

  $('.gm-giveup').addEventListener('click', () => playing && finish(true));
  $('.gm-menu').addEventListener('click', toMenu);

  return {
    el,
    activate() {
      void ensureMap().then(() => map!.resize());
    },
    deactivate() {
      street?.destroy();
      street = null;
      nq?.destroy();
      nq = null;
      duel?.destroy();
      duel = null;
      clearInterval(timer);
      if (playing) toMenu();
      else if (Array.from(panels.values()).every((p) => p.hidden)) showPanel('hub');
    },
  };
}
