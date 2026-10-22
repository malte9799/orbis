import { Map as MlMap, NavigationControl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Point, Position } from 'geojson';
import { escapeHtml, toast } from '../util';
import { store } from '../store';
import type { StreetGame } from '../games/streetguess';
import type { NameQuiz } from '../games/namequiz';
import type { SizeDuel } from '../games/sizeduel';
import type { SizeScale } from '../games/sizescale';

// Games – deliberately separate from the layer drawer of the main map: own tab, own (label-free) map.
// Country / region quiz: a name pops up and you click it ("Anklicken"), or you type all names ("Eintippen").

export interface GamesView {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
}

export type Props = { id: string; name: string; en: string; cont?: string; sub?: string; pop?: number; sov?: number; flag?: string; cap?: string[]; capEn?: string[] };
export type Feat = Feature<Geometry, Props>;
type Mode = 'click' | 'type';
type Status = 'found' | 'missed' | 'wrong' | 'target' | 'hint';

export interface Scope {
  id: string;
  label: string;
  filter?: (p: Props) => boolean;
  /** fixed map view [w, s, e, n] – the bounding box of e.g. Russia or France (Guyana) is useless */
  view?: BBox;
}

const DATA = `${import.meta.env.BASE_URL}data/games/`;
export type BBox = [number, number, number, number];
export const SCOPES: Scope[] = [
  { id: 'world', label: 'Welt', view: [-168, -56, 180, 80] },
  { id: 'Europe', view: [-25, 34, 45, 72], label: 'Europa', filter: (p) => p.cont === 'Europe' },
  { id: 'Asia', view: [25, -11, 150, 55], label: 'Asien', filter: (p) => p.cont === 'Asia' },
  { id: 'Africa', view: [-20, -36, 53, 38], label: 'Afrika', filter: (p) => p.cont === 'Africa' },
  { id: 'North America', view: [-170, 7, -50, 72], label: 'Nordamerika', filter: (p) => p.cont === 'North America' },
  { id: 'South America', view: [-83, -56, -34, 13], label: 'Südamerika', filter: (p) => p.cont === 'South America' },
  { id: 'Oceania', view: [110, -48, 180, 0], label: 'Ozeanien', filter: (p) => p.cont === 'Oceania' },
];
const MAX_TRIES = 3;

/** continents as quiz targets (Natural Earth names → German, English) */
const CONTINENTS: { key: string; de: string; en: string }[] = [
  { key: 'Europe', de: 'Europa', en: 'Europe' },
  { key: 'Asia', de: 'Asien', en: 'Asia' },
  { key: 'Africa', de: 'Afrika', en: 'Africa' },
  { key: 'North America', de: 'Nordamerika', en: 'North America' },
  { key: 'South America', de: 'Südamerika', en: 'South America' },
  { key: 'Oceania', de: 'Ozeanien', en: 'Oceania' },
];

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
  /** map variant of the flag game: the question is a flag instead of a name */
  flag: boolean;
  mode: Mode;
}

export const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0d1530' } }],
};

/** lower case, no diacritics, ß→ss, only letters/digits */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function eachPos(g: Geometry, fn: (p: Position) => void) {
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') fn(c as Position);
    else (c as unknown[]).forEach(walk);
  };
  if (g.type !== 'GeometryCollection') walk(g.coordinates);
}

export function bboxOf(fs: Feat[]): BBox {
  const b: BBox = [180, 90, -180, -90];
  for (const f of fs)
    eachPos(f.geometry, (p) => {
      b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]);
    });
  return b;
}

/** bounding box of the feature's biggest part */
function mainBox(f: Feat): BBox {
  const g = f.geometry;
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let best: BBox = [0, 0, 0, 0];
  let area = -1;
  for (const p of parts) {
    const xs = p[0].map((q) => q[0]);
    const ys = p[0].map((q) => q[1]);
    const b: BBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const a = (b[2] - b[0]) * (b[3] - b[1]);
    if (a > area) { area = a; best = b; }
  }
  return best;
}

