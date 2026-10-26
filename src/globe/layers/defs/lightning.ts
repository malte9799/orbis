import { defineExtra } from '../types';

export default defineExtra({
  id: 'lightning',
  order: 100,
  section: 'earth',
  cat: 'wetter',
  label: 'Blitze Live',
  hint: 'Einschläge der letzten 15 Minuten weltweit, mit Ton, Einschlagskreis und Detektoren – Blitzortung.org (Hobby-Netzwerk, nicht amtlich, nur zur privaten Information, nicht für Warnzwecke)',
  glyph: 'bolt',
  icon: 'bolt',
  color: '#ffd600',
  layers: ['lightning-thunder', 'lightning-wave', 'lightning-line', 'lightning-sta', 'lightning-glow', 'lightning'],
  clickLayers: ['lightning'],
});
