import { loadFirms, loadFirmsSnapshot } from '../../../api/events';
import { defineFeed } from '../types';

export default defineFeed<{ count: number; ok: boolean }>({
  id: 'firms',
  order: 70,
  name: 'NASA FIRMS',
  initial: { count: 0, ok: false },
  async load(ctx) {
    const key = ctx.keys().firms;
    // own key → live points; otherwise the shared worldwide snapshot from the data branch
    const fc = key ? await loadFirms(key) : await loadFirmsSnapshot();
    ctx.setData('firms', fc.features);
    return { count: fc.features.length, ok: fc.features.length > 0 };
  },
});
