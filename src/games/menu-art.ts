import { DATA } from './data';

// Pictures and texts of the games hub and of the option buttons (static data).

export interface GameCard {
  id: string;
  label: string;
  tag: string;
  blurb: string;
  chips: string[];
}
export const GAME_CARDS: GameCard[] = [
  { id: 'quiz', label: 'Länder-Rater', tag: 'Karte', blurb: 'Ein Name erscheint – klick das Land auf der Weltkarte an. Oder tipp alle Namen aus dem Kopf. Auch Kontinente und Regionen.', chips: ['Anklicken', 'Eintippen', 'Regionen'] },
  { id: 'flags', label: 'Flaggen-Rater', tag: 'Flaggen', blurb: 'Welche Flagge gehört zu welchem Land?', chips: ['Auswahl', 'Eintippen', 'Karte'] },
  { id: 'capitals', label: 'Hauptstädte', tag: 'Städte', blurb: 'Land zur Hauptstadt – oder umgekehrt.', chips: ['Auswahl', 'Eintippen'] },
  { id: 'outline', label: 'Umrisse', tag: 'Formen', blurb: 'Erkennst du ein Land oder eine Region nur an ihrer Form?', chips: ['Auswahl', 'Eintippen'] },
  { id: 'size', label: 'Größenvergleich', tag: 'Maßstab', blurb: 'Welches Land ist größer – oder zieh ein Land auf die richtige Größe. Nach Fläche oder Einwohnern.', chips: ['Maßstab', 'Higher Lower'] },
  { id: 'street', label: 'Straßen-Rater', tag: '360°', blurb: 'Echte 360°-Straßenfotos – schau dich um und tippe auf der Karte, wo du stehst. 5 Runden, bis zu 5000 Punkte.', chips: ['360°', '5 Runden', 'Punkte'] },
];

/** preview picture of a game: static SVG (scripts/build-game-previews.mjs) or a fan of real flags */
export function previewHtml(id: string): string {
  if (id === 'flags') {
    const fl = ['jp', 'br', 'de', 'ca', 'za'];
    return `<div class="gm-pv gm-pv-flags">${fl.map((f, i) => `<img class="gm-pvflag f${i}" alt="" loading="lazy" src="${DATA}flags/${f}.svg" />`).join('')}</div>`;
  }
  return `<div class="gm-pv"><img alt="" loading="lazy" src="${DATA}previews/${id}.svg" /></div>`;
}

