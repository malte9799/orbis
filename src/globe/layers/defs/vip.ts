import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { vipFeatures } from '../shared/intel';
import { loadVipData, vipPhotoCredit, VIP_ATTRIBUTION, type VipData } from '../../../api/vip';
import { escapeHtml, safeUrl } from '../../../util';

const COLOR = '#ffd54f';

let cache: VipData | null = null;

export default defineExtra({
  id: 'vip',
  order: 830,
  section: 'konflikt',
  cat: 'politik',
  label: 'Milliardäre: Firmensitze',
  hint: 'Firmensitze bekannter Milliardäre – Daten aus Wikidata (CC0), Fotos von Wikimedia Commons mit Urheber und Lizenz; Vermögenslabels kuratiert. Klick zeigt Person, Vermögensklasse, Foto und Wikipedia-Link.',
  glyph: 'money',
  icon: 'crowd',
  color: COLOR,
  sources: { vip: `Milliardäre: ${VIP_ATTRIBUTION}` },
  addLayers({ add, hidden, setData }) {
    setData('vip', empty());
    add(
      {
        id: 'vip',
        type: 'circle',
        source: 'vip',
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.85,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 10, 7],
          'circle-stroke-color': '#3d2e00',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('vip', Infinity, async () => {
      const d = await loadVipData();
      cache = d;
      if (!d) {
        ctx.setData('vip', empty());
        return { count: 0, note: 'keine Daten – Snapshot nicht verfügbar' };
      }
      const fc = vipFeatures(d);
      ctx.setData('vip', fc);
      return { count: fc.features.length, note: 'Quelle Wikidata' };
    });
  },
  click({ p, pt }) {
    const person = cache?.people[Number(p.i)];
    const company = person?.companies[Number(p.c)];
    if (!person || !company) return null;
    const credit = vipPhotoCredit(person);
    const photo = safeUrl(person.photo);
    const wiki = safeUrl(person.wikipedia_url);
    const extra =
      `<div class="pop-sub"><b>${escapeHtml(person.name)}</b>${person.net_worth_label ? ` · ${escapeHtml(person.net_worth_label)}` : ''}</div>` +
      (person.description ? `<div class="pop-sub">${escapeHtml(person.description)}</div>` : '') +
      (photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(person.name)}" style="max-width:120px;border-radius:6px;margin:4px 0" referrerpolicy="no-referrer">` : '') +
      (photo && credit ? `<div class="pop-sub" style="font-size:10px">Foto: ${escapeHtml(credit)}</div>` : '') +
      (wiki ? `<div class="pop-sub"><a href="${escapeHtml(wiki)}" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a></div>` : '');
    const sub = [company.industry, [company.hq_city, company.hq_country].filter(Boolean).join(', '), company.ticker].filter(Boolean).join(' · ');
    return { type: 'html', html: cardHtml({ glyph: 'money', color: COLOR, title: company.name, subtitle: sub, source: 'Wikidata (CC0), Fotos Wikimedia Commons', extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['vip'],
  clickLayers: ['vip'],
});
