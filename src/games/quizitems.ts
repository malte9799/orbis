import type { Geometry, Position } from 'geojson';
import { bboxOf, loadData, SCOPES, scopeOf, type Feat } from './data';
import type { QuizItem } from './namequiz';

// Question sets for the name quiz: flags, capitals and outlines.

const DATA = `${import.meta.env.BASE_URL}data/games/`;
export const flagUrl = (code: string) => `${DATA}flags/${code}.svg`;
const flagImg = (code: string, cls = 'fg-img') => `<img class="${cls}" alt="Flagge" src="${flagUrl(code)}" />`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function countries(scopeId: string, keep: (f: Feat) => boolean): Promise<Feat[]> {
  const scope = scopeOf(scopeId) ?? SCOPES[0];
  const all = (await loadData('countries.json')).features as Feat[];
  return all.filter((f) => f.properties.sov && keep(f) && (!scope.filter || scope.filter(f.properties)));
}

export async function flagItems(scope: string): Promise<QuizItem[]> {
  return (await countries(scope, (f) => !!f.properties.flag)).map((f) => ({
    id: f.properties.id,
    group: f.properties.cont ?? '',
    label: f.properties.name,
    answers: [f.properties.name, f.properties.en],
    prompt: flagImg(f.properties.flag!),
    thumb: flagImg(f.properties.flag!, 'fg-thumb'),
  }));
}

/** dir 'cap': the country is shown, the capital is asked; 'land': the other way round */
export async function capitalItems(scope: string, dir: 'cap' | 'land'): Promise<QuizItem[]> {
  return (await countries(scope, (f) => !!f.properties.cap?.length)).map((f) => {
    const p = f.properties;
    return dir === 'cap'
      ? {
          id: p.id, group: p.cont ?? '', label: p.cap![0], answers: [...p.cap!, ...(p.capEn ?? [])],
          prompt: `<div class="fg-text"><small>Hauptstadt von</small><b>${esc(p.name)}</b></div>`,
        }
      : {
          id: p.id, group: p.cont ?? '', label: p.name, answers: [p.name, p.en],
          prompt: `<div class="fg-text"><small>Hauptstadt von welchem Land?</small><b>${esc(p.cap![0])}</b></div>`,
        };
  });
}

// ----- outlines --------------------------------------------------------------------

type Ring = Position[];
function partsOf(g: Geometry): Ring[][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
}
function box(r: Ring): [number, number, number, number] {
  const b: [number, number, number, number] = [180, 90, -180, -90];
  for (const [x, y] of r) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
}
const diag = (b: number[]) => Math.hypot(b[2] - b[0], b[3] - b[1]);

/** the parts that make up a silhouette; far-flung ones (Guyana, Hawaii, Svalbard …) are left out so the main shape stays big */
export function outlineShape(g: Geometry) {
  const parts = partsOf(g)
    .map((p) => ({ p, b: box(p[0]) }))
    .map((x) => ({ ...x, a: (x.b[2] - x.b[0]) * (x.b[3] - x.b[1]) }))
    .sort((x, y) => y.a - x.a);
  if (!parts.length) return null;
  const keep = [parts[0]];
  const bb = [...parts[0].b];
  const mainDiag = diag(parts[0].b);
  for (const q of parts.slice(1)) {
    const nb = [Math.min(bb[0], q.b[0]), Math.min(bb[1], q.b[1]), Math.max(bb[2], q.b[2]), Math.max(bb[3], q.b[3])];
    if (q.a >= parts[0].a * 0.002 && diag(nb) <= mainDiag * 1.8) {
      keep.push(q);
      bb.splice(0, 4, ...nb);
    }
  }
  const k = Math.cos((((bb[1] + bb[3]) / 2) * Math.PI) / 180);
  return { keep: keep.map((q) => q.p), bb, k, w: (bb[2] - bb[0]) * k, h: bb[3] - bb[1] };
}

/** SVG silhouette */
export function outlineSvg(g: Geometry): string {
  const sh = outlineShape(g);
  if (!sh) return '';
  const { keep, bb, k, w, h } = sh;
  const pad = Math.max(w, h) * 0.06;
  const pt = ([x, y]: Position) => `${((x - bb[0]) * k).toFixed(3)} ${(bb[3] - y).toFixed(3)}`;
  const d = keep.flatMap((p) => p.map((r) => `M${r.map(pt).join('L')}Z`)).join('');
  return `<svg class="fg-outline" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" role="img" aria-label="Umriss"><path d="${d}" fill-rule="evenodd" /></svg>`;
}

const tiny = (f: Feat) => {
  const b = bboxOf([f]);
  return Math.max(b[2] - b[0], b[3] - b[1]) < 0.3;
};

/** scope = a SCOPES id, or `regions:<ISO>` for the regions (states, Bundesländer …) of one country */
export async function outlineItems(scope: string): Promise<QuizItem[]> {
  if (scope.startsWith('regions:')) {
    const fs = (await loadData(`admin1/${scope.slice(8)}.json`)).features as Feat[];
    return fs.filter((f) => !tiny(f)).map((f) => ({
      id: f.properties.id, group: '', label: f.properties.name, answers: [f.properties.name, f.properties.en], prompt: outlineSvg(f.geometry),
    }));
  }
  return (await countries(scope, (f) => !tiny(f))).map((f) => ({
    id: f.properties.id, group: f.properties.cont ?? '', label: f.properties.name, answers: [f.properties.name, f.properties.en], prompt: outlineSvg(f.geometry),
  }));
}
