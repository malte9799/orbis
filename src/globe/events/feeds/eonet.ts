import { loadEonet } from '../../../api/events';
import { defineFeed, type EonetTracks, type EventFeature } from '../types';

export default defineFeed<{ points: EventFeature[]; tracks: EonetTracks }>({
  id: 'eonet',
  order: 10,
  name: 'NASA EONET',
  initial: { points: [], tracks: [] },
  load: () => loadEonet(),
  points: (d) => d.points,
});
