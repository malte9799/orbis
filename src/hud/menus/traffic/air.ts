import { defineMenuCat } from '../types';

// aircraft always on, the weather balloons fly along ("Flughäfen" = the airport symbols plus the
// airports in 3D when zoomed in close); the eye switch of each layer turns them off separately
export default defineMenuCat({
  order: 30,
  id: 'air',
  label: 'Flugzeug',
  icon: 'plane2',
  defaults: ['aircraft', 'sondes'],
  rows: [
    { label: 'Flughäfen', layers: ['airports', 'airport3d'] },
  ],
});
