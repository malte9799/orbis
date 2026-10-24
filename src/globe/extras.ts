import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap, MapGeoJSONFeature, RasterTileSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { loadCityAirQuality, loadCityWeather, loadDwdWarnings, loadPegel } from '../api/europe';
import { FUELS, loadCables, loadIxps, loadOsmPower, loadPowerPlants, loadShippingLanes, type PowerCat } from '../api/infra';
import { staticAirports } from '../api/airport';
import type { FlightRoute } from '../api/route';
import { AC_ALL_PAUSED, groundTrack, loadAircraft, loadAircraftByHex, loadGlobalAircraft, loadSatellites, loadSatGroup, loadSondes, satelliteFeatures, satPopupInfo, type AircraftResult, type Sat } from '../api/tracking';
import { ALPR_SOURCE_LAYER, ALPR_TILES_CA, ALPR_TILES_US, hasWindyKey, loadAlpr, loadDigitrafficCams, loadOsmWebcams, loadWindyWebcams } from '../api/cams';
import { LightningStream } from '../api/lightning';
import { loadAurora, loadFirePerimeters, loadGvpVolcanoes, loadRadiation, loadSpaceWeather, loadTsunami } from '../api/earth';
import { loadBuoys, loadRivers, loadTideDetails, loadTideStations, loadWaves } from '../api/ocean';
import {
  AisStream,
  countdown,
  hasAisKey,
  loadAirportFlights,
  loadDigitrafficShips,
  loadLaunches,
  loadTrainDetails,
  loadTrains,
  SHIP_LABELS,
  shipFeatures,
  type Launch,
  type Ship,
  type ShipCat,
} from '../api/transport';
import { loadAmtrak, loadAutobahn, loadNina, loadNinaDetails, loadSegments, modeStyle, positionsAt, RAIL_MODES, type Segment } from '../api/transit';
import { feedsInView, vehicleFeatures } from '../api/vehicles';
import { loadTransitNetwork } from '../api/networks';
import { camFeedsInView, SNAPSHOT_CAMS } from '../api/camfeeds';
import { snapshotJson } from '../api/data';
import { loadNearbyStations, loadTopStations } from '../api/radio';
import { isSuperseded } from '../api/overpass';
import { BGR_KOR250_TILES, loadMrds, loadOsmResources, loadPipelines, loadWikidataResources } from '../api/resources';
import { playStation, radioPopupExtra } from './player';
import { escapeHtml, fetchJson as fetchJsonExt, fmt, safeUrl } from '../util';
import { weatherIcon } from '../weather';
import { ensureWeatherIcons, registerSilhouettes, type GlyphId } from './icons';
import { cardHtml } from './popup';
import { AIRPORT_ZOOM, Airport3D, AP3D_HIT_LAYER, AP3D_LAYERS } from './airport3d';
import { FONT_BOLD, FONT_REGULAR } from './vector';

// Additional map content beyond weather: European measurements, live air/space traffic and
// infrastructure. Every source is free and keyless.

export type ExtraId =
  | 'cities'
  | 'dwdwarn'
  | 'gauges'
  | 'aq'
  | 'aircraft'
  | 'sondes'
  | 'sats'
  | 'starlink'
  | 'shipping'
  | 'cables'
  | 'wind'
  | 'solar'
  | 'plants'
  | 'webcams'
  | 'alpr'
  | 'aurora'
  | 'gvp'
  | 'fireareas'
  | 'tsunami'
  | 'lightning'
  | 'radiation'
  | 'launches'
  | 'airports'
  | 'airport3d'
  | 'ships'
  | 'trains'
  | 'transit'
  | 'railmap'
  | 'autobahn'
  | 'nina'
  | 'roadnet'
  | 'busnet'
  | 'railspeed'
  | 'railelec'
  | 'cyclenet'
  | 'hikenet'
  | 'radio'
  | 'resources'
  | 'pipelines'
  | 'geology'
  | 'plates'
  | 'ndvi'
  | 'lst'
  | 'snowcover'
  | 'aerosol'
  | 'landcover'
  | 'buoys'
  | 'tides'
  | 'waves'
  | 'rivers'
  | 'terrain'
  | 'buildings3d'
  | 'bathymetry'
  | 'chlorophyll'
  | 'ecradar'
  | 'nexrad'
  | 'fmiradar'
  | 'noaaradar'
  | 'jmaradar'
  | 'dwdnowcast'
  | 'ecsnow'
  | 'fmirain24'
  | 'jmanowcast';

export type SectionId = 'europe' | 'earth' | 'ocean' | 'air' | 'infra' | 'networks' | 'cams';

export interface ExtraDef {
  id: ExtraId;
  section: SectionId;
  label: string;
  hint: string;
  glyph: GlyphId;
  color: string;
}

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'europe', title: 'Europa & Messwerte' },
  { id: 'earth', title: 'Erde & Umwelt' },
  { id: 'ocean', title: 'Meer, Radar & Gelände' },
  { id: 'air', title: 'Luftraum & Weltraum' },
  { id: 'infra', title: 'Verkehr & Infrastruktur' },
  { id: 'networks', title: 'Verkehrsnetze' },
  { id: 'cams', title: 'Kameras & Radio' },
];

export const EXTRAS: ExtraDef[] = [
  { id: 'cities', section: 'europe', label: 'Städtewetter', hint: 'aktuelles Wetter in ~200 Städten', glyph: 'city', color: '#5b9dff' },
  { id: 'dwdwarn', section: 'europe', label: 'Unwetterwarnungen DE', hint: 'Deutscher Wetterdienst, amtlich', glyph: 'warn', color: '#e53935' },
  { id: 'gauges', section: 'europe', label: 'Pegel & Hochwasser DE', hint: 'PEGELONLINE, Bundeswasserstraßen', glyph: 'gauge', color: '#3d9ad1' },
  { id: 'nina', section: 'europe', label: 'Bevölkerungswarnungen', hint: 'NINA: MoWaS, KATWARN, BIWAPP, Hochwasser, Polizei', glyph: 'warn', color: '#c2185b' },
  { id: 'aq', section: 'europe', label: 'Luftqualität & Pollen', hint: 'europäische Städte – Copernicus CAMS', glyph: 'air', color: '#50c878' },
  { id: 'aurora', section: 'earth', label: 'Polarlicht', hint: 'Vorhersage für die nächste Stunde – NOAA SWPC', glyph: 'aurora', color: '#3ddc84' },
  { id: 'gvp', section: 'earth', label: 'Alle Vulkane', hint: '~1.300 Vulkane mit letztem Ausbruch – Smithsonian GVP', glyph: 'volcano', color: '#ff7043' },
  { id: 'fireareas', section: 'earth', label: 'Brandflächen USA', hint: 'aktuelle Waldbrand-Umrisse – NIFC', glyph: 'fire', color: '#ff5722' },
  { id: 'tsunami', section: 'earth', label: 'Tsunami-Meldungen', hint: 'NOAA-Tsunamiwarnzentren, letzte 7 Tage', glyph: 'tsunami', color: '#1e88e5' },
  { id: 'lightning', section: 'earth', label: 'Blitze live', hint: 'Einschläge der letzten 15 Minuten weltweit – Blitzortung.org (Hobby-Netzwerk, nicht amtlich, nur zur privaten Information, nicht für Warnzwecke)', glyph: 'bolt', color: '#ffd600' },
  { id: 'radiation', section: 'earth', label: 'Radioaktivität', hint: 'Ortsdosisleistung – BfS (DE), EURDEP (40+ Länder, u. a. Frankreich, Türkei, Kanada), Safecast (weltweit)', glyph: 'radiation', color: '#c0ca33' },
  { id: 'resources', section: 'earth', label: 'Rohstoffvorkommen', hint: 'Öl, Gas, Kohle, Erze, Steine – weltweit (Wikidata), genauer ab Zoom 7 (USGS, BGR) und 10 (OpenStreetMap)', glyph: 'plant', color: '#8d6e63' },
  { id: 'geology', section: 'earth', label: 'Geologie', hint: 'geologische Karten weltweit, beim Zoomen immer genauer – Macrostrat', glyph: 'landslide', color: '#ab47bc' },
  { id: 'plates', section: 'earth', label: 'Tektonische Platten', hint: 'Plattengrenzen (PB2002, Bird 2003)', glyph: 'quake', color: '#ef5350' },
  { id: 'ndvi', section: 'earth', label: 'Vegetation', hint: 'Pflanzenwachstum (NDVI, 8 Tage) – NASA MODIS', glyph: 'wind', color: '#66bb6a' },
  { id: 'lst', section: 'earth', label: 'Bodentemperatur', hint: 'Landoberflächentemperatur am Tag – NASA MODIS', glyph: 'heat', color: '#ff7043' },
  { id: 'snowcover', section: 'earth', label: 'Schneedecke (Satellit)', hint: 'Schneebedeckung – NASA MODIS', glyph: 'ice', color: '#e1f5fe' },
  { id: 'aerosol', section: 'earth', label: 'Aerosole & Staub', hint: 'Dunst, Rauch, Saharastaub (AOD) – NASA MODIS', glyph: 'dust', color: '#bcaaa4' },
  { id: 'landcover', section: 'earth', label: 'Landbedeckung', hint: 'Wald, Acker, Siedlung, Wasser (10 m) – ESA WorldCover', glyph: 'city', color: '#4caf50' },
  { id: 'waves', section: 'ocean', label: 'Seegang & Strömung', hint: 'Wellenhöhe, Dünung und Meeresströmung im Kartenausschnitt – Open-Meteo Marine', glyph: 'tsunami', color: '#26c6da' },
  { id: 'rivers', section: 'ocean', label: 'Flussabfluss & Hochwasser', hint: 'Abfluss in m³/s mit 7-Tage-Trend an Flüssen im Kartenausschnitt – GloFAS via Open-Meteo', glyph: 'flood', color: '#1e88e5' },
  { id: 'buoys', section: 'ocean', label: 'Messbojen', hint: 'Wellen, Wind, Luftdruck, Wassertemperatur live – NOAA NDBC (~900 Stationen)', glyph: 'gauge', color: '#4fc3f7' },
  { id: 'tides', section: 'ocean', label: 'Gezeitenpegel USA', hint: 'Wasserstand und nächste Hoch-/Niedrigwasser per Klick – NOAA CO-OPS', glyph: 'gauge', color: '#42a5f5' },
  { id: 'bathymetry', section: 'ocean', label: 'Meerestiefe', hint: 'Bathymetrie weltweit – GEBCO; Europa genauer – EMODnet', glyph: 'tsunami', color: '#1565c0' },
  { id: 'chlorophyll', section: 'ocean', label: 'Chlorophyll (Algen)', hint: 'Algenblüte im Meer, Satellit – NASA VIIRS', glyph: 'wind', color: '#2e7d32' },
  { id: 'nexrad', section: 'ocean', label: 'Radar USA (NEXRAD)', hint: 'Regenradar Mosaik der USA, ~5 min – NOAA via Iowa Environmental Mesonet', glyph: 'storm', color: '#ef5350' },
  { id: 'ecradar', section: 'ocean', label: 'Radar Kanada', hint: 'Regenradar Kanada, 1 km, ~6 min – Environment Canada', glyph: 'storm', color: '#e53935' },
  { id: 'fmiradar', section: 'ocean', label: 'Radar Finnland', hint: 'Regenradar Finnland, 1 km, 5 min – Finnish Meteorological Institute (CC BY 4.0)', glyph: 'storm', color: '#1e88e5' },
  { id: 'noaaradar', section: 'ocean', label: 'Radar Alaska, Hawaii, Karibik, Guam', hint: 'Regenradar Alaska, Hawaii, Puerto Rico und Guam – NOAA MRMS', glyph: 'storm', color: '#d84315' },
  { id: 'jmaradar', section: 'ocean', label: 'Radar Japan', hint: 'Niederschlagsradar Japan, 5 min – Japan Meteorological Agency', glyph: 'storm', color: '#c62828' },
  { id: 'dwdnowcast', section: 'ocean', label: 'Radar-Nowcast Deutschland', hint: 'Radar-Vorhersage für die nächsten 2 Stunden, 1 km – Deutscher Wetterdienst (WN-Produkt)', glyph: 'storm', color: '#7b1fa2' },
  { id: 'ecsnow', section: 'ocean', label: 'Schneeradar Kanada', hint: 'Radar nur für Schneefall, 1 km – Environment Canada', glyph: 'ice', color: '#81d4fa' },
  { id: 'fmirain24', section: 'ocean', label: 'Regensumme 24 h Finnland', hint: 'Radar-Niederschlagssumme der letzten 24 Stunden – Finnish Meteorological Institute', glyph: 'flood', color: '#0277bd' },
  { id: 'jmanowcast', section: 'ocean', label: 'Radar-Nowcast Japan', hint: 'Niederschlagsprognose für die nächste Stunde – Japan Meteorological Agency', glyph: 'storm', color: '#ad1457' },
  { id: 'terrain', section: 'ocean', label: '3D-Gelände', hint: 'Berge und Täler plastisch, Schummerung – AWS Terrain Tiles (zum Kippen mit Strg + Ziehen)', glyph: 'landslide', color: '#8d6e63' },
  { id: 'buildings3d', section: 'ocean', label: '3D-Gebäude', hint: 'Gebäude als Volumen, ab Stadtzoom – Karte mit Strg + Ziehen kippen (OpenStreetMap)', glyph: 'city', color: '#9fb4d0' },
  { id: 'aircraft', section: 'air', label: 'Flugzeuge & Hubschrauber', hint: 'live, ADS-B – adsb.lol, adsb.fi, airplanes.live, OpenSky', glyph: 'plane', color: '#f2c94c' },
  { id: 'sondes', section: 'air', label: 'Wetterballons', hint: 'Radiosonden live – SondeHub', glyph: 'sonde', color: '#ff8fab' },
  { id: 'launches', section: 'air', label: 'Raketenstarts', hint: 'nächste Starts weltweit mit Countdown – The Space Devs', glyph: 'rocket', color: '#ff6e40' },
  { id: 'airports', section: 'air', label: 'Flughäfen', hint: 'mit Abflügen & Ankünften vom Vortag – OpenSky', glyph: 'airport', color: '#90caf9' },
  { id: 'airport3d', section: 'air', label: 'Flughafen 3D', hint: 'Rollwege, Terminals und Flugzeuge in 3D ab Zoomstufe 11 – OpenStreetMap, ADS-B (zum Kippen Strg + Ziehen)', glyph: 'airport', color: '#ff6a2b' },
  { id: 'sats', section: 'air', label: 'Satelliten', hint: 'ISS, Wetter-, GPS-, Galileo-Satelliten', glyph: 'satellite', color: '#b388ff' },
  { id: 'starlink', section: 'air', label: 'Starlink', hint: 'tausende Satelliten – CelesTrak', glyph: 'satellite', color: '#7e8aa8' },
  { id: 'ships', section: 'infra', label: 'Schiffe live (AIS)', hint: 'Ostsee frei (Fintraffic), weltweit mit kostenlosem aisstream-Schlüssel', glyph: 'vessel', color: '#4dd0e1' },
  { id: 'trains', section: 'infra', label: 'Züge live', hint: 'Deutschland & Europa (Echtzeitfahrplan, Transitous), GPS: Finnland, USA (Amtrak)', glyph: 'train', color: '#ffca28' },
  { id: 'transit', section: 'infra', label: 'Busse, Trams & U-Bahn', hint: 'Deutschland & Europa ab Stadtzoom (Transitous); GPS: Norwegen, Boston, Toronto, Malaysia, optional Melbourne, Chicago, Schweden', glyph: 'train', color: '#ab47bc' },
  { id: 'roadnet', section: 'networks', label: 'Straßennetz', hint: 'Autobahnen bis Kreisstraßen mit Nummern – OpenStreetMap', glyph: 'city', color: '#f57c00' },
  { id: 'railmap', section: 'networks', label: 'Bahnnetz', hint: 'Gleise, Bahnhöfe, Strecken – OpenRailwayMap', glyph: 'train', color: '#78909c' },
  { id: 'busnet', section: 'networks', label: 'Bus- & ÖPNV-Netz', hint: 'Bus-, Tram-, U-Bahn- und Fährlinien mit Haltestellen (ab Stadtzoom) – OpenStreetMap', glyph: 'train', color: '#7e57c2' },
  { id: 'railspeed', section: 'networks', label: 'Bahn: Geschwindigkeit', hint: 'zulässige Streckengeschwindigkeit – OpenRailwayMap', glyph: 'train', color: '#e53935' },
  { id: 'railelec', section: 'networks', label: 'Bahn: Elektrifizierung', hint: 'Stromsysteme der Strecken – OpenRailwayMap', glyph: 'plant', color: '#fdd835' },
  { id: 'cyclenet', section: 'networks', label: 'Radnetz', hint: 'Radfernwege & regionale Radrouten – Waymarked Trails', glyph: 'city', color: '#43a047' },
  { id: 'hikenet', section: 'networks', label: 'Wandernetz', hint: 'Wanderwege – Waymarked Trails', glyph: 'city', color: '#8d6e63' },
  { id: 'autobahn', section: 'infra', label: 'Autobahn: Staus & Baustellen', hint: 'Verkehrsmeldungen, Sperrungen, Baustellen – Autobahn GmbH', glyph: 'warn', color: '#ffa000' },
  { id: 'pipelines', section: 'infra', label: 'Öl- & Gaspipelines', hint: 'Pipelines für Gas, Öl, Wasserstoff (ab Zoom 8) – OpenStreetMap', glyph: 'cable', color: '#29b6f6' },
  { id: 'shipping', section: 'infra', label: 'Schiffsrouten & Fähren', hint: 'Hauptschifffahrtswege, Fährlinien (OSM)', glyph: 'ship', color: '#26c6da' },
  { id: 'cables', section: 'infra', label: 'Seekabel & Internetknoten', hint: 'Unterseekabel aus OpenStreetMap (unvollständig), Internetknoten von PeeringDB', glyph: 'cable', color: '#9c6bff' },
  { id: 'wind', section: 'infra', label: 'Windkraft', hint: 'Windparks, beim Zoomen einzelne Anlagen', glyph: 'wind', color: FUELS.Wind.color },
  { id: 'solar', section: 'infra', label: 'Solarparks', hint: 'Photovoltaik-Kraftwerke', glyph: 'solar', color: FUELS.Solar.color },
  { id: 'plants', section: 'infra', label: 'Weitere Kraftwerke', hint: 'Kern, Kohle, Gas, Wasser, Biomasse …', glyph: 'plant', color: FUELS.Nuclear.color },
  { id: 'webcams', section: 'cams', label: 'Live-Webcams', hint: 'London, New York, Kalifornien, Kanada, Hongkong, Singapur, Finnland, Autobahn, OpenStreetMap – optional Windy und US-Nationalparks', glyph: 'webcam', color: '#00bfa5' },
  { id: 'radio', section: 'cams', label: 'Radiosender', hint: 'über 50.000 Sender weltweit – direkt anhören (Radio Browser)', glyph: 'radio', color: '#ff4081' },
  { id: 'alpr', section: 'cams', label: 'Kennzeichen-Kameras', hint: 'ALPR/Flock-Kameras aus OpenStreetMap – DeFlock-Community', glyph: 'alpr', color: '#ef4444' },
];

