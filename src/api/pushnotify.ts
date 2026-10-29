import { store, type SavedTrip } from '../store';
import { fetchJson } from '../util';

// Push notifications for saved commuter trips. The app only hands the trips to the push worker
// (proxy/fahrplan-push-worker.js); the worker watches the timetable and sends Web Push messages –
// that is what makes it work with the app closed.

// import.meta.env is undefined when this is imported under Node
const BUILT_IN = (import.meta.env?.VITE_PUSH_URL as string | undefined)?.trim() || '';

export const builtInPush = () => BUILT_IN;

/** Worker address in use ('' without one) – the user's own address wins over the built-in one. */
export const pushBase = (): string => (store.getKeys().pushWorker?.trim() || BUILT_IN).replace(/\/+$/, '');

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'ready';

export const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function pushState(): PushState {
  if (!pushSupported()) return 'unsupported';
  if (!pushBase()) return 'unconfigured';
  return Notification.permission === 'denied' ? 'denied' : 'ready';
}

/** lead times (minutes before departure) offered in the app */
export const LEADS = [30, 20, 10, 5];

const b64uDec = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** the active service worker; there is none in the dev server, so this must not wait forever */
async function readyReg(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
  if (!reg) throw new Error('Der Service Worker ist nicht aktiv (er läuft nur in der veröffentlichten App).');
  return reg;
}

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await readyReg();
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  const { key } = await fetchJson<{ key: string }>(`${pushBase()}/key`, undefined, 15000);
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uDec(key) as BufferSource });
}

const post = (path: string, body: unknown) =>
  fetchJson<{ ok?: boolean }>(`${pushBase()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 15000);

/** Asks for the permission (call from a click) and subscribes. Throws with a readable message. */
export async function enablePush(): Promise<void> {
  const st = pushState();
  if (st === 'unsupported') throw new Error('Dieser Browser unterstützt keine Push-Nachrichten.');
  if (st === 'unconfigured') throw new Error('Der Push-Dienst ist nicht eingerichtet.');
  if (st === 'denied') throw new Error('Benachrichtigungen sind im Browser blockiert.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Ohne Erlaubnis kann ich keine Nachricht schicken.');
  await subscription(true);
}

/** the trips the worker has to watch */
const watched = (): SavedTrip[] => store.getTrips().filter((t) => t.notify && t.notify.leads.length && t.days.length);

/**
 * Tells the worker which trips to watch (a full replacement). Does nothing without permission or worker;
 * resolves with whether the worker knows the trips now.
 */
export async function syncPush(): Promise<boolean> {
  if (pushState() !== 'ready' || Notification.permission !== 'granted') return false;
  const sub = await subscription(false);
  if (!sub) return false;
  const trips = watched();
  if (!trips.length) {
    await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    return true;
  }
  const stop = (s: SavedTrip['from']) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, src: s.src });
  await post('/sync', {
    subscription: sub.toJSON(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    trips: trips.map((t) => ({ id: t.id, from: stop(t.from), to: stop(t.to), line: t.line, hm: t.hm, days: t.days, leads: t.notify!.leads, onlyDelay: t.notify!.onlyDelay })),
  });
  return true;
}

/** sends a test notification to this device (the trips must have been synced) */
export async function testPush(): Promise<void> {
  const sub = await subscription(false);
  if (!sub) throw new Error('Noch nicht angemeldet.');
  await post('/test', { endpoint: sub.endpoint });
}
