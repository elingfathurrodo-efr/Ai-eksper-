// ============================================================
// AI HYPER — storage layer
// Two tiers on purpose:
//  - localStorage: small, synchronous stuff (settings, active theme,
//    quota counters) — read on every keystroke, must be instant.
//  - IndexedDB: bigger stuff (chat history, agent library, cached
//    model weight blobs) — async, can hold hundreds of MB.
// Everything here is LOCAL to the device. Nothing leaves unless the
// chat/cloud layer explicitly sends it.
// ============================================================

const DB_NAME = "ai-hyper";
const DB_VERSION = 1;
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("chats")) {
        db.createObjectStore("chats", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("agents")) {
        db.createObjectStore("agents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("model_blobs")) {
        db.createObjectStore("model_blobs", { keyPath: "modelId" });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode) {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export const idb = {
  async put(store, value) {
    const s = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = s.put(value);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  async get(store, key) {
    const s = await tx(store, "readonly");
    return new Promise((res, rej) => {
      const r = s.get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  },
  async getAll(store) {
    const s = await tx(store, "readonly");
    return new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },
  async delete(store, key) {
    const s = await tx(store, "readwrite");
    return new Promise((res, rej) => {
      const r = s.delete(key);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
};

// ---- synchronous local settings ----
const LS_PREFIX = "aihyper:";
export const localPrefs = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch {}
  },
};

// ---- chat helpers ----
export async function saveChat(chat) {
  chat.updatedAt = Date.now();
  await idb.put("chats", chat);
}
export async function loadAllChats() {
  const chats = await idb.getAll("chats");
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function deleteChat(id) {
  await idb.delete("chats", id);
}

// ---- agent (prompt library) helpers ----
export async function saveAgent(agent) {
  await idb.put("agents", agent);
}
export async function loadAllAgents() {
  return idb.getAll("agents");
}
export async function deleteAgent(id) {
  await idb.delete("agents", id);
}
