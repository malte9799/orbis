import { searchPlaces } from './api/openmeteo';
import type { Place } from './store';
import { debounce, escapeHtml } from './util';

/** Place search box with suggestion list and keyboard navigation. */
export function createSearch(onSelect: (p: Place) => void, placeholder = 'Ort suchen …'): HTMLElement {
  const root = document.createElement('div');
  root.className = 'search';
  root.innerHTML = `
    <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
    <input type="search" placeholder="${escapeHtml(placeholder)}" autocomplete="off" spellcheck="false"
      role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="Ort suchen"/>
    <ul class="suggestions" role="listbox" hidden></ul>`;
  const input = root.querySelector('input')!;
  const list = root.querySelector('ul')!;
  let results: Place[] = [];
  let active = -1;
  let seq = 0;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };
  const render = () => {
    list.innerHTML = results.length
      ? results
          .map(
            (r, i) => `<li role="option" data-i="${i}" class="${i === active ? 'active' : ''}" aria-selected="${i === active}">
              <span class="s-name">${escapeHtml(r.name)}</span>
              <span class="s-meta">${escapeHtml([r.region, r.country].filter(Boolean).join(', '))}</span>
            </li>`,
          )
          .join('')
      : `<li class="empty">Keine Treffer</li>`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const choose = (i: number) => {
    const p = results[i];
    if (!p) return;
    input.value = '';
    close();
    input.blur();
    onSelect(p);
  };

  const run = debounce(async (q: string) => {
    const my = ++seq;
    try {
      const r = await searchPlaces(q);
      if (my !== seq) return;
      results = r;
      active = r.length ? 0 : -1;
      render();
    } catch {
      if (my === seq) {
        results = [];
        list.innerHTML = `<li class="empty">Suche nicht verfügbar</li>`;
        list.hidden = false;
      }
    }
  }, 250);

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) {
      seq++;
      close();
      return;
    }
    run(q);
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden || !results.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(Math.max(0, active));
    } else if (e.key === 'Escape') {
      close();
    }
  });
  list.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('li[data-i]');
    if (li) {
      e.preventDefault();
      choose(Number(li.dataset.i));
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  return root;
}

export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation nicht unterstützt'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}
