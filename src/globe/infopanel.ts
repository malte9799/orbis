import { escapeHtml, safeUrl } from '../util';
import { t } from '../i18n';
import { glyphSvg, type GlyphId } from './icons';
import { category, routeHero, tile } from './sidepanel';
import './flightpanel.css';

// Right-hand panel for static detail cards (same layout as the flight, ship and sonde panel):
// title, optional route hero, value tiles, collapsible categories and a link to the source site.

export interface InfoPanelData {
  glyph: GlyphId;
  color: string;
  title: string;
  subtitle?: string;
  /** big "from → to" line under the header */
  hero?: { from: string; to: string; fromSub?: string; toSub?: string; note?: string };
  tiles?: [label: string, value: string][];
  /** collapsible categories; `rows` values are escaped, `href` makes a value a link */
  sections?: { key: string; title: string; open?: boolean; rows: { k: string; v: string; href?: string }[] }[];
  note?: string;
  /** button at the bottom that opens the website for more details */
  link?: { label: string; url: string };
}

export class InfoPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private actions: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private head: HTMLElement;
  private ic: HTMLElement;
  /** called when the panel opens, so the other panels can step aside */
  onOpen?: () => void;

  constructor(parent: HTMLElement) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic"></i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="${t('hud.close')}">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions"></div>`;
    parent.append(this.root);
    this.head = this.root.querySelector('.fp-head')!;
    this.ic = this.root.querySelector('.fp-ic')!;
    this.title = this.root.querySelector('.fp-title')!;
    this.sub = this.root.querySelector('.fp-sub')!;
    this.body = this.root.querySelector('.fp-body')!;
    this.actions = this.root.querySelector('.fp-actions')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
  }

  open(d: InfoPanelData) {
    this.head.style.setProperty('--c', d.color);
    this.ic.innerHTML = glyphSvg(d.glyph, d.color, 30);
    this.title.textContent = d.title;
    this.sub.textContent = d.subtitle ?? '';
    this.sub.hidden = !d.subtitle;
    const open = new Set((d.sections ?? []).filter((s) => s.open).map((s) => s.key));
    const hero = d.hero
      ? routeHero({
          from: { code: d.hero.from, sub: d.hero.fromSub ?? '' },
          to: { code: d.hero.to, sub: d.hero.toSub ?? '' },
          progress: 1,
          mark: '',
          color: d.color,
          note: escapeHtml(d.hero.note ?? ''),
        })
      : '';
    const tiles = d.tiles?.length ? `<div class="sp-tiles">${d.tiles.map(([k, v]) => tile(escapeHtml(k), escapeHtml(v))).join('')}</div>` : '';
    const cats = (d.sections ?? [])
      .map((s) =>
        category(
          s.key,
          escapeHtml(s.title),
          s.rows.map((r) => {
            const href = safeUrl(r.href);
            return [escapeHtml(r.k), href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.v)} ↗</a>` : escapeHtml(r.v)];
          }),
          open,
        ),
      )
      .join('');
    this.body.innerHTML = `${hero}${tiles}${cats}${d.note ? `<div class="fp-note">${escapeHtml(d.note)}</div>` : ''}`;
    this.body.scrollTop = 0;
    const url = safeUrl(d.link?.url);
    this.actions.hidden = !url;
    this.actions.innerHTML = url ? `<a class="fp-link full" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.link!.label)} ↗</a>` : '';
    this.root.hidden = false;
    this.onOpen?.();
  }

  close() {
    this.root.hidden = true;
  }
}
