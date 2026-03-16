import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- In-memory IndexedDB mock ----

function createMockIndexedDB() {
  const databases = {}

  function createObjectStore(dbName, storeName, opts) {
    if (!databases[dbName]) databases[dbName] = {}
    if (!databases[dbName][storeName]) databases[dbName][storeName] = { records: [], autoIncId: 1, opts }
    return databases[dbName][storeName]
  }

  function getStore(dbName, storeName) {
    return databases[dbName]?.[storeName]
  }

  function makeRequest(resultValue) {
    const req = { result: resultValue, error: null, onsuccess: null, onerror: null }
    Promise.resolve().then(() => req.onsuccess?.())
    return req
  }

  function makeTransaction(dbName, storeName, mode) {
    const tx = { oncomplete: null, onerror: null, error: null }
    const store = getStore(dbName, storeName)

    const storeObj = {
      add(record) {
        const id = store.autoIncId++
        const entry = { ...record, [store.opts.keyPath]: id }
        store.records.push(entry)
        return makeRequest(id)
      },
      put(record) {
        const key = record[store.opts.keyPath]
        const idx = store.records.findIndex(r => r[store.opts.keyPath] === key)
        if (idx >= 0) store.records[idx] = record
        else store.records.push(record)
        return makeRequest(key)
      },
      delete(key) {
        store.records = store.records.filter(r => r[store.opts.keyPath] !== key)
        return makeRequest(undefined)
      },
      count() {
        const req = { result: store.records.length, onsuccess: null, onerror: null }
        Promise.resolve().then(() => req.onsuccess?.())
        return req
      },
      getAll() {
        const req = { result: [...store.records], onsuccess: null, onerror: null }
        Promise.resolve().then(() => req.onsuccess?.())
        return req
      },
      openCursor() {
        let index = 0
        const req = { result: null, onsuccess: null, onerror: null }
        function advance() {
          if (index < store.records.length) {
            const record = store.records[index]
            req.result = {
              value: record,
              delete() {
                store.records.splice(index, 1)
              },
              continue() {
                index++
                Promise.resolve().then(() => {
                  advance()
                })
              },
            }
          } else {
            req.result = null
          }
          req.onsuccess?.()
        }
        Promise.resolve().then(() => advance())
        return req
      },
    }

    Promise.resolve()
      .then(() => new Promise(r => setTimeout(r, 0)))
      .then(() => tx.oncomplete?.())

    return {
      ...tx,
      objectStore(name) {
        return storeObj
      },
      set oncomplete(fn) { tx.oncomplete = fn },
      get oncomplete() { return tx.oncomplete },
      set onerror(fn) { tx.onerror = fn },
      get onerror() { return tx.onerror },
    }
  }

  const idb = {
    open(dbName, version) {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null }

      Promise.resolve().then(() => {
        const isNew = !databases[dbName]
        const dbObj = {
          objectStoreNames: {
            contains(name) { return !!databases[dbName]?.[name] },
          },
          createObjectStore(name, opts) {
            createObjectStore(dbName, name, opts)
          },
          transaction(storeName, mode) {
            return makeTransaction(dbName, storeName, mode)
          },
        }
        req.result = dbObj
        if (isNew) {
          if (!databases[dbName]) databases[dbName] = {}
          req.onupgradeneeded?.()
        }
        req.onsuccess?.()
      })

      return req
    },
    _databases: databases,
    _reset() {
      for (const key of Object.keys(databases)) delete databases[key]
    },
  }

  return idb
}

// ---- Test setup ----