/** the big airports of our own list for zoom 5–8 (the tiles have airports from zoom 8): by size, largest first */
const AIRPORT_FAR = ['airports-far-1', 'airports-far-2', 'airports-far-3'];

const LAYERS: Record<ExtraId, string[]> = {
  cities: ['cities'],
  dwdwarn: ['dwd-warn-fill', 'dwd-warn-line'],
  gauges: ['gauges'],
  aq: ['aq-circle', 'aq-text'],
  aircraft: ['aircraft'],
  sondes: ['sondes'],
  sats: ['sats-icon', 'sats-label', 'sat-track'],
  starlink: ['sats-dot', 'sat-track'],
  shipping: ['ship-lanes', 'ferries'],
  cables: ['cables', 'ixp'],
  wind: ['power', 'osm-power'],
  solar: ['power', 'osm-power'],
  plants: ['power', 'osm-power'],
  webcams: ['webcams', 'webcams-osm'],
  aurora: ['aurora'],
  gvp: ['gvp'],
  fireareas: ['fireareas-fill', 'fireareas-line'],
  tsunami: ['tsunami-ring', 'tsunami'],
  lightning: ['lightning-glow', 'lightning'],
  radiation: ['radiation', 'radiation-label'],
  launches: ['launches'],
  airports: ['airports', 'airports-minor', ...AIRPORT_FAR],
  buildings3d: ['buildings-3d'],
  airport3d: AP3D_LAYERS,
  ships: ['ships'],
  trains: ['trains', 'trains-label'],
  transit: ['transit-veh', 'transit-label'],
  railmap: ['railmap'],
  roadnet: ['road-secondary', 'road-primary', 'road-trunk', 'road-motorway', 'road-ref'],
  busnet: ['busnet-line', 'busnet-label', 'busnet-stop'],
  railspeed: ['railspeed'],
  railelec: ['railelec'],
  cyclenet: ['cyclenet'],
  hikenet: ['hikenet'],
  radio: ['radio', 'radio-label'],
  resources: ['kor250', 'resources', 'resources-label'],
  pipelines: ['pipelines'],
  geology: ['geology'],
  plates: ['plates'],
  ndvi: ['ndvi'],
  lst: ['lst'],
  snowcover: ['snowcover'],
  aerosol: ['aerosol'],
  landcover: ['landcover'],
  waves: ['waves', 'waves-label'],
  rivers: ['rivers', 'rivers-label'],
  buoys: ['buoys', 'buoys-label'],
  tides: ['tides'],
  bathymetry: ['emodnet', 'gebco'],
  chlorophyll: ['chlorophyll-pace', 'chlorophyll-n20', 'chlorophyll'],
  nexrad: ['nexrad'],
  ecradar: ['ecradar'],
  fmiradar: ['fmiradar'],
  noaaradar: ['noaa-ak', 'noaa-hi', 'noaa-pr', 'noaa-gu'],
  jmaradar: ['jmaradar'],
  dwdnowcast: ['dwdnowcast'],
  ecsnow: ['ecsnow'],
  fmirain24: ['fmirain24'],
  jmanowcast: ['jmanowcast'],
  terrain: ['hillshade'],
  autobahn: ['autobahn-line', 'autobahn'],
  nina: ['nina-fill', 'nina-line'],
  alpr: ['alpr-heat', 'alpr-dots', 'alpr-cone', 'alpr-cone-line', 'alpr'],
};

const JMA_RADAR_TILES = (base: string, valid = base) => `https://www.jma.go.jp/bosai/jmatile/data/nowc/${base}/none/${valid}/surf/hrpns/{z}/{x}/{y}.png`;

const POWER_CAT: Partial<Record<ExtraId, PowerCat>> = { wind: 'wind', solar: 'solar', plants: 'other' };

