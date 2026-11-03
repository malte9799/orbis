import { defineKey } from '../types';

export default defineKey({
  id: 'cesiumIon',
  order: 200,
  group: 'tiles3d',
  tip: 'Cesium OSM Buildings als 3D-Kacheln weltweit.',
  steps: [
    { t: '1. Kostenlosen Account bei Cesium ion anlegen', u: 'https://ion.cesium.com/signup' },
    { t: '2. Unter „Access Tokens“ einen Token erzeugen', u: 'https://ion.cesium.com/tokens' },
    { t: '3. Token hier einfügen' },
  ],
  label: 'Cesium ion Token',
  placeholder: 'Access Token',
});
