import type { Forecast } from './api/openmeteo';
import { escapeHtml, fmt } from './util';
import { describe, weatherIcon } from './weather';

/**
 * Hourly chart: temperature line (top panel) and precipitation bars (bottom panel) on a
 * shared time axis – two panels, never a dual y-axis. A crosshair + tooltip follows the pointer.
 */
export function renderHourlyChart(container: HTMLElement, f: Forecast, hours = 48) {
  const h = f.hourly;
  const start = Math.max(0, h.time.findIndex((t) => t >= f.current.time.slice(0, 13)));
  const idx = Array.from({ length: Math.min(hours, h.time.length - start) }, (_, i) => start + i);
  if (idx.length < 2) {
    container.innerHTML = '';
    return;
  }

  const W = 960;
  const padL = 40;
  const padR = 12;
  const iconRow = 34;
  const tTop = iconRow + 22;
  const tH = 120;
  const pTop = tTop + tH + 28;
  const pH = 56;
  const axisY = pTop + pH + 18;
  const H = axisY + 6;
  const step = (W - padL - padR) / idx.length;
  const x = (i: number) => padL + step * (i + 0.5);

  const temps = idx.map((i) => h.temperature_2m[i]);
  const tMin = Math.floor(Math.min(...temps) - 1);
  const tMax = Math.ceil(Math.max(...temps) + 1);
  const ty = (t: number) => tTop + tH - ((t - tMin) / (tMax - tMin || 1)) * tH;

  const precs = idx.map((i) => h.precipitation[i] ?? 0);
  const pMax = Math.max(2, ...precs);
  const py = (p: number) => (p / pMax) * pH;

  // Gridlines (recessive) + y labels for temperature
  const ticks = niceTicks(tMin, tMax, 4);
  const grid = ticks
    .map(
      (t) =>
        `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${ty(t)}" y2="${ty(t)}"/><text class="axis" x="${padL - 6}" y="${ty(t) + 4}" text-anchor="end">${t}°</text>`,
    )
    .join('');

  const line = idx.map((_, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${ty(temps[k]).toFixed(1)}`).join('');
  const area = `${line}L${x(idx.length - 1)} ${tTop + tH}L${x(0)} ${tTop + tH}Z`;

  const bars = precs
    .map((p, k) => {
      if (p <= 0) return '';
      const bh = Math.max(2, py(p));
      const bw = Math.max(2, step - 2);
      return `<rect class="pbar" x="${x(k) - bw / 2}" y="${pTop + pH - bh}" width="${bw}" height="${bh}" rx="2"/>`;
    })
    .join('');

  // Labels every 3 h; day separators at midnight
  let axis = '';
  let icons = '';
  idx.forEach((i, k) => {
    const t = h.time[i];
    const hh = t.slice(11, 13);
    if (hh === '00' && k > 0) {
      axis += `<line class="daysep" x1="${x(k) - step / 2}" x2="${x(k) - step / 2}" y1="${iconRow - 6}" y2="${axisY - 10}"/>`;
      axis += `<text class="axis day" x="${x(k) - step / 2 + 4}" y="${iconRow + 14}">${escapeHtml(fmt.weekday(t))}</text>`;
    }
    if (k % 3 === 0) {
      axis += `<text class="axis" x="${x(k)}" y="${axisY}" text-anchor="middle">${hh}</text>`;
      icons += `<g transform="translate(${x(k) - 13} 0)">${weatherIcon(h.weather_code[i], h.is_day[i] === 1, 26)}</g>`;
      axis += `<text class="tlabel" x="${x(k)}" y="${ty(temps[k]) - 8}" text-anchor="middle">${Math.round(temps[k])}°</text>`;
    }
  });

  container.innerHTML = `
    <div class="chart-scroll">
      <svg class="hourly" viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperatur und Niederschlag der nächsten ${idx.length} Stunden">
        <defs>
          <linearGradient id="tfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/>
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${icons}
        <text class="panel-title" x="${padL}" y="${tTop - 8}">Temperatur</text>
        ${grid}
        <path d="${area}" fill="url(#tfill)"/>
        <path d="${line}" class="tline"/>
        <text class="panel-title" x="${padL}" y="${pTop - 8}">Niederschlag (mm/h, max. ${fmt.num(pMax, 1)})</text>
        <line class="baseline" x1="${padL}" x2="${W - padR}" y1="${pTop + pH}" y2="${pTop + pH}"/>
        ${bars}
        ${axis}
        <g class="cross" visibility="hidden">
          <line class="crossline" y1="${iconRow}" y2="${axisY - 10}"/>
          <circle class="crossdot" r="5"/>
        </g>
        <rect class="hit" x="${padL}" y="0" width="${W - padL - padR}" height="${H}" fill="transparent"/>
      </svg>
    </div>
    <div class="chart-tip" hidden></div>`;

  const svg = container.querySelector('svg')!;
  const cross = svg.querySelector<SVGGElement>('.cross')!;
  const crossLine = cross.querySelector('line')!;
  const crossDot = cross.querySelector('circle')!;
  const tip = container.querySelector<HTMLDivElement>('.chart-tip')!;

  const show = (clientX: number) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    const k = Math.max(0, Math.min(idx.length - 1, Math.floor((vx - padL) / step)));
    const i = idx[k];
    crossLine.setAttribute('x1', String(x(k)));
    crossLine.setAttribute('x2', String(x(k)));
    crossDot.setAttribute('cx', String(x(k)));
    crossDot.setAttribute('cy', String(ty(temps[k])));
    cross.setAttribute('visibility', 'visible');
    const prob = h.precipitation_probability[i];
    tip.innerHTML = `
      <div class="tip-head">${escapeHtml(fmt.weekday(h.time[i]))}, ${fmt.hour(h.time[i])} Uhr</div>
      <div class="tip-row tip-cond">${weatherIcon(h.weather_code[i], h.is_day[i] === 1, 22)} <span>${escapeHtml(describe(h.weather_code[i]))}</span></div>
      <div class="tip-row"><span>Temperatur</span><b>${fmt.temp(h.temperature_2m[i], 1)}</b></div>
      <div class="tip-row"><span>Gefühlt</span><b>${fmt.temp(h.apparent_temperature[i], 1)}</b></div>
      <div class="tip-row"><span>Niederschlag</span><b>${fmt.num(h.precipitation[i], 1)} mm${prob != null ? ` · ${prob} %` : ''}</b></div>
      <div class="tip-row"><span>Wind / Böen</span><b>${Math.round(h.wind_speed_10m[i])} / ${Math.round(h.wind_gusts_10m[i])} km/h</b></div>`;
    tip.hidden = false;
    const cRect = container.getBoundingClientRect();
    const px = rect.left - cRect.left + (x(k) / W) * rect.width;
    const left = px + 14 + tip.offsetWidth > cRect.width ? px - 14 - tip.offsetWidth : px + 14;
    tip.style.left = `${Math.max(0, left)}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  svg.addEventListener('pointermove', (e) => show(e.clientX));
  svg.addEventListener('pointerdown', (e) => show(e.clientX));
  svg.addEventListener('pointerleave', hide);
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}
