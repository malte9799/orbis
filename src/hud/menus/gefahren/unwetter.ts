import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 10,
  id: 'unwetter',
  label: 'Unwetter',
  icon: 'storm',
  defaults: ['dwdwarn'],
  rows: [
    { label: 'Unwetterwarnungen DE (DWD)', layers: ['dwdwarn'] },
    { label: 'Bevölkerungswarnungen', layers: ['nina'] },
    { label: 'Tornados & Unwetter USA', layers: ['tornado'] },
    { label: 'Blitze Live', layers: ['lightning'] },
    { label: 'Stürme & Zyklone', layers: ['storms'] },
    { label: 'Hurrikane (NHC)', layers: ['cyclones'] },
    { label: 'Radar-Nowcast Deutschland', layers: ['dwdnowcast'] },
    { label: 'Fluten & Dürren', layers: ['floods'] },
    { label: 'Pegel & Hochwasser DE', layers: ['gauges'] },
    { label: 'Flussabfluss & Hochwasser', layers: ['rivers'] },
    { label: 'Eis, Staub & Hitze', layers: ['ice'] },
  ],
});
