import { loadEmsc } from '../../../api/europe';
import { defineFeed, type EventFeature } from '../types';

export default defineFeed<EventFeature[]>({
  id: 'emsc',
  order: 40,
  name: 'EMSC Erdbeben Europa',
  initial: [],
  load: () => loadEmsc(),
});
