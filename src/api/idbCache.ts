// Shared browser-persistent key/value cache (IndexedDB – for data too big or too
// numerous for localStorage). One object store, used by multiple API modules
// (aircraft tracking, mobile speed checks, …) with their own key prefixes.

const idb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('orbis-cache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const r = db.transaction('kv').objectStore('kv').get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

export function kvSet(key: string, value: unknown) {
  idb()
    .then((db) => db.transaction('kv', 'readwrite').objectStore('kv').put(value, key))
    .catch(() => undefined);
}

export async function kvDelete(key: string) {
  try {
    const db = await idb();
    db.transaction('kv', 'readwrite').objectStore('kv').delete(key);
  } catch {
    /* ignore – worst case the stale entry lingers until overwritten */
  }
}

/** All `{key, value}` entries whose key starts with `prefix` – for building an in-memory index of a tile grid without probing every possible tile individually. */
export async function kvEntriesByPrefix<T>(prefix: string): Promise<{ key: string; value: T }[]> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const range = IDBKeyRange.bound(prefix, prefix + '￿');
      const req = db.transaction('kv').objectStore('kv').openCursor(range);
      const out: { key: string; value: T }[] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        out.push({ key: String(cursor.key), value: cursor.value as T });
        cursor.continue();
      };
      req.onerror = () => resolve(out);
    });
  } catch {
    return [];
  }
}
