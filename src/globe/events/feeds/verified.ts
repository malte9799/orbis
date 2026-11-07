import { loadVerifiedEvents } from '../../../api/events';
import { defineFeed, type EventFeature } from '../types';

export default defineFeed<EventFeature[]>({
  id: 'verified',
  order: 15,
  name: 'GeoConfirmed',
  initial: [],
  load: async () => {
    const fc = await loadVerifiedEvents();
    return (fc.features || []).map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        kind: 'verified',
        title: f.properties?.id || 'Verified event',
        date: f.properties?.date,
        source: 'GeoConfirmed',
        color: f.properties?.color || '#ff9d3b',
        weight: 0.6,
      },
    })) as EventFeature[];
  },
  points: (d) => d,
});
