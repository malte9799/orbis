import { defineExtra, type ExtraCtx } from '../types';
import { ensureWeatherIcons } from '../../icons';
import { loadCityWeather } from '../../../api/europe';
import { weatherIcon } from '../../../weather';

async function loadCities(ctx: ExtraCtx) {
  const list = await loadCityWeather();
  await ensureWeatherIcons(
    ctx.map,
    list.map((c) => ({ code: c.code, isDay: c.isDay })),
    (code, isDay) => weatherIcon(code, isDay, 64),
  );
  ctx.setData('cities', {
    type: 'FeatureCollection',
    features: list.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { name: c.name, temp: `${Math.round(c.temp)}°`, icon: `wx-${c.code}-${c.isDay ? 'd' : 'n'}`, rank: c.rank },
    })),
  });
  return { count: list.length };
}

export default defineExtra({
  id: 'cities',
  order: 10,
  section: 'europe',
  cat: 'wetter',
  label: 'Städtewetter',
  hint: 'aktuelles Wetter in ~200 Städten',
  glyph: 'city',
  icon: 'city',
  color: '#5b9dff',
  enable(ctx) {
    ctx.loadOnce('cities', 60 * 60000, () => loadCities(ctx));
  },
  click({ pt }) {
    return { type: 'weather', lng: pt[0], lat: pt[1] };
  },
  layers: ['cities'],
  clickLayers: ['cities'],
});
