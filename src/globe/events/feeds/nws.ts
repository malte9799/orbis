import { loadNwsSevere } from '../../../api/events';
import { defineFeed, type EventFeature, type NwsPolygons } from '../types';

export default defineFeed<{ points: EventFeature[]; polygons: NwsPolygons }>({
  id: 'nws',
  order: 50,
  name: 'NWS (USA)',
  initial: { points: [], polygons: [] },
  load: () => loadNwsSevere(),
  points: (d) => d.points,
  group: 'tornado',
});
