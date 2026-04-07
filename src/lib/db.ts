const DB_NAME = 'petfood-nutrition-db';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('ingredients')) db.createObjectStore('ingredients', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('channels')) db.createObjectStore('channels', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('formulas')) db.createObjectStore('formulas', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('nutrients')) db.createObjectStore('nutrients', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('formulaVersions')) db.createObjectStore('formulaVersions', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllByIndex<T>(storeName: string, key: string, value: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const results = (req.result as any[]).filter(item => item[key] === value);
      resolve(results as T[]);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putItem<T>(storeName: string, item: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(storeName: string, id: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key: string, value: string): Promise<void> {
  await putItem('meta', { key, value });
}

export async function getMeta(key: string): Promise<string | undefined> {
  const result = await getById<{ key: string; value: string }>('meta', key);
  return result?.value;
}
