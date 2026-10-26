import { defineExtra } from '../types';

export default defineExtra({
  id: 'webcams',
  order: 670,
  section: 'cams',
  cat: 'medien',
  label: 'Live-Webcams',
  hint: 'London, New York, Kalifornien, Kanada, Hongkong, Singapur, Finnland, Island, Neuseeland, Australien (NSW), Autobahn, OpenStreetMap – optional Windy und US-Nationalparks',
  glyph: 'webcam',
  icon: 'cam',
  color: '#00bfa5',
  layers: ['webcams-glow', 'webcams-heat', 'webcams-dots', 'webcams', 'webcams-osm', 'webcams-cone', 'webcams-cone-line'],
  clickLayers: ['webcams', 'webcams-osm'],
});
