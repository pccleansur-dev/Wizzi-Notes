import { Note } from '../types';

const DB_NAME = 'WizziNotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notesStore';

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Error al abrir la base de datos IndexedDB'));
    };
  });
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort notes so newest is always first
      const notes = request.result as Note[];
      notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(notes);
    };

    request.onerror = () => {
      reject(request.error || new Error('Error al recuperar las notas de IndexedDB'));
    };
  });
}

export async function saveNote(note: Note): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(note);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Error al guardar la nota en IndexedDB'));
    };
  });
}

export async function clearAllNotes(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Error al borrar las notas de IndexedDB'));
  });
}

export async function importNotes(notes: Note[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const note of notes) {
      store.put(note);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Error al importar notas en IndexedDB'));
  });
}

export async function deleteNoteFromDB(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Error al eliminar la nota de IndexedDB'));
    };
  });
}