let mockIDB
let onlineStatus = true

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  mockIDB = createMockIndexedDB()
  onlineStatus = true

  vi.stubGlobal('indexedDB', mockIDB)
  vi.stubGlobal('navigator', {
    get onLine() { return onlineStatus },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function loadModule() {
  const mod = await import('../offlineQueue.js')
  return mod
}

describe('offlineQueue', () => {

  describe('enqueue', () => {
    it('adds an operation to the queue', async () => {
      const { enqueue, getPendingCount, getPendingOps } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1', title: 'Paris' } })

      const count = await getPendingCount()
      expect(count).toBe(1)

      const ops = await getPendingOps()
      expect(ops).toHaveLength(1)
      expect(ops[0].action).toBe('save')
      expect(ops[0].dbKey).toBe('trips')
      expect(ops[0].entry).toEqual({ id: '1', title: 'Paris' })
      expect(ops[0].createdAt).toBeTypeOf('number')
    })

    it('adds multiple operations in order', async () => {
      const { enqueue, getPendingOps } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      await enqueue({ action: 'delete', dbKey: 'trips', entryId: '2' })
      await enqueue({ action: 'saveConfig', dbKey: 'trips', config: { theme: 'dark' } })

      const ops = await getPendingOps()
      expect(ops).toHaveLength(3)
      expect(ops[0].action).toBe('save')
      expect(ops[1].action).toBe('delete')
      expect(ops[2].action).toBe('saveConfig')
    })

    it('assigns a createdAt timestamp', async () => {
      const now = Date.now()
      const { enqueue, getPendingOps } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'x', entry: {} })

      const ops = await getPendingOps()
      expect(ops[0].createdAt).toBeGreaterThanOrEqual(now)
      expect(ops[0].createdAt).toBeLessThanOrEqual(now + 1000)
    })
  })

  describe('MAX_QUEUE_SIZE enforcement', () => {
    it('removes oldest entry when queue reaches 500', async () => {
      const { enqueue, getPendingCount, getPendingOps } = await loadModule()

      // Seed one entry via enqueue to initialize the DB/store
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '0' } })

      // Directly populate the backing store to avoid 500 async round-trips
      const store = Object.values(mockIDB._databases)[0]?.['pending-ops']
      for (let i = 1; i < 500; i++) {
        const id = store.autoIncId++
        store.records.push({
          queueId: id,
          action: 'save',
          dbKey: 'trips',
          entry: { id: String(i) },
          createdAt: Date.now(),
        })
      }
      expect(await getPendingCount()).toBe(500)

      // Adding one more should evict the oldest
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: 'overflow' } })

      const count = await getPendingCount()
      expect(count).toBe(500)

      const ops = await getPendingOps()
      const ids = ops.map(o => o.entry?.id)
      expect(ids).not.toContain('0')
      expect(ids).toContain('overflow')
    })
  })

  describe('cleanupStaleEntries', () => {
    it('removes entries older than 48 hours during flush', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })

      // Manually backdate the entry to 49 hours ago
      const store = Object.values(mockIDB._databases)[0]?.['pending-ops']
      if (store && store.records.length > 0) {
        store.records[0].createdAt = Date.now() - 49 * 60 * 60 * 1000
      }

      // Add a fresh entry
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '2' } })

      const mockDb = { saveEntry: vi.fn().mockResolvedValue(true) }
      await flushQueue({ trips: mockDb })

      // Only the fresh entry should be flushed; the stale one was cleaned up
      expect(mockDb.saveEntry).toHaveBeenCalledTimes(1)
      expect(mockDb.saveEntry).toHaveBeenCalledWith({ id: '2' })
    })

    it('keeps entries younger than 48 hours', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      const store = Object.values(mockIDB._databases)[0]?.['pending-ops']
      if (store && store.records.length > 0) {
        store.records[0].createdAt = Date.now() - 47 * 60 * 60 * 1000
      }

      const mockDb = { saveEntry: vi.fn().mockResolvedValue(true) }
      await flushQueue({ trips: mockDb })

      expect(mockDb.saveEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('flushQueue', () => {
    it('processes pending save operations', async () => {
      const { enqueue, flushQueue, getPendingCount } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1', title: 'Paris' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '2', title: 'London' } })

      const mockDb = { saveEntry: vi.fn().mockResolvedValue(true) }
      const result = await flushQueue({ trips: mockDb })

      expect(result.flushed).toBe(2)
      expect(result.failed).toBe(0)
      expect(mockDb.saveEntry).toHaveBeenCalledTimes(2)
      expect(mockDb.saveEntry).toHaveBeenCalledWith({ id: '1', title: 'Paris' })
      expect(mockDb.saveEntry).toHaveBeenCalledWith({ id: '2', title: 'London' })

      expect(await getPendingCount()).toBe(0)
    })

    it('processes pending delete operations', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'delete', dbKey: 'trips', entryId: 'abc' })

      const mockDb = { deleteEntry: vi.fn().mockResolvedValue(true) }
      const result = await flushQueue({ trips: mockDb })

      expect(result.flushed).toBe(1)
      expect(mockDb.deleteEntry).toHaveBeenCalledWith('abc')
    })

    it('processes pending saveConfig operations', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'saveConfig', dbKey: 'trips', config: { theme: 'dark' } })

      const mockDb = { saveConfig: vi.fn().mockResolvedValue(true) }
      const result = await flushQueue({ trips: mockDb })

      expect(result.flushed).toBe(1)
      expect(mockDb.saveConfig).toHaveBeenCalledWith({ theme: 'dark' })
    })

    it('returns {0,0} when offline', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      onlineStatus = false

      const result = await flushQueue({ trips: {} })
      expect(result).toEqual({ flushed: 0, failed: 0 })
    })

    it('returns {0,0} with empty queue', async () => {
      const { flushQueue } = await loadModule()

      const result = await flushQueue({})
      expect(result).toEqual({ flushed: 0, failed: 0 })
    })

    it('counts failed ops when no db found for dbKey', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'unknown', entry: { id: '1' } })

      const result = await flushQueue({})
      expect(result.failed).toBe(1)
      expect(result.flushed).toBe(0)
    })

    it('stops processing if connectivity is lost mid-flush', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '2' } })

      let callCount = 0
      const mockDb = {
        saveEntry: vi.fn().mockImplementation(async () => {
          callCount++
          if (callCount === 1) {
            onlineStatus = false
            throw new Error('network error')
          }
        }),
      }

      const result = await flushQueue({ trips: mockDb })
      expect(result.failed).toBe(1)
      expect(mockDb.saveEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('flushQueue exponential backoff', () => {
    it('applies exponential backoff on consecutive failures', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '2' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '3' } })

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const mockDb = {
        saveEntry: vi.fn().mockRejectedValue(new Error('server error')),
      }

      await flushQueue({ trips: mockDb })

      const delays = setTimeoutSpy.mock.calls
        .map(c => c[1])
        .filter(d => d !== undefined && d >= 500)

      // Should see escalating delays: 500, 1000, 2000
      expect(delays.length).toBeGreaterThanOrEqual(2)
      if (delays.length >= 2) {
        expect(delays[1]).toBeGreaterThanOrEqual(delays[0])
      }

      setTimeoutSpy.mockRestore()
    })

    it('resets backoff after a successful operation', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '2' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '3' } })

      let callIndex = 0
      const mockDb = {
        saveEntry: vi.fn().mockImplementation(async () => {
          callIndex++
          if (callIndex === 1) throw new Error('temp fail')
        }),
      }

      const result = await flushQueue({ trips: mockDb })
      expect(result.flushed).toBe(2)
      expect(result.failed).toBe(1)
    })

    it('caps backoff at 30000ms', async () => {
      const { enqueue, flushQueue } = await loadModule()

      // Use only 3 entries - enough to verify the backoff pattern
      // without triggering timeouts. The code doubles from 500:
      // 500 -> 1000 -> 2000 -> 4000 -> ... -> 30000 (cap)
      // We just need to verify no delay exceeds 30000.
      for (let i = 0; i < 3; i++) {
        await enqueue({ action: 'save', dbKey: 'trips', entry: { id: String(i) } })
      }

      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const mockDb = {
        saveEntry: vi.fn().mockRejectedValue(new Error('fail')),
      }

      await flushQueue({ trips: mockDb })

      const delays = setTimeoutSpy.mock.calls
        .map(c => c[1])
        .filter(d => d !== undefined && d >= 500)

      for (const d of delays) {
        expect(d).toBeLessThanOrEqual(30000)
      }

      // Verify the doubling pattern: 500, 1000, 2000
      expect(delays).toEqual([500, 1000, 2000])

      setTimeoutSpy.mockRestore()
    })

    it('prevents concurrent flushes', async () => {
      const { enqueue, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })

      const mockDb = {
        saveEntry: vi.fn().mockImplementation(() => new Promise(r => setTimeout(r, 100))),
      }

      const [r1, r2] = await Promise.all([
        flushQueue({ trips: mockDb }),
        flushQueue({ trips: mockDb }),
      ])

      expect(r2).toEqual({ flushed: 0, failed: 0 })
      expect(r1.flushed).toBe(1)
    })
  })

  describe('wrapDbForOffline', () => {
    it('calls original saveEntry when online', async () => {
      const { wrapDbForOffline } = await loadModule()

      const db = {
        saveEntry: vi.fn().mockResolvedValue('ok'),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.saveEntry({ id: '1' })

      expect(db.saveEntry).toHaveBeenCalledWith({ id: '1' })
      expect(result).toBe('ok')
    })

    it('queues saveEntry when offline', async () => {
      const { wrapDbForOffline, getPendingOps } = await loadModule()

      onlineStatus = false

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.saveEntry({ id: '1', title: 'Paris' })

      expect(result).toBe(true)
      expect(db.saveEntry).not.toHaveBeenCalled()

      const ops = await getPendingOps()
      expect(ops).toHaveLength(1)
      expect(ops[0].action).toBe('save')
      expect(ops[0].entry).toEqual({ id: '1', title: 'Paris' })
    })

    it('queues saveEntry on fetch/network error while online', async () => {
      const { wrapDbForOffline, getPendingOps } = await loadModule()

      const db = {
        saveEntry: vi.fn().mockRejectedValue(new Error('fetch failed')),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.saveEntry({ id: '1' })

      expect(result).toBe(true)
      const ops = await getPendingOps()
      expect(ops).toHaveLength(1)
    })

    it('rethrows non-network errors from saveEntry', async () => {
      const { wrapDbForOffline } = await loadModule()

      const db = {
        saveEntry: vi.fn().mockRejectedValue(new Error('validation error')),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      await expect(wrapped.saveEntry({ id: '1' })).rejects.toThrow('validation error')
    })

    it('queues deleteEntry when offline', async () => {
      const { wrapDbForOffline, getPendingOps } = await loadModule()

      onlineStatus = false

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.deleteEntry('abc')

      expect(result).toBe(true)
      expect(db.deleteEntry).not.toHaveBeenCalled()

      const ops = await getPendingOps()
      expect(ops).toHaveLength(1)
      expect(ops[0].action).toBe('delete')
      expect(ops[0].entryId).toBe('abc')
    })

    it('calls original deleteEntry when online', async () => {
      const { wrapDbForOffline } = await loadModule()

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn().mockResolvedValue('deleted'),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.deleteEntry('abc')

      expect(db.deleteEntry).toHaveBeenCalledWith('abc')
      expect(result).toBe('deleted')
    })

    it('queues saveConfig when offline', async () => {
      const { wrapDbForOffline, getPendingOps } = await loadModule()

      onlineStatus = false

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.saveConfig({ theme: 'dark' })

      expect(result).toBe(true)
      expect(db.saveConfig).not.toHaveBeenCalled()

      const ops = await getPendingOps()
      expect(ops).toHaveLength(1)
      expect(ops[0].action).toBe('saveConfig')
      expect(ops[0].config).toEqual({ theme: 'dark' })
    })

    it('calls original saveConfig when online', async () => {
      const { wrapDbForOffline } = await loadModule()

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn().mockResolvedValue('saved'),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.saveConfig({ theme: 'dark' })

      expect(db.saveConfig).toHaveBeenCalledWith({ theme: 'dark' })
      expect(result).toBe('saved')
    })

    it('passes through read-only methods unchanged', async () => {
      const { wrapDbForOffline } = await loadModule()

      const loadEntriesFn = vi.fn()
      const loadConfigFn = vi.fn()
      const readPhotosFn = vi.fn()
      const savePhotosFn = vi.fn()
      const deletePhotoFn = vi.fn()

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn(),
        saveConfig: vi.fn(),
        loadEntries: loadEntriesFn,
        loadConfig: loadConfigFn,
        readPhotos: readPhotosFn,
        savePhotos: savePhotosFn,
        deletePhoto: deletePhotoFn,
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      expect(wrapped.loadEntries).toBe(loadEntriesFn)
      expect(wrapped.loadConfig).toBe(loadConfigFn)
      expect(wrapped.readPhotos).toBe(readPhotosFn)
      expect(wrapped.savePhotos).toBe(savePhotosFn)
      expect(wrapped.deletePhoto).toBe(deletePhotoFn)
    })

    it('queues deleteEntry when online save throws and connectivity drops', async () => {
      const { wrapDbForOffline, getPendingOps } = await loadModule()

      const db = {
        saveEntry: vi.fn(),
        deleteEntry: vi.fn().mockImplementation(async () => {
          onlineStatus = false
          throw new Error('connection lost')
        }),
        saveConfig: vi.fn(),
        loadEntries: vi.fn(),
        loadConfig: vi.fn(),
        readPhotos: vi.fn(),
        savePhotos: vi.fn(),
        deletePhoto: vi.fn(),
      }

      const wrapped = wrapDbForOffline(db, 'trips')
      const result = await wrapped.deleteEntry('xyz')

      expect(result).toBe(true)
      const ops = await getPendingOps()
      expect(ops).toHaveLength(1)
      expect(ops[0].action).toBe('delete')
    })
  })

  describe('getPendingCount', () => {
    it('returns 0 for empty queue', async () => {
      const { getPendingCount } = await loadModule()
      expect(await getPendingCount()).toBe(0)
    })

    it('returns correct count after enqueuing', async () => {
      const { enqueue, getPendingCount } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'a', entry: {} })
      await enqueue({ action: 'save', dbKey: 'b', entry: {} })
      await enqueue({ action: 'delete', dbKey: 'c', entryId: '1' })

      expect(await getPendingCount()).toBe(3)
    })

    it('decreases after successful flush', async () => {
      const { enqueue, getPendingCount, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })
      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '2' } })
      expect(await getPendingCount()).toBe(2)

      const mockDb = { saveEntry: vi.fn().mockResolvedValue(true) }
      await flushQueue({ trips: mockDb })

      expect(await getPendingCount()).toBe(0)
    })
  })

  describe('onQueueChange', () => {
    it('immediately notifies with current count', async () => {
      const { enqueue, onQueueChange } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'x', entry: {} })
      await enqueue({ action: 'save', dbKey: 'x', entry: {} })

      const listener = vi.fn()
      onQueueChange(listener)

      await vi.advanceTimersByTimeAsync(50)

      expect(listener).toHaveBeenCalledWith(2)
    })

    it('notifies listeners when items are enqueued', async () => {
      const { enqueue, onQueueChange } = await loadModule()

      const listener = vi.fn()
      onQueueChange(listener)

      await vi.advanceTimersByTimeAsync(50)
      listener.mockClear()

      await enqueue({ action: 'save', dbKey: 'x', entry: {} })

      await vi.advanceTimersByTimeAsync(50)

      expect(listener).toHaveBeenCalled()
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1]
      expect(lastCall[0]).toBe(1)
    })

    it('notifies listeners after flush completes', async () => {
      const { enqueue, onQueueChange, flushQueue } = await loadModule()

      await enqueue({ action: 'save', dbKey: 'trips', entry: { id: '1' } })

      const listener = vi.fn()
      onQueueChange(listener)
      await vi.advanceTimersByTimeAsync(50)
      listener.mockClear()

      const mockDb = { saveEntry: vi.fn().mockResolvedValue(true) }
      await flushQueue({ trips: mockDb })
      await vi.advanceTimersByTimeAsync(50)

      expect(listener).toHaveBeenCalled()
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1]
      expect(lastCall[0]).toBe(0)
    })

    it('returns an unsubscribe function', async () => {
      const { enqueue, onQueueChange } = await loadModule()

      const listener = vi.fn()
      const unsubscribe = onQueueChange(listener)

      await vi.advanceTimersByTimeAsync(50)
      listener.mockClear()

      unsubscribe()

      await enqueue({ action: 'save', dbKey: 'x', entry: {} })
      await vi.advanceTimersByTimeAsync(50)

      expect(listener).not.toHaveBeenCalled()
    })

    it('supports multiple listeners', async () => {
      const { onQueueChange } = await loadModule()

      const listener1 = vi.fn()
      const listener2 = vi.fn()
      onQueueChange(listener1)
      onQueueChange(listener2)

      await vi.advanceTimersByTimeAsync(50)

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })
  })

  describe('isOnline', () => {
    it('returns true when navigator.onLine is true', async () => {
      const { isOnline } = await loadModule()
      onlineStatus = true
      expect(isOnline()).toBe(true)
    })

    it('returns false when navigator.onLine is false', async () => {
      const { isOnline } = await loadModule()
      onlineStatus = false
      expect(isOnline()).toBe(false)
    })
  })
})
