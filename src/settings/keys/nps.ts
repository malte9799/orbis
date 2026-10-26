import { defineKey } from '../types';

export default defineKey({
  id: 'nps',
  order: 50,
  section: 'keys',
  label: 'US National Park Service',
  hint: 'kostenloser Schlüssel von nps.gov/subjects/developer – Nationalpark-Webcams',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
