import type { TripEntity } from "../types/travel";

/** 本地优先持久化:浏览器 IndexedDB。记录可以是行程,也可以是对 CSV 基础行程的删除标记(tombstone)。 */
export interface TripRecord {
  id: string;
  deleted?: boolean;
  trip?: TripEntity;
}

const DB_NAME = "travel-traces";
const STORE = "trips";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r ? (r as IDBRequest<T>).result : undefined);
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const tripDb = {
  async getAll(): Promise<TripRecord[]> {
    return ((await tx<TripRecord[]>("readonly", (s) => s.getAll())) as TripRecord[]) || [];
  },
  async put(rec: TripRecord) {
    await tx("readwrite", (s) => s.put(rec));
  },
  async putMany(recs: TripRecord[]) {
    await tx("readwrite", (s) => {
      for (const r of recs) s.put(r);
    });
  },
  async remove(id: string) {
    await tx("readwrite", (s) => s.delete(id));
  },
  async clear() {
    await tx("readwrite", (s) => s.clear());
  },
};
