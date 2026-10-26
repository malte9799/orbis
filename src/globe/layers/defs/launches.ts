import { defineExtra, type ExtraCtx } from '../types';
import type { FeatureCollection } from 'geojson';
import { FONT_BOLD } from '../../vector';
import { Launch, countdown, loadLaunches } from '../../../api/transport';
import { cardHtml } from '../../popup';
import { escapeHtml, fmt, safeUrl } from '../../../util';

type St = { launchData: FeatureCollection | null };
const getState = (ctx: ExtraCtx) => ctx.state<St>('launches', () => ({ launchData: null }));

function updateLaunchLabels(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!st.launchData) return;
  for (const f of st.launchData.features) f.properties!.when = countdown(String(f.properties!.next));
  ctx.setData('launches', st.launchData);
}

export default defineExtra({
  id: 'launches',
  order: 370,
  section: 'air',
  cat: 'verkehr',
  label: 'Raketenstarts',
  hint: 'nächste Starts, Countdown, Tracking & Stream – The Space Devs',
  glyph: 'rocket',
  icon: 'rocket',
  color: '#ff6e40',
  sources: { launches: 'Raketenstarts: <a href="https://thespacedevs.com/">The Space Devs</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'launches',
        type: 'symbol',
        source: 'launches',
        layout: {
          ...hidden,
          'icon-image': 'glyph-rocket',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 8, 1],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 2, ['get', 'when']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffccbc', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    const st = getState(ctx);
    ctx.loadOnce('launches', 60 * 60000, async () => {
      st.launchData = await loadLaunches();
      updateLaunchLabels(ctx);
      return { count: st.launchData.features.length };
    });
    ctx.every('launch-labels', 60000, () => updateLaunchLabels(ctx));
  },
  disable(ctx) {
    ctx.clear('launch-labels');
  },
  click({ ctx, p, pt }) {
    let list: Launch[] = [];
    try {
      list = JSON.parse(String(p.launches));
    } catch {
      /* ignore */
    }
    const items = list
      .slice(0, 4)
      .map(
        (l) => `<li><b>${escapeHtml(l.name)}</b><br><span class="small">${escapeHtml(fmt.dateTime(l.net))} · ${escapeHtml(countdown(l.net))}${l.status ? ` · ${escapeHtml(l.status)}` : ''}</span>
          ${l.provider || l.rocket ? `<br><span class="small muted">${escapeHtml([l.provider, l.rocket].filter(Boolean).join(' · '))}</span>` : ''}
          ${safeUrl(l.video) ? `<br><a class="small" href="${escapeHtml(safeUrl(l.video)!)}" target="_blank" rel="noopener noreferrer">▶ Livestream</a>` : ''}</li>`,
      )
      .join('');
    const trackBtn = ctx.openLaunch
      ? `<button class="btn small wide pop-track" type="button" style="margin:8px 0 2px">Tracking &amp; Stream öffnen</button>`
      : '';
    return {
      type: 'html',
      html: cardHtml({ glyph: 'rocket', color: '#ff6e40', title: p.pad || 'Startplatz', subtitle: p.place, source: 'The Space Devs', url: 'https://thespacedevs.com/', extra: `<ol class="pop-list">${items}</ol>${trackBtn}` }),
      lng: pt[0],
      lat: pt[1],
      ...(ctx.openLaunch && list[0]
        ? {
            after: (node: HTMLElement) => node.querySelector('.pop-track')?.addEventListener('click', () => ctx.openLaunch?.(list[0], pt[0], pt[1])),
          }
        : {}),
    };
  },
  layers: ['launches'],
  clickLayers: ['launches'],
});
