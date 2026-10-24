import { catalogOf } from '../hud/catalog';
import type { Hud } from '../hud/hud';
import { ico } from '../hud/icons';
import { escapeHtml as esc } from '../util';

// The Infrastruktur view: the infrastructure catalog of the map on its own page. Every entry is a
// toggle that switches the layer on the active Karte (the HUD state), with a button to open the map.

export interface InfraView {
  el: HTMLElement;
  activate(): void;
  deactivate(): void;
}

/** the catalog ids shown in a section (labels, hints and icons come from the catalog) */
const ENERGY = ['wind', 'solar', 'water', 'nuclear', 'coal', 'gas', 'oil', 'biomass', 'plants'];
const NETS = ['cables', 'pipelines'];
const MEDIA = ['radio'];
const WATCH = ['webcams', 'alpr'];

/** the Rohstoffe categories in groups – become the filter value of the resources layer */
const RES_GROUPS: { label: string; cats: string[] }[] = [
  { label: 'Öl', cats: ['oil'] },
  { label: 'Gas', cats: ['gas'] },
  { label: 'Kohle', cats: ['coal'] },
  { label: 'Erze & Metalle', cats: ['iron', 'gold', 'copper', 'lithium', 'uranium', 'metal', 'gem'] },
  { label: 'Steine & Salze', cats: ['stone', 'salt', 'other'] },
];
const ALL_RES = RES_GROUPS.flatMap((g) => g.cats);

export function createInfraView(deps: { hud: () => Hud | null; onOpenKarte: () => void }): InfraView {
  const el = document.createElement('main');
  el.className = 'view infra-view';
  el.innerHTML = `
    <div class="if-body">
      <nav class="if-side" aria-label="Infrastruktur-Bereiche"></nav>
      <div class="if-main"></div>
    </div>`;

  const hud = () => deps.hud();
  const side = el.querySelector<HTMLElement>('.if-side')!;
  const main = el.querySelector<HTMLElement>('.if-main')!;

  const on = (id: string) => hud()?.layerOn(id) ?? false;

  function sideNav() {
    side.innerHTML = ['energie', 'rohstoffe', 'netze', 'radio', 'ueberwachung']
      .map((s) => `<a href="#if-${s}" data-sid="${s}">${secTitle(s)}</a>`)
      .join('');
    side.querySelectorAll<HTMLAnchorElement>('a[data-sid]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        main.querySelector<HTMLElement>(`#if-${CSS.escape(a.dataset.sid!)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.matchMedia('(max-width: 900px)').matches) el.classList.remove('menu-open');
      }),
    );
  }

  const SEC_TITLES: Record<string, string> = {
    energie: 'Energie',
    rohstoffe: 'Rohstoffe',
    netze: 'Netze',
    radio: 'Radio',
    ueberwachung: 'Überwachung',
  };
  const secTitle = (id: string) => SEC_TITLES[id] ?? id;

  /** one toggle row: catalog glyph, label + hint, live count when on, switch */
  function row(id: string): string {
    const c = catalogOf(id);
    if (!c) return '';
    const isOn = on(id);
    const n = isOn ? hud()?.info(id).count ?? null : null;
    const count = n != null && n > 0 ? `<span class="if-count">${n.toLocaleString('de-DE')}</span>` : '';
    return `
      <div class="if-row ${isOn ? 'on' : ''}">
        <span class="g" style="background:${c.color}">${ico(c.icon, 1.6)}</span>
        <div class="tx"><b>${esc(c.label)}</b>${c.region ? `<span class="tagr">${esc(c.region)}</span>` : ''}${count}<small>${esc(c.hint)}</small></div>
        <button type="button" class="sw" data-act="tgl" data-id="${esc(id)}" role="switch" aria-checked="${isOn}" aria-label="${esc(c.label)}"><i></i></button>
      </div>`;
  }

  /** the Rohstoffe group chips: master toggle plus per-group refinement (layer filter) */
  function resRows(): string {
    const isOn = on('resources');
    const active = new Set((hud()?.layerFilter('resources') ?? '').split(',').filter(Boolean));
    const all = !active.size;
    const chips = RES_GROUPS.map((g) => {
      const set = isOn && active.size ? g.cats.every((c) => active.has(c)) : false;
      return `<button type="button" class="rchip ${set ? 'on' : ''}" data-act="resg" data-cats="${esc(g.cats.join(','))}" role="switch" aria-checked="${set}" ${isOn ? '' : 'disabled'}>${esc(g.label)}</button>`;
    }).join('');
    return `
      ${row('resources')}
      <div class="if-res">${chips}
        <small>${isOn ? (all ? 'Sämtliche Rohstoffe an – Gruppen abwählen zum Einschränken.' : 'Schränke ein, welche Rohstoffe gezeigt werden.') : 'Erst Rohstoffe einschalten.'}</small>
      </div>`;
  }

  const SECTIONS = [
    { id: 'energie', rows: ENERGY },
    { id: 'rohstoffe' },
    { id: 'netze', rows: NETS },
    { id: 'radio', rows: MEDIA },
    { id: 'ueberwachung', rows: WATCH },
  ];

  function section(s: (typeof SECTIONS)[number]): string {
    const rowsHtml = s.id === 'rohstoffe' ? resRows() : s.rows!.map(row).join('');
    return `<section id="if-${esc(s.id)}" class="if-sec"><h3>${esc(secTitle(s.id))}</h3><div class="card if-rows">${rowsHtml}</div></section>`;
  }

  function render() {
    const kname = hud()?.currentName() ?? 'Karte';
    sideNav();
    main.innerHTML = `
      <header class="if-head">
        <div><h2>Infrastruktur</h2>
          <small>Energie, Rohstoffe, Netze und Kameras der Welt – jeder Schalter legt die Ebene auf der Karte <b>${esc(kname)}</b> an oder weg.</small></div>
        <button type="button" class="btn if-map" data-act="karte">${MAP_SVG()}Auf der Karte öffnen</button>
      </header>
      ${SECTIONS.map(section).join('')}
      <p class="if-note small muted">Die Schalter verändern die aktuell geöffnete Karte im HUD – zur Voransicht einfach „Auf der Karte öffnen“ drücken.</p>`;
    bind();
  }

  function bind() {
    main.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const h = hud();
        if (!h) return;
        if (b.dataset.act === 'karte') deps.onOpenKarte();
        else if (b.dataset.act === 'tgl') {
          const id = b.dataset.id!;
          h.toggleLayer(id, !h.layerOn(id));
          render();
        } else if (b.dataset.act === 'resg') {
          const set = new Set((h.layerFilter('resources') ?? '').split(',').filter(Boolean));
          for (const c of b.dataset.cats!.split(',')) if (set.has(c)) set.delete(c); else set.add(c);
          // nothing left → sie wie den Hauptschalter aus; alles an → kein Filter
          const remaining = ALL_RES.filter((c) => set.has(c));
          if (!remaining.length) h.toggleLayer('resources', false);
          else h.setLayerFilter('resources', remaining.length === ALL_RES.length ? null : remaining.join(','));
          render();
        }
      }),
    );
  }

  return {
    el,
    activate() {
      render();
    },
    deactivate() {},
  };
}

const MAP_SVG = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" width="17" height="17" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>`;
