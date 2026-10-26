import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 20,
  id: 'radar',
  label: 'Radar',
  hint: 'Live-Niederschlagsradar (RainViewer)',
  icon: 'radar',
  color: '#4f8dff',
  subs: [
    { label: '', main: 'radar', mainVar: 'radar' },
  ],
});
