/** Global Orbis button (top right) with the menu: views, Weltall submenu (NASA Eyes + planet maps), settings. */

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="orbisG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#5b3fd6"/></linearGradient><clipPath id="orbisFront"><rect x="0" y="16" width="32" height="16"/></clipPath></defs><g transform="rotate(-24 16 16)"><ellipse cx="16" cy="16" rx="14.6" ry="4.8" fill="none" stroke="#ffc533" stroke-width="1.6" opacity=".55"/><circle cx="16" cy="16" r="9" fill="url(#orbisG)"/><path d="M10 12.5c3 1.6 6-1.4 9 .3M9.4 18c3.4 1 6.2-1.6 10.4-.2" stroke="#d6ecff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".7"/><ellipse cx="16" cy="16" rx="14.6" ry="4.8" fill="none" stroke="#ffc533" stroke-width="1.6" clip-path="url(#orbisFront)"/><circle cx="30.4" cy="15.2" r="1.9" fill="#ffe08a"/></g></svg>`;

const EYES: [string, string][] = [
  ['earth', 'Erde'],
  ['mrn', 'Mars'],
  ['solar-system', 'Sonnensystem'],
  ['asteroids', 'Asteroiden'],
  ['exo', 'Exoplaneten'],
];

const BODIES: [string, [string, string][]][] = [
  ['Planeten', [['mercury', 'Merkur'], ['venus', 'Venus'], ['mars', 'Mars']]],
  [
    'Monde',
    [
      ['moon', 'Mond'], ['io', 'Io'], ['europa', 'Europa'], ['ganymede', 'Ganymed'], ['callisto', 'Callisto'], ['titan', 'Titan'], ['phobos', 'Phobos'],
      ['mimas', 'Mimas'], ['enceladus', 'Enceladus'], ['tethys', 'Tethys'], ['dione', 'Dione'], ['rhea', 'Rhea'], ['iapetus', 'Iapetus'],
    ],
  ],
  ['Asteroiden', [['vesta', 'Vesta'], ['ceres', 'Ceres'], ['ryugu', 'Ryugu']]],
];

const ICON: Record<string, string> = {
  forecast: 'M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17.5 18z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  space: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M2 12a10 4 0 1 0 20 0 10 4 0 1 0-20 0',
  games: 'M6 9h12a3 3 0 0 1 3 3v3a3 3 0 0 1-5 2l-1-1h-6l-1 1a3 3 0 0 1-5-2v-3a3 3 0 0 1 3-3z M8 11v4 M6 13h4 M16 12h.01 M18 14h.01',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h0a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chev: 'M6 9l6 6 6-6',
};
const ico = (n: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[n]}"/></svg>`;

export type NavRoute = 'forecast' | 'globe' | 'space' | 'planet' | 'games';

export interface NavMenu {
  /** mark the active view (and NASA-Eyes view / planet map body) */
  update(route: NavRoute, eyes: string | null, body: string | null): void;
  close(): void;
}

export function createNavMenu(openSettings: () => void): NavMenu {
  const root = document.createElement('div');
  root.className = 'orbis-nav';
  root.innerHTML = `
    <button type="button" class="orbis-btn" aria-label="Menü" aria-haspopup="true" aria-expanded="false" title="Menü">${LOGO}</button>
    <div class="orbis-menu" role="menu" hidden>
      <a role="menuitem" href="#/vorhersage" data-route="forecast">${ico('forecast')}Vorhersage</a>
      <a role="menuitem" href="#/" data-route="globe">${ico('globe')}Karte</a>
      <details class="om-space">
        <summary data-route="space">${ico('space')}Weltall<span class="om-chev">${ico('chev')}</span></summary>
        <div class="om-sub">
          <div class="om-h">NASA Eyes</div>
          <div class="om-chips">${EYES.map(([id, t]) => `<a role="menuitem" href="#/weltall?eyes=${id}" data-eyes="${id}">${t}</a>`).join('')}</div>
          ${BODIES.map(([cat, items]) => `<div class="om-h">${cat}</div><div class="om-chips">${items.map(([id, t]) => `<a role="menuitem" href="#/planet?body=${id}" data-body="${id}">${t}</a>`).join('')}</div>`).join('')}
        </div>
      </details>
      <a role="menuitem" href="#/spiele" data-route="games">${ico('games')}Spiele</a>
      <div class="om-sep"></div>
      <button type="button" role="menuitem" class="om-settings">${ico('gear')}Einstellungen</button>
    </div>`;
  document.body.appendChild(root);

  const btn = root.querySelector<HTMLButtonElement>('.orbis-btn')!;
  const menu = root.querySelector<HTMLElement>('.orbis-menu')!;
  const space = root.querySelector<HTMLDetailsElement>('.om-space')!;

  const setOpen = (on: boolean) => {
    menu.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
  };
  btn.addEventListener('click', () => setOpen(menu.hidden));
  root.querySelector('.om-settings')!.addEventListener('click', () => {
    setOpen(false);
    openSettings();
  });
  // choosing a destination closes the menu (the submenu stays as the user left it)
  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !root.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      btn.focus();
    }
  });

  return {
    update(route, eyes, body) {
      const view = route === 'planet' ? 'space' : route;
      root.querySelectorAll<HTMLElement>('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === view));
      root.querySelectorAll<HTMLElement>('[data-eyes]').forEach((a) => a.classList.toggle('active', route === 'space' && a.dataset.eyes === (eyes ?? 'earth')));
      root.querySelectorAll<HTMLElement>('[data-body]').forEach((a) => a.classList.toggle('active', route === 'planet' && a.dataset.body === (body ?? 'mars')));
      // the Weltall submenu opens by itself while one of its views is shown
      if (route === 'space' || route === 'planet') space.open = true;
    },
    close: () => setOpen(false),
  };
}
