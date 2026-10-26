import { loadSpcTornadoReports } from '../../../api/events';
import { defineFeed, type EventFeature } from '../types';

export default defineFeed<EventFeature[]>({
  id: 'spc',
  order: 60,
  name: 'SPC Tornado-Meldungen',
  // the SPC files have no CORS headers on some days – don't bother the user about it
  silent: true,
  initial: [],
  load: () => loadSpcTornadoReports(),
  points: (d) => d,
  group: 'tornado',
});