/** a point inside/near the feature: centre of its biggest part's bounding box */
function anchor(f: Feat): [number, number] {
  const b = mainBox(f);
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

/** bbox around the biggest part of every feature – unlike the real bbox it ignores far-flung parts (Aleutians crossing the antimeridian) */
function anchorView(fs: Feat[]): BBox {
  const boxes = fs.map(mainBox);
  const pad = 1.5;
  return [Math.min(...boxes.map((b) => b[0])) - pad, Math.min(...boxes.map((b) => b[1])) - pad, Math.max(...boxes.map((b) => b[2])) + pad, Math.max(...boxes.map((b) => b[3])) + pad];
}

/** span (degrees) of the biggest single part – an archipelago like Hawaii is as hard to spot as its biggest island */
function span(f: Feat): number {
  const g = f.geometry;
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let best = 0;
  for (const p of parts) {
    const xs = p[0].map((q) => q[0]);
    const ys = p[0].map((q) => q[1]);
    best = Math.max(best, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  return best;
}

const cache = new Map<string, Promise<FeatureCollection<Geometry, Props>>>();
export function loadData(file: string) {
  let p = cache.get(file);
  if (!p) {
    p = fetch(DATA + file).then((r) => {
      if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

interface GameCard {
  id: string;
  label: string;
  tag: string;
  blurb: string;
  chips: string[];
}
const GAME_CARDS: GameCard[] = [
  { id: 'quiz', label: 'Länder-Rater', tag: 'Karte', blurb: 'Ein Name erscheint – klick das Land auf der Weltkarte an. Oder tipp alle Namen aus dem Kopf. Auch Kontinente und Regionen.', chips: ['Anklicken', 'Eintippen', 'Regionen'] },
  { id: 'flags', label: 'Flaggen-Rater', tag: 'Flaggen', blurb: 'Welche Flagge gehört zu welchem Land?', chips: ['Auswahl', 'Eintippen', 'Karte'] },
  { id: 'capitals', label: 'Hauptstädte', tag: 'Städte', blurb: 'Land zur Hauptstadt – oder umgekehrt.', chips: ['Auswahl', 'Eintippen'] },
  { id: 'outline', label: 'Umrisse', tag: 'Formen', blurb: 'Erkennst du ein Land oder eine Region nur an ihrer Form?', chips: ['Auswahl', 'Eintippen'] },
  { id: 'size', label: 'Größenvergleich', tag: 'Maßstab', blurb: 'Welches Land ist größer – oder zieh ein Land auf die richtige Größe. Nach Fläche oder Einwohnern.', chips: ['Duell', 'Maßstab'] },
  { id: 'street', label: 'Straßen-Rater', tag: 'Straßenfotos', blurb: 'Ein zufälliges Straßenfoto – tippe auf der Karte, wo es aufgenommen wurde. 5 Runden, bis zu 5000 Punkte.', chips: ['5 Runden', 'Punkte'] },
];

/** preview picture of a game: static SVG (scripts/build-game-previews.mjs) or a fan of real flags */
function previewHtml(id: string): string {
  if (id === 'flags') {
    const fl = ['jp', 'br', 'de', 'ca', 'za'];
    return `<div class="gm-pv gm-pv-flags">${fl.map((f, i) => `<img class="gm-pvflag f${i}" alt="" loading="lazy" src="${DATA}flags/${f}.svg" />`).join('')}</div>`;
  }
  return `<div class="gm-pv"><img alt="" loading="lazy" src="${DATA}previews/${id}.svg" /></div>`;
}

const regionIndexP: { p: Promise<{ id: string; name: string; n: number }[]> | null } = { p: null };
function loadRegionIndex() {
  regionIndexP.p ??= fetch(`${DATA}admin1/index.json`).then((r) => {
    if (!r.ok) throw new Error('Regionsliste konnte nicht geladen werden');
    return r.json();
  });
  regionIndexP.p.catch(() => (regionIndexP.p = null));
  return regionIndexP.p;
}

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
        <small class="gm-note gm-scope-note"></small>
      </div>
      <label class="gm-check"><input type="checkbox" class="gm-sov" checked /> Nur souveräne Staaten (ohne Gebiete wie Grönland oder Puerto Rico)</label>
      <button class="btn btn-primary gm-start" type="button">Spiel starten</button>
      <p class="gm-note gm-err"></p>
      <p class="gm-note">Kartendaten: Natural Earth (gemeinfrei).</p>
    </div>

    <div class="gm-panel" data-game="flags" hidden>
      <div class="gm-games"></div>
      <h2>Flaggen-Rater</h2>
      <p class="gm-lead">Welche Flagge gehört zu welchem Land?</p>
      <div class="gm-field"><span>Spielart</span>
        <div class="gm-seg fg-modes" data-k="fmode">
          <button type="button" data-v="choice" class="on">Auswahl<small>4 Antworten</small></button>
          <button type="button" data-v="type">Eintippen<small>Name selbst schreiben</small></button>
          <button type="button" data-v="map">Auf der Karte<small>Land anklicken</small></button>
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
      <p class="gm-lead">Wie groß ist ein Land im Vergleich zu einem anderen? Im Duell werden die Paare mit der Zeit immer knapper.</p>
      <div class="gm-field"><span>Spielart</span>
        <div class="gm-seg" data-k="smode">
          <button type="button" data-v="duel" class="on">Duell<small>Zwei Gebiete – welches ist größer?</small></button>
          <button type="button" data-v="scale">Maßstab<small>Ein Gebiet fest, das andere ziehst du auf die richtige Größe</small></button>
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
      <div class="gm-field"><span>Runden</span><select class="sz-rounds"><option value="10">10 Runden</option><option value="20">20 Runden</option><option value="5">5 Runden</option><option value="0" class="sz-endless">Bis zum ersten Fehler (Duell)</option></select></div>
      <button class="btn btn-primary sz-start" type="button">Spiel starten</button>
      <p class="gm-note sz-err"></p>
      <p class="gm-note">Flächen aus den Grenzdaten berechnet (Natural Earth), daher nur ungefähr.</p>
    </div>

    <div class="gm-panel" data-game="street" hidden>
      <div class="gm-games"></div>
      <h2>Straßen-Rater</h2>
      <p class="gm-lead">Du siehst ein zufälliges Straßenfoto und tippst auf der Karte, wo es ist. 5 Runden, bis zu 5000 Punkte pro Runde.</p>
      <div class="gm-field"><span>Gebiet</span><select class="sg-scope"></select></div>
      <div class="gm-field"><span>Bewegung</span>
        <div class="gm-seg" data-k="move">
          <button type="button" data-v="1" class="on">Frei<small>Du kannst dich umsehen und weiterfahren</small></button>
          <button type="button" data-v="0">Gesperrt<small>Nur umschauen und zoomen</small></button>
        </div>
      </div>
      <div class="gm-field"><span>Mapillary-Token (kostenlos)</span>
        <input class="gm-input sg-token" type="password" placeholder="MLY|…" autocomplete="off" spellcheck="false" />
        <small class="gm-note">Client-Token aus <a href="https://www.mapillary.com/dashboard/developers" target="_blank" rel="noopener">mapillary.com/dashboard/developers</a> (Anwendung registrieren). Bleibt nur in diesem Browser gespeichert.</small>
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
  for (const [id, p] of panels) {
    if (id === 'hub') continue;
    const bar = p.querySelector('.gm-games')!;
    bar.outerHTML = `${previewHtml(id).replace('class="gm-pv', 'class="gm-pv gm-banner')}<button type="button" class="gm-backhub">← Alle Spiele</button>`;
    p.querySelector('.gm-backhub')!.addEventListener('click', () => showPanel('hub'));
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
  scopeSel.innerHTML = [`<option value="world">${SCOPES[0].label}</option>`, '<option value="continents">Kontinente</option>', ...SCOPES.slice(1).map((s) => `<option value="${s.id}">${s.label}</option>`), REGIONS_OPT].join('');
  const sovBox = $<HTMLInputElement>('.gm-sov');
  const SCOPE_NOTE: Record<string, string> = {
    world: 'Erst die 6 Kontinente, danach alle Länder – in einem Durchgang.',
    continents: 'Nur die 6 Kontinente.',
  };

  /** "Regionen eines Landes …" shows a country picker (list loaded on demand) */
  function bindRegions(scope: HTMLSelectElement, region: HTMLSelectElement, onChange?: () => void) {
    scope.addEventListener('change', async () => {
      const regions = scope.value === 'regions';
      region.hidden = !regions;
      onChange?.();
      if (regions && !region.options.length) {
        try {
          const sorted = [...(await loadRegionIndex())].sort((a, b) => a.name.localeCompare(b.name, 'de'));
          region.innerHTML = sorted.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.n})</option>`).join('');
          region.value = sorted.some((c) => c.id === 'DE') ? 'DE' : sorted[0].id;
        } catch (e) {
          region.hidden = true;
          scope.value = 'world';
          toast((e as Error).message, 'error');
        }
      }
    });
  }
  const regionSel = $<HTMLSelectElement>('.gm-region');
  bindRegions(scopeSel, regionSel, () => {
    sovBox.parentElement!.hidden = scopeSel.value === 'regions';
    $('.gm-scope-note').textContent = SCOPE_NOTE[scopeSel.value] ?? '';
  });
  $('.gm-scope-note').textContent = SCOPE_NOTE[scopeSel.value] ?? '';
  bindRegions($<HTMLSelectElement>('.ol-scope'), $<HTMLSelectElement>('.ol-region'));
  bindRegions($<HTMLSelectElement>('.sz-scope'), $<HTMLSelectElement>('.sz-region'));

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
    if (segVal.fmode === 'map') {
      showPanel('none');
      void start({ scope: val('.fg-scope'), sov: true, flag: true, mode: 'click' });
      return;
    }
    void launchNameQuiz('flags', '.fg-err', async () => {
      const { flagItems } = await import('../games/quizitems');
      return { items: await flagItems(val('.fg-scope')), mode: segVal.fmode as 'choice' | 'type', rounds: Number(val('.fg-rounds')), placeholder: 'Welches Land?' };
    });
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
    const token = tokenInput.value.trim();
    const err = $('.sg-err');
    if (!token) {
      err.textContent = 'Bitte zuerst einen Mapillary-Token eintragen.';
      return;
    }
    store.setKeys({ ...store.getKeys(), mapillary: token });
    err.textContent = 'Lade …';
    try {
      const { startStreetGame } = await import('../games/streetguess');
      street?.destroy();
      showPanel('none');
      err.textContent = '';
      street = await startStreetGame(host, { token, scope: val('.sg-scope'), move: segVal.move === '1', rounds: 5 }, leaveStreet);
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
        m.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': color as never, 'fill-opacity': 0.95 } });
        m.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#0d1530', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2] } });
        m.addLayer({ id: 'marks-circle', type: 'circle', source: 'marks', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 6, 8], 'circle-color': color as never, 'circle-stroke-color': '#e9eef8', 'circle-stroke-width': 1.2 } });
        m.on('click', onMapClick);
        // typing mode: the input stays ready after panning/zooming the map
        m.on('moveend', focusInput);
        m.on('mousemove', (e) => {
          if (!playing || mode !== 'click') return;
          m.getCanvas().style.cursor = m.queryRenderedFeatures(e.point, { layers: ['marks-circle', 'areas-fill'] }).length ? 'pointer' : '';
        });
        res();
      });
    });
    return mapReady;
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
    void start({ scope: scopeSel.value, region: regionSel.value, sov: sovBox.checked, flag: false, mode: segVal.mode as Mode });
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
        const sc = SCOPES.find((s) => s.id === scope);
        let list = data.features as Feat[];
        // continents contain the dependencies too (Greenland is part of North America)
        if ((cfg.sov && scope !== 'continents') || cfg.flag) list = list.filter((f) => f.properties.sov && (!cfg.flag || f.properties.flag));
        if (sc?.filter) list = list.filter((f) => sc.filter!(f.properties));
        data = { type: 'FeatureCollection', features: list };
      }
      feats = data.features as Feat[];
      if (feats.length < 2) throw new Error('zu wenige Gebiete');
      byId = new Map(feats.map((f) => [f.properties.id, f]));

      // what is asked: continents (world / continents) and countries (everything but "continents")
      const countries: Target[] = scope === 'continents' ? [] : feats.map((f) => ({ id: f.properties.id, kind: 'country', name: f.properties.name, en: f.properties.en, ids: [f.properties.id], feat: f }));
      const conts: Target[] =
        (scope === 'continents' || (scope === 'world' && cfg.mode === 'click')) && !cfg.flag
          ? CONTINENTS.map((c) => ({ id: `c:${c.key}`, kind: 'continent' as const, name: c.de, en: c.en, cont: c.key, ids: feats.filter((f) => f.properties.cont === c.key).map((f) => f.properties.id) })).filter((c) => c.ids.length)
          : [];
      targets = [...conts, ...countries];
      if (targets.length < 2) throw new Error('zu wenige Gebiete');

      // tiny areas get a clickable dot
      view = scope === 'regions' ? anchorView(feats) : SCOPES.find((x) => x.id === scope)?.view ?? SCOPES[0].view ?? bboxOf(feats);
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
      for (const t of targets) for (const n of [t.name, t.en]) lookup.set(norm(n), t);
      bounds = view;
      map!.fitBounds(bounds, { ...FIT, duration: 800 });

      found = new Set();
      firstTry = 0;
      wrongTotal = 0;
      phaseNoted = false;
      current = null;
      // click mode: continents first (shuffled), then the countries (shuffled)
      queue = [...shuffle(conts), ...shuffle(countries)];
      playing = true;
      showPanel('none');
      result.hidden = true;
      hud.hidden = false;
      ask.hidden = mode !== 'click';
      typeForm.hidden = mode !== 'type';
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
        say(`${targets.length} Namen warten auf dich${conts.length && countries.length ? ' (Kontinente und Länder)' : ''}.`);
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
  }

  function onMapClick(e: { point: { x: number; y: number } }) {
    if (!playing || mode !== 'click' || !current) return;
    const hit = map!.queryRenderedFeatures(e.point as never, { layers: ['marks-circle', 'areas-fill'] })[0];
    if (!hit) return;
    const id = String(hit.properties?.id);
    const clicked = byId.get(id);
    const cur = current;
    if (!clicked || (cur.kind === 'country' && found.has(id))) return;
    const ok = cur.kind === 'continent' ? clicked.properties.cont === cur.cont : id === cur.id;
    if (ok) {
      found.add(cur.id);
      if (tries === 0) firstTry++;
      paint(cur, 'found');
      say(tries === 0 ? 'Richtig!' : `Richtig – nach ${tries + 1} Versuchen.`, 'ok');
      scoreText();
      next();
    } else {
      tries++;
      wrongTotal++;
      const before = (map!.getFeatureState({ source: 'areas', id }).status as Status | undefined) ?? null;
      setStatus(id, 'wrong');
      window.setTimeout(() => setStatus(id, found.has(id) ? 'found' : before === 'wrong' ? null : before), 600);
      say(`Das war ${clicked.properties.name}.`, 'bad');
      if (tries >= MAX_TRIES) reveal(cur);
    }
  }

  /** after too many wrong clicks: show the answer, then move on */
  function reveal(t: Target) {
    paint(t, 'target');
    if (t.kind === 'continent') map!.fitBounds(bboxOf(t.ids.map((i) => byId.get(i)!)), { ...FIT, duration: 700, maxZoom: 5 });
    else {
      const [lng, lat] = anchor(t.feat!);
      map!.easeTo({ center: [lng, lat], zoom: Math.max(map!.getZoom(), 3), duration: 700 });
    }
    say(`${t.kind === 'continent' ? 'Das ist' : 'Hier liegt'} ${t.name}.`, 'bad');
    current = null;
    window.setTimeout(() => {
      if (!playing) return;
      paint(t, t.kind === 'continent' ? null : 'missed');
      requeue(t); // asked again later
      next();
      map!.fitBounds(bounds!, { ...FIT, duration: 600 });
    }, 1500);
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
    if (playing && mode === 'type' && document.activeElement !== input) input.focus({ preventScroll: true });
  }
  // typing anywhere on the page goes into the input
  document.addEventListener('keydown', (e) => {
    if (el.hidden || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (/^(input|textarea|select)$/i.test((document.activeElement as HTMLElement | null)?.tagName ?? '')) return;
    focusInput();
  });
  typeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!playing || mode !== 'type') return;
    const q = norm(input.value);
    if (!q) return;
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
