// Right-hand panel for the selected region of the "Wahlen" layer (same glass look as the
// flight/ship panels): winner, turnout, all parties with votes as bar rows and a link to
// the source. Follows the timeline: moving it updates the shown election.
import { escapeHtml as esc, fmt } from '../util';
import { glyphSvg } from './icons';
import { tile } from './sidepanel';
import {
  partyColor,
  partyLabel,
  subscribeWahlen,
  wahlenAnchorLabel,
  wahlenInfoAt,
  winnerOf,
} from '../api/wahlen';
import './wahlenpanel.css';

const COLOR = '#a626a4';
const pct = (v: number) => v.toFixed(1).replace('.', ',') + ' %';

export class WahlPanel {
  private root = document.createElement('aside');
  private subEl: HTMLElement;
  private bodyEl: HTMLElement;
  private region: string | null = null;
  private name: string | null = null;

  constructor(parent: HTMLElement) {
    this.root.className = 'fp wp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic" style="color:${COLOR}">${glyphSvg('vote', 'currentColor', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="wp-body"></div>
      <div class="fp-note wp-src">Daten: <a class="fp-link" href="https://german-elections.com" target="_blank" rel="noopener noreferrer">GERDA – German Election Database</a> (CC BY 4.0)</div>`;
    parent.append(this.root);
    this.subEl = this.root.querySelector('.fp-sub')!;
    this.bodyEl = this.root.querySelector('.wp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    // Zeitstrahl bewegt: geöffnete Ansicht folgt (Wahl, Sieger, Balken)
    subscribeWahlen(() => {
      if (this.region) this.render();
    });
  }

  open(region: string, name: string) {
    this.region = region;
    this.name = name || region;
    this.root.querySelector<HTMLElement>('.fp-title')!.textContent = this.name;
    this.root.hidden = false;
    this.render();
  }

  close() {
    this.region = null;
    this.root.hidden = true;
  }

  private render() {
    if (!this.region) return;
    const info = wahlenInfoAt(this.region);
    if (!info) {
      this.subEl.innerHTML = `<b>Wahlergebnisse</b>`;
      this.bodyEl.innerHTML = `<div class="fp-note">Für dieses Gebiet liegt vor dem gewählten Termin keine Wahl in den Daten (Abdeckung ab 1990).</div>`;
      return;
    }
    const { res } = info;
    const total = Math.max(1, res.p.reduce((s, [, v]) => s + v, 0));
    const w = winnerOf(res);
    const rows = [...res.p]
      .sort((a, b) => b[1] - a[1])
      .map(([id, v]) => {
        const p = (v / total) * 100;
        const win = w?.[0] === id;
        return `<div class="wp-row${win ? ' win' : ''}">
          <div class="wp-top"><i class="wp-dot" style="background:${partyColor(id)}"></i><span>${esc(partyLabel(id))}</span><b>${pct(p)}</b></div>
          <div class="wp-bar"><i style="width:${p.toFixed(1)}%;background:${partyColor(id)}"></i></div>
          <small class="wp-votes">${win ? 'Sieger · ' : ''}${fmt.num(Math.round(v))} Stimmen</small>
        </div>`;
      })
      .join('');
    const isAnchor = `${info.election} · ${info.date}` === wahlenAnchorLabel();
    this.subEl.innerHTML = `<b>${esc(info.election)}</b> · ${esc(info.date)}${isAnchor ? '' : ' <span class="wp-hint">(letzte Wahl vor dem gewählten Termin)</span>'}`;
    this.bodyEl.innerHTML = `
      <div class="sp-tiles">
        ${tile('Sieger', esc(partyLabel(w?.[0] ?? '–')), {})}
        ${tile('Beteiligung', res.b != null ? esc(res.b.toFixed(1).replace('.', ',')) + ' %' : '–', {})}
      </div>
      <div class="wp-bars">${rows}</div>`;
  }
}
