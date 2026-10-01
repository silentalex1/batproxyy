export interface SavedUpscale {
  id: string;
  user: string;
  name: string;
  tier: string;
  w: number;
  h: number;
  size: number;
  type: string;
  at: number;
  blob: Blob;
  thumb: Blob;
}

const DB_NAME = 'bp-image-4k';
const STORE = 'items';
const KEEP = 12;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('user', 'user');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let value: T;
      req.onsuccess = () => { value = req.result; };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || req.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  } finally {
    db.close();
  }
}

export async function listSaved(user: string): Promise<SavedUpscale[]> {
  const all = await run<SavedUpscale[]>('readonly', s => s.index('user').getAll(user));
  return all.sort((a, b) => b.at - a.at);
}

export function removeSaved(id: string) {
  return run('readwrite', s => s.delete(id));
}

export async function saveUpscale(item: SavedUpscale) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await run('readwrite', s => s.put(item));
      break;
    } catch (err) {
      const list = await listSaved(item.user);
      const oldest = list[list.length - 1];
      if (!oldest || attempt === 3) throw err;
      await removeSaved(oldest.id);
    }
  }
  const list = await listSaved(item.user);
  for (const extra of list.slice(KEEP)) await removeSaved(extra.id);
}
