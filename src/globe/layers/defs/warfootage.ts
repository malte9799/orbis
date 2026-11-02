import { defineExtra } from '../types';
import { empty } from '../shared/geo';
import { tile, category } from '../../sidepanel';
import type { DetailContent } from '../../detailpanel';
import { escapeHtml as esc, safeUrl } from '../../../util';
import type { GlyphId } from '../../icons';
import { catLabel, clipOf, clipUrl, featuresOf, loadArchive, mediaUrl, thumbUrl, type AgClip } from '../../../api/agarchive';

// Zeugen-Archiv: Videopositionen des Archive Genocide. Exakte GPS-Verortungen (Pins des Archivs und
// externe Verortungen) als klickbare Punkte – Klick holt die Clip-Metadaten (Caption inkl.) nach und
// zeigt Links zum Original-Beitrag und zur Archivseite; alle nur ungefähr verorteten Clips erscheinen
// als Heatmap. Regel des Archivs übernommen: ein Ortsname wird nie als exakter Punkt gezeichnet.
// Kriegsdokumentation – hinter der Inhalts-Warnung der Karte; das Video wird erst im Detail-Panel
// (rechts) geladen und startet nie von selbst.

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

const KIND = { video: 'Video', photo: 'Foto' } as Record<string, string>;

/** Panel-Inhalt eines Clips: Video/Foto eingebettet, Caption, Verortung und Belege */
function clipDetail(c: AgClip | null, id: number, when: string): Partial<DetailContent> {
  if (!c) {
    return {
      subtitle: 'Nicht in der Archiv-Karte gefunden',
      body: `<div class="muted small">Zu diesem Punkt liegen keine Clip-Daten vor.</div>`,
    };
  }
  const h = headline(c, '');
  const src = mediaUrl(c);
  const poster = thumbUrl(c);
  const media = !src
    ? ''
    : c.k === 'video'
      ? `<video class="dp-media" controls preload="metadata" playsinline src="${esc(src)}"${poster ? ` poster="${esc(poster)}"` : ''}></video>`
      : `<img class="dp-media" alt="" loading="lazy" src="${esc(src)}">`;
  const tiles = `<div class="sp-tiles">${tile('Datum', de(c.d ?? when) || '–')}${tile('Kategorie', catLabel(String(c.cat ?? 'other')))}${tile(KIND[c.k] ?? 'Medium', c.du || '–')}</div>`;
  const where: [string, string][] = (
    [
      ['Ort', c.cp ? esc(c.cp) : ''],
      ['Genauigkeit', c.lvl ? esc(c.lvl) : ''],
      ['Methode', c.m ? esc(c.m) : ''],
      ['Status', c.st ? esc(c.st) : ''],
    ] satisfies [string, string][]
  ).filter(([, v]) => v);
  const provRows: [string, string][] = [];
  for (const v of c.pv ?? []) {
    const links = (v.links?.length ? v.links : v.url ? [[v.url, 'Quelle'] as [string, string]] : [])
      .filter(([u]) => safeUrl(u))
      .map(([u, l]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l || 'Quelle')} ↗</a>`);
    if (links.length) provRows.push([esc(v.by || v.method || 'Beleg'), links.join(' · ')]);
  }
  const origin: [string, string][] = [
    ['Quelle', esc(c.a || '–')],
    ['Original-Beitrag', c.pu && safeUrl(c.pu) ? `<a href="${esc(c.pu)}" target="_blank" rel="noopener noreferrer">öffnen ↗</a>` : '–'],
  ];
  const body =
    media +
    tiles +
    (h.desc || h.title !== 'Dokumentierter Clip' ? `<div class="sp-blurb">${esc(h.desc || h.title)}</div>` : '') +
    (where.length ? category('where', 'Verortung', where, new Set(['where'])) : '') +
    (provRows.length ? category('prov', 'Belege der Verortung', provRows, new Set(['prov'])) : '') +
    category('origin', 'Herkunft', origin, new Set(['origin']));
  return {
    title: c.et?.trim() || h.title,
    subtitle: [c.cp, de(c.d ?? when), c.du ? `Länge ${c.du}` : ''].filter(Boolean).join(' · '),
    body,
    link: { url: clipUrl(id), label: 'Im Archiv öffnen' },
  };
}

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
    const when = String(p.date || '');
    const base: Omit<DetailContent, 'title' | 'body'> = { glyph: GLYPH, color: COLOR, source: 'Archive Genocide – archivegenocide.com/geolocation' };
    if (isExt) {
      const srcUrl = safeUrl(String(p.srcUrl || ''));
      const rows: [string, string][] = [
        ['Quelle', esc(String(p.srcName || 'Externe Quelle'))],
        ...(when ? ([['Datum', esc(de(when))]] as [string, string][]) : []),
      ];
      return {
        type: 'detail' as const,
        d: {
          ...base,
          title: String(p.title || 'Externe Verortung'),
          subtitle: 'Externe Verortung anderer Quellen',
          body: category('q', 'Angaben', rows, new Set(['q'])) + (p.note ? `<div class="sp-blurb">${esc(String(p.note))}</div>` : ''),
          link: srcUrl ? { url: srcUrl, label: 'Quelle öffnen' } : undefined,
        },
        lng: pt[0],
        lat: pt[1],
      };
    }
    const loading = `<div class="sp-tiles">${tile('Datum', when ? de(when) : '–')}${tile('Kategorie', catLabel(String(p.cat || 'other')))}</div><div class="muted small">Video und Angaben werden geladen …</div>`;
    return {
      type: 'detail' as const,
      d: {
        ...base,
        title: 'Dokumentierter Clip',
        subtitle: 'Metadaten werden geladen …',
        body: loading,
        link: { url: clipUrl(id), label: 'Im Archiv öffnen' },
        pending: clipOf(id).then((c) => clipDetail(c, id, when)),
      },
      lng: pt[0],
      lat: pt[1],
    };
  },
  layers: ['warfootage', 'warfootage-ext', 'warfootage-dots'],
  clickLayers: ['warfootage', 'warfootage-ext'],
});
