// Tile URL builders shared by the raster overlay definitions.

export const gibsWms = (layer: string, time?: string) =>
  `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256${time ? `&TIME=${time}` : ''}`;

export const noaaWms = (region: string) => `https://opengeo.ncep.noaa.gov/geoserver/${region}/ows?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${region}_bref_qcd&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;
export const noaaCredit = 'Radar: <a href="https://www.nssl.noaa.gov/projects/mrms/">NOAA MRMS</a>';

/** JMA tiles are addressed by scan time – the newest one is looked up when the layer is switched on */
export const JMA_RADAR_TILES = (base: string, valid = base) => `https://www.jma.go.jp/bosai/jmatile/data/nowc/${base}/none/${valid}/surf/hrpns/{z}/{x}/{y}.png`;

// the daily ocean-colour swaths (and clouds) leave gaps: the newest complete day is yesterday
export const chlDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
