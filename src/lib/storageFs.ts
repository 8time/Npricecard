import type { CardDocument, SavedDocument } from '../types';
import { getSavedDirHandle, setSavedDirHandle } from './storage';

const stripImageData = (doc: CardDocument): CardDocument => ({
  ...doc,
  imageLayers: (doc.imageLayers || []).map((l) => ({ ...l, dataUrl: '' })),
  instances: (doc.instances || []).map((inst) => ({
    ...inst,
    design: {
      ...inst.design,
      imageLayers: (inst.design.imageLayers || []).map((l) => ({ ...l, dataUrl: '' })),
    },
  })),
});

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function selectSaveFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    await setSavedDirHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

export async function verifyDirPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const h = handle as any;
    const opts = { mode: 'readwrite' };
    if ((await h.queryPermission(opts)) === 'granted') return true;
    if ((await h.requestPermission(opts)) === 'granted') return true;
    return false;
  } catch {
    return false;
  }
}

export async function initSaveFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  const handle = await getSavedDirHandle();
  if (!handle) return null;
  const ok = await verifyDirPermission(handle);
  return ok ? handle : null;
}

export async function saveDocumentToFs(
  dirHandle: FileSystemDirectoryHandle,
  item: SavedDocument,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(`${item.id}.json`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(item, null, 2));
  await writable.close();
}

export async function deleteDocumentFromFs(
  dirHandle: FileSystemDirectoryHandle,
  id: string,
): Promise<void> {
  try {
    await dirHandle.removeEntry(`${id}.json`);
  } catch {
    // ファイルが存在しない場合は無視
  }
}

export async function loadDocumentFromFs(
  dirHandle: FileSystemDirectoryHandle,
  id: string,
): Promise<SavedDocument | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(`${id}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as SavedDocument;
  } catch {
    return null;
  }
}

export async function loadDocumentsFromFs(
  dirHandle: FileSystemDirectoryHandle,
): Promise<SavedDocument[]> {
  const items: SavedDocument[] = [];
  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    try {
      const file = await (entry as FileSystemFileHandle).getFile();
      const text = await file.text();
      const item = JSON.parse(text) as SavedDocument;
      items.push({ ...item, document: stripImageData(item.document) });
    } catch {
      // 壊れたファイルはスキップ
    }
  }
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}