/** Interactive layers this module answers clicks for. */
export const EXTRA_CLICK_LAYERS = [...AIRPORT_FAR, 'cities', 'dwd-warn-fill', 'gauges', 'aq-circle', 'aircraft', 'sondes', 'sats-icon', 'sats-dot', 'cables', 'ixp', 'power', 'osm-power', 'webcams', 'webcams-osm', 'alpr', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca', 'gvp', 'fireareas-fill', 'tsunami', 'radiation', 'lightning', 'launches', 'airports', 'ships', 'trains', 'transit-veh', 'autobahn', 'nina-fill', 'busnet-line', 'airports-minor', AP3D_HIT_LAYER, 'radio', 'resources', 'pipelines', 'plates', 'waves', 'rivers', 'buoys', 'tides'];

/** Zoom from which cameras are loaded for the visible area (Overpass). */
const CAM_DETAIL_ZOOM = 9;
const ALPR_RED = '#ef4444';
const CARDINAL = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const ALPR_ZONE: Record<string, string> = { traffic: 'Verkehr', parking: 'Parkplatz', town: 'Ortschaft', building: 'Gebäude', public: 'Öffentlich', shop: 'Geschäft' };
const ALPR_MOUNT: Record<string, string> = { pole: 'Mast', wall: 'Wand', street_lamp: 'Laterne', ceiling: 'Decke', bridge: 'Brücke', traffic_signals: 'Ampel', building: 'Gebäude' };

/** Stock photo per vendor (DeFlock CDN, first image of each LPR vendor), matched on the manufacturer tag. */
const ALPR_VENDOR_IMG: [RegExp, string][] = [
  [/flock/i, 'flock/flock-1.jpg'],
  [/motorola|vigilant/i, 'motorola/motorola-1.jpg'],
  [/genetec/i, 'genetec/genetec-1.webp'],
  [/leonardo|elsag/i, 'leonardo/elsag-1.jpg'],
  [/neology/i, 'neology/neology-1.jpg'],
  [/axon/i, 'axon/axon-1.webp'],
  [/verkada/i, 'verkada/verkada_bullet_cropped.png'],
];
const alprVendorImg = (brand: string) => {
  const hit = ALPR_VENDOR_IMG.find(([re]) => re.test(brand));
  return hit ? `https://cdn.deflock.me/vendors/${hit[1]}` : '';
};

/** Properties of an overview-tile camera in the shape of the live (Overpass) ones. */
function alprTileProps(t: Record<string, unknown> | null, lon: number, lat: number): Record<string, unknown> {
  const brand = String(t?.brand ?? '');
  const flock = /flock/i.test(brand);
  const dir = Number(t?.direction);
  return {
    title: flock ? 'Flock-Kamera (ALPR)' : 'Kennzeichenerfassung (ALPR)',
    subtitle: [brand, t?.operator].filter(Boolean).join(' · '),
    flock,
    dir: t?.direction != null && t.direction !== '' && Number.isFinite(dir) ? dir : -1,
    mount: t?.mountType ?? '',
    operator: t?.operator ?? '',
    brand,
    zone: t?.surveillanceZone ?? '',
    since: t?.startDate ?? '',
    ref: t?.ref ?? '',
    url: t?.osmId ? `https://www.openstreetmap.org/${t.osmType ?? 'node'}/${t.osmId}` : undefined,
    deflock: `https://maps.deflock.org/?lat=${lat.toFixed(5)}&lng=${lon.toFixed(5)}&zoom=17`,
  };
}
const ALPR_FOV_ZOOM = 12; // sectors are drawn from here on
const ALPR_FOV_RADIUS = 50; // metres
const ALPR_FOV_ANGLE = 60; // degrees

export type ClickResult =
  | { type: 'html'; html: string; lng: number; lat: number; after?: (node: HTMLElement) => void }
  | { type: 'weather'; lng: number; lat: number }
  /** an aircraft was clicked: the flight panel shows it */
  | { type: 'flight'; hex: string; lng: number; lat: number };

/** What the flight panel shows about one aircraft. */
export interface FlightInfo {
  hex: string;
  callsign: string;
  reg: string;
  type: string;
  icao: string;
  operator: string;
  altM: number;
  speedKmh: number | null;
  track: number;
  ground: boolean;
  emergency: string;
  squawk: string;
  vsMs: number | null;
  lon: number;
  lat: number;
  source: string;
  /** departure / destination (adsbdb); null: unknown, undefined: still loading */
  route?: FlightRoute | null;
}

interface Info {
  count?: number;
  loading?: boolean;
  note?: string;
  at?: number;
}

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

const ALT_COLOR: ExpressionSpecification = [
  'case',
  ['get', 'ground'],
  '#9aa3b5',
  ['interpolate', ['linear'], ['get', 'altM'], 0, '#ffd23f', 3000, '#7bd389', 8000, '#4fc3f7', 12000, '#b388ff'],
];

/** paint properties that control the opacity of a map layer, by layer type */
const OPACITY_PROPS: Record<string, string[]> = {
  raster: ['raster-opacity'],
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  heatmap: ['heatmap-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
};

export class ExtraLayers {
  private opacity: Partial<Record<ExtraId, number>> = {};
  private baseOpacity = new Map<string, unknown>();
  private on = new Set<ExtraId>();
  private info: Partial<Record<ExtraId, Info>> = {};
  private timers: Partial<Record<string, number>> = {};
  private sats: Sat[] = [];
  private starlink: Sat[] = [];
  private satsLoading: Promise<void> | null = null;
  private starlinkLoading: Promise<void> | null = null;
  private powerLoaded = false;
  private powerLoading: Promise<void> | null = null;
  private powerCounts: Record<PowerCat, number> = { wind: 0, solar: 0, other: 0 };
  private osmPowerKey = '';
  private aircraftSeq = 0;
  private aircraftBusy = false;
  private aircraftAgain = false;
  private aircraftAt = 0;
  private aircraftDelay: number | undefined;
  private aircraftErr = '';
  private airport3d: Airport3D | null = null;
  private lastAircraft: AircraftResult | null = null;
  private ready = false;
  private fiCams: FeatureCollection = empty();
  private windyCams: FeatureCollection = empty();
  private camFeeds = new Map<string, { at: number; features: Feature<Point>[] }>();
  private camFeedLoading = new Set<string>();
  private camFeedErrors = new Set<string>();
  private camKey = '';
  private osmCamCount = 0;
  private windyKey = '';
  private alprKey = '';
  private alprTilesAdded = false;
  private alprTilesFailed = false;
  private alprLive: Feature[] = [];
  private alprFovKey = '';
  private launchData: FeatureCollection | null = null;
  private baltic: Ship[] = [];
  private busnetKey = '';
  private radioTop: FeatureCollection | null = null;
  private radioNear: FeatureCollection = empty();
  private radioKey = '';
  private resWd: FeatureCollection = empty();
  private resMrds: FeatureCollection = empty();
  private resOsm: FeatureCollection = empty();
  private resMrdsKey = '';
  private resOsmKey = '';
  private pipeKey = '';
  private segs: Segment[] = [];
  private segKey = '';
  private segAt = 0;
  private segLoading = false;
  private gpsTrains: FeatureCollection = empty();
  private feedVeh = new Map<string, { at: number; features: Feature<Point>[] }>();
  private feedLoading = new Set<string>();
  private feedErrors = new Set<string>();
  private ais: AisStream | null = null;
  private lightning: LightningStream | null = null;

  constructor(
    private map: MlMap,
    private hooks: { changed(): void; toast(msg: string): void },
  ) {}

  /** Adds runtime sources/layers; call once after the style has loaded. */
  init() {
    const m = this.map;
    registerSilhouettes(m);
    const ATTR: Record<string, string> = {
      'ship-lanes': 'Schiffsrouten: <a href="https://doi.org/10.5281/zenodo.6361763">P. Benden, CC BY 4.0</a>',
      cables: 'Seekabel: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)',
      ixp: 'Internetknoten: <a href="https://www.peeringdb.com/">PeeringDB</a>',
      power: 'Kraftwerke: <a href="https://datasets.wri.org/dataset/globalpowerplantdatabase">WRI GPPD, CC BY 4.0</a>',
      aircraft: 'Flugdaten: <a href="https://adsb.lol/">adsb.lol</a> (ODbL), <a href="https://adsb.fi/">adsb.fi</a>, <a href="https://airplanes.live/">airplanes.live</a>, <a href="https://opensky-network.org/">OpenSky</a>',
      sondes: 'Radiosonden: <a href="https://sondehub.org/">SondeHub</a>',
      sats: 'Bahndaten: <a href="https://celestrak.org/">CelesTrak</a>',
      webcams: 'Webcams: <a href="https://www.digitraffic.fi/">Fintraffic Digitraffic</a> (CC BY 4.0), <a href="https://www.windy.com/webcams">Windy.com</a>',
      'webcams-osm': 'Webcams: © OpenStreetMap',
      alpr: 'ALPR: © OpenStreetMap-Mitwirkende, <a href="https://deflock.org/">DeFlock</a>',
      aurora: 'Polarlicht: <a href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast">NOAA SWPC</a>',
      gvp: 'Vulkane: <a href="https://volcano.si.edu/">Smithsonian GVP</a>',
      fireareas: 'Brandflächen: <a href="https://data-nifc.opendata.arcgis.com/">NIFC</a>',
      tsunami: 'Tsunami: <a href="https://www.tsunami.gov/">NOAA</a>',
      lightning: 'Blitze: <a href="https://www.blitzortung.org/">Blitzortung.org</a> – nicht amtlich, nur zur privaten Information, nicht für Warnzwecke',
      radiation: 'Radioaktivität: <a href="https://odlinfo.bfs.de/">BfS</a> (DL-DE 2.0), <a href="https://remap.jrc.ec.europa.eu/">EURDEP</a>, <a href="https://safecast.org/">Safecast</a> (CC0)',
      launches: 'Raketenstarts: <a href="https://thespacedevs.com/">The Space Devs</a>',
      ships: 'AIS: <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://aisstream.io/">aisstream.io</a>',
      trains: 'Züge & ÖPNV: <a href="https://transitous.org/">Transitous</a>, <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://amtraker.com/">Amtraker</a>, Entur (NLOD), MBTA, SEPTA, TTC (Contains information licensed under the Open Government Licence – Toronto), data.gov.my (CC BY 4.0), Transport Victoria (CC BY 4.0), CTA (Data provided by Chicago Transit Authority), Trafiklab',
      autobahn: 'Verkehr: <a href="https://www.autobahn.de/">Autobahn GmbH</a>',
      'autobahn-line': '',
      nina: 'Warnungen: <a href="https://warnung.bund.de/">NINA / BBK</a>',
      busnet: 'ÖPNV-Netz: © OpenStreetMap-Mitwirkende',
      radio: 'Radiosender: <a href="https://www.radio-browser.info/">Radio Browser</a>',
      resources: 'Rohstoffe: <a href="https://www.wikidata.org/">Wikidata</a>, <a href="https://mrdata.usgs.gov/mrds/">USGS MRDS</a>, © OpenStreetMap',
      pipelines: 'Pipelines: © OpenStreetMap-Mitwirkende',
      waves: 'Seegang: <a href="https://open-meteo.com/en/docs/marine-weather-api">Open-Meteo Marine</a> (CC BY 4.0)',
      rivers: 'Flüsse: <a href="https://open-meteo.com/en/docs/flood-api">Open-Meteo Flood</a> / GloFAS (CC BY 4.0)',
      buoys: 'Bojen: <a href="https://www.ndbc.noaa.gov/">NOAA NDBC</a>',
      tides: 'Pegel: <a href="https://tidesandcurrents.noaa.gov/">NOAA CO-OPS</a>',
      plates: 'Plattengrenzen: Bird (2003), <a href="https://github.com/fraxen/tectonicplates">fraxen/tectonicplates</a>',
    };
    for (const id of ['ship-lanes', 'cables', 'ixp', 'power', 'osm-power', 'aircraft', 'sondes', 'sats', 'sat-track', 'webcams', 'webcams-osm', 'alpr', 'alpr-fov', 'aurora', 'gvp', 'fireareas', 'tsunami', 'lightning', 'airports-far', 'radiation', 'launches', 'ships', 'trains', 'autobahn', 'autobahn-line', 'nina', 'busnet', 'busnet-stops', 'radio', 'resources', 'pipelines', 'plates', 'waves', 'rivers', 'buoys', 'tides']) {
      if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: empty(), attribution: ATTR[id] });
    }
    const hidden = { visibility: 'none' as const };
    const add = (layer: LayerSpecification, before?: string) => {
      if (!m.getLayer(layer.id)) m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
    };
    // lines: above weather, below labels
    add(
      {
        id: 'ship-lanes',
        type: 'line',
        source: 'ship-lanes',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': 'rgba(110, 210, 255, 0.75)',
          'line-width': ['match', ['get', 'type'], 'major', 2.2, 'middle', 1.4, 0.8],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 0.9],
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'ferries',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 4,
        filter: ['==', ['get', 'class'], 'ferry'],
        layout: hidden,
        paint: { 'line-color': 'rgba(150, 240, 255, 0.85)', 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'cables',
        type: 'line',
        source: 'cables',
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#9c6bff'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 2.2],
          'line-opacity': 0.85,
        },
      },
      'lbl-border-country',
    );
    // points: below the event icons
    add(
      {
        id: 'power',
        type: 'circle',
        source: 'power',
        filter: ['in', ['get', 'cat'], ['literal', []]],
        layout: { 'circle-sort-key': ['get', 'mw'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['max', 1.5, ['*', 0.09, ['sqrt', ['get', 'mw']]]], 8, ['max', 3, ['*', 0.4, ['sqrt', ['get', 'mw']]]]],
          'circle-opacity': 0.85,
          'circle-stroke-color': 'rgba(0,0,0,0.45)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0, 7, 0.8],
        },
      },
      'gauges',
    );
    add(
      {
        id: 'osm-power',
        type: 'circle',
        source: 'osm-power',
        minzoom: 10,
        filter: ['in', ['get', 'cat'], ['literal', []]],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'turbine'], 3.5, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    add(
      {
        id: 'ixp',
        type: 'circle',
        source: 'ixp',
        layout: { ...hidden, 'circle-sort-key': ['get', 'nets'] },
        paint: {
          'circle-color': '#e040fb',
          'circle-radius': ['interpolate', ['linear'], ['get', 'nets'], 0, 3, 100, 6, 1000, 12],
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    // earth observation & geology (raster overlays, below labels)
    const gibsWms = (layer: string, time?: string) =>
      `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256${time ? `&TIME=${time}` : ''}`;
    const overlay = (id: string, tiles: string[], attribution: string, maxzoom: number, opacity: number, extra: Record<string, unknown> = {}) => {
      if (!m.getSource(id)) m.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom, attribution, ...extra });
      add({ id, type: 'raster', source: id, layout: hidden, paint: { 'raster-opacity': opacity } }, 'lbl-border-country');
    };
    overlay('ndvi', [gibsWms('MODIS_Terra_NDVI_8Day')], 'Vegetation: NASA MODIS NDVI', 9, 0.75);
    overlay('lst', [gibsWms('MODIS_Terra_Land_Surface_Temp_Day')], 'Bodentemperatur: NASA MODIS', 7, 0.75);
    overlay('snowcover', [gibsWms('MODIS_Terra_NDSI_Snow_Cover')], 'Schneedecke: NASA MODIS', 8, 0.85);
    overlay('aerosol', [gibsWms('MODIS_Combined_Value_Added_AOD')], 'Aerosole: NASA MODIS', 6, 0.75);
    overlay(
      'landcover',
      ['https://wmts.terrascope.be/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=esa-worldcover-map-10m-2021-v2_map&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&TIME=2021-01-01'],
      'Landbedeckung: © ESA WorldCover 2021 (CC BY 4.0)',
      // 10 m data: zoom 14 is full resolution; the service has no tiles below zoom 6
      14,
      0.75,
      { minzoom: 6 },
    );
    overlay('gebco', ['https://wms.gebco.net/mapserv?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=GEBCO_LATEST&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'], 'Meerestiefe: <a href="https://www.gebco.net/">GEBCO</a> (nicht zur Navigation)', 10, 0.8);
    overlay('emodnet', ['https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png'], 'Europa: <a href="https://emodnet.ec.europa.eu/">EMODnet Bathymetry</a> (CC BY 4.0, nicht zur Navigation)', 11, 0.85, { bounds: [-36, 15, 43, 74] });
    // daily ocean-colour swaths (and clouds) leave gaps: three satellites stacked cover the oceans
    const chlDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    overlay('chlorophyll-pace', [gibsWms('OCI_PACE_Chlorophyll_a', chlDay)], 'Chlorophyll: NASA PACE / GIBS', 7, 0.8);
    overlay('chlorophyll-n20', [gibsWms('VIIRS_NOAA20_Chlorophyll_a', chlDay)], 'Chlorophyll: NASA VIIRS / GIBS', 7, 0.8);
    overlay('chlorophyll', [gibsWms('VIIRS_SNPP_L2_Chlorophyll_A', chlDay)], 'Chlorophyll: NASA VIIRS / GIBS', 7, 0.8);
    overlay('nexrad', ['https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png'], 'Radar USA: NOAA NEXRAD via <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>', 9, 0.8, { bounds: [-130, 20, -60, 52] });
    overlay('ecradar', ['https://geo.weather.gc.ca/geomet?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=RADAR_1KM_RRAI&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'], 'Radar Kanada: © <a href="https://eccc-msc.github.io/open-data/">Environment Canada</a> (Open Government Licence)', 9, 0.8, { bounds: [-141, 41, -52, 70] });
    overlay('fmiradar', ['https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Radar:suomi_dbz_eureffin&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'], 'Radar Finnland: © <a href="https://en.ilmatieteenlaitos.fi/open-data">Finnish Meteorological Institute</a> (CC BY 4.0)', 9, 0.8, { bounds: [18, 58, 33, 71] });
    const noaaWms = (region: string) => `https://opengeo.ncep.noaa.gov/geoserver/${region}/ows?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${region}_bref_qcd&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;
    const noaaCredit = 'Radar: <a href="https://www.nssl.noaa.gov/projects/mrms/">NOAA MRMS</a>';
    overlay('noaa-ak', [noaaWms('alaska')], noaaCredit, 9, 0.8, { bounds: [-170, 51, -129, 72] });
    overlay('noaa-hi', [noaaWms('hawaii')], noaaCredit, 9, 0.8, { bounds: [-164, 17, -153, 24] });
    overlay('noaa-pr', [noaaWms('carib')], noaaCredit, 9, 0.8, { bounds: [-70, 15, -62, 20] });
    overlay('noaa-gu', [noaaWms('guam')], noaaCredit, 9, 0.8, { bounds: [142, 11, 148, 16] });
    // JMA tiles are addressed by scan time – the newest one is looked up in loadJmaRadar()
    overlay('jmaradar', [JMA_RADAR_TILES('20000101000000')], 'Radar Japan: © <a href="https://www.jma.go.jp/">Japan Meteorological Agency</a>', 10, 0.8, { bounds: [118, 20, 150, 48] });
    overlay('dwdnowcast', ['https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=dwd:Radar_wn-product_1x1km_ger&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'], 'Radar-Nowcast: © <a href="https://www.dwd.de/">DWD</a> (CC BY 4.0)', 9, 0.85, { bounds: [1, 44, 20, 56] });
    overlay('ecsnow', ['https://geo.weather.gc.ca/geomet?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=RADAR_1KM_RSNO&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'], 'Schneeradar Kanada: © <a href="https://eccc-msc.github.io/open-data/">Environment Canada</a> (Open Government Licence)', 9, 0.85, { bounds: [-141, 41, -52, 70] });
    overlay('fmirain24', ['https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Radar:suomi_rr24h_eureffin&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'], 'Regensumme: © <a href="https://en.ilmatieteenlaitos.fi/open-data">Finnish Meteorological Institute</a> (CC BY 4.0)', 9, 0.8, { bounds: [18, 58, 33, 71] });
    overlay('jmanowcast', [JMA_RADAR_TILES('20000101000000')], 'Radar-Nowcast Japan: © <a href="https://www.jma.go.jp/">Japan Meteorological Agency</a>', 10, 0.8, { bounds: [118, 20, 150, 48] });
    // 3D terrain: AWS Terrarium tiles (also used for the hillshade below)
    if (!m.getSource('terrain-dem')) {
      m.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
        // full credit list required by the terrain tiles (tilezen/joerd docs/attribution.md)
        attribution:
          'Gelände: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a> (Mapzen) – USGS 3DEP, SRTM, GMTED2010 (U.S. Geological Survey); ETOPO1 (NOAA); ' +
          'ArcticDEM (DigitalGlobe-Bilder, NSF-gefördert); © Commonwealth of Australia (Geoscience Australia) 2017; © offene Daten Österreichs – DGM Österreich; ' +
          'Open Government Licence – Canada; EU-DEM: produced using Copernicus data and information funded by the European Union; INEGI, Continental relief, 2016; ' +
          '© Land Information New Zealand; © Kartverket; © Environment Agency copyright and/or database right 2015',
      });
    }
    add(
      { id: 'hillshade', type: 'hillshade', source: 'terrain-dem', layout: hidden, paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#1a1a2e' } },
      'lbl-border-country',
    );
    overlay('geology', ['https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png'], 'Geologie: <a href="https://macrostrat.org/">Macrostrat</a> (CC BY 4.0)', 18, 0.65);
    overlay('kor250', [BGR_KOR250_TILES], 'Rohstoffe DE: © BGR, KOR250', 18, 0.8, { minzoom: 6, bounds: [5.5, 47, 15.5, 55.2] });
    add(
      {
        id: 'plates',
        type: 'line',
        source: 'plates',
        layout: { ...hidden, 'line-join': 'round' },
        paint: { 'line-color': '#ff5252', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 8, 3], 'line-opacity': 0.85 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'pipelines',
        type: 'line',
        source: 'pipelines',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4], 'line-opacity': 0.9 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'resources',
        type: 'circle',
        source: 'resources',
        layout: { ...hidden, 'circle-sort-key': ['get', 'lvl'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'lvl'], 0, 2.4, 1.6], 8, ['match', ['get', 'lvl'], 0, 6, 4], 13, 7],
          'circle-stroke-color': ['case', ['==', ['get', 'cat'], 'oil'], '#ffb300', 'rgba(255,255,255,0.85)'],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 8, 1.2],
        },
      },
      'marker',
    );
    add(
      {
        id: 'resources-label',
        type: 'symbol',
        source: 'resources',
        minzoom: 9,
        layout: { ...hidden, 'text-field': ['get', 'title'], 'text-font': FONT_REGULAR, 'text-size': 10, 'text-offset': [0, 1.0], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#efebe9', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    // transport networks
    const rasterOverlay = (id: string, tiles: string[], attribution: string, maxzoom = 19, opacity = 0.9) => {
      if (!m.getSource(id)) m.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom, attribution });
      add({ id, type: 'raster', source: id, layout: hidden, paint: { 'raster-opacity': opacity } }, 'lbl-border-country');
    };
    const orm = (style: string) => ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/${style}/{z}/{x}/{y}.png`);
    rasterOverlay('railspeed', orm('maxspeed'), 'Streckengeschwindigkeit: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)');
    rasterOverlay('railelec', orm('electrification'), 'Elektrifizierung: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)');
    rasterOverlay('cyclenet', ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'], 'Radrouten: <a href="https://cycling.waymarkedtrails.org/">Waymarked Trails</a> (CC BY-SA)', 18, 0.95);
    rasterOverlay('hikenet', ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'], 'Wanderwege: <a href="https://hiking.waymarkedtrails.org/">Waymarked Trails</a> (CC BY-SA)', 18, 0.95);
    const road = (id: string, cls: string[], minzoom: number, color: string, w: [number, number, number, number]) =>
      add(
        {
          id,
          type: 'line',
          source: 'ofm',
          'source-layer': 'transportation',
          minzoom,
          filter: ['all', ['in', ['get', 'class'], ['literal', cls]], ['!=', ['get', 'ramp'], 1]],
          layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': color,
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], w[0], w[1], w[2], w[3]],
            'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 0.9],
          },
        },
        'lbl-border-country',
      );
    road('road-secondary', ['secondary'], 8, '#ffe082', [8, 0.6, 14, 4]);
    road('road-primary', ['primary'], 6, '#ffb74d', [6, 0.6, 14, 5]);
    road('road-trunk', ['trunk'], 4, '#ff8a65', [4, 0.6, 14, 6]);
    road('road-motorway', ['motorway'], 3, '#e53935', [3, 0.7, 14, 7]);
    add(
      {
        id: 'road-ref',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'transportation_name',
        minzoom: 6,
        filter: ['all', ['has', 'ref'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
        layout: {
          ...hidden,
          'symbol-placement': 'line',
          'symbol-spacing': 400,
          'text-field': ['get', 'ref'],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['match', ['get', 'class'], 'motorway', '#1565c0', 'trunk', '#c62828', '#ef6c00'],
          'text-halo-width': 3,
        },
      },
      'marker',
    );
    add(
      {
        id: 'busnet-line',
        type: 'line',
        source: 'busnet',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'order'] },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'mode'], 'bus', 1.2, 2], 16, ['match', ['get', 'mode'], 'bus', 3, 5]],
          'line-opacity': 0.85,
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'busnet-stop',
        type: 'circle',
        source: 'busnet-stops',
        minzoom: 13,
        layout: hidden,
        paint: { 'circle-color': '#ffffff', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 5], 'circle-stroke-color': '#7e57c2', 'circle-stroke-width': 1.5 },
      },
      'marker',
    );
    add(
      {
        id: 'busnet-label',
        type: 'symbol',
        source: 'busnet',
        minzoom: 12,
        filter: ['!=', ['get', 'ref'], ''],
        layout: {
          ...hidden,
          'symbol-placement': 'line',
          'symbol-spacing': 300,
          'text-field': ['get', 'ref'],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-rotation-alignment': 'viewport',
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': ['get', 'color'], 'text-halo-width': 2.5 },
      },
      'marker',
    );
    // earth & environment
    add(
      {
        id: 'aurora',
        type: 'heatmap',
        source: 'aurora',
        // a large-scale phenomenon on a 1° grid – fades out before the grid becomes visible
        maxzoom: 8,
        layout: hidden,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'v'], 3, 0.05, 30, 0.6, 90, 1],
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 6, 3, 30, 6, 170, 8, 480],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0.6],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.8, 8, 0],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,255,120,0)', 0.15, 'rgba(0,255,120,0.35)', 0.45, 'rgba(60,255,140,0.75)', 0.75, '#d4ff5a', 1, '#ff5ac8'],
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'fireareas-fill',
        type: 'fill',
        source: 'fireareas',
        layout: hidden,
        paint: { 'fill-color': '#ff3d00', 'fill-opacity': 0.4 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'fireareas-line',
        type: 'line',
        source: 'fireareas',
        layout: hidden,
        paint: { 'line-color': '#ffab40', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 2] },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'gvp',
        type: 'circle',
        source: 'gvp',
        layout: { ...hidden, 'circle-sort-key': ['match', ['get', 'state'], 'recent', 3, 'historic', 2, 1] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'state'], 'recent', 4.5, 'historic', 3, 2], 8, ['match', ['get', 'state'], 'recent', 9, 'historic', 7, 5]],
          'circle-stroke-color': ['match', ['get', 'state'], 'recent', '#ffffff', 'rgba(0,0,0,0.5)'],
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    add(
      {
        id: 'radiation',
        type: 'circle',
        source: 'radiation',
        layout: { ...hidden, 'circle-sort-key': ['get', 'v'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 9, 7],
          'circle-stroke-color': 'rgba(0,0,0,0.55)',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    add(
      {
        id: 'radiation-label',
        type: 'symbol',
        source: 'radiation',
        minzoom: 8,
        layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    // ocean: wave grid, buoys, tide gauges
    const waveLabel = (id: string, source: string): LayerSpecification => ({
      id,
      type: 'symbol',
      source,
      minzoom: 2,
      layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-allow-overlap': false, 'text-optional': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.2 },
    });
    add(
      {
        id: 'waves',
        type: 'circle',
        source: 'waves',
        layout: hidden,
        paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.8, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 8, 16], 'circle-stroke-color': 'rgba(0,0,0,0.4)', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add(waveLabel('waves-label', 'waves'), 'marker');
    add(
      {
        id: 'rivers',
        type: 'circle',
        source: 'rivers',
        layout: { ...hidden, 'circle-sort-key': ['get', 'q'] },
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 9, 11], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add({ ...waveLabel('rivers-label', 'rivers'), minzoom: 5 }, 'marker');
    add(
      {
        id: 'buoys',
        type: 'circle',
        source: 'buoys',
        layout: { ...hidden, 'circle-sort-key': ['get', 'wave'] },
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 9, 8], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add({ ...waveLabel('buoys-label', 'buoys'), minzoom: 5 }, 'marker');
    add(
      {
        id: 'tides',
        type: 'circle',
        source: 'tides',
        minzoom: 3,
        layout: hidden,
        paint: { 'circle-color': '#42a5f5', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 9, 6], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add(
      {
        id: 'tsunami-ring',
        type: 'circle',
        source: 'tsunami',
        layout: hidden,
        paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 16, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-opacity': 0.8 },
      },
      'marker',
    );
    add(
      {
        id: 'tsunami',
        type: 'symbol',
        source: 'tsunami',
        layout: { ...hidden, 'icon-image': 'glyph-tsunami', 'icon-size': 0.8, 'icon-allow-overlap': true },
      },
      'marker',
    );
    // live lightning: newest strikes bright yellow/white, ageing to dark red
    const strikeColor: ExpressionSpecification = ['match', ['get', 'age'], 0, '#ffffff', 1, '#ffe14d', 2, '#ff9100', '#d32f2f'];
    add(
      {
        id: 'lightning-glow',
        type: 'circle',
        source: 'lightning',
        layout: hidden,
        filter: ['==', ['get', 'age'], 0],
        paint: {
          'circle-color': 'rgba(255,230,80,0.35)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 8, 12],
          'circle-blur': 0.8,
        },
      },
      'marker',
    );
    add(
      {
        id: 'lightning',
        type: 'circle',
        source: 'lightning',
        layout: hidden,
        paint: {
          'circle-color': strikeColor,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3, 10, 5],
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
          'circle-stroke-width': 0.5,
        },
      },
      'marker',
    );
    // transport
    const airportLayer = (id: string, minzoom: number, classes: string[], textOverlap: boolean): LayerSpecification => ({
      id,
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'aerodrome_label',
      minzoom,
      filter: ['all', ['has', 'iata'], ['in', ['get', 'class'], ['literal', classes]]],
      layout: {
        ...hidden,
        'icon-image': 'glyph-airport',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 3, 1, 9, 1.3],
        'text-field': ['step', ['zoom'], '', 4, ['get', 'iata']],
        'text-font': FONT_BOLD,
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
        // icons and names stay visible at medium zoom (~50 km) and are not hidden by place labels of the base map
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': textOverlap,
      },
      paint: { 'text-color': '#cfe6ff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
    });
    add(airportLayer('airports', 1, ['international'], true), 'marker');
    // The map tiles only carry airports from zoom 8. The big ones (from our own airport list, by size) show up earlier:
    // the largest from zoom 5, then 6 and 7.
    AIRPORT_FAR.forEach((id, i) => {
      const spec = airportLayer(id, 5 + i, [], true);
      add({ ...spec, source: 'airports-far', 'source-layer': undefined, maxzoom: 8, filter: ['==', ['get', 'tier'], i + 1], layout: { ...spec.layout, 'text-field': ['get', 'iata'] } } as LayerSpecification, 'marker');
    });
    // 3D buildings everywhere, from zoom 14 on (the map has to be tilted to see them)
    add(
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'ofm',
        'source-layer': 'building',
        minzoom: 14,
        layout: hidden,
        paint: {
          'fill-extrusion-color': '#1c2538', // the dark building colour of the map
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.8,
        },
      },
      'marker',
    );
    add(airportLayer('airports-minor', 5.5, ['public', 'regional', 'other', 'military', 'private'], false), 'marker');
    if (!m.getSource('railmap'))
      m.addSource('railmap', {
        type: 'raster',
        tiles: ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png`),
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Bahnnetz: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)',
      });
    add({ id: 'railmap', type: 'raster', source: 'railmap', layout: hidden, paint: { 'raster-opacity': 0.85 } }, 'lbl-border-country');
    add(
      {
        id: 'nina-fill',
        type: 'fill',
        source: 'nina',
        layout: hidden,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'nina-line',
        type: 'line',
        source: 'nina',
        layout: hidden,
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.4 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'autobahn-line',
        type: 'line',
        source: 'autobahn-line',
        minzoom: 6,
        layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 12, 6], 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'autobahn',
        type: 'circle',
        source: 'autobahn',
        minzoom: 5,
        layout: { ...hidden, 'circle-sort-key': ['match', ['get', 'kind'], 'closure', 3, 'jam', 2, 'warning', 1, 0] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'kind'], 'roadworks', 2, 3], 11, ['match', ['get', 'kind'], 'roadworks', 5, 7]],
          'circle-stroke-color': ['match', ['get', 'kind'], 'closure', '#ffffff', 'rgba(0,0,0,0.6)'],
          'circle-stroke-width': 1.2,
        },
      },
      'marker',
    );
    const vehicleLayers = (id: string, label: string, filter: ExpressionSpecification) => {
      add(
        {
          id,
          type: 'circle',
          source: 'trains',
          filter,
          layout: hidden,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 10, 5, 14, 7],
            'circle-stroke-color': ['case', ['==', ['get', 'realTime'], false], 'rgba(255,255,255,0.45)', '#ffffff'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 10, 1.5],
          },
        },
        'marker',
      );
      add(
        {
          id: label,
          type: 'symbol',
          source: 'trains',
          filter,
          minzoom: 9,
          layout: {
            ...hidden,
            'text-field': ['get', 'name'],
            'text-font': FONT_BOLD,
            'text-size': 10,
            'text-offset': [0, 1.0],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
        },
        'marker',
      );
    };
    vehicleLayers('trains', 'trains-label', ['==', ['get', 'rail'], true]);
    vehicleLayers('transit-veh', 'transit-label', ['!=', ['get', 'rail'], true]);
    add(
      {
        id: 'ships',
        type: 'symbol',
        source: 'ships',
        layout: {
          ...hidden,
          'icon-image': 'sil-vessel',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 8, 0.8, 12, 1.15],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 10, ['get', 'name']],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': ['case', ['get', 'moving'], 1, 0.6],
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
          'text-color': '#e0f7fa',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
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
    add(
      {
        id: 'radio',
        type: 'circle',
        source: 'radio',
        layout: { ...hidden, 'circle-sort-key': ['get', 'clicks'] },
        paint: {
          'circle-color': ['case', ['get', 'playable'], '#ff4081', '#b0789a'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['interpolate', ['linear'], ['get', 'clicks'], 0, 1.5, 5000, 4], 8, ['interpolate', ['linear'], ['get', 'clicks'], 0, 4, 5000, 8]],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.3, 8, 1.2],
          'circle-opacity': 0.9,
        },
      },
      'marker',
    );
    add(
      {
        id: 'radio-label',
        type: 'symbol',
        source: 'radio',
        minzoom: 8,
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_REGULAR, 'text-size': 10, 'text-offset': [0, 1.0], 'text-anchor': 'top', 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'clicks']] },
        paint: { 'text-color': '#ffd1e3', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    // cameras
    const camIcon = (id: string, source: string): LayerSpecification => ({
      id,
      type: 'symbol',
      source,
      layout: {
        ...hidden,
        'icon-image': 'glyph-webcam',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 9, 0.85],
        'icon-allow-overlap': ['step', ['zoom'], false, 8, true],
      },
      paint: { 'icon-opacity': 0.95 },
    });
    add(camIcon('webcams', 'webcams'), 'marker');
    add(camIcon('webcams-osm', 'webcams-osm'), 'marker');
    // field of view as real-size sectors (metres on the ground, so they scale with the zoom)
    add(
      {
        id: 'alpr-cone',
        type: 'fill',
        source: 'alpr-fov',
        layout: hidden,
        paint: { 'fill-color': ALPR_RED, 'fill-opacity': 0.28 },
      },
      'marker',
    );
    add(
      {
        id: 'alpr-cone-line',
        type: 'line',
        source: 'alpr-fov',
        layout: hidden,
        paint: { 'line-color': ALPR_RED, 'line-width': 1.2, 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'alpr',
        type: 'circle',
        source: 'alpr',
        layout: hidden,
        paint: {
          'circle-color': ['case', ['get', 'flock'], ALPR_RED, '#ff9800'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 1.5],
        },
      },
      'marker',
    );
    m.on('error', (ev) => {
      const e = ev as typeof ev & { sourceId?: string };
      if (e.sourceId !== 'alpr-us' && e.sourceId !== 'alpr-ca') return;
      if (!this.alprTilesFailed) console.warn('ALPR-Übersicht', e.error);
      this.alprTilesFailed = true;
      this.updateAlprNote();
    });
    // moving objects on top
    add(
      {
        id: 'sat-track',
        type: 'line',
        source: 'sat-track',
        layout: hidden,
        paint: { 'line-color': '#ffd23f', 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
      },
      'marker',
    );
    add(
      {
        id: 'sats-dot',
        type: 'circle',
        source: 'sats',
        filter: ['==', ['get', 'group'], 'starlink'],
        layout: hidden,
        paint: { 'circle-color': '#c7d0e8', 'circle-radius': 1.6, 'circle-opacity': 0.8 },
      },
      'marker',
    );
    add(
      {
        id: 'sats-icon',
        type: 'symbol',
        source: 'sats',
        filter: ['!=', ['get', 'group'], 'starlink'],
        layout: {
          ...hidden,
          'icon-image': 'sil-satellite',
          'icon-size': ['case', ['==', ['get', 'group'], 'stations'], 0.9, 0.55],
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-color': ['match', ['get', 'group'], 'stations', '#ffd23f', 'weather', '#4fc3f7', 'gps-ops', '#7bd389', 'galileo', '#7bd389', '#d1b3ff'],
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'sats-label',
        type: 'symbol',
        source: 'sats',
        filter: ['any', ['==', ['get', 'group'], 'stations'], ['==', ['get', 'group'], 'weather']],
        minzoom: 2,
        layout: {
          ...hidden,
          'text-field': ['get', 'name'],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffe9a8', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: 'sondes',
        type: 'symbol',
        source: 'sondes',
        layout: { ...hidden, 'icon-image': 'sil-sonde', 'icon-size': 0.8, 'icon-allow-overlap': true },
        paint: { 'icon-color': '#ff8fab', 'icon-halo-color': 'rgba(0,0,0,0.7)', 'icon-halo-width': 1 },
      },
      'marker',
    );
    add(
      {
        id: 'aircraft',
        type: 'symbol',
        source: 'aircraft',
        layout: {
          ...hidden,
          'icon-image': ['concat', 'sil-', ['get', 'kind']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.3],
          'icon-rotate': ['case', ['==', ['get', 'kind'], 'balloon'], 0, ['get', 'track']],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 8, ['get', 'callsign']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['case', ['!=', ['get', 'emergency'], ''], '#ff2d55', ALT_COLOR],
          'icon-halo-color': 'rgba(0,0,0,0.75)',
          'icon-halo-width': 1,
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    this.airport3d = new Airport3D(m, 'marker', { info: (i) => this.set('airport3d', i), modeChanged: () => this.refreshAircraftIcons(), iconsTick: () => this.refreshAircraftIcons() });
    this.airport3d.init();
    this.ready = true;
    this.apply();
  }

  isOn(id: ExtraId) {
    return this.on.has(id);
  }

  setEnabled(ids: ExtraId[]) {
    this.on = new Set(ids);
    if (this.ready) this.apply();
  }

  toggle(id: ExtraId, on: boolean) {
    if (on) this.on.add(id);
    else this.on.delete(id);
    if (this.ready) this.apply();
  }

  /** Opacity of a layer in percent (100 = as designed); scales the original paint value of its map layers. */
  setOpacity(id: ExtraId, percent: number) {
    const f = Math.max(0.05, Math.min(1, percent / 100));
    if ((this.opacity[id] ?? 1) === f) return;
    this.opacity[id] = f;
    this.applyOpacity(id);
  }

  private applyOpacity(id: ExtraId) {
    const f = this.opacity[id] ?? 1;
    for (const lid of LAYERS[id]) {
      const type = this.map.getLayer(lid)?.type;
      const props = type ? OPACITY_PROPS[type] : undefined;
      if (!props) continue;
      for (const prop of props) {
        const key = `${lid}.${prop}`;
        if (!this.baseOpacity.has(key)) this.baseOpacity.set(key, this.map.getPaintProperty(lid, prop as never));
        const base = this.baseOpacity.get(key);
        let next: unknown;
        if (f === 1) next = base;
        else if (base == null) next = f;
        else if (typeof base === 'number') next = base * f;
        // expressions that depend on the zoom must stay a top-level interpolate/step – leave those alone
        else if (Array.isArray(base) && !JSON.stringify(base).includes('"zoom"')) next = ['*', f, base];
        else continue;
        this.map.setPaintProperty(lid, prop as never, next as never);
      }
    }
  }

  /** Badge text in the panel: count, '…' while loading or empty. */
  badge(id: ExtraId): string {
    const i = this.info[id];
    if (!this.on.has(id) || !i) return '';
    if (i.loading) return '…';
    return i.count != null ? fmt.num(i.count) : '';
  }

  /** Number of loaded features (undefined while off or not loaded). */
  count(id: ExtraId): number | undefined {
    return this.on.has(id) ? this.info[id]?.count : undefined;
  }

  note(id: ExtraId): string | undefined {
    return this.on.has(id) ? this.info[id]?.note : undefined;
  }

  /** The map layers of a layer entry (for the draw order), in their style order. */
  layerIds(id: ExtraId): string[] {
    return LAYERS[id] ?? [];
  }

  stop() {
    for (const t of Object.values(this.timers)) clearInterval(t);
    this.timers = {};
  }

  resume() {
    if (this.ready) this.apply();
  }

  /** Called after the map stopped moving. */
  onMoveEnd() {
    if (this.wantsAircraft()) this.loadAircraftNow();
    if (this.on.has('airport3d')) this.airport3d?.onMoveEnd();
    if (this.on.has('busnet')) this.loadBusnetNow();
    if (this.on.has('radio')) this.loadRadioNow();
    if (this.on.has('resources')) this.loadResourcesNow();
    if (this.on.has('pipelines')) this.loadPipelinesNow();
    if (this.on.has('trains') || this.on.has('transit')) this.loadFeedsNow();
    if (this.on.has('trains') || this.on.has('transit')) this.loadSegmentsNow();
    if (this.on.has('ships') && this.ais) this.ais.start(this.viewBounds(4));
    if (this.on.has('webcams')) this.loadWebcamsNow();
    if (this.on.has('alpr')) this.loadAlprNow();
    if (this.on.has('waves')) this.loadWavesNow();
    if (this.on.has('rivers')) this.loadRiversNow();
    if (this.on.has('wind') || this.on.has('solar') || this.on.has('plants')) this.loadOsmPowerNow();
  }

  // -------------------------------------------------------------------------

  private set(id: ExtraId, i: Info) {
    this.info[id] = { ...this.info[id], ...i };
    this.hooks.changed();
  }

  /** Big airports from our own list for the zoom levels 5–8, where the map tiles have none yet. */
  private async loadFarAirports() {
    const list = await staticAirports();
    const area = (b: number[]) => (b[2] - b[0]) * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180) * (b[3] - b[1]) * 111.32 ** 2; // km²
    const features: Feature<Point>[] = list
      .filter((a) => a.iata)
      .map((a) => {
        const km2 = area(a.bbox);
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [(a.bbox[0] + a.bbox[2]) / 2, (a.bbox[1] + a.bbox[3]) / 2] },
          properties: { icao: a.icao, iata: a.iata, name: a.name, tier: km2 >= 45 ? 1 : km2 >= 30 ? 2 : 3 },
        };
      });
    this.setData('airports-far', { type: 'FeatureCollection', features });
  }

  private setData(source: string, data: FeatureCollection) {
    (this.map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
  }

  private vis(layer: string, on: boolean) {
    if (this.map.getLayer(layer)) this.map.setLayoutProperty(layer, 'visibility', on ? 'visible' : 'none');
  }

  private every(key: string, ms: number, fn: () => void) {
    if (this.timers[key]) return;
    this.timers[key] = window.setInterval(() => {
      if (!document.hidden) fn();
    }, ms);
  }

  private clear(key: string) {
    clearInterval(this.timers[key]);
    delete this.timers[key];
  }

  /** Bring layers, timers and data in line with the enabled set. */
  private apply() {
    const visible = new Set<string>();
    for (const id of this.on) LAYERS[id].forEach((l) => visible.add(l));
    for (const l of new Set(Object.values(LAYERS).flat())) this.vis(l, visible.has(l));
    // layers that were added lazily pick up the chosen opacity now
    for (const id of this.on) if ((this.opacity[id] ?? 1) !== 1) this.applyOpacity(id);
    // power plants share layers – filter by enabled categories
    const cats = (Object.keys(POWER_CAT) as ExtraId[]).filter((id) => this.on.has(id)).map((id) => POWER_CAT[id]!);
    this.map.setFilter('power', ['in', ['get', 'cat'], ['literal', cats]]);
    this.map.setFilter('osm-power', ['in', ['get', 'cat'], ['literal', cats]]);
    if (this.info.dwdwarn?.note && this.on.has('dwdwarn')) this.vis('dwd', true);
    else if (!this.on.has('dwdwarn')) this.vis('dwd', false);

    // 3D layout of the airports, 3D aircraft with trails, and whether the 2D aircraft icons are shown
    this.airport3d?.configure({ layout: this.on.has('airport3d'), planes: this.wantsAircraft(), icons: this.on.has('aircraft') });
    this.refreshAircraftIcons();
    // the airport symbols make room for the 3D airport once it is drawn
    const maxZoom = this.on.has('airport3d') ? AIRPORT_ZOOM : 24;
    for (const [id, min] of [['airports', 1], ['airports-minor', 5.5]] as const) if (this.map.getLayer(id)) this.map.setLayerZoomRange(id, min, maxZoom);

    for (const def of EXTRAS) {
      const on = this.on.has(def.id);
      if (!on) {
        this.clear(def.id);
        continue;
      }
      switch (def.id) {
        case 'cities':
          this.loadOnce('cities', 60 * 60000, () => this.loadCities());
          break;
        case 'dwdwarn':
          this.loadOnce('dwdwarn', 10 * 60000, () => this.loadDwd());
          break;
        case 'gauges':
          this.loadOnce('gauges', 15 * 60000, async () => {
            const fc = await loadPegel();
            this.setData('gauges', fc);
            const high = fc.features.filter((f) => f.properties.state === 'high').length;
            return { count: fc.features.length, note: high ? `${high} Pegel mit Hochwasser` : undefined };
          });
          break;
        case 'aq':
          this.loadOnce('aq', 60 * 60000, async () => {
            const fc = await loadCityAirQuality();
            this.setData('aq', fc);
            return { count: fc.features.length };
          });
          break;
        case 'aircraft':
          this.loadAircraftNow();
          this.every('aircraft', 10000, () => this.loadAircraftNow());
          break;
        case 'airport3d':
          this.loadAircraftNow();
          this.every('airport3d', 10000, () => this.loadAircraftNow());
          break;
        case 'sondes':
          this.loadOnce('sondes', 60000, async () => {
            const fc = await loadSondes();
            this.setData('sondes', fc);
            return { count: fc.features.length };
          });
          break;
        case 'sats':
        case 'starlink':
          this.startSatellites();
          break;
        case 'shipping':
          this.loadOnce('shipping', Infinity, async () => {
            const fc = await loadShippingLanes();
            this.setData('ship-lanes', fc);
            return { count: fc.features.length };
          });
          break;
        case 'cables':
          this.loadOnce('cables', Infinity, () => this.loadCablesAndIxps());
          break;
        case 'wind':
        case 'solar':
        case 'plants':
          this.ensurePower();
          break;
        case 'webcams':
          this.loadOnce('webcams', 6 * 60 * 60000, async () => {
            try {
              this.fiCams = await loadDigitrafficCams();
            } catch (e) {
              console.warn('Digitraffic', e);
            }
            this.mergeWebcams();
            return {};
          });
          this.loadWebcamsNow();
          break;
        case 'alpr':
          this.ensureAlprTiles();
          this.loadAlprNow();
          break;
        case 'aurora':
          this.loadOnce('aurora', 15 * 60000, async () => {
            const [r, sw] = await Promise.all([loadAurora(), loadSpaceWeather().catch(() => null)]);
            this.setData('aurora', r.fc);
            const t = new Date(r.forecastTime);
            const kp = r.kp != null ? `Kp ${fmt.num(r.kp, 1)}${r.kp >= 5 ? ' – geomagnetischer Sturm!' : ''} · ` : '';
            const sun = sw
              ? ` · Sonnenwind ${sw.windKmS != null ? `${Math.round(sw.windKmS)} km/s` : '–'}${sw.bz != null ? `, Bz ${fmt.num(sw.bz, 1)} nT${sw.bz < -5 ? ' (günstig)' : ''}` : ''}${sw.xray ? `, Röntgen ${sw.xray}` : ''}`
              : '';
            return { count: undefined, note: `${kp}Vorhersage für ${t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr${sun}` };
          });
          break;
        case 'gvp':
          this.loadOnce('gvp', Infinity, async () => {
            const fc = await loadGvpVolcanoes();
            this.setData('gvp', fc);
            const recent = fc.features.filter((f) => f.properties?.state === 'recent').length;
            return { count: fc.features.length, note: `${recent} mit Ausbruch seit letztem Jahr (rot)` };
          });
          break;
        case 'fireareas':
          this.loadOnce('fireareas', 30 * 60000, async () => {
            const fc = await loadFirePerimeters();
            this.setData('fireareas', fc);
            return { count: fc.features.length, note: fc.features.length ? undefined : 'derzeit keine aktiven Brandflächen' };
          });
          break;
        case 'tsunami':
          this.loadOnce('tsunami', 10 * 60000, async () => {
            const fc = await loadTsunami();
            this.setData('tsunami', fc);
            const warn = fc.features.filter((f) => f.properties?.level === 'warning').length;
            return { count: fc.features.length, note: !fc.features.length ? 'keine Meldungen in den letzten 7 Tagen' : warn ? `${warn} aktive Warnung(en)!` : undefined };
          });
          break;
        case 'lightning':
          this.lightning ??= new LightningStream(() => this.lightningStatus());
          this.lightning.start();
          this.every('lightning', 3000, () => this.updateLightning());
          this.updateLightning();
          break;
        case 'buoys':
          this.loadOnce('buoys', 10 * 60000, async () => {
            const fc = await loadBuoys();
            this.setData('buoys', fc);
            return { count: fc.features.length, note: 'Farbe = Wellenhöhe, Zahl = Wellenhöhe in m (sonst Wind in kn)' };
          });
          break;
        case 'tides':
          this.loadOnce('tides', Infinity, async () => {
            const fc = await loadTideStations();
            this.setData('tides', fc);
            return { count: fc.features.length, note: 'Klick auf einen Pegel zeigt Wasserstand & Gezeiten' };
          });
          break;
        case 'waves':
          this.loadWavesNow();
          break;
        case 'rivers':
          this.loadRiversNow();
          break;
        case 'jmaradar':
          this.loadOnce('jmaradar', 5 * 60000, () => this.loadJmaRadar());
          break;
        case 'jmanowcast':
          this.loadOnce('jmanowcast', 5 * 60000, () => this.loadJmaRadar('jmanowcast'));
          break;
        case 'terrain':
          this.setTerrain(true);
          break;
        case 'radiation':
          this.loadOnce('radiation', 60 * 60000, async () => {
            const r = await loadRadiation();
            this.setData('radiation', r.fc);
            return { count: r.fc.features.length, note: r.failed.length ? `${r.failed.join(', ')} nicht erreichbar` : 'natürlicher Normalbereich: 0,04–0,20 µSv/h' };
          });
          break;
        case 'launches':
          this.loadOnce('launches', 60 * 60000, async () => {
            this.launchData = await loadLaunches();
            this.updateLaunchLabels();
            return { count: this.launchData.features.length };
          });
          this.every('launch-labels', 60000, () => this.updateLaunchLabels());
          break;
        case 'airports':
          this.set('airports', { note: 'Klick auf einen Flughafen zeigt Abflüge & Ankünfte vom Vortag' });
          void this.loadFarAirports();
          break;
        case 'ships':
          this.loadOnce('ships', 60000, () => this.loadShips());
          if (hasAisKey()) {
            this.ais ??= new AisStream(() => this.mergeShips());
            this.ais.start(this.viewBounds(4));
            this.every('ais-push', 3000, () => this.mergeShips());
          }
          break;
        case 'trains':
          this.loadOnce('trains', 30000, () => this.loadGpsTrains());
          break;
        case 'autobahn':
          this.loadOnce('autobahn', 10 * 60000, async () => {
            const r = await loadAutobahn();
            this.setData('autobahn', r.points);
            this.setData('autobahn-line', r.lines);
            const n = (k: string) => r.points.features.filter((f) => f.properties?.kind === k).length;
            return { count: r.points.features.length, note: `${n('jam')} Staus · ${n('closure')} Sperrungen · ${n('roadworks')} Baustellen` };
          });
          break;
        case 'busnet':
          this.loadBusnetNow();
          break;
        case 'radio':
          this.loadRadioNow();
          break;
        case 'resources':
          this.loadOnce('resources', Infinity, async () => {
            this.resWd = await loadWikidataResources();
            this.mergeResources();
            return {};
          });
          this.loadResourcesNow();
          break;
        case 'pipelines':
          this.loadPipelinesNow();
          break;
        case 'plates':
          this.loadOnce('plates', Infinity, async () => {
            const fc = await fetchJsonExt<FeatureCollection>('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json');
            this.setData('plates', fc);
            return { count: fc.features.length };
          });
          break;
        case 'nina':
          this.loadOnce('nina', 5 * 60000, async () => {
            const fc = await loadNina();
            this.setData('nina', fc);
            const ids = new Set(fc.features.map((f) => f.properties?.id));
            return { count: ids.size, note: ids.size ? undefined : 'derzeit keine Warnungen' };
          });
          break;
      }
    }
    if (!this.on.has('sats') && !this.on.has('starlink')) this.clear('sat-pos');
    if (!this.on.has('launches')) this.clear('launch-labels');
    if (this.on.has('trains') || this.on.has('transit')) {
      this.loadSegmentsNow();
      this.every('veh-anim', 2000, () => this.updateVehicles());
      this.every('veh-fetch', 60000, () => this.loadSegmentsNow(true));
      this.loadFeedsNow();
      this.every('veh-feeds', 10000, () => this.loadFeedsNow());
    } else {
      this.clear('veh-anim');
      this.clear('veh-fetch');
      this.clear('veh-feeds');
    }
    if (!this.on.has('terrain')) this.setTerrain(false);
    if (!this.on.has('waves')) this.waveKey = '';
    if (!this.on.has('rivers')) this.riverKey = '';
    if (!this.on.has('lightning')) {
      this.clear('lightning');
      this.lightning?.stop();
      this.setData('lightning', empty());
    }
    if (!this.on.has('ships') || !hasAisKey()) {
      this.clear('ais-push');
      this.ais?.stop();
      if (!hasAisKey()) this.ais = null;
    }
  }

  /** Load once (or again after `maxAge`), then refresh every `maxAge` while enabled. */
  private loadOnce(id: ExtraId, maxAge: number, fn: () => Promise<Partial<Info> | void>) {
    const run = () => {
      if (this.info[id]?.loading) return;
      this.set(id, { loading: true });
      fn()
        .then((r) => this.set(id, { loading: false, at: Date.now(), ...(r ?? {}) }))
        .catch((e) => {
          console.warn(id, e);
          this.set(id, { loading: false, at: Date.now(), note: 'Quelle nicht erreichbar' });
          this.hooks.toast(`${EXTRAS.find((d) => d.id === id)!.label}: Daten konnten nicht geladen werden.`);
        });
    };
    const at = this.info[id]?.at ?? 0;
    if (Date.now() - at > maxAge || !at) run();
    if (Number.isFinite(maxAge)) this.every(id, maxAge, run);
  }

  /** Point a JMA source at its newest scan (observation) or the +60 min forecast frame (nowcast). */
  private async loadJmaRadar(id: 'jmaradar' | 'jmanowcast' = 'jmaradar') {
    const nowcast = id === 'jmanowcast';
    const r = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_${nowcast ? 'N2' : 'N1'}.json`);
    if (!r.ok) throw new Error(`JMA ${r.status}`);
    const times = (await r.json()) as { basetime: string; validtime: string }[];
    const latest = nowcast ? times.reduce((a, t) => (t.basetime > a.basetime || (t.basetime === a.basetime && t.validtime > a.validtime) ? t : a), times[0]) : (times.find((t) => t.basetime === t.validtime) ?? times[0]);
    if (!latest) throw new Error('JMA: keine Radarzeit');
    (this.map.getSource(id) as RasterTileSource | undefined)?.setTiles([JMA_RADAR_TILES(latest.basetime, latest.validtime)]);
  }

  private async loadCities() {
    const list = await loadCityWeather();
    await ensureWeatherIcons(
      this.map,
      list.map((c) => ({ code: c.code, isDay: c.isDay })),
      (code, isDay) => weatherIcon(code, isDay, 64),
    );
    this.setData('cities', {
      type: 'FeatureCollection',
      features: list.map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { name: c.name, temp: `${Math.round(c.temp)}°`, icon: `wx-${c.code}-${c.isDay ? 'd' : 'n'}`, rank: c.rank },
      })),
    });
    return { count: list.length };
  }

  private async loadDwd() {
    try {
      const fc = await loadDwdWarnings();
      this.setData('dwd-warn', fc);
      this.vis('dwd', false);
      return { count: fc.features.length, note: fc.features.length ? undefined : 'derzeit keine Warnungen' };
    } catch (e) {
      // WFS unavailable – fall back to the rendered WMS image (not clickable)
      console.warn('DWD WFS', e);
      this.vis('dwd', this.on.has('dwdwarn'));
      return { note: 'nur als Kartenbild verfügbar' };
    }
  }

  /** Throttled: no overlapping requests and at least 5 s between two (timer + map moves). */
  /** The aircraft feed also drives the 3D airport layer. */
  private wantsAircraft() {
    return this.on.has('aircraft') || this.on.has('airport3d');
  }

  private loadAircraftNow() {
    if (!this.wantsAircraft()) return;
    if (this.aircraftBusy) {
      this.aircraftAgain = true;
      return;
    }
    const wait = this.aircraftAt + 5000 - Date.now();
    if (wait > 0) {
      clearTimeout(this.aircraftDelay);
      this.aircraftDelay = window.setTimeout(() => this.loadAircraftNow(), wait);
      return;
    }
    this.aircraftBusy = true;
    this.aircraftAt = Date.now();
    this.fetchAircraft().finally(() => {
      this.aircraftBusy = false;
      if (this.aircraftAgain) {
        this.aircraftAgain = false;
        this.loadAircraftNow();
      }
    });
  }

  private selectedBusy = false;

  /** The selected aircraft is followed on its own, so it stays up to date outside the area of the map request. */
  private fetchSelected() {
    const hex = this.airport3d?.selectedHex();
    if (!hex || this.selectedBusy) return;
    this.selectedBusy = true;
    loadAircraftByHex(hex)
      .then((fc) => this.airport3d?.feed(fc))
      .catch(() => undefined)
      .finally(() => (this.selectedBusy = false));
  }

  private fetchAircraft(): Promise<void> {
    const m = this.map;
    this.fetchSelected();
    if (m.getZoom() < 5) {
      // the 3D airport layer only needs the live feed
      if (!this.on.has('aircraft')) return Promise.resolve();
      // zoomed out: coarse worldwide overview (positions refresh every 2 minutes)
      const seq = ++this.aircraftSeq;
      return loadGlobalAircraft()
        .then((fc) => {
          if (seq !== this.aircraftSeq || !this.on.has('aircraft')) return;
          this.setData('aircraft', fc);
          this.set('aircraft', { loading: false, count: fc.features.length, note: 'Weltübersicht (OpenSky, alle 2 min) – reinzoomen für Live-Details' });
        })
        .catch(() => {
          if (seq !== this.aircraftSeq) return;
          this.setData('aircraft', empty());
          this.set('aircraft', { note: 'Weltübersicht gerade nicht verfügbar – zum Anzeigen näher heranzoomen', count: undefined, loading: false });
        });
    }
    const c = m.getCenter();
    const b = m.getBounds();
    // radius = distance centre → corner in nautical miles
    const dLat = ((b.getNorth() - c.lat) * Math.PI) / 180;
    const dLon = ((b.getEast() - c.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((c.lat * Math.PI) / 180) * Math.cos((b.getNorth() * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const nm = km / 1.852;
    const seq = ++this.aircraftSeq;
    if (this.on.has('aircraft') && !this.info.aircraft?.count) this.set('aircraft', { loading: true, note: undefined });
    return loadAircraft(c.lat, c.lng, nm)
      .then((fc) => {
        this.aircraftErr = '';
        if (seq !== this.aircraftSeq || !this.wantsAircraft()) return;
        this.lastAircraft = fc;
        this.airport3d?.feed(fc, { lat: c.lat, lon: c.lng, nm });
        if (!this.on.has('aircraft')) return;
        this.refreshAircraftIcons();
        this.set('aircraft', { loading: false, count: fc.features.length, note: `via ${fc.source}${nm > 250 ? ' · nur Umkreis um die Kartenmitte' : ''}` });
      })
      .catch((e) => {
        // log once per distinct failure, not on every refresh
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== this.aircraftErr && msg !== AC_ALL_PAUSED) console.warn('aircraft', e);
        this.aircraftErr = msg;
        if (seq === this.aircraftSeq && this.on.has('aircraft'))
          this.set('aircraft', { loading: false, note: 'keine Flugdatenquelle erreichbar – ggf. Daten-Proxy einrichten (README)' });
      });
  }

  /** 2D aircraft icons: all aircraft, except those drawn as 3D models while the map is tilted. */
  private refreshAircraftIcons() {
    if (!this.on.has('aircraft') || !this.lastAircraft) return;
    const fc = this.lastAircraft;
    const airport = this.airport3d;
    // aircraft of the cache that the latest request did not return stay visible (they keep flying on their course)
    const cached = airport ? airport.cachedFeatures(new Set(fc.features.map((f) => String(f.properties?.hex)))) : [];
    let features = airport ? [...fc.features, ...cached].filter((f) => !airport.owns(String(f.properties?.hex))) : fc.features;
    // on a flat map the icons move like the 3D models: smoothed position and heading
    if (airport?.mode() === 'flat') {
      features = features.map((f) => {
        const live = airport.planeInfo(String(f.properties?.hex));
        return live ? { ...f, geometry: { type: 'Point', coordinates: [live.lon, live.lat] }, properties: { ...f.properties, track: live.track } } : f;
      });
    }
    this.setData('aircraft', { ...fc, features });
  }

  /** Current data of an aircraft for the flight panel (smoothed position if it is tracked in 3D). */
  flightInfo(hex: string): FlightInfo | null {
    const f = this.lastAircraft?.features.find((x) => x.properties?.hex === hex) ?? this.airport3d?.cachedFeatures(new Set())?.find((x) => x.properties?.hex === hex);
    if (!f) return null;
    const p = f.properties as Record<string, unknown>;
    const live = this.airport3d?.planeInfo(hex);
    const [lon, lat] = f.geometry.coordinates;
    return {
      hex,
      callsign: String(p.callsign ?? ''),
      reg: String(p.reg ?? ''),
      type: String(p.type ?? ''),
      icao: String(p.icao ?? ''),
      operator: String(p.operator ?? ''),
      altM: live ? live.altM : Number(p.altM) || 0,
      speedKmh: p.speedKmh != null ? Number(p.speedKmh) : null,
      track: live ? live.track : Number(p.track) || 0,
      ground: !!p.ground,
      emergency: String(p.emergency ?? ''),
      squawk: String(p.squawk ?? ''),
      vsMs: p.vsMs != null ? Number(p.vsMs) : null,
      lon: live ? live.lon : lon,
      lat: live ? live.lat : lat,
      source: this.lastAircraft?.source ?? '',
      route: this.airport3d?.route(hex),
    };
  }

  /** Aircraft under a screen point: the model, its trail or the wall below the trail. */
  pickFlight(x: number, y: number): string | null {
    return this.airport3d?.pick(x, y) ?? null;
  }

  /** Highlight the trail of an aircraft (null: none). */
  selectFlight(hex: string | null) {
    this.airport3d?.select(hex);
  }

  /** Zoom the map to the whole trail of an aircraft. */
  fitFlight(hex: string) {
    this.airport3d?.fitTrail(hex);
  }

  private startSatellites() {
    const wantBase = this.on.has('sats');
    const wantStarlink = this.on.has('starlink');
    if (wantBase && !this.sats.length && !this.satsLoading) {
      this.set('sats', { loading: true });
      this.satsLoading = loadSatellites()
        .then((s) => {
          this.sats = s;
          this.set('sats', { loading: false, count: s.length });
        })
        .catch(() => {
          this.set('sats', { loading: false, note: 'CelesTrak nicht erreichbar' });
          this.hooks.toast('Satellitendaten (CelesTrak) konnten nicht geladen werden.');
        })
        .finally(() => {
          this.satsLoading = null;
          this.updateSatPositions();
        });
    }
    if (wantStarlink && !this.starlink.length && !this.starlinkLoading) {
      this.set('starlink', { loading: true });
      this.starlinkLoading = loadSatGroup('starlink')
        .then((s) => {
          this.starlink = s;
          this.set('starlink', { loading: false, count: s.length });
        })
        .catch(() => this.set('starlink', { loading: false, note: 'CelesTrak nicht erreichbar' }))
        .finally(() => {
          this.starlinkLoading = null;
          this.updateSatPositions();
        });
    }
    this.updateSatPositions();
    this.clear('sat-pos');
    this.every('sat-pos', wantStarlink ? 4000 : 2000, () => this.updateSatPositions());
  }

  private updateSatPositions() {
    const list = [...(this.on.has('sats') ? this.sats : []), ...(this.on.has('starlink') ? this.starlink : [])];
    this.setData('sats', satelliteFeatures(list));
  }

  private async loadCablesAndIxps() {
    const [cables, ixps] = await Promise.allSettled([loadCables(), loadIxps()]);
    let count = 0;
    const missing: string[] = [];
    if (cables.status === 'fulfilled') {
      this.setData('cables', cables.value);
      count += cables.value.features.length;
    } else missing.push('Seekabel');
    if (ixps.status === 'fulfilled') {
      this.setData('ixp', ixps.value);
      count += ixps.value.features.length;
    } else missing.push('Internetknoten');
    if (missing.length === 2) throw new Error('keine Quelle erreichbar');
    return { count, note: missing.length ? `${missing.join(', ')} nicht erreichbar` : undefined };
  }

  private ensurePower() {
    if (!this.powerLoaded && !this.powerLoading) {
      for (const id of ['wind', 'solar', 'plants'] as ExtraId[]) if (this.on.has(id)) this.set(id, { loading: true });
      this.powerLoading = loadPowerPlants()
        .then((fc) => {
          this.powerLoaded = true;
          this.setData('power', fc);
          this.powerCounts = { wind: 0, solar: 0, other: 0 };
          for (const f of fc.features) this.powerCounts[f.properties!.cat as PowerCat]++;
        })
        .catch(() => this.hooks.toast('Kraftwerksdatenbank konnte nicht geladen werden.'))
        .finally(() => {
          this.powerLoading = null;
          for (const id of ['wind', 'solar', 'plants'] as ExtraId[]) {
            this.set(id, { loading: false, count: this.powerLoaded ? this.powerCounts[POWER_CAT[id]!] : undefined });
          }
        });
    }
    this.loadOsmPowerNow();
  }

  private loadOsmPowerNow() {
    const m = this.map;
    if (m.getZoom() < 10) return;
    const b = m.getBounds();
    // snap to a grid so small pans reuse the last result
    const snap = (v: number, f: (x: number) => number) => f(v * 20) / 20;
    const bounds = {
      west: snap(b.getWest(), Math.floor),
      south: snap(b.getSouth(), Math.floor),
      east: snap(b.getEast(), Math.ceil),
      north: snap(b.getNorth(), Math.ceil),
    };
    const key = Object.values(bounds).join(',');
    if (key === this.osmPowerKey) return;
    this.osmPowerKey = key;
    loadOsmPower(bounds)
      .then((fc) => {
        if (this.osmPowerKey === key) this.setData('osm-power', fc);
      })
      .catch((e) => {
        if (isSuperseded(e) || this.osmPowerKey !== key) return;
        console.warn('Overpass', e);
        this.osmPowerKey = '';
      });
  }

  // -------------------------------------------------------------------------
  // Trains & public transport

  /** Resources: Wikidata worldwide; USGS MRDS from zoom 7; OpenStreetMap from zoom 10. */
  private loadResourcesNow() {
    const z = this.map.getZoom();
    if (z >= 7) {
      const b = this.viewBounds(4);
      const key = Object.values(b).join(',');
      if (key !== this.resMrdsKey) {
        this.resMrdsKey = key;
        loadMrds(b)
          .then((fc) => {
            if (this.resMrdsKey !== key) return;
            this.resMrds = fc;
            this.mergeResources();
          })
          .catch((e) => {
            console.warn('USGS MRDS', e);
            this.resMrdsKey = '';
          });
      }
    } else if (this.resMrds.features.length) {
      this.resMrds = empty();
      this.resMrdsKey = '';
    }
    if (z >= 10) {
      const b = this.viewBounds(20);
      const key = Object.values(b).join(',');
      if (key !== this.resOsmKey) {
        this.resOsmKey = key;
        loadOsmResources(b)
          .then((fc) => {
            if (this.resOsmKey !== key) return;
            this.resOsm = fc;
            this.mergeResources();
          })
          .catch((e) => {
            if (isSuperseded(e) || this.resOsmKey !== key) return;
            console.warn('Overpass resources', e);
            this.resOsmKey = '';
          });
      }
    } else if (this.resOsm.features.length) {
      this.resOsm = empty();
      this.resOsmKey = '';
    }
    this.mergeResources();
  }

  private mergeResources() {
    const features = [...this.resWd.features, ...this.resMrds.features, ...this.resOsm.features];
    this.setData('resources', { type: 'FeatureCollection', features });
    const z = this.map.getZoom();
    const level = z < 7 ? 'Weltübersicht (Wikidata) – reinzoomen für USGS/BGR (ab 7) und OSM (ab 10)' : z < 10 ? 'Regional: Wikidata, USGS MRDS, BGR (DE) – ab Zoom 10 OpenStreetMap' : 'Lokal: alle Quellen inkl. OpenStreetMap';
    if (features.length || !this.info.resources?.loading) this.set('resources', { count: features.length, note: level });
  }

  private loadPipelinesNow() {
    const z = this.map.getZoom();
    if (z < 8) {
      this.set('pipelines', { note: 'ab Zoomstufe 8 sichtbar' });
      return;
    }
    const b = this.viewBounds(10);
    const key = Object.values(b).join(',');
    if (key === this.pipeKey) return;
    this.pipeKey = key;
    this.set('pipelines', { loading: true, note: undefined });
    loadPipelines(b)
      .then((fc) => {
        if (this.pipeKey !== key) return;
        this.setData('pipelines', fc);
        this.set('pipelines', { loading: false, count: fc.features.length, note: 'blau Gas · orange Öl · lila Wasserstoff' });
      })
      .catch((e) => {
        if (isSuperseded(e) || this.pipeKey !== key) return;
        console.warn('Overpass pipelines', e);
        this.pipeKey = '';
        this.set('pipelines', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
      });
  }

  /** Radio: popular stations worldwide, all stations around the centre from zoom 6. */
  private loadRadioNow() {
    if (!this.radioTop && !this.info.radio?.loading) {
      this.set('radio', { loading: true });
      loadTopStations()
        .then((fc) => {
          this.radioTop = fc;
          this.mergeRadio();
        })
        .catch((e) => {
          console.warn('Radio Browser', e);
          this.set('radio', { loading: false, note: 'Radio Browser nicht erreichbar' });
        });
    }
    const z = this.map.getZoom();
    if (z < 6) {
      this.set('radio', { note: 'beliebteste Sender weltweit – reinzoomen für alle Sender der Region' });
      return;
    }
    const c = this.map.getCenter();
    const b = this.map.getBounds();
    const km = Math.min(600, (Math.abs(b.getNorth() - b.getSouth()) * 111) / 1.4);
    const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${Math.round(km / 25)}`;
    if (key === this.radioKey) return;
    this.radioKey = key;
    loadNearbyStations(c.lat, c.lng, km)
      .then((fc) => {
        if (this.radioKey !== key) return;
        this.radioNear = fc;
        this.mergeRadio();
      })
      .catch((e) => {
        console.warn('Radio Browser nearby', e);
        this.radioKey = '';
      });
  }

  private mergeRadio() {
    const seen = new Set<string>();
    const features = [...this.radioNear.features, ...(this.radioTop?.features ?? [])].filter((f) => {
      const id = String(f.properties?.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    this.setData('radio', { type: 'FeatureCollection', features });
    const playable = features.filter((f) => f.properties?.playable).length;
    this.set('radio', { loading: false, count: features.length, note: `${playable} direkt abspielbar (pink) · andere öffnen im neuen Tab` });
  }

  /** OSM public transport lines for the view (from zoom 11 – Overpass results get large). */
  private loadBusnetNow() {
    const z = this.map.getZoom();
    if (z < 11) {
      this.set('busnet', { note: 'ab Stadtzoom (Zoomstufe 11) – Daten aus OpenStreetMap' });
      return;
    }
    const b = this.viewBounds(z >= 13 ? 50 : 10);
    const key = Object.values(b).join(',');
    if (key === this.busnetKey) return;
    this.busnetKey = key;
    this.set('busnet', { loading: true, note: undefined });
    loadTransitNetwork(b)
      .then((r) => {
        if (this.busnetKey !== key) return;
        this.setData('busnet', r.lines);
        this.setData('busnet-stops', r.stops);
        const modes = new Set(r.lines.features.map((f) => f.properties?.modeLabel));
        this.set('busnet', { loading: false, count: r.lines.features.length, note: r.lines.features.length ? `Linien: ${[...modes].join(', ')}` : 'keine Linien im Ausschnitt erfasst' });
      })
      .catch((e) => {
        if (isSuperseded(e) || this.busnetKey !== key) return;
        console.warn('Overpass ÖPNV', e);
        this.busnetKey = '';
        this.set('busnet', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar oder überlastet – bitte erneut verschieben' });
      });
  }

  private async loadGpsTrains() {
    const [fi, us] = await Promise.allSettled([loadTrains(), loadAmtrak()]);
    const features = [...(fi.status === 'fulfilled' ? fi.value.features : []), ...(us.status === 'fulfilled' ? us.value : [])];
    this.gpsTrains = { type: 'FeatureCollection', features };
    this.updateVehicles();
    const failed = [fi.status === 'rejected' ? 'Finnland' : '', us.status === 'rejected' ? 'Amtrak' : ''].filter(Boolean);
    return { note: this.trainNote(failed) };
  }

  private trainNote(failed: string[] = []) {
    const z = this.map.getZoom();
    return [z < 5 ? 'Deutschland & Europa ab Zoomstufe 5' : '', failed.length ? `${failed.join(', ')} nicht erreichbar` : ''].filter(Boolean).join(' · ') || undefined;
  }

  /** Fetch Transitous trip segments for the view (rail from zoom 5, local transport from zoom 10). */
  private loadSegmentsNow(force = false) {
    const z = this.map.getZoom();
    const wantRail = this.on.has('trains') && z >= 5;
    const wantLocal = this.on.has('transit') && z >= 10;
    const cityNote = 'Fahrplan-Echtzeit (Transitous) ab Zoomstufe 10 – GPS-Regionen schon früher';
    if (this.on.has('transit')) this.set('transit', { note: z < 10 ? cityNote : this.info.transit?.note === cityNote ? undefined : this.info.transit?.note });
    if (this.on.has('trains')) this.set('trains', { note: this.trainNote() });
    if (!wantRail && !wantLocal) {
      this.segs = [];
      this.segKey = '';
      this.updateVehicles();
      return;
    }
    const b = this.viewBounds(z >= 10 ? 20 : 2);
    const key = `${Object.values(b).join(',')}|${Math.round(z)}`;
    if (this.segLoading || (!force && key === this.segKey && Date.now() - this.segAt < 60000)) return;
    this.segLoading = true;
    const now = Date.now();
    loadSegments(b, z, now - 30000, now + 3 * 60000)
      .then((segs) => {
        this.segs = segs;
        this.segKey = key;
        this.segAt = Date.now();
        this.updateVehicles();
      })
      .catch((e) => {
        console.warn('Transitous', e);
        if (this.on.has('trains')) this.set('trains', { note: 'Transitous nicht erreichbar – nur GPS-Züge (Finnland, USA)' });
        if (this.on.has('transit')) this.set('transit', { note: 'Transitous nicht erreichbar' });
      })
      .finally(() => {
        this.segLoading = false;
      });
  }

  /** GPS feeds (Norway, Boston, Toronto, …) for the regions in view, each at its own interval. */
  private loadFeedsNow() {
    if (this.map.getZoom() < 4) return;
    const b = this.map.getBounds();
    const view = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
    const active = new Set<string>();
    for (const feed of feedsInView(view)) {
      active.add(feed.id);
      const prev = this.feedVeh.get(feed.id);
      if (this.feedLoading.has(feed.id) || (prev && Date.now() - prev.at < feed.every * 1000)) continue;
      this.feedLoading.add(feed.id);
      // Entur supports a bounding box – pad the view so small pans need no reload
      const padX = (view.east - view.west) * 0.3;
      const padY = (view.north - view.south) * 0.3;
      feed
        .load({ west: view.west - padX, east: view.east + padX, south: view.south - padY, north: view.north + padY })
        .then((list) => {
          this.feedVeh.set(feed.id, { at: Date.now(), features: vehicleFeatures(feed, list) });
          this.feedErrors.delete(feed.label);
          this.updateVehicles();
        })
        .catch((e) => {
          console.warn(feed.id, e);
          this.feedVeh.set(feed.id, { at: Date.now(), features: [] });
          this.feedErrors.add(feed.label);
          const note = `${[...this.feedErrors].join(', ')} nicht erreichbar`;
          if (this.on.has('transit')) this.set('transit', { note });
        })
        .finally(() => this.feedLoading.delete(feed.id));
    }
    // drop vehicles of regions that left the view
    for (const id of [...this.feedVeh.keys()]) if (!active.has(id)) this.feedVeh.delete(id);
  }

  private updateVehicles() {
    const rail = this.on.has('trains');
    const local = this.on.has('transit');
    const live = positionsAt(this.segs, Date.now(), (m) => (RAIL_MODES.has(m) ? rail : local));
    const gps = [...this.feedVeh.values()].flatMap((f) => f.features).filter((f) => (f.properties?.rail ? rail : local));
    const features = [...live.features, ...gps, ...(rail ? this.gpsTrains.features : [])];
    this.setData('trains', { type: 'FeatureCollection', features });
    const nRail = features.filter((f) => f.properties?.rail).length;
    if (rail && this.info.trains?.count !== nRail) this.set('trains', { count: nRail, loading: false });
    if (local && this.info.transit?.count !== features.length - nRail) this.set('transit', { count: features.length - nRail });
  }

  // -------------------------------------------------------------------------
  // Launches, ships

  private updateLaunchLabels() {
    if (!this.launchData) return;
    for (const f of this.launchData.features) f.properties!.when = countdown(String(f.properties!.next));
    this.setData('launches', this.launchData);
  }

  private async loadShips() {
    let note: string | undefined;
    try {
      this.baltic = await loadDigitrafficShips();
    } catch (e) {
      console.warn('Digitraffic AIS', e);
      if (!hasAisKey()) throw e;
      note = 'Fintraffic nicht erreichbar';
    }
    this.mergeShips();
    return { note: note ?? this.info.ships?.note };
  }

  private waveKey = '';

  private loadWavesNow() {
    const b = this.map.getBounds();
    const z = this.map.getZoom();
    const q = (v: number) => Math.round(v / 2) * 2;
    const key = [q(b.getWest()), q(b.getSouth()), q(b.getEast()), q(b.getNorth())].join(',');
    if (key === this.waveKey) return;
    this.waveKey = key;
    this.set('waves', { loading: true });
    loadWaves({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: z })
      .then((r) => {
        if (this.waveKey !== key) return;
        this.setData('waves', r.fc);
        this.set('waves', { loading: false, count: r.fc.features.length, note: `Raster ${r.step}° · Zahl = Wellenhöhe in m – zoomen für feineres Raster` });
      })
      .catch((e) => {
        console.warn('Open-Meteo Marine', e);
        this.waveKey = '';
        this.set('waves', { loading: false, note: e instanceof Error && /Limit/.test(e.message) ? e.message : 'Open-Meteo Marine nicht erreichbar' });
      });
  }

  private riverKey = '';

  private loadRiversNow() {
    const b = this.map.getBounds();
    const q = (v: number) => Math.round(v / 2) * 2;
    const key = [q(b.getWest()), q(b.getSouth()), q(b.getEast()), q(b.getNorth())].join(',');
    if (key === this.riverKey) return;
    this.riverKey = key;
    this.set('rivers', { loading: true });
    loadRivers({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: this.map.getZoom() })
      .then((r) => {
        if (this.riverKey !== key) return;
        this.setData('rivers', r.fc);
        this.set('rivers', { loading: false, count: r.fc.features.length, note: r.fc.features.length ? `Raster ${r.step}° – zoomen für mehr Flüsse · Farbe = Abfluss (blau klein → lila/rot sehr groß)` : 'hier keine Flüsse im Modell – anderen Ausschnitt wählen' });
      })
      .catch((e) => {
        console.warn('Open-Meteo Flood', e);
        this.riverKey = '';
        this.set('rivers', { loading: false, note: e instanceof Error && /Limit/.test(e.message) ? e.message : 'Open-Meteo Flood nicht erreichbar' });
      });
  }

  private setTerrain(on: boolean) {
    const has = !!this.map.getTerrain();
    if (on && !has) this.map.setTerrain({ source: 'terrain-dem', exaggeration: 1.4 });
    else if (!on && has) this.map.setTerrain(null);
  }

  private updateLightning() {
    const l = this.lightning;
    if (!l) return;
    this.setData('lightning', l.features());
    this.lightningStatus();
  }

  private lightningStatus() {
    const l = this.lightning;
    if (!l) return;
    const note = l.error || (l.connected ? `live verbunden · ${fmt.num(l.received)} Blitze seit Aktivierung · weiß = jetzt, rot = bis 15 min` : 'verbinde …');
    const prev = this.info.lightning;
    if (prev?.count !== l.count || prev?.note !== note) this.set('lightning', { count: l.count, note });
  }

  private mergeShips() {
    const all = new Map<number, Ship>();
    for (const s of this.baltic) all.set(s.mmsi, s);
    if (this.ais) for (const s of this.ais.ships.values()) all.set(s.mmsi, s);
    this.setData('ships', shipFeatures(all.values()));
    const notes = [this.ais?.error, !hasAisKey() ? 'außerhalb der Ostsee mit kostenlosem aisstream.io-Schlüssel (Einstellungen)' : 'weltweit live im Kartenausschnitt (aisstream.io)'].filter(Boolean);
    const prev = this.info.ships;
    const note = notes.join(' · ');
    if (prev?.count !== all.size || prev?.note !== note) this.set('ships', { count: all.size, note });
  }

  // -------------------------------------------------------------------------
  // Cameras

  private viewBounds(step = 20) {
    const b = this.map.getBounds();
    const snap = (v: number, f: (x: number) => number) => f(v * step) / step;
    return {
      west: snap(b.getWest(), Math.floor),
      south: snap(b.getSouth(), Math.floor),
      east: snap(b.getEast(), Math.ceil),
      north: snap(b.getNorth(), Math.ceil),
    };
  }

  private mergeWebcams() {
    const feedCams = [...this.camFeeds.values()].flatMap((f) => f.features);
    const all = { type: 'FeatureCollection' as const, features: [...this.fiCams.features, ...this.windyCams.features, ...feedCams] };
    this.setData('webcams', all);
    this.set('webcams', { count: all.features.length + this.osmCamCount || undefined });
    this.updateWebcamNote();
  }

  private updateWebcamNote() {
    const notes: string[] = [];
    if (this.map.getZoom() < CAM_DETAIL_ZOOM) notes.push('Webcams aus OpenStreetMap ab Zoomstufe 9');
    if (this.camFeedErrors.size) notes.push(`${[...this.camFeedErrors].join(', ')} nicht erreichbar`);
    if (!hasWindyKey()) notes.push('weltweit viele weitere mit kostenlosem Windy-Schlüssel (Einstellungen)');
    else if (this.map.getZoom() < 5) notes.push('Windy-Webcams ab Zoomstufe 5');
    this.set('webcams', { note: notes.join(' · ') || undefined });
  }

  private loadWebcamsNow() {
    const m = this.map;
    const z = m.getZoom();
    // regional camera feeds (London, California, Hong Kong, …) once their region is in view
    const vb = m.getBounds();
    for (const feed of camFeedsInView({ west: vb.getWest(), south: vb.getSouth(), east: vb.getEast(), north: vb.getNorth() })) {
      const prev = this.camFeeds.get(feed.id);
      // signed image URLs (Singapore) expire – refresh those more often
      const maxAge = (feed.id === 'singapore' ? 4 : 10) * 60000;
      if (this.camFeedLoading.has(feed.id) || (prev && Date.now() - prev.at < maxAge)) continue;
      this.camFeedLoading.add(feed.id);
      // camera lists are mirrored daily into the data branch (images still load live)
      const load = SNAPSHOT_CAMS.has(feed.id) ? () => snapshotJson(`cams/${feed.id}.json`, () => feed.load()) : () => feed.load();
      load()
        .then((features) => {
          this.camFeeds.set(feed.id, { at: Date.now(), features });
          this.camFeedErrors.delete(feed.label);
          this.mergeWebcams();
        })
        .catch((e) => {
          console.warn('Webcams', feed.id, e);
          this.camFeeds.set(feed.id, { at: Date.now(), features: prev?.features ?? [] });
          this.camFeedErrors.add(feed.label);
          this.updateWebcamNote();
        })
        .finally(() => this.camFeedLoading.delete(feed.id));
    }
    // OpenStreetMap webcams for the visible area
    if (z >= CAM_DETAIL_ZOOM) {
      const b = this.viewBounds();
      const key = Object.values(b).join(',');
      if (key !== this.camKey) {
        this.camKey = key;
        loadOsmWebcams(b)
          .then((fc) => {
            if (this.camKey !== key) return;
            this.setData('webcams-osm', fc);
            this.osmCamCount = fc.features.length;
            this.mergeWebcams();
          })
          .catch((e) => {
            if (isSuperseded(e) || this.camKey !== key) return;
            console.warn('Overpass webcams', e);
            this.camKey = '';
          });
      }
    }
    // Windy webcams around the map centre
    if (hasWindyKey() && z >= 5) {
      const c = m.getCenter();
      const b = m.getBounds();
      const km = Math.min(250, (Math.abs(b.getNorth() - b.getSouth()) * 111) / 2);
      const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${Math.round(km / 10)}`;
      // image URLs expire after 10 minutes on the free tier – reload at least that often
      if (key !== this.windyKey || Date.now() - (this.info.webcams?.at ?? 0) > 8 * 60000) {
        this.windyKey = key;
        loadWindyWebcams(c.lat, c.lng, km)
          .then((fc) => {
            if (this.windyKey !== key) return;
            this.windyCams = fc;
            this.mergeWebcams();
          })
          .catch((e) => {
            console.warn('Windy', e);
            this.windyKey = '';
            this.set('webcams', { note: 'Windy-Webcams nicht erreichbar – Schlüssel prüfen' });
          });
      }
    }
    this.updateWebcamNote();
  }

  private ensureAlprTiles() {
    if (this.alprTilesAdded) return;
    this.alprTilesAdded = true;
    const m = this.map;
    const attribution = 'ALPR-Übersicht: <a href="https://github.com/flockhopper3/deflock-data">deflock-data</a>, © OpenStreetMap (ODbL)';
    m.addSource('alpr-us', { type: 'vector', url: ALPR_TILES_US, attribution });
    m.addSource('alpr-ca', { type: 'vector', url: ALPR_TILES_CA });
    for (const src of ['alpr-us', 'alpr-ca']) {
      m.addLayer(
        {
          id: `alpr-heat-${src}`,
          type: 'heatmap',
          source: src,
          'source-layer': ALPR_SOURCE_LAYER,
          maxzoom: CAM_DETAIL_ZOOM + 0.5,
          paint: {
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, CAM_DETAIL_ZOOM + 0.5, 0],
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(239,68,68,0)', 0.2, 'rgba(239,68,68,0.45)', 0.5, '#f97316', 0.8, '#fde047', 1, '#ffffff'],
          },
        },
        'alpr-cone',
      );
      m.addLayer(
        {
          id: `alpr-dots-${src}`,
          type: 'circle',
          source: src,
          'source-layer': ALPR_SOURCE_LAYER,
          minzoom: 6,
          // no maxzoom: the tiles carry single cameras up to zoom 14, so the map stays filled when
          // the live Overpass query fails (the live layer is drawn on top of these dots)
          paint: { 'circle-color': ALPR_RED, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8 },
        },
        'alpr-cone',
      );
    }
    m.on('idle', () => this.updateAlprFov());
    LAYERS.alpr.push('alpr-heat-alpr-us', 'alpr-heat-alpr-ca', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca');
    this.apply();
  }

  /** Viewing-direction sectors for the cameras in view: live data plus what the overview tiles carry. */
  private updateAlprFov() {
    if (!this.on.has('alpr')) return;
    const m = this.map;
    const cams = new Map<string, [number, number, number]>();
    const take = (lon: number, lat: number, dir: unknown) => {
      const d = Number(dir);
      if (dir == null || dir === '' || !Number.isFinite(d) || d < 0) return;
      cams.set(`${lon.toFixed(6)},${lat.toFixed(6)},${d}`, [lon, lat, d]);
    };
    if (m.getZoom() >= ALPR_FOV_ZOOM) {
      for (const f of this.alprLive) take((f.geometry as Point).coordinates[0], (f.geometry as Point).coordinates[1], f.properties?.dir);
      if (this.alprTilesAdded && !this.alprTilesFailed) {
        for (const src of ['alpr-us', 'alpr-ca']) {
          if (!m.getSource(src)) continue;
          for (const f of m.querySourceFeatures(src, { sourceLayer: ALPR_SOURCE_LAYER, filter: ['has', 'direction'] })) {
            if (f.geometry.type === 'Point') take(f.geometry.coordinates[0], f.geometry.coordinates[1], f.properties?.direction);
          }
        }
      }
    }
    const key = [...cams.keys()].sort().join('|');
    if (key === this.alprFovKey) return;
    this.alprFovKey = key;
    const features: Feature[] = [...cams.values()].map(([lon, lat, dir]) => {
      const kx = 111320 * Math.cos((lat * Math.PI) / 180);
      const ring: [number, number][] = [[lon, lat]];
      for (let i = 0; i <= 12; i++) {
        const a = ((dir - ALPR_FOV_ANGLE / 2 + (ALPR_FOV_ANGLE * i) / 12) * Math.PI) / 180;
        ring.push([lon + (Math.sin(a) * ALPR_FOV_RADIUS) / kx, lat + (Math.cos(a) * ALPR_FOV_RADIUS) / 111320]);
      }
      ring.push([lon, lat]);
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
    });
    this.setData('alpr-fov', { type: 'FeatureCollection', features });
  }

  private updateAlprNote() {
    const z = this.map.getZoom();
    if (z >= CAM_DETAIL_ZOOM) return; // keeps the per-view summary
    const notes: string[] = [];
    if (z < CAM_DETAIL_ZOOM)
      notes.push(this.alprTilesFailed ? 'Übersicht nicht erreichbar – ab Zoomstufe 9 live aus OpenStreetMap' : 'Übersicht USA/Kanada · Details ab Zoomstufe 9 (weltweit)');
    this.set('alpr', { note: notes.join(' · ') || undefined });
  }

  private loadAlprNow() {
    this.updateAlprNote();
    if (this.map.getZoom() < CAM_DETAIL_ZOOM) {
      this.setData('alpr', empty());
      this.alprLive = [];
      this.alprKey = '';
      return;
    }
    const b = this.viewBounds();
    const key = Object.values(b).join(',');
    if (key === this.alprKey) return;
    this.alprKey = key;
    this.set('alpr', { loading: true });
    loadAlpr(b)
      .then((fc) => {
        if (this.alprKey !== key) return;
        this.setData('alpr', fc);
        this.alprLive = fc.features;
        this.updateAlprFov();
        const flock = fc.features.filter((f) => f.properties?.flock).length;
        this.set('alpr', { loading: false, count: fc.features.length, note: fc.features.length ? `${flock} davon Flock Safety (im Ausschnitt)` : 'keine Kennzeichen-Kameras im Ausschnitt erfasst' });
      })
      .catch((e) => {
        if (isSuperseded(e) || this.alprKey !== key) return;
        console.warn('Overpass ALPR', e);
        this.alprKey = '';
        this.set('alpr', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
      });
  }

  // -------------------------------------------------------------------------
  // Clicks

  click(f: MapGeoJSONFeature, at: { lng: number; lat: number }): ClickResult | null {
    const pt = f.geometry.type === 'Point' ? (f.geometry as Point).coordinates : [at.lng, at.lat];
    const tileCam = f.layer.id.startsWith('alpr-dots-');
    const p = (tileCam ? alprTileProps(f.properties, pt[0], pt[1]) : f.properties) as Record<string, unknown>;
    const html = (glyph: GlyphId, color: string, extra?: string) =>
      cardHtml({ glyph, color, title: p.title, subtitle: p.subtitle, date: p.date, description: p.description, source: p.source, url: p.url, extra });
    switch (tileCam ? 'alpr' : f.layer.id) {
      case 'cities':
        return { type: 'weather', lng: pt[0], lat: pt[1] };
      case 'dwd-warn-fill':
        return { type: 'html', html: html('warn', String(p.color)), lng: at.lng, lat: at.lat };
      case 'gauges':
        return { type: 'html', html: html('gauge', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'aq-circle':
        return { type: 'html', html: html('air', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'sondes':
        return { type: 'html', html: html('sonde', '#ff8fab') + '', lng: pt[0], lat: pt[1] };
      case 'aircraft':
      case 'ap3d-hit':
        return { type: 'flight', hex: String(p.hex), lng: pt[0], lat: pt[1] };
      case 'sats-icon':
      case 'sats-dot': {
        const sat = [...this.sats, ...this.starlink].find((s) => s.id === p.id);
        if (!sat) return null;
        const info = satPopupInfo(sat);
        this.setData('sat-track', groundTrack(sat));
        return {
          type: 'html',
          html: cardHtml({ glyph: 'satellite', color: '#b388ff', title: info.title, subtitle: info.subtitle, description: info.details, source: 'CelesTrak', url: info.url }),
          lng: pt[0],
          lat: pt[1],
        };
      }
      case 'cables': {
        const id = String(p.id ?? '');
        const rows = [
          ['Betreiber', p.operator],
          ['In Betrieb seit', p.since],
        ].filter(([, v]) => v);
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'cable',
            color: String(p.color ?? '#9c6bff'),
            title: String(p.name || 'Seekabel'),
            subtitle: 'Unterseekabel (Telekommunikation)',
            source: 'OpenStreetMap-Mitwirkende (ODbL)',
            url: id ? `https://www.openstreetmap.org/way/${encodeURIComponent(id)}` : undefined,
            extra: rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : undefined,
          }),
          lng: at.lng,
          lat: at.lat,
        };
      }
      case 'ixp':
        return { type: 'html', html: cardHtml({ glyph: 'cable', color: '#e040fb', title: p.title, subtitle: p.subtitle, source: 'PeeringDB', url: p.url }), lng: pt[0], lat: pt[1] };
      case 'webcams':
      case 'webcams-osm': {
        const img = safeUrl(p.image);
        // still images are cached by browsers – add a cache-buster (not for signed Windy URLs)
        const src = img && p.kind === 'road' ? `${img}${img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}` : img;
        const video = safeUrl(p.video);
        const extra = video
          ? `<video class="pop-cam" src="${escapeHtml(video)}" ${src ? `poster="${escapeHtml(src)}"` : ''} autoplay muted loop playsinline controls></video>`
          : src
          ? `<a class="pop-cam" href="${escapeHtml(safeUrl(p.url) ?? img)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="Webcam-Bild" loading="lazy" referrerpolicy="no-referrer"></a>`
          : `<a class="btn small pop-cam-link" href="${escapeHtml(safeUrl(p.url) ?? '#')}" target="_blank" rel="noopener noreferrer">Webcam öffnen ↗</a>`;
        return { type: 'html', html: cardHtml({ glyph: 'webcam', color: '#00bfa5', title: p.title, subtitle: p.subtitle, date: p.updated, source: p.source, url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'alpr': {
        const dir = Number(p.dir);
        const card = dir >= 0 ? CARDINAL[Math.round(dir / 45) % 8] : '';
        const rows = [
          ['Hersteller', p.brand],
          ['Betreiber', p.operator],
          ['Bereich', ALPR_ZONE[String(p.zone)] ?? p.zone],
          ['Montage', ALPR_MOUNT[String(p.mount)] ?? p.mount],
          ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
          ['Seit', p.since],
          ['Kennung', p.ref],
          ['Position', `${(pt[1] as number).toFixed(5)}, ${(pt[0] as number).toFixed(5)}`],
        ].filter(([, v]) => v);
        const photo = alprVendorImg(String(p.brand ?? ''));
        const extra = `${photo ? `<div class="pop-cam"><img src="${escapeHtml(photo)}" alt="${escapeHtml(String(p.brand))} (Beispielfoto)" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : ''}
          <div class="pop-foot"><a href="${escapeHtml(safeUrl(p.deflock) ?? '#')}" target="_blank" rel="noopener noreferrer">Auf DeFlock ansehen ↗</a></div>`;
        return { type: 'html', html: cardHtml({ glyph: 'alpr', color: p.flock ? ALPR_RED : '#ff9800', title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap / DeFlock (Beispielfoto: deflock.org)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'gvp':
        return { type: 'html', html: html('volcano', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'fireareas-fill':
        return { type: 'html', html: html('fire', '#ff5722'), lng: at.lng, lat: at.lat };
      case 'tsunami':
        return { type: 'html', html: html('tsunami', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'buoys':
        return { type: 'html', html: html('gauge', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'rivers':
        return { type: 'html', html: html('flood', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'waves':
        return { type: 'html', html: html('tsunami', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'tides': {
        const id = String(p.id);
        return {
          type: 'html',
          html: cardHtml({ glyph: 'gauge', color: '#42a5f5', title: p.title, subtitle: p.subtitle, source: p.source, url: p.url, extra: '<div class="pop-loading small">Pegeldaten werden geladen …</div>' }),
          lng: pt[0],
          lat: pt[1],
          after: (node) => {
            loadTideDetails(id)
              .then((d) => {
                const t = (iso: string) => new Date(iso).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
                const rows: [string, string][] = [];
                if (d.level) rows.push(['Wasserstand', `${fmt.num(d.level.v, 2)} m (über MLLW) · ${t(d.level.t)}`]);
                for (const n of d.next) rows.push([n.type === 'H' ? 'Hochwasser' : 'Niedrigwasser', `${t(n.t)} · ${fmt.num(n.v, 2)} m`]);
                const el = node.querySelector('.pop-loading');
                if (el) el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
              })
              .catch(() => {
                const el = node.querySelector('.pop-loading');
                if (el) el.textContent = 'keine aktuellen Messwerte';
              });
          },
        };
      }
      case 'radiation':
        return { type: 'html', html: html('radiation', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'lightning': {
        const at = Number(p.at);
        const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
        const ago = secs < 90 ? `vor ${secs} s` : `vor ${Math.round(secs / 60)} min`;
        const extra = `<div class="pop-grid two"><span>Zeitpunkt</span><b>${new Date(at).toLocaleTimeString('de-DE')} Uhr (${ago})</b><span>Position</span><b>${fmt.num(pt[1], 3)}°, ${fmt.num(pt[0], 3)}°</b></div>`;
        return { type: 'html', html: cardHtml({ glyph: 'bolt', color: '#ffd600', title: 'Blitzeinschlag', source: 'Blitzortung.org', url: 'https://www.blitzortung.org/', extra }), lng: pt[0], lat: pt[1] };
      }
      case 'launches': {
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
        return {
          type: 'html',
          html: cardHtml({ glyph: 'rocket', color: '#ff6e40', title: p.pad || 'Startplatz', subtitle: p.place, source: 'The Space Devs', url: 'https://thespacedevs.com/', extra: `<ol class="pop-list">${items}</ol>` }),
          lng: pt[0],
          lat: pt[1],
        };
      }
      case 'resources':
        return { type: 'html', html: cardHtml({ glyph: 'plant', color: String(p.color), title: p.title, subtitle: [p.catLabel, p.subtitle].filter(Boolean).join(' · '), source: p.source, url: p.url }), lng: pt[0], lat: pt[1] };
      case 'pipelines':
        return { type: 'html', html: html('cable', String(p.color)), lng: at.lng, lat: at.lat };
      case 'plates': {
        const t = { SUB: 'Subduktionszone', OSR: 'Ozeanischer Rücken', OTF: 'Transformstörung', CRB: 'Kontinentaler Grabenbruch', CTF: 'Kontinentale Transformstörung', CCB: 'Kontinentale Kollision', OCB: 'Ozeanische Kollision' } as Record<string, string>;
        return {
          type: 'html',
          html: cardHtml({ glyph: 'quake', color: '#ef5350', title: `Plattengrenze ${String(p.Name ?? '')}`, subtitle: [p.PlateA && p.PlateB ? `${p.PlateA} – ${p.PlateB}` : '', t[String(p.Type)] ?? p.Type].filter(Boolean).join(' · '), source: 'Bird (2003), PB2002' }),
          lng: at.lng,
          lat: at.lat,
        };
      }
      case 'radio':
        return {
          type: 'html',
          html: cardHtml({ glyph: 'radio', color: '#ff4081', title: p.name, source: 'Radio Browser', extra: radioPopupExtra(p) }),
          lng: pt[0],
          lat: pt[1],
          after: (node) =>
            node.querySelector('.rp-play')?.addEventListener('click', () =>
              playStation({ id: String(p.id), name: String(p.name), stream: String(p.stream), favicon: String(p.favicon ?? ''), place: String(p.place ?? '') }),
            ),
        };
      case 'busnet-line': {
        const rows = [
          ['Verkehrsmittel', p.modeLabel],
          ['Strecke', p.from && p.to ? `${p.from} → ${p.to}` : ''],
          ['Betreiber', p.operator],
        ].filter(([, v]) => v);
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'train',
            color: String(p.color),
            title: p.ref ? `${p.modeLabel} ${p.ref}` : p.name || String(p.modeLabel),
            subtitle: p.ref ? p.name : '',
            source: 'OpenStreetMap',
            url: p.url,
            extra: `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`,
          }),
          lng: at.lng,
          lat: at.lat,
        };
      }
      case 'airports-minor':
      case 'airports-far-1':
      case 'airports-far-2':
      case 'airports-far-3':
      case 'airports': {
        const icao = String(p.icao ?? '');
        const name = String(p['name:de'] ?? p.name ?? 'Flughafen');
        const code = [p.iata, icao].filter(Boolean).join(' / ');
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'airport',
            color: '#90caf9',
            title: name,
            subtitle: [code, p.ele != null ? `${p.ele} m ü. NN` : ''].filter(Boolean).join(' · '),
            source: 'OpenStreetMap, OpenSky Network',
            url: icao ? `https://opensky-network.org/network/explorer?airport=${encodeURIComponent(icao)}` : undefined,
            extra: icao ? '<div class="pop-loading small">Flüge vom Vortag werden geladen …</div>' : '',
          }),
          lng: pt[0],
          lat: pt[1],
          after: (node) => {
            if (!icao) return;
            loadAirportFlights(icao)
              .then((r) => {
                const list = (l: { callsign: string; other: string; time: number }[], arrow: string) =>
                  l
                    .slice(0, 6)
                    .map((f) => `<span>${escapeHtml(new Date(f.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))}</span><b>${escapeHtml(f.callsign || '–')} ${arrow} ${escapeHtml(f.other)}</b>`)
                    .join('');
                const el = node.querySelector('.pop-loading');
                if (!el) return;
                el.outerHTML = r.departures.length + r.arrivals.length
                  ? `<div class="small muted">Vortag: ${r.departures.length} Abflüge, ${r.arrivals.length} Ankünfte</div>
                     ${r.departures.length ? `<div class="pop-sub">Letzte Abflüge</div><div class="pop-grid two">${list(r.departures, '→')}</div>` : ''}
                     ${r.arrivals.length ? `<div class="pop-sub">Letzte Ankünfte</div><div class="pop-grid two">${list(r.arrivals, '←')}</div>` : ''}`
                  : '<div class="small muted">Keine Flugdaten vom Vortag verfügbar.</div>';
              })
              .catch(() => {
                const el = node.querySelector('.pop-loading');
                if (el) el.textContent = 'OpenSky gerade nicht erreichbar (Tageskontingent ohne Konto begrenzt).';
              });
          },
        };
      }
      case 'ships': {
        const rows = [
          ['Typ', SHIP_LABELS[p.cat as ShipCat] ?? 'Schiff'],
          ['Geschwindigkeit', `${fmt.num(Number(p.sog), 1)} kn (${fmt.num(Number(p.sog) * 1.852, 0)} km/h)`],
          ['Kurs', `${Math.round(Number(p.rot))}°`],
          ['Ziel', p.dest],
          ['Rufzeichen', p.call],
          ['MMSI', p.mmsi],
          ['Position von', new Date(Number(p.at)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'],
        ].filter(([, v]) => v !== '' && v != null);
        const extra = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
        return {
          type: 'html',
          html: cardHtml({ glyph: 'vessel', color: String(p.color), title: p.name, source: p.source, url: `https://www.marinetraffic.com/de/ais/details/ships/mmsi:${encodeURIComponent(String(p.mmsi))}`, extra }),
          lng: pt[0],
          lat: pt[1],
        };
      }
      case 'trains':
      case 'transit-veh': {
        if (p.src === 'transitous' || p.src === 'amtrak' || p.src === 'gps') return this.vehicleCard(p, pt);
        const num = Number(p.num);
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'train',
            color: '#ffca28',
            title: `Zug ${num}`,
            subtitle: `${fmt.num(Number(p.speed))} km/h`,
            source: 'Fintraffic Digitraffic',
            url: `https://www.junat.net/en/train/${num}`,
            extra: '<div class="pop-loading small">Details werden geladen …</div>',
          }),
          lng: pt[0],
          lat: pt[1],
          after: (node) => {
            loadTrainDetails(num, String(p.date))
              .then((d) => {
                const el = node.querySelector('.pop-loading');
                if (!el || !d) return el?.remove();
                const head = node.querySelector('.pop-head b');
                if (head) head.textContent = d.title;
                const rows = [
                  ['Art', d.category],
                  ['Strecke', d.from && d.to ? `${d.from} → ${d.to}` : ''],
                  ['Zuletzt', d.lastStation],
                  ['Verspätung', d.delay != null ? (d.delay > 0 ? `+${d.delay} min` : 'pünktlich') : ''],
                ].filter(([, v]) => v);
                el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
              })
              .catch(() => node.querySelector('.pop-loading')?.remove());
          },
        };
      }
      case 'autobahn':
        return { type: 'html', html: html('warn', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'nina-fill': {
        const id = String(p.id ?? '');
        return {
          type: 'html',
          html: cardHtml({ glyph: 'warn', color: String(p.color), title: p.title, subtitle: p.subtitle, date: p.date, source: p.source, url: p.url, extra: '<div class="pop-loading small">Text wird geladen …</div>' }),
          lng: at.lng,
          lat: at.lat,
          after: (node) => {
            loadNinaDetails(id)
              .then((txt) => {
                const el = node.querySelector('.pop-loading');
                if (el) el.outerHTML = txt ? `<p class="pop-desc">${escapeHtml(txt.slice(0, 700))}${txt.length > 700 ? ' …' : ''}</p>` : '';
              })
              .catch(() => node.querySelector('.pop-loading')?.remove());
          },
        };
      }
      case 'power':
      case 'osm-power': {
        const glyph: GlyphId = p.cat === 'wind' ? 'wind' : p.cat === 'solar' ? 'solar' : 'plant';
        return { type: 'html', html: html(glyph, String(p.color)), lng: pt[0], lat: pt[1] };
      }
    }
    return null;
  }

  private vehicleCard(p: Record<string, unknown>, pt: number[]): ClickResult {
    const st = modeStyle(String(p.mode));
    const t = (ms: unknown) => new Date(Number(ms)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const delay = Number(p.delay);
    const rows =
      p.src === 'amtrak' || p.src === 'gps'
        ? [
            ['Art', st.label],
            ...(p.src === 'gps' ? [['Von', p.from], ['Nach', p.to], ['Verspätung', delay === -999 ? '' : delay > 0 ? `+${delay} min` : 'pünktlich']] : []),

            ['Strecke', p.from && p.to ? `${p.from} → ${p.to}` : ''],
            ['Geschwindigkeit', p.speed != null ? `${p.speed} km/h` : ''],
            ['Status', p.timely],
          ]
        : [
            ['Art', st.label],
            ['Abschnitt', `${p.from} → ${p.to}`],
            ['Ankunft', `${t(p.arr)} Uhr`],
            ['Verspätung', delay === -999 ? 'keine Echtzeitdaten' : delay > 0 ? `+${delay} min` : delay < 0 ? `${delay} min` : 'pünktlich'],
          ];
    const extra = `<div class="pop-grid two">${rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`)
      .join('')}</div>${p.src === 'transitous' ? '<div class="small muted">Position aus Echtzeitfahrplan berechnet</div>' : ''}`;
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'train',
        color: String(p.color ?? st.color),
        title: p.name,
        source: p.src === 'amtrak' ? 'Amtraker (Amtrak-GPS)' : p.src === 'gps' ? `${p.feed} (GPS)` : 'Transitous',
        url: p.src === 'amtrak' ? 'https://amtraker.com/' : p.src === 'gps' ? undefined : 'https://transitous.org/',
        extra,
      }),
      lng: pt[0],
      lat: pt[1],
    };
  }

  clearSelection() {
    this.setData('sat-track', empty());
  }
}
