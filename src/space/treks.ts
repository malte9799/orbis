import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import Projection from 'ol/proj/Projection';

export interface Trek {
  id: string;
  name: string;
  cat: 'planet' | 'moon' | 'asteroid';
  /** Basis-Pfad der Trek-WMTS-Tiles: https://trek.nasa.gov/tiles/<Body>/EQ/<Layer>/ */
  tileBase: string;
  /** serverseitig festgelegte Bild-Extension */
  ext: 'jpg' | 'png';
  /** letzter WMTS TileMatrix laut GetCapabilities */
  maxMatrix: number;
}

// Basiskarten aus der offiziellen Trek-API (trek.nasa.gov/tiles/apidoc), Equirectangular
export const TREKS: readonly Trek[] = [
  { id: 'mercury', name: 'Merkur', cat: 'planet', tileBase: 'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m', ext: 'jpg', maxMatrix: 7 },
  { id: 'mars', name: 'Mars', cat: 'planet', tileBase: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m', ext: 'jpg', maxMatrix: 7 },
  { id: 'moon', name: 'Mond', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02', ext: 'jpg', maxMatrix: 8 },
  { id: 'titan', name: 'Titan', cat: 'moon', tileBase: 'https://trektiles.jpl.nasa.gov/trektiles/Titan/EQ/Titan_global_32ppd_ColorRatio_v2', ext: 'png', maxMatrix: 4 },
  { id: 'dione', name: 'Dione', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Dione/EQ/Dione_Cassini_Voyageglobal_154m', ext: 'jpg', maxMatrix: 5 },
  { id: 'enceladus', name: 'Enceladus', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Enceladus/EQ/Enceladus_Cassini_mosaic_global_110m', ext: 'jpg', maxMatrix: 5 },
  { id: 'tethys', name: 'Tethys', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Tethys/EQ/Tethys_Cassini_mosaic_global_293m', ext: 'jpg', maxMatrix: 4 },
  { id: 'rhea', name: 'Rhea', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Rhea/EQ/RH_120803_DLR_basemap', ext: 'jpg', maxMatrix: 4 },
  { id: 'mimas', name: 'Mimas', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Mimas/EQ/MI_170630_DLR_basemap', ext: 'jpg', maxMatrix: 4 },
  { id: 'iapetus', name: 'Iapetus', cat: 'moon', tileBase: 'https://trek.nasa.gov/tiles/Iapetus/EQ/Iapetus_Cassini_Voyager_mosaic_global_783m', ext: 'jpg', maxMatrix: 3 },
  { id: 'vesta', name: 'Vesta', cat: 'asteroid', tileBase: 'https://trek.nasa.gov/tiles/Vesta/EQ/Vesta_Dawn_GRaND_ClrIronCorrectedCounts_Global_2ppd', ext: 'jpg', maxMatrix: 1 },
  { id: 'ceres', name: 'Ceres', cat: 'asteroid', tileBase: 'https://trek.nasa.gov/tiles/Ceres/EQ/Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016', ext: 'jpg', maxMatrix: 5 },
];

export const TREK_CATEGORIES: readonly { id: Trek['cat']; name: string }[] = [
  { id: 'planet', name: 'Planeten' },
  { id: 'moon', name: 'Monde' },
  { id: 'asteroid', name: 'Asteroiden' },
];

export interface TreksView {
  el: HTMLElement;
  activate(opts?: { trek?: string }): void;
  deactivate(): void;
}

export function createTreksView(): TreksView {
  const el = document.createElement('div');
  el.className = 'nasa-eyes'; // gleiche Full-Size-Basis wie die Eyes-Apps
  el.hidden = true;
  el.innerHTML = `<div class="trek-map-map"></div>`;
  const mount = el.querySelector<HTMLDivElement>('.trek-map-map')!;

  // Trek WMTS: TileMatrix M = 2^(M+1) Spalten × 2^M Reihen über Equirectangular/Ausschnitt (-180..180, -90..90)
  const projection = new Projection({
    code: 'EPSG:4326',
    units: 'degrees',
    extent: [-180, -90, 180, 90],
    worldExtent: [-180, -90, 180, 90],
  });
  const resolutions: number[] = [];
  const sizes: [number, number][] = [];
  const maxM = 8;
  for (let m = 0; m <= maxM; m++) {
    resolutions.push(360 / (256 * 2 ** (m + 1)));
    sizes.push([2 ** (m + 1), 2 ** m]);
  }

  let current: Trek = TREKS.find((t) => t.id === 'moon') ?? TREKS[0];
  let layer: TileLayer<XYZ> | null = null;
  const map = new Map({
    target: mount,
    layers: [],
    view: new View({
      center: [0, 0],
      zoom: 1,
      projection,
      // Zoom-Stufen an das Trek-WMTS-Raster koppeln (Zoom-Index = TileMatrix)
      resolutions,
    }),
  });

  function useTrek(t: Trek) {
    current = t;
    if (layer) {
      map.removeLayer(layer);
      layer.dispose();
    }
    layer = new TileLayer({
      source: new XYZ({
        projection,
        tileGrid: new TileGrid({
          extent: [-180, -90, 180, 90],
          origin: [-180, 90],
          resolutions: resolutions.slice(0, t.maxMatrix + 1),
          sizes: sizes.slice(0, t.maxMatrix + 1),
          tileSize: [256, 256],
        }),
        // Trek-WMTS-RESTful-Pfad: /{TileMatrix}/{TileRow}/{TileCol} = /{z}/{y}/{x}
        url: `${t.tileBase}/1.0.0/default/default028mm/{z}/{y}/{x}.${t.ext}`,
      }),
    });
    map.addLayer(layer);
    const view = map.getView();
    view.cancelAnimations();
    view.setCenter([0, 0]);
    view.setZoom(Math.min(1, t.maxMatrix));
    map.render();
  }

  function activate(opts?: { trek?: string }) {
    const want = TREKS.find((t) => t.id === opts?.trek) ?? current;
    // Größe nachvollziehen, falls die Karte bei Display:none erzeugt wurde
    map.updateSize();
    if (want !== current || !layer) useTrek(want);
  }

  function deactivate() {
    // OpenLayers hält keine laufenden Timers; Tiles werden bei Bedarf erneut geladen.
  }

  return { el, activate, deactivate };
}
