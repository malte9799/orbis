import { loadGdacs } from '../../../api/events';
import { defineFeed, type EventFeature } from '../types';

export default defineFeed<EventFeature[]>({
  id: 'gdacs',
  order: 20,
  name: 'GDACS',
  initial: [],
  load: () => loadGdacs(),
  points: (d) => d,
});
