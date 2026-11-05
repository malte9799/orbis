// Click panel of the global net tows (public/data/plastik/tows-global.geojson, built by scripts/tows-build.py).
import { safeUrl } from '../../../util';
import type { InfoPanelData } from '../../infopanel';

export interface GlobalTowsMeta {
  sources: Record<string, { name: string; license: string; cite: string; url: string }>;
  methods: Record<string, string>;
  /** original studies behind the NOAA NCEI records: short reference and DOI */
  refs: { t: string; doi: string | null }[];
}

const NUM = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 3 });
const DATE = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2013-05-04" as a German date; anything else is returned as it is (the year) */
export function towDate(d: unknown, y: number): string {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return String(y);
  return DATE.format(new Date(`${d}T00:00:00Z`));
}

/** which quantity a tow carries: mass g/km², count per km² or concentration per m³ of net water */
export function towQuantity(p: Record<string, unknown>): 'm' | 'n' | 'c' | null {
  for (const k of ['m', 'n', 'c'] as const) if (p[k] != null && Number.isFinite(Number(p[k]))) return k;
  return null;
}

export function globalTowPanel(p: Record<string, unknown>, meta: GlobalTowsMeta | undefined, color: string): InfoPanelData {
  const y = Number(p.y);
  const src = meta?.sources[String(p.src)];
  const ref = p.r != null ? meta?.refs[Number(p.r)] : undefined;
  const q = towQuantity(p);
  const val = (k: 'm' | 'n' | 'c', unit: string) => (p[k] != null ? `${NUM.format(Number(p[k]))} ${unit}` : 'keine Angabe');
  const rows: { k: string; v: string; href?: string }[] = [
    { k: 'Datum', v: towDate(p.d, y) },
    { k: 'Methode', v: (meta?.methods[String(p.meth)] ?? 'Netzfang') + (p.mesh ? `, Maschenweite ${NUM.format(Number(p.mesh))} mm` : '') },
  ];
  const doiUrl = ref?.doi ? safeUrl(`https://doi.org/${ref.doi}`) : null;
  if (ref) rows.push({ k: 'Studie', v: ref.t, href: doiUrl ?? undefined });
  rows.push({ k: 'Daten', v: src ? `${src.name} (${src.license})` : String(p.src), href: safeUrl(src?.url) ?? undefined });
  const tiles: [string, string][] =
    q === 'm' ? [['Masse', val('m', 'g/km²')]] : q === 'n' ? [['Teile', val('n', 'Teile/km²')]] : [['Konzentration', val('c', 'Teile/m³')]];
  const note =
    q === 'c'
      ? 'Teile je m³ Wasser im Netz, nicht je km² Meeresoberfläche: ohne Eintauchtiefe des Netzes nicht in Teile/km² umrechenbar und nicht mit den Farben der anderen Netzfänge vergleichbar. Maschenweiten (meist 0,2 bis 0,5 mm), Netztypen und Größenbereiche unterscheiden sich zwischen den Studien.'
      : q === 'm'
        ? 'Masse je km² Meeresoberfläche aus einem Netzfang (Cózar et al. 2015). Gewichte und Teilzahlen sind nicht direkt vergleichbar; Netze und Maschenweiten unterscheiden sich zwischen den Studien.'
        : 'Teile je km² Meeresoberfläche aus einem Netzfang. Zahlen sind nicht mit Massen (g/km²) vergleichbar; Netze, Maschenweiten und Größenbereiche unterscheiden sich zwischen den Studien.';
  return {
    glyph: 'tsunami',
    color,
    title: `Netzfang ${y}`,
    subtitle: q === 'm' ? 'Messpunkt, Masse an der Meeresoberfläche' : q === 'n' ? 'Messpunkt, Teile an der Meeresoberfläche' : 'Messpunkt, Teile je m³ Netzwasser',
    tiles,
    sections: [{ key: 'tow', title: 'Messung', open: true, rows }],
    note,
  };
}
