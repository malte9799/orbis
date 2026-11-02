// Mockup: host -> readable provider name. In the real feature this would be generated from docs/DATENQUELLEN.md.
const PROVIDERS: [RegExp, string][] = [
  [/^air-quality-api\.open-meteo\.com$/, 'Open-Meteo Air Quality'],
  [/^geocoding-api\.open-meteo\.com$/, 'Open-Meteo Geocoding'],
  [/^marine-api\.open-meteo\.com$/, 'Open-Meteo Marine'],
  [/open-meteo\.com$/, 'Open-Meteo'],
  [/brightsky\.dev$/, 'Bright Sky (DWD)'],
  [/weather\.gov$/, 'NWS'],
  [/nominatim\.openstreetmap\.org$/, 'Nominatim (OSM)'],
  [/bigdatacloud/, 'BigDataCloud'],
  [/rainviewer\.com$/, 'RainViewer'],
  [/openfreemap\.org$/, 'OpenFreeMap'],
  [/nasa\.gov$/, 'NASA'],
  [/noaa\.gov$/, 'NOAA'],
  [/planespotters\.net$/, 'Planespotters'],
  [/adsbdb\.com$/, 'adsbdb'],
  [/adsb\.(lol|fi)$/, 'ADSB-Flugdaten'],
  [/opensky-network\.org$/, 'OpenSky'],
  [/overpass/, 'Overpass (OSM)'],
];

export function providerOf(host: string): string {
  if (host === location.host) return 'Orbis (eigene Daten)';
  return PROVIDERS.find(([re]) => re.test(host))?.[1] ?? host;
}
