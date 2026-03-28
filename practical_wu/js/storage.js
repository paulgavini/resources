const DB_NAME = "PracticalInvestigationBuilderDB";
const DB_VERSION = 1;
const STORE_NAME = "investigations";
const RECORD_KEY = "current";
const LEGACY_LOCAL_STORAGE_KEY = "practicalInvestigationBuilder.v1";

let dbPromise = null;

function parseSavedPayload(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      savedAt: parsed.savedAt ?? "",
      state: parsed.state,
    };
  } catch (error) {
    console.error("Could not parse saved investigation.", error);
    return null;
  }
}

function readLegacyLocalStorage() {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return parseSavedPayload(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY));
}

function writeLegacyLocalStorage(payload) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(payload));
}

function removeLegacyLocalStorage() {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
}

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Failed to open IndexedDB."));
    };
  });

  return dbPromise;
}

async function readFromIndexedDbOnly() {
  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(RECORD_KEY);

    request.onsuccess = () => {
      const payload = request.result;
      if (!payload || typeof payload !== "object") {
        resolve(null);
        return;
      }

      resolve({
        savedAt: payload.savedAt ?? "",
        state: payload.state,
      });
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to read from IndexedDB."));
    };
  });
}

async function writeToIndexedDb(payload) {
  const db = await openDatabase();
  if (!db) {
    return false;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(payload, RECORD_KEY);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Failed to write to IndexedDB."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction was aborted."));
  });
}

async function deleteFromIndexedDb() {
  const db = await openDatabase();
  if (!db) {
    return false;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(RECORD_KEY);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("Failed to clear IndexedDB record."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction was aborted."));
  });
}

export async function saveToIndexedDb(state) {
  const payload = {
    savedAt: new Date().toISOString(),
    state,
  };

  try {
    const wroteToIndexedDb = await writeToIndexedDb(payload);
    if (!wroteToIndexedDb) {
      writeLegacyLocalStorage(payload);
    }
  } catch (error) {
    console.error("Failed to save to IndexedDB. Falling back to localStorage.", error);
    writeLegacyLocalStorage(payload);
  }

  return payload.savedAt;
}

export async function loadFromIndexedDb() {
  try {
    const indexedDbPayload = await readFromIndexedDbOnly();
    if (indexedDbPayload?.state) {
      return indexedDbPayload;
    }
  } catch (error) {
    console.error("Failed to load from IndexedDB. Falling back to localStorage.", error);
  }

  return readLegacyLocalStorage();
}

export async function clearSavedInvestigation() {
  try {
    await deleteFromIndexedDb();
  } catch (error) {
    console.error("Failed to clear IndexedDB record.", error);
  }

  removeLegacyLocalStorage();
}

export async function migrateLegacyLocalStorageToIndexedDb() {
  const legacy = readLegacyLocalStorage();
  if (!legacy?.state) {
    return { migrated: false };
  }

  try {
    const current = await readFromIndexedDbOnly();
    if (current?.state) {
      return { migrated: false };
    }

    const wroteToIndexedDb = await writeToIndexedDb(legacy);
    if (!wroteToIndexedDb) {
      return { migrated: false };
    }

    removeLegacyLocalStorage();
    return {
      migrated: true,
      savedAt: legacy.savedAt ?? "",
    };
  } catch (error) {
    console.error("Legacy localStorage migration to IndexedDB failed.", error);
    return { migrated: false };
  }
}

export function exportAsJson(state) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Practical Investigation Builder",
    state,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `practical-investigation-${timestamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importFromJsonText(text) {
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid JSON structure.");
  }

  if (parsed.state) {
    return parsed.state;
  }

  return parsed;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsText(file);
  });
}