/** little picture per menu option (viewBox 160×100): see .gm-opt-pv in styles/110-games.css for the colour classes */
export const BLOB_A = 'M14 62L30 36L58 28L84 40L78 64L46 74Z';
export const BLOB_B = 'M92 30L128 24L146 44L130 70L100 62Z';
export const PIN = 'M0 12C-10-2-10-16 0-16S10-2 0 12Z';
export const OPT_ICONS: Record<string, string> = {
  click: `<path class="m" d="${BLOB_A}"/><path class="a" d="${BLOB_B}"/><path class="w" d="M118 46L118 74L126 67L131 79L137 77L132 65L142 65Z"/>`,
  type: `<rect class="o" x="14" y="36" width="132" height="30" rx="8"/><text class="t" x="26" y="57">Bras</text><rect class="a" x="62" y="44" width="2.5" height="14"/><g class="m"><rect x="14" y="76" width="34" height="9" rx="4.5"/><rect x="54" y="76" width="44" height="9" rx="4.5"/></g>`,
  choice: `<g class="m"><rect x="12" y="14" width="64" height="32" rx="7"/><rect x="84" y="14" width="64" height="32" rx="7"/><rect x="12" y="54" width="64" height="32" rx="7"/></g><rect class="a" x="84" y="54" width="64" height="32" rx="7"/><path class="wl" d="M104 70L113 78L130 62"/>`,
  map: `<rect class="w" x="12" y="14" width="46" height="32" rx="4"/><rect class="a" x="12" y="14" width="46" height="11"/><rect fill="#e5484d" x="12" y="36" width="46" height="10"/><path class="m" d="M70 46L88 30L116 26L140 38L132 66L98 78L74 68Z"/><g transform="translate(112 56)"><path class="p" d="${PIN}"/><circle fill="#fff" cy="-6" r="3.5"/></g>`,
  cap: `<path class="a" d="M10 62L26 36L52 30L72 42L66 64L36 74Z"/><path class="wl" d="M78 52H100M94 45L101 52L94 59"/><g transform="translate(130 50)"><path class="p" d="${PIN}"/><circle fill="#fff" cy="-6" r="3.5"/></g><rect class="o" x="108" y="68" width="44" height="14" rx="5"/>`,
  land: `<g transform="translate(30 50)"><path class="p" d="${PIN}"/><circle fill="#fff" cy="-6" r="3.5"/></g><rect class="o" x="8" y="68" width="44" height="14" rx="5"/><path class="wl" d="M62 52H84M78 45L85 52L78 59"/><path class="a" d="M96 62L112 36L138 30L154 42L148 64L120 74Z"/>`,
  duel: `<path class="a" d="M12 74L18 40L44 26L66 40L62 70L36 80Z"/><path class="r" d="M96 70L102 48L124 34L148 46L146 68L120 78Z"/><circle class="o" cx="80" cy="52" r="13"/><text class="t" x="80" y="57" text-anchor="middle" font-size="13">VS</text>`,
  scale: `<path class="m" d="M16 70L22 36L50 22L72 36L68 66L42 76Z"/><rect class="dash" x="76" y="20" width="70" height="60" rx="3"/><path class="a" d="M88 64L94 44L112 34L128 44L126 62L106 70Z"/><circle class="w" cx="146" cy="80" r="6"/>`,
  area: `<rect class="a" x="14" y="22" width="76" height="62" rx="4"/><rect class="r" x="104" y="54" width="42" height="30" rx="4"/><path class="wl" d="M14 14H90M14 11V17M90 11V17"/>`,
  pop: `<g class="a">${Array.from({ length: 24 }, (_, i) => `<circle cx="${18 + (i % 6) * 11}" cy="${26 + Math.floor(i / 6) * 14}" r="4"/>`).join('')}</g><g class="r">${Array.from({ length: 6 }, (_, i) => `<circle cx="${100 + (i % 3) * 14}" cy="${58 + Math.floor(i / 3) * 14}" r="4.5"/>`).join('')}</g>`,
  move1: `<path class="road" d="M70 30H90L150 90H10Z"/><path class="wl" d="M80 38V90" stroke-dasharray="6 6"/><path class="w" d="M30 20L20 30L30 40M130 20L140 30L130 40" fill="none" stroke-width="4"/>`,
  move0: `<path class="road" d="M70 30H90L150 90H10Z"/><path class="wl" d="M80 38V90" stroke-dasharray="6 6"/><g transform="translate(80 40)"><rect class="a" x="-14" y="-4" width="28" height="22" rx="4"/><path class="wl" d="M-8 -4V-12a8 8 0 0116 0V-4"/></g>`,
};
export const OPT_BASE: Record<string, string> = { mode: 'previews/quiz.svg', fhelp: 'flags/br.svg', cmode: 'previews/capitals.svg', omode: 'previews/outline.svg' };
export const OPT_OVERLAY: Record<string, string> = {
  click: '<circle class="wl" cx="92" cy="40" r="11" stroke-width="2.5" opacity=".85"/><path class="w" d="M92 40L92 70L100 63L105 76L112 73L107 60L118 60Z"/>',
  type: '<rect class="bg" x="22" y="62" width="116" height="26" rx="10"/><text class="t" x="36" y="80" font-size="14">Bras</text><rect class="a" x="76" y="69" width="2.5" height="12"/>',
  choice: '<g class="bg"><rect x="12" y="56" width="68" height="18" rx="7"/><rect x="84" y="56" width="68" height="18" rx="7"/><rect x="12" y="78" width="68" height="18" rx="7"/></g><rect class="a" x="84" y="78" width="68" height="18" rx="7"/>',
};
/** picture of a menu option: the game's map/flag image with a little overlay, or a drawing */
export const optIcon = (k: string, v: string): string => {
  if (k === 'smode' && (v === 'duel' || v === 'scale')) return `<img class="gm-opt-bg" alt="" src="${DATA}previews/${v === 'duel' ? 'higherlower' : 'scale'}.svg" />`;
  if (OPT_BASE[k] && OPT_OVERLAY[v]) return `<img class="gm-opt-bg${k === 'fmode' ? ' dim' : ''}" alt="" src="${DATA}${OPT_BASE[k]}" /><svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">${OPT_OVERLAY[v]}</svg>`;
  const d = OPT_ICONS[k === 'move' ? 'move' + v : v];
  return d ? `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">${d}</svg>` : '';
};
export const slug = (s: string) => s.toLowerCase().replace(/ /g, '-');
