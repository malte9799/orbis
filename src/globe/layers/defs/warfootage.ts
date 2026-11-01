import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { cardHtml } from '../../popup';
import { escapeHtml as esc, safeUrl } from '../../../util';
import type { GlyphId } from '../../icons';
import { catLabel, clipOf, clipUrl, featuresOf, loadArchive, type AgClip } from '../../../api/agarchive';

// Zeugen-Archiv: Videopositionen des Archive Genocide. Exakte GPS-Verortungen (Pins des Archivs und
// externe Verortungen) als klickbare Punkte – Klick holt die Clip-Metadaten (Caption inkl.) nach und
// zeigt Links zum Original-Beitrag und zur Archivseite; alle nur ungefähr verorteten Clips erscheinen
// als Heatmap. Regel des Archivs übernommen: ein Ortsname wird nie als exakter Punkt gezeichnet.
// Kriegsdokumentation – nichts wird inline abgespielt, nur Positionsdaten und Links.

const COLOR = '#c0392b';
const GLYPH: GlyphId = 'witness';

/** Caption lesbar kürzen: der Archiv-Text vor dem [Original post]-Block ist der Titel */
function headline(c: AgClip | null, extTitle: string): { title: string; desc: string } {
  const cap = (c?.c ?? extTitle).trim();
  if (!cap) return { title: 'Dokumentierter Clip', desc: '' };
  const head = cap.split('[Original post]')[0].trim();
  const firstLine = head.split('\n').find((x) => x.trim()) ?? '';
  const rest = cap.slice(firstLine.length).replace(/\s*\[Original post\]\s*/, ' ').trim();
  return { title: firstLine.slice(0, 140) || 'Dokumentierter Clip', desc: rest.length > 320 ? `${rest.slice(0, 320)} …` : rest };
}

const de = (d: string) => (d ? d.split('-').reverse().join('.') : '');

