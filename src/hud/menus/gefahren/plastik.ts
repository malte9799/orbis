import { defineMenuCat } from '../types';

// The marine plastic layers arrive with a separate branch. Ids that are not in the layer catalog
// yet are dropped at runtime (catalog.ts, pruneMenu), so the rows appear as soon as the layers exist.
export default defineMenuCat({
  order: 30,
  id: 'plastik',
  label: 'Plastik',
  icon: 'ocean',
  defaults: ['plastik'],
  rows: [
    { label: 'Plastik im Meer', layers: ['plastik'] },
    { label: 'Plastikflüsse', layers: ['plastikfluesse'] },
    { label: 'Plastikherkunft', layers: ['plastikherkunft'] },
    { label: 'Treibbojen', layers: ['treibbojen'] },
    { label: 'Treibgut-Modell', layers: ['treibmodell'] },
    { label: 'Seegang & Strömung', layers: ['waves'] },
  ],
});
