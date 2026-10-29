// The tile sources of the "3D-Kacheln" layer (the chips in its settings). Sources with a `url` are
// open and need no key; `key` names the entry in the settings panel (settings/keys) of the paid ones.
// `textured` marks photogrammetry meshes with real facade/roof photos, the others are plain blocks.

export interface TilesSourceDef {
  id: string;
  label: string;
  hint: string;
  attribution: string;
  textured?: boolean;
  /** what the data is: photo mesh, plain building blocks, LoD2 city model (roof shapes) or terrain */
  kind: 'Foto-Mesh' | 'Gebäude-Blöcke' | 'LoD2' | 'Gelände';
  /** not a tileset of its own: expands to tilesets chosen by location (see plateau.ts) */
  dynamic?: boolean;
  /** where the source is worth a look: [lon, lat, zoom] (the chip in the settings flies there) */
  at: [number, number, number];
  url?: string;
  key?: string;
  /** licence checked and clear enough for the public app; every other source is shown in the dev server only */
  open?: boolean;
  /** links appended to the attribution (the licence, the data's own page) */
  links?: { text: string; href: string }[];
  /** logos the data provider asks for next to the attribution (images under /public or absolute) */
  logos?: { src: string; alt: string; href?: string }[];
}

export const TILES_SOURCES: TilesSourceDef[] = [
  { id: 'basemap', kind: 'LoD2', at: [13.4132, 52.5219, 16], label: 'basemap.de (DE)', hint: 'LoD2-Gebäude Deutschland, BKG', url: 'https://sgx.geodatenzentrum.de/gdz_basemapde_3d_gebaeude/lod2_4326_null.json', attribution: '© GeoBasis-DE / BKG, basemap.de', open: true, links: [{ text: 'dl-de/by-2-0', href: 'https://www.govdata.de/dl-de/by-2-0' }] },
  { id: 'reearth', kind: 'Gebäude-Blöcke', at: [151.2153, -33.8568, 16], label: 'Re:Earth (Welt)', hint: 'Overture/OSM-Gebäude weltweit', url: 'https://buildings.reearth.land/tileset.json', attribution: '© OpenStreetMap contributors · © Overture Maps Foundation · Re:Earth Buildings', open: true, links: [{ text: 'ODbL', href: 'https://www.openstreetmap.org/copyright' }, { text: 'Overture', href: 'https://overturemaps.org/' }] },
  { id: 'ion', kind: 'Gebäude-Blöcke', at: [-0.0754, 51.5055, 16], label: 'Cesium OSM', hint: 'Cesium ion OSM Buildings, braucht Token', key: 'cesiumIon', attribution: 'Cesium ion · © OpenStreetMap' },
  { id: 'google', kind: 'Foto-Mesh', at: [-73.9857, 40.7484, 16], label: 'Google', hint: 'Fotorealistische 3D-Kacheln weltweit, braucht API-Key', key: 'googleTiles', textured: true, attribution: 'Google' },
  // regional photogrammetry meshes and textured city models (all with photos; sorted by country)
  { id: 'strasbourg', kind: 'Foto-Mesh', at: [7.7503, 48.5818, 16], label: 'FR Straßburg', hint: 'Photomaillage 2022, Eurométropole', textured: true, url: 'https://s3.eu-west-2.wasabisys.com/ems-sgct-photomaillage/ODACIT/EMS_PM2022/tileset.json', attribution: '© Ville et Eurométropole de Strasbourg · cofinancé par l\'UE (FEDER) et DataGrandEst', open: true, links: [{ text: 'Licence ouverte', href: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/' }] },
  { id: 'lille', kind: 'Foto-Mesh', at: [3.0633, 50.6372, 16], label: 'FR Lille', hint: 'Maillage 2016, 10 cm, Métropole Européenne de Lille', textured: true, url: 'https://webimaging.lillemetropole.fr/externe/maillage/2016_mel_10cm/3dtiles/tileset.json', attribution: '© Métropole Européenne de Lille' },
  { id: 'clermont', kind: 'Foto-Mesh', at: [3.0825, 45.7797, 16], label: 'FR Clermont-Ferrand', hint: 'CRAIG Auvergne-Rhône-Alpes', textured: true, url: 'https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json', attribution: '© CRAIG' },
  { id: 'stetienne', kind: 'Foto-Mesh', at: [4.3872, 45.4397, 16], label: 'FR Saint-Étienne', hint: 'CRAIG Auvergne-Rhône-Alpes', textured: true, url: 'https://3d.craig.fr/datasets/St-Etienne/3dtiles/tileset.json', attribution: '© CRAIG' },
  { id: 'berlin', kind: 'LoD2', at: [13.4132, 52.5219, 16], label: 'DE Berlin', hint: 'Texturiertes Gebäudemodell (virtualcityMAP-Demo, kein Foto-Mesh)', textured: true, url: 'https://www.virtualcitymap.de/datasource-data/632b42e6-b44c-450b-9436-93e48ca78ea2/tileset.json', attribution: '© Land Berlin / virtualcitySYSTEMS' },
  { id: 'soest', kind: 'Foto-Mesh', at: [8.1066, 51.5716, 16], label: 'DE Soest', hint: '3D-Mesh 2023, Stadt Soest', textured: true, url: 'https://soest.virtualcitymap.de/datasource-data/HOSTING-Soest/3D-Mesh_2023/tileset.json', attribution: '© Stadt Soest' },
  { id: 'stuttgart', kind: 'Foto-Mesh', at: [9.1925, 48.8586, 16], label: 'DE Stuttgart', hint: 'Integrated Mesh 2023, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Stuttgart__Integrated_Mesh_3D_Tiles_WGS84/3DTilesServer/tileset.json', attribution: '© 2023 Geofly GmbH / Esri' },
  { id: 'munich', kind: 'Foto-Mesh', at: [11.5755, 48.1374, 16], label: 'DE München', hint: 'Integrated Mesh 2021, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Munich__Integrated_Mesh_3D_Tiles_WGS84/3DTilesServer/tileset.json', attribution: '© 2021 Hexagon / Esri' },
  { id: 'jena', kind: 'Foto-Mesh', at: [11.5867, 50.9248, 16], label: 'DE Jena', hint: 'Integrated Mesh, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Jena__Integrated_Mesh_3DTiles_WGS84/3DTilesServer/tileset.json', attribution: '© Thüringer Landesamt für Bodenmanagement und Geoinformation / Esri' },
  { id: 'osnabrueck', kind: 'Foto-Mesh', at: [8.053, 52.2764, 16], label: 'DE Osnabrück', hint: 'Mesh, Datenlizenz Deutschland – Namensnennung 2.0', textured: true, url: 'https://tiles-eu1.arcgis.com/zjLIs5FIYdPdUakN/arcgis/rest/services/PublicMesh/3DTilesServer/tileset.json', attribution: '© Stadt Osnabrück, dl-de/by-2-0' },
  { id: 'frankfurt', kind: 'Foto-Mesh', at: [8.6821, 50.1109, 16], label: 'DE Frankfurt', hint: 'Texturiertes Mesh, ArcGIS-Online-Demo (Lizenz unklar)', textured: true, url: 'https://tiles.arcgis.com/tiles/EguFTd9xPXEoDtC7/arcgis/rest/services/Mesh_3D_tiles_package/3DTilesServer/tileset.json', attribution: '© ArcGIS Online (Quelle unklar)' },
  { id: 'utrecht', kind: 'Foto-Mesh', at: [5.1214, 52.0907, 16], label: 'NL Utrecht', hint: 'Integrated Mesh, Gemeente Utrecht', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Utrecht__Integrated_Mesh_3D_Tiles_WGS84/3DTilesServer/tileset.json', attribution: '© Gemeente Utrecht / Esri' },
  { id: 'rotterdam', kind: 'LoD2', at: [4.4792, 51.9225, 16], label: 'NL Rotterdam', hint: 'Texturiertes LoD2-Gebäudemodell', textured: true, url: 'https://www.3drotterdam.nl/datasource-data/3adbe5af-d05c-475a-b34c-59e69ba8dadc/tileset.json', attribution: '© Gemeente Rotterdam', open: true },
  { id: 'rotterdambgt', kind: 'Gelände', at: [4.4792, 51.9225, 16], label: 'NL Rotterdam Boden', hint: 'Texturiertes Gelände (3D BGT)', textured: true, url: 'https://www.3drotterdam.nl/datasource-data/594311c4-f78d-4d6c-a41c-062c87f99f8e/tileset.json', attribution: '© Gemeente Rotterdam' },
  { id: 'shertogenbosch', kind: 'Foto-Mesh', at: [5.3037, 51.6978, 16], label: 'NL \'s-Hertogenbosch', hint: 'Mesh ohne Textur, nur Vertex-Farben, rund 24 km (Gemeente \'s-Hertogenbosch, Lizenz unklar)', url: 'https://tiles-eu1.arcgis.com/fyncqJ7cWHF7TuW8/arcgis/rest/services/terrain_shb_mesh/3DTilesServer/tileset.json', attribution: '© Gemeente \'s-Hertogenbosch' },
  { id: 'vienna', kind: 'Foto-Mesh', at: [16.3738, 48.2082, 16], label: 'AT Wien', hint: 'Integrated Mesh, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Vienna__Integrated_Mesh_3D_Tiles_WGS84/3DTilesServer/tileset.json', attribution: '© Vermessung AVT-ZT-GmbH / Esri' },
  { id: 'linz', kind: 'Foto-Mesh', at: [14.3109, 48.2984, 16], label: 'AT Linz', hint: 'Integrated Mesh, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Linz__Integrated_Mesh_3DTiles_WGS84/3DTilesServer/tileset.json', attribution: '© Amt der OÖ Landesregierung / Esri' },
  { id: 'zurich', kind: 'Foto-Mesh', at: [8.5417, 47.3769, 16], label: 'CH Zürich', hint: 'Integrated Mesh, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Zurich_Integrated_Mesh_3D_Tiles/3DTilesServer/tileset.json', attribution: '© Esri' },
  { id: 'helsinki2017', kind: 'Foto-Mesh', at: [24.9522, 60.1704, 16], label: 'FI Helsinki 2017', hint: 'Reality Mesh 2017, CC BY 4.0', textured: true, url: 'https://kartta.hel.fi/3d/mesh/Helsinki_2017/tileset.json', attribution: '© Helsingin kaupunki', open: true, links: [{ text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }] },
  { id: 'alppila', kind: 'Foto-Mesh', at: [24.9369, 60.1945, 16], label: 'FI Helsinki Alppila', hint: 'Reality Mesh 2023, CC BY 4.0', textured: true, url: 'https://kartta.hel.fi/3d/mesh/Alppila_2023/tileset.json', attribution: '© Helsingin kaupunki', open: true, links: [{ text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }] },
  { id: 'uunisaari', kind: 'Foto-Mesh', at: [24.9526, 60.1527, 16], label: 'FI Helsinki Uunisaari', hint: 'Reality Mesh 2026, CC BY 4.0', textured: true, url: 'https://kartta.hel.fi/3d/mesh/Uunisaari_2026/tileset.json', attribution: '© Helsingin kaupunki', open: true, links: [{ text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }] },
  { id: 'sompasaari', kind: 'Foto-Mesh', at: [24.977, 60.1815, 16], label: 'FI Helsinki Sompasaari', hint: 'Reality Mesh 2019, CC BY 4.0', textured: true, url: 'https://kartta.hel.fi/3d/mesh/Sompasaari_2019/tileset.json', attribution: '© Helsingin kaupunki', open: true, links: [{ text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }] },
  { id: 'aarhus', kind: 'Foto-Mesh', at: [10.2108, 56.1572, 16], label: 'DK Aarhus', hint: 'Aarhus Mesh, SDFE', textured: true, url: 'https://sdfe-hosting.virtualcitymap.de/Aarhus/datasource-data/Aarhus_Mesh/tileset.json', attribution: '© Aarhus Kommune / SDFE' },
  { id: 'frederiksberg', kind: 'Foto-Mesh', at: [12.5253, 55.6811, 16], label: 'DK Frederiksberg', hint: '3D-Mesh, Frederiksberg Kommune (Lizenz unklar)', textured: true, url: 'https://tiles.arcgis.com/tiles/NqGokVvI0NQ6O9Jf/arcgis/rest/services/Frederiskberg_3Dmesh/3DTilesServer/tileset.json', attribution: '© Frederiksberg Kommune' },
  { id: 'madrid', kind: 'Foto-Mesh', at: [-3.6911, 40.4675, 16], label: 'ES Madrid Tetuán', hint: 'Mesh Tetuán/Valdezarza, nur ein Ausschnitt von etwa 330 × 250 m (Lizenz unklar)', textured: true, url: 'https://tiles-eu1.arcgis.com/UrtTdLP2PYSxwtI6/arcgis/rest/services/tileset_Tetuan_Valdezarza/3DTilesServer/tileset.json', attribution: '© Ayuntamiento de Madrid' },
  { id: 'boston', kind: 'Foto-Mesh', at: [-71.0764, 42.3598, 16], label: 'US Boston', hint: 'Integrated Mesh 2023, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Boston__Integrated_Mesh_3D_Tiles_WGS84/3DTilesServer/tileset.json', attribution: '© 2023 Bluesky Geospatial / Esri' },
  { id: 'cambridge', kind: 'Foto-Mesh', at: [-71.1064, 42.3758, 16], label: 'US Cambridge MA', hint: 'Integrated Mesh 2023, Esri-Demo', textured: true, url: 'https://tiles.arcgis.com/tiles/z2tnIkrLQ2BRzr6P/arcgis/rest/services/Cambridge_Massachusetts__Integrated_Mesh_3DTiles_WGS84/3DTilesServer/tileset.json', attribution: '© 2023 Bluesky Geospatial / Esri' },
  { id: 'acapulco', kind: 'Gebäude-Blöcke', at: [-99.876, 16.852, 16], label: 'MX Acapulco', hint: 'Texturierte Gebäude, Vricon 2024 (Lizenz unklar)', textured: true, url: 'https://tiles.arcgis.com/tiles/hjlmj6DTJ3YhmS5m/arcgis/rest/services/Acapulco_3D_Textured_Buildings/3DTilesServer/tileset.json', attribution: '© Vricon / Maxar' },
  { id: 'expo2025', kind: 'LoD2', at: [135.3835, 34.6495, 16], label: 'JP Expo 2025 Osaka', hint: 'LoD3-Gebäude ohne Textur, nur das Expo-Gelände (Lizenz unklar)', url: 'https://tiles.arcgis.com/tiles/KbxBPISGJFVF6WCN/arcgis/rest/services/expo2025_bldg_lod3_no_texture/3DTilesServer/tileset.json', attribution: '© Esri Japan' },
  { id: 'plateau', kind: 'LoD2', at: [139.7671, 35.6812, 16], label: 'JP PLATEAU (automatisch)', hint: 'Texturierte 3D-Stadtmodelle von ~250 japanischen Städten, je nach Kartenausschnitt (MLIT Project PLATEAU)', textured: true, dynamic: true, attribution: '© MLIT Japan, Project PLATEAU', open: true, links: [{ text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }] },
];