export default defineExtra({
  id: 'warfootage',
  order: 700,
  section: 'politik',
  cat: 'politik',
  label: 'Zeugen-Archiv: Videopositionen',
  hint:
    'Dokumentierte Videopositionen aus Gaza und dem Westjordanland (Archive Genocide): exakte GPS-Punkte, ungefähr verortete Clips als Heatmap. Klick zeigt Caption, Datum, Kategorie und Links zum Original. Belegmaterial kann verstörende Aufnahmen zeigen – nichts wird inline abgespielt. Benötigt den Daten-Proxy (Einstellungen).',
  glyph: GLYPH,
  icon: 'warn',
  color: COLOR,
  region: 'PS',
  sources: {
    warfootage: 'Archiv & Verortungen: <a href="https://archivegenocide.com/sources.html">archivegenocide.com</a>',
    'warfootage-dots': '',
  },
  addLayers(ctx) {
    const { add, hidden, setData } = ctx;
    setData('warfootage', empty());
    setData('warfootage-dots', empty());
    // Heatmap der approximierten Verortungen (löst sich ab Zoomstufe 12 auf)
    add(
      {
        id: 'warfootage-dots',
        type: 'heatmap',
        source: 'warfootage-dots',
        layout: hidden,
        maxzoom: 12,
        paint: {
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 7, 9, 15],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 9, 1.1],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 12, 0],
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'lvl'], 0, 0.6, 3, 1],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(192,57,43,0)',
            0.2, 'rgba(192,57,43,0.4)',
            0.45, 'rgba(235,87,66,0.6)',
            0.75, 'rgba(255,138,76,0.85)',
            1, 'rgba(255,234,150,0.95)',
          ],
        },
      },
      'marker',
    );
    // externe Verortungen (helle Verortung anderer Quellen) + die eigenen exakten Pins, beide klickbar
    add({ id: 'warfootage-ext', type: 'circle', source: 'warfootage', filter: ['==', ['get', 'kind'], 'ext'], minzoom: 3, layout: hidden, paint: { 'circle-color': COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 7], 'circle-opacity': 0.75, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } });
    add({ id: 'warfootage', type: 'circle', source: 'warfootage', filter: ['==', ['get', 'kind'], 'pin'], minzoom: 3, layout: hidden, paint: { 'circle-color': COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.2, 10, 7.5], 'circle-opacity': 0.9, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.2 } });
  },
  enable(ctx) {
    ctx.loadOnce('warfootage', 24 * 3600000, async () => {
      try {
        const d = await loadArchive();
        const pts = featuresOf(d.places, ['pin', 'ext']);
        const dots = featuresOf(d.places, ['dot']);
        ctx.setData('warfootage', { type: 'FeatureCollection', features: pts });
        ctx.setData('warfootage-dots', { type: 'FeatureCollection', features: dots });
        ctx.set('warfootage', {
          count: pts.length,
          note: `${pts.length.toLocaleString('de-DE')} exakte Punkte · ${dots.length.toLocaleString('de-DE')} ungefähr verortete Clips (Heatmap) · Stand ${d.stats.built}`,
        });
      } catch (e) {
        ctx.set('warfootage', { note: 'Daten-Proxy nötig (Einstellungen → Daten-Proxy): archivegenocide.com liefert die Daten ohne CORS-Proxy nicht.' });
        throw e;
      }
      return {};
    });
  },
  click({ p, pt }) {
    const isExt = p.kind === 'ext';
    const id = Number(p.id);
    const { title, desc } = isExt ? { title: String(p.title || 'Externe Verortung'), desc: String(p.note || '') } : headline(null, '');
    const when = String(p.date || '');
    const srcName = String(p.srcName || 'Externe Quelle');
    const extLink = safeUrl(String(p.srcUrl || ''));
    return {
      type: 'html',
      html: cardHtml({
        glyph: GLYPH,
        color: COLOR,
        title,
        subtitle: isExt ? 'Externe Verortung anderer Quellen' : 'Metadaten werden geladen …',
        date: isExt && when ? when : undefined,
        description: desc,
        source: isExt ? srcName : 'Archive Genocide',
        url: isExt && extLink ? String(p.srcUrl) : undefined,
        extra: isExt
          ? undefined
          : '<div class="pop-loading small">Caption, Datum und Links werden geladen …</div>',
      }),
      lng: pt[0],
      lat: pt[1],
      after: isExt
        ? undefined
        : (node) => {
            clipOf(id)
              .then((c) => {
                const h = headline(c, '');
                const bits = [catLabel(String(c?.cat ?? 'other')), de(c?.d ?? when), c?.du ? `Länge ${c.du}` : ''].filter(Boolean).join(' · ');
                const links = [
                  c?.pu && safeUrl(c.pu) ? `<a href="${esc(c.pu)}" target="_blank" rel="noopener noreferrer">Original-Beitrag ↗</a>` : '',
                  `<a href="${esc(clipUrl(id))}" target="_blank" rel="noopener noreferrer">Im Archiv (mit Inhaltsnote) ↗</a>`,
                ].filter(Boolean).join(' · ');
                const head = node.querySelector('.pop-head b');
                if (head) head.textContent = h.title;
                const sub = node.querySelector('.pop-sub');
                const tag = document.createElement('div');
                tag.className = 'pop-sub';
                tag.textContent = bits;
                if (sub) sub.replaceWith(tag);
                else node.querySelector('.pop-head')?.after(tag);
                const descEl = node.querySelector('.pop-desc');
                if (h.desc) {
                  if (descEl) descEl.textContent = h.desc;
                  else tag.insertAdjacentHTML('afterend', `<p class="pop-desc">${esc(h.desc)}</p>`);
                }
                const foot = node.querySelector('.pop-foot');
                const html = `<div class="pop-sub">Position exakt geolokalisiert · nichts wird inline abgespielt</div>${links ? `<div class="pop-foot">${links}</div>` : ''}`;
                if (foot) foot.outerHTML = html;
                else node.querySelector('.pop-loading')?.insertAdjacentHTML('beforebegin', html);
                node.querySelector('.pop-loading')?.remove();
              })
              .catch(() => {
                const el = node.querySelector('.pop-loading');
                if (el) el.textContent = 'Metadaten nicht erreichbar (Daten-Proxy prüfen)';
              });
          },
    };
  },
  layers: ['warfootage', 'warfootage-ext', 'warfootage-dots'],
  clickLayers: ['warfootage', 'warfootage-ext'],
});
