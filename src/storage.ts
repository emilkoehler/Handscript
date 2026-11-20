// Speichert Schriften lokal im Browser (IndexedDB).
import { HandFont } from './font';

const DB_NAME = 'handscript';
const STORE = 'fonts';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
  });
}

export async function listFonts(): Promise<HandFont[]> {
  const all = await tx<HandFont[]>('readonly', (s) => s.getAll() as IDBRequest<HandFont[]>);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveFont(font: HandFont): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put(font));
}

export function deleteFont(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id));
}

/** Lädt eine Schrift als .json-Datei herunter (zum Teilen mit Freunden). */
export function downloadFont(font: HandFont): void {
  const blob = new Blob([JSON.stringify(font)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${font.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'schrift'}.handscript.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
