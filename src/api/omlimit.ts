// Client-side budget for the free Open-Meteo API. Every location in a multi-location request
// counts as (at least) one call; the free tier allows ~600 calls per minute, 5 000 per hour
// and 10 000 per day. Requests wait here instead of running into HTTP 429.

const PER_MINUTE = 590; // stay just below the limit
const log: { t: number; w: number }[] = [];
let priorityJobs = 0;

/** Runs `fn` with priority: low-priority requests wait until it has finished. */
export async function omPriority<T>(fn: () => Promise<T>): Promise<T> {
  priorityJobs++;
  try {
    return await fn();
  } finally {
    priorityJobs--;
  }
}

export class OpenMeteoLimitError extends Error {}

export async function omBudget(weight: number, low = false): Promise<void> {
  for (;;) {
    if (low && priorityJobs > 0) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    const now = Date.now();
    while (log.length && now - log[0].t > 60000) log.shift();
    const used = log.reduce((s, e) => s + e.w, 0);
    if (used + weight <= PER_MINUTE || !log.length) {
      log.push({ t: now, w: weight });
      return;
    }
    await new Promise((r) => setTimeout(r, Math.max(500, 60000 - (now - log[0].t) + 200)));
  }
}

/**
 * fetch() for Open-Meteo with budget + one retry after a per-minute 429.
 * Hourly/daily limits are reported as OpenMeteoLimitError.
 */
export async function omFetch<T>(url: string, weight: number, low = false): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await omBudget(weight, low);
    const res = await fetch(url);
    if (res.status === 429) {
      const reason = await res.text().catch(() => '');
      if (/minut/i.test(reason) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 61000));
        continue;
      }
      throw new OpenMeteoLimitError(
        /hour|stünd/i.test(reason) ? 'Stundenlimit der kostenlosen Open-Meteo-API erreicht' : 'Tageslimit der kostenlosen Open-Meteo-API erreicht',
      );
    }
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return (await res.json()) as T;
  }
}
