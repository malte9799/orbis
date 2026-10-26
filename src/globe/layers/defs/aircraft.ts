import { defineExtra } from '../types';

export default defineExtra({
  id: 'aircraft',
  order: 350,
  section: 'air',
  cat: 'verkehr',
  label: 'Flugzeuge & Hubschrauber',
  hint: 'live, ADS-B – adsb.lol, adsb.fi, OpenSky',
  glyph: 'plane',
  icon: 'plane2',
  color: '#f2c94c',
  layers: ['aircraft', 'aircraft-rotor', 'aircraft-vehicle'],
  clickLayers: ['aircraft', 'aircraft-vehicle'],
});
