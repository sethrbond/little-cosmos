/* offlineQueue.js — IndexedDB-backed offline queue for entry saves
   When the app is offline, saves are queued locally and flushed when connectivity returns.
   Integrates with the existing fire-and-forget save pattern in the reducer. */

const DB_NAME = 'cosmos-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-ops'

let _db = null
let _flushInProgress = false
const _listeners = new Set()

// ---- IndexedDB Setup ----

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'queueId', autoIncrement: true })
      }
    }
    req.onsuccess = () => { _db = req.result; resolve(_db) }
    req.onerror = () => reject(req.error)
  })
}

// ---- Queue Operations ----

export async function enqueue(op) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.add({ ...op, createdAt: Date.now() })
    tx.oncomplete = () => { _notify(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingOps() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingCount() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function removeOp(queueId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(queueId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- Flush Queue ----

export async function flushQueue(dbFactoryMap) {
  if (_flushInProgress || !navigator.onLine) return { flushed: 0, failed: 0 }
  _flushInProgress = true
  let flushed = 0, failed = 0

  try {
    const ops = await getPendingOps()
    for (const op of ops) {
      try {
        const db = dbFactoryMap[op.dbKey]
        if (!db) { console.warn('[offlineQueue] no db for key:', op.dbKey); failed++; continue }

        if (op.action === 'save') {
          await db.saveEntry(op.entry)
        } else if (op.action === 'delete') {
          await db.deleteEntry(op.entryId)
        } else if (op.action === 'saveConfig') {
          await db.saveConfig(op.config)
        }

        await removeOp(op.queueId)
        flushed++
      } catch (err) {
        console.error('[offlineQueue] flush op failed:', op.queueId, err)
        failed++
        // Stop flushing on network error — will retry on next online event
        if (!navigator.onLine) break
      }
    }
  } finally {
    _flushInProgress = false
    _notify()
  }

  return { flushed, failed }
}

// ---- Online Detection ----

export function isOnline() {
  return navigator.onLine
}

// ---- Listener System ----

function _notify() {
  getPendingCount().then(count => {
    _listeners.forEach(fn => fn(count))
  }).catch(() => {})
}

export function onQueueChange(fn) {
  _listeners.add(fn)
  // Immediately notify with current count
  getPendingCount().then(fn).catch(() => fn(0))
  return () => _listeners.delete(fn)
}

// ---- Offline-Aware DB Wrapper ----

export function wrapDbForOffline(db, dbKey) {
  return {
    ...db,
    saveEntry: async (entry) => {
      if (navigator.onLine) {
        try {
          return await db.saveEntry(entry)
        } catch (err) {
          // Network error during save — queue it
          if (err?.message?.includes('fetch') || err?.message?.includes('network') || !navigator.onLine) {
            await enqueue({ action: 'save', dbKey, entry })
            return true
          }
          throw err
        }
      }
      // Offline — queue immediately
      await enqueue({ action: 'save', dbKey, entry })
      return true
    },
    deleteEntry: async (id) => {
      if (navigator.onLine) {
        try {
          return await db.deleteEntry(id)
        } catch (err) {
          if (!navigator.onLine) {
            await enqueue({ action: 'delete', dbKey, entryId: id })
            return true
          }
          throw err
        }
      }
      await enqueue({ action: 'delete', dbKey, entryId: id })
      return true
    },
    saveConfig: async (config) => {
      if (navigator.onLine) {
        try {
          return await db.saveConfig(config)
        } catch (err) {
          if (!navigator.onLine) {
            await enqueue({ action: 'saveConfig', dbKey, config })
            return true
          }
          throw err
        }
      }
      await enqueue({ action: 'saveConfig', dbKey, config })
      return true
    },
    // Pass through all other methods unchanged
    loadEntries: db.loadEntries,
    loadConfig: db.loadConfig,
    readPhotos: db.readPhotos,
    savePhotos: db.savePhotos,
    deletePhoto: db.deletePhoto,
  }
}
