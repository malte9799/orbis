import { loadQuakes } from '../../../api/events';
import { defineFeed, type EventFeature } from '../types';

export default defineFeed<EventFeature[]>({
  id: 'usgs',
  order: 30,
  name: 'USGS Erdbeben',
  initial: [],
  load: () => loadQuakes(),
});
