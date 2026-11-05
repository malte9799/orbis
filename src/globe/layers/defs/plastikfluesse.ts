import type { FeatureCollection } from 'geojson';
import { assetUrl } from '../../../assets';
import { fetchJson } from '../../../util';
import type { InfoPanelData } from '../../infopanel';
import { colorExpr, fmtRank, fmtTons, radiusExpr, strokeExpr } from '../shared/plastikfluesse';
import { defineExtra } from '../types';

// Plastic from rivers: model estimate of Meijer et al. 2021 for the river mouths (points >= 3 t/year, prepared by
// scripts/plastik-build.py). The file is loaded through assetUrl and only once the layer is switched on.

const ID = 'plastikfluesse';
const COLOR = '#e57373';
const L_PT = 'plastikfluesse-pt';
const PAPER = 'https://doi.org/10.1126/sciadv.aaz5803';
const DATA = 'https://doi.org/10.6084/m9.figshare.14515590';

function panel(t: number, r: number): InfoPanelData {
  return {
    glyph: 'tsunami',
    color: COLOR,
    title: 'Flussmündung',
    subtitle: 'Modellschätzung des Plastikeintrags ins Meer',
    tiles: [
      ['Plastikeintrag', fmtTons(t)],
      ['Rang', `${r}`],
    ],
    sections: [
      {
        key: 'val',
        title: 'Einordnung',
        open: true,
        rows: [
          { k: 'Menge', v: fmtTons(t) },
          { k: 'Rang', v: fmtRank(r) },
        ],
      },
      {
        key: 'src',
        title: 'Quellen',
        open: true,
        rows: [
          { k: 'Paper', v: 'Meijer et al. 2021 (Science Advances)', href: PAPER },
          { k: 'Daten', v: 'figshare, Meijer et al. 2021 (CC BY 4.0)', href: DATA },
        ],
      },
    ],
    note: 'Modellschätzung (Meijer et al. 2021). Gesamte Spanne der Studie 0,8–2,7 Mio t/Jahr; Fluss- und Ländernamen liegen im Datensatz nicht vor. Meijer et al. 2021 (CC BY 4.0)',
    link: { label: 'Studie öffnen (Science Advances)', url: PAPER },
  };
}

export default defineExtra({
  id: ID,
  order: 253,
  section: 'ocean',
  cat: 'meer',
  label: 'Plastik aus Flüssen',
  hint: 'Mündungen mit geschätztem Plastikeintrag ins Meer (t/Jahr), Modell Meijer et al. 2021',
  glyph: 'tsunami',
  icon: 'ocean',
  color: COLOR,
  sources: { [ID]: 'Plastik aus Flüssen: <a href="https://doi.org/10.1126/sciadv.aaz5803">Meijer et al. 2021</a> (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: L_PT,
        type: 'circle',
        source: ID,
        // biggest on top; small ranks appear with zoom through the radius (a zoom expression is not allowed in filters)
        layout: { ...hidden, 'circle-sort-key': ['get', 't'] },
        paint: {
          'circle-color': colorExpr,
          'circle-radius': radiusExpr(),
          'circle-opacity': 0.85,
          'circle-stroke-color': 'rgba(40,0,0,0.75)',
          'circle-stroke-width': strokeExpr(),
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce(ID, Infinity, async () => {
      const fc = await fetchJson<FeatureCollection>(assetUrl('data/plastik/rivers.geojson'));
      ctx.setData(ID, fc);
      return { count: fc.features.length, note: 'Modellschätzung, Klick zeigt Menge und Rang · kleinere Mündungen erscheinen beim Heranzoomen' };
    });
  },
  click({ p, pt }) {
    const t = Number(p.t);
    const r = Number(p.r);
    if (!Number.isFinite(t) || !Number.isFinite(r)) return null;
    return { type: 'panel', data: panel(t, r), lng: pt[0], lat: pt[1] };
  },
  layers: [L_PT],
  clickLayers: [L_PT],
});
