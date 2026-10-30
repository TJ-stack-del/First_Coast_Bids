"use client";

import type { CarriedFields } from "./fields";
import type { ReadItem } from "./read";

// Hands the bid a visitor read on the homepage to the sign-up form
// (app/intake), so they don't upload it twice. Kept in this browser's own
// IndexedDB, which never leaves the device: the file reaches us only when
// the visitor creates their account and the last step attaches it, the
// same as an upload they'd make by hand. Best-effort throughout: private
// windows and blocked storage just mean the sign-up form starts empty.

export type CarriedBid = {
  file: File;
  fields: CarriedFields;
  items: Pick<ReadItem, "key" | "group" | "label" | "page">[];
  pagesRead: number;
  savedAt: number;
};

const DB = "fcb-bid-read";
const STORE = "carried";
const KEY = "bid";
// A bid read last month is a different visit; don't surprise anyone with it.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = act(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveCarriedBid(bid: Omit<CarriedBid, "savedAt">): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put({ ...bid, savedAt: Date.now() }, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function loadCarriedBid(): Promise<CarriedBid | null> {
  try {
    const bid = (await run("readonly", (s) => s.get(KEY))) as CarriedBid | undefined;
    if (!bid || !(bid.file instanceof Blob)) return null;
    if (Date.now() - bid.savedAt > MAX_AGE_MS) {
      await clearCarriedBid();
      return null;
    }
    return bid;
  } catch {
    return null;
  }
}

export async function clearCarriedBid(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing to clean up if storage was never available.
  }
}
