import { escapeHtml, fmt, safeUrl } from '../util';
import { glyphSvg, type GlyphId } from './icons';

export interface CardProps {
  glyph: GlyphId;
  color: string;
  title: unknown;
  subtitle?: unknown;
  date?: unknown;
  description?: unknown;
  source?: unknown;
  url?: unknown;
  extra?: string; // trusted HTML
}

/** Popup card shared by all map objects. All external strings are escaped. */
export function cardHtml(p: CardProps): string {
  const url = safeUrl(p.url);
  const desc = typeof p.description === 'string' ? p.description.slice(0, 500) : '';
  const date = typeof p.date === 'string' && p.date ? p.date : null;
  return `<div class="pop">
    <div class="pop-head">${glyphSvg(p.glyph, p.color, 26)}<b>${escapeHtml(p.title)}</b></div>
    ${p.subtitle ? `<div class="pop-sub">${escapeHtml(p.subtitle)}</div>` : ''}
    ${date ? `<div class="pop-sub">${escapeHtml(fmt.dateTime(date))} (${escapeHtml(fmt.relative(date))})</div>` : ''}
    ${desc ? `<p class="pop-desc">${escapeHtml(desc)}${desc.length >= 500 ? ' …' : ''}</p>` : ''}
    ${p.extra ?? ''}
    ${p.source || url ? `<div class="pop-foot">${p.source ? `Quelle: ${escapeHtml(p.source)}` : ''}${url ? `${p.source ? ' · ' : ''}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Details ↗</a>` : ''}</div>` : ''}
  </div>`;
}
