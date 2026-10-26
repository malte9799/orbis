import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 10,
  id: 'radar',
  label: 'Radar',
  hint: 'Live-Niederschlagsradar',
  icon: 'radar',
  color: '#4f8dff',
  variants: [['radar', 'Regen (RainViewer)'], ['dwd-radar', 'Deutschland (DWD)']],
});
