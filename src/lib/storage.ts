import type { SavedDocument, StoredFont } from '../types';

const DB_NAME = 'retro-pop-price-card-db';
const DOCUMENTS_STORE = 'documents';
const FONTS_STORE = 'fonts';
const FS_STORE = 'fs-handles';
const DB_VERSION = 3;

const openDb = async () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FONTS_STORE)) {
        db.createObjectStore(FONTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FS_STORE)) {
        db.createObjectStore(FS_STORE, { keyPath: 'key' });
      }
    };
  });

export const saveDocument = async (item: SavedDocument) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOCUMENTS_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DOCUMENTS_STORE).put(item);
  });
  db.close();
};

export const loadDocuments = async () => {
  const db = await openDb();
  const items = await new Promise<SavedDocument[]>((resolve, reject) => {
    const tx = db.transaction(DOCUMENTS_STORE, 'readonly');
    const request = tx.objectStore(DOCUMENTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result as SavedDocument[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteDocument = async (id: string) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DOCUMENTS_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(DOCUMENTS_STORE).delete(id);
  });
  db.close();
};

export const getSavedDirHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await openDb();
    const result = await new Promise<{ key: string; handle: FileSystemDirectoryHandle } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(FS_STORE, 'readonly');
        const req = tx.objectStore(FS_STORE).get('saveDir');
        req.onsuccess = () => resolve(req.result as any);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();
    return result?.handle ?? null;
  } catch {
    return null;
  }
};

export const setSavedDirHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FS_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(FS_STORE).put({ key: 'saveDir', handle });
  });
  db.close();
};

export const saveStoredFont = async (font: StoredFont) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(FONTS_STORE).put(font);
  });
  db.close();
};

export const loadStoredFonts = async () => {
  const db = await openDb();
  const fonts = await new Promise<StoredFont[]>((resolve, reject) => {
    const tx = db.transaction(FONTS_STORE, 'readonly');
    const request = tx.objectStore(FONTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredFont[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return fonts.sort((a, b) => a.createdAt - b.createdAt);
};
