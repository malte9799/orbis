import { distTxt } from '../units';

/** distance for a guidance text: metres in 10-m steps below 1 km (km setting), otherwise through the unit setting */
export function distance(m: number, metric = true): string {
  if (!metric) return distTxt(m / 1000, m < 1000 ? 2 : 1);
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return distTxt(m / 1000, m < 10_000 ? 1 : 0);
}

/** "1 Std 20 Min" / "12 Min" */
export function duration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h >= 24 ? `${Math.floor(h / 24)} T ${h % 24} Std` : `${h} Std${m ? ` ${m} Min` : ''}`;
}
