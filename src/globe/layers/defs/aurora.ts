import { defineExtra } from '../types';
import { fmt } from '../../../util';
import { loadAurora, loadSpaceWeather } from '../../../api/earth';
import { clockTxt } from '../../../units';

export default defineExtra({
  id: 'aurora',
  order: 60,
  section: 'earth',
  cat: 'wetter',
  label: 'Polarlicht',
  hint: 'Vorhersage für die nächste Stunde – NOAA SWPC',
  glyph: 'aurora',
  icon: 'aurora',
  color: '#3ddc84',
  sources: { aurora: 'Polarlicht: <a href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast">NOAA SWPC</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'aurora',
        type: 'heatmap',
        source: 'aurora',
        // a large-scale phenomenon on a 1° grid – fades out before the grid becomes visible
        maxzoom: 8,
        layout: hidden,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'v'], 3, 0.05, 30, 0.6, 90, 1],
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 6, 3, 30, 6, 170, 8, 480],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0.6],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.8, 8, 0],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,255,120,0)', 0.15, 'rgba(0,255,120,0.35)', 0.45, 'rgba(60,255,140,0.75)', 0.75, '#d4ff5a', 1, '#ff5ac8'],
        },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('aurora', 15 * 60000, async () => {
      const [r, sw] = await Promise.all([loadAurora(), loadSpaceWeather().catch(() => null)]);
      ctx.setData('aurora', r.fc);
      const t = new Date(r.forecastTime);
      const kp = r.kp != null ? `Kp ${fmt.num(r.kp, 1)}${r.kp >= 5 ? ' – geomagnetischer Sturm!' : ''} · ` : '';
      const sun = sw
        ? ` · Sonnenwind ${sw.windKmS != null ? `${Math.round(sw.windKmS)} km/s` : '–'}${sw.bz != null ? `, Bz ${fmt.num(sw.bz, 1)} nT${sw.bz < -5 ? ' (günstig)' : ''}` : ''}${sw.xray ? `, Röntgen ${sw.xray}` : ''}`
        : '';
      return { count: undefined, note: `${kp}Vorhersage für ${clockTxt(t)}${sun}` };
    });
  },
  layers: ['aurora'],
});
