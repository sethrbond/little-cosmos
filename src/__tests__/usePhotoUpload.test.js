import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
//  Set up global DOM stubs — Node has no document
// ---------------------------------------------------------------------------

let createdInput, mockBody

function resetDomMocks() {
  createdInput = {
    type: '', accept: '', multiple: false, style: {},
    files: [], value: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    click: vi.fn(),
  }
  mockBody = {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  }
}
resetDomMocks()

globalThis.document = {
  createElement: vi.fn(() => createdInput),
  body: mockBody,
}

// ---------------------------------------------------------------------------
//  Mock React — stateful mock that resets per test
// ---------------------------------------------------------------------------

let effectCallbacks = []
let refStore = {}

vi.mock('react', () => {
  return {
    useState: (init) => [init, vi.fn()],
    useRef: (init) => {
      // Use a stable key based on the init value to identify refs
      const key = init instanceof Promise ? '_lock'
        : init === null ? `_null_${Object.keys(refStore).filter(k => k.startsWith('_null')).length}`
        : `_other_${Object.keys(refStore).filter(k => k.startsWith('_other')).length}`
      if (!refStore[key]) refStore[key] = { current: init }
      return refStore[key]
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => { effectCallbacks.push(fn) },
  }
})

vi.mock('../imageUtils.js', () => ({
  compressImage: vi.fn(async (file) => file),
}))

import { usePhotoUpload } from '../usePhotoUpload.js'
import { compressImage } from '../imageUtils.js'

// ---------------------------------------------------------------------------
//  Test infrastructure
// ---------------------------------------------------------------------------

beforeEach(() => {
  effectCallbacks = []
  refStore = {}
  resetDomMocks()
  globalThis.document.createElement = vi.fn(() => createdInput)
  globalThis.document.body = mockBody
  vi.clearAllMocks()
})

function createMockDb(overrides = {}) {
  return {
    uploadPhoto: overrides.uploadPhoto || vi.fn(async () => 'https://storage.example.com/photo.jpg'),
    readPhotos: overrides.readPhotos || vi.fn(async () => ({ ok: true, photos: [] })),
    savePhotos: overrides.savePhotos || vi.fn(async () => ({ ok: true })),
  }
}

function createMockFile(name = 'photo.jpg', size = 500_000) {
  return { name, size, type: 'image/jpeg' }
}

/**
 * Run the useEffect that sets up the DOM file input (the first one captured).
 * Returns the cleanup function.
 */
function runSetupEffect() {
  if (effectCallbacks.length > 0) return effectCallbacks[0]()
}

function getChangeHandler() {
  const calls = createdInput.addEventListener.mock.calls
  const changeCall = calls.find(c => c[0] === 'change')
  return changeCall ? changeCall[1] : null
}

/**
 * Fully wire up the hook: create it, run its setup effect, then set
 * the refs that the change handler reads (db, dispatch, entryId).
 */
function wireUpPipeline(db, dispatch, showToast, entryId = 'entry-1') {
  const result = usePhotoUpload({ db, dispatch, showToast })
  runSetupEffect()

  // The hook creates 5 refs in this order:
  //   uploadLockRef (Promise.resolve())
  //   fileInputRef  (null)       — _null_0
  //   photoEntryIdRef (null)     — _null_1
  //   dbRef (db)                 — _other_0
  //   dispatchRef (dispatch)     — _other_1
  // Set the entryId so the handler proceeds:
  const nullRefs = Object.entries(refStore).filter(([k]) => k.startsWith('_null'))
  if (nullRefs.length >= 2) nullRefs[1][1].current = entryId  // photoEntryIdRef
  // dbRef and dispatchRef are already set via the hook init, but we update them
  // to make sure the handler sees the exact mock we want:
  const otherRefs = Object.entries(refStore).filter(([k]) => k.startsWith('_other'))
  if (otherRefs.length >= 1) otherRefs[0][1].current = db
  if (otherRefs.length >= 2) otherRefs[1][1].current = dispatch

  return result
}

// ---------------------------------------------------------------------------
//  Tests: handlePhotos — offline blocking
// ---------------------------------------------------------------------------

describe('usePhotoUpload — handlePhotos', () => {
  it('blocks upload when offline and shows toast', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const showToast = vi.fn()
    const { handlePhotos } = usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast })
    handlePhotos('entry-1')
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('offline'), expect.any(String), expect.any(Number)
    )
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('does not trigger upload when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const db = createMockDb()
    const { handlePhotos } = usePhotoUpload({ db, dispatch: vi.fn(), showToast: vi.fn() })
    handlePhotos('entry-1')
    expect(db.uploadPhoto).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('does not show offline toast when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const showToast = vi.fn()
    const { handlePhotos } = usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast })
    handlePhotos('entry-1')
    expect(showToast).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
//  Tests: return shape
// ---------------------------------------------------------------------------

describe('usePhotoUpload — return shape', () => {
  it('returns all expected keys', () => {
    const result = usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    expect(result).toHaveProperty('uploading')
    expect(result).toHaveProperty('setUploading')
    expect(result).toHaveProperty('uploadProgress')
    expect(result).toHaveProperty('setUploadProgress')
    expect(result).toHaveProperty('handlePhotos')
    expect(result).toHaveProperty('uploadLockRef')
  })

  it('uploading starts as false', () => {
    const result = usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    expect(result.uploading).toBe(false)
  })

  it('uploadProgress starts at {done:0, total:0}', () => {
    const result = usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    expect(result.uploadProgress).toEqual({ done: 0, total: 0 })
  })

  it('uploadLockRef is initialized as resolved promise', () => {
    const result = usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    expect(result.uploadLockRef).toHaveProperty('current')
    expect(result.uploadLockRef.current).toBeInstanceOf(Promise)
  })
})

// ---------------------------------------------------------------------------
//  Tests: DOM setup (file input creation)
// ---------------------------------------------------------------------------

describe('usePhotoUpload — DOM setup', () => {
  it('creates a hidden file input in the DOM', () => {
    usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    runSetupEffect()

    expect(globalThis.document.createElement).toHaveBeenCalledWith('input')
    expect(mockBody.appendChild).toHaveBeenCalled()
    expect(createdInput.type).toBe('file')
    expect(createdInput.accept).toBe('image/*')
    expect(createdInput.multiple).toBe(true)
  })

  it('registers a change event listener', () => {
    usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    runSetupEffect()
    expect(createdInput.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('cleanup removes listener and element from DOM', () => {
    usePhotoUpload({ db: createMockDb(), dispatch: vi.fn(), showToast: vi.fn() })
    const cleanup = runSetupEffect()
    if (cleanup) cleanup()
    expect(createdInput.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mockBody.removeChild).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
//  Tests: upload pipeline logic
// ---------------------------------------------------------------------------

describe('usePhotoUpload — upload pipeline', () => {
  it('skips upload if no files selected', async () => {
    const db = createMockDb()
    wireUpPipeline(db, vi.fn(), vi.fn())
    createdInput.files = []
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 20))
    expect(db.uploadPhoto).not.toHaveBeenCalled()
  })

  it('calls compressImage on each file', async () => {
    const db = createMockDb()
    wireUpPipeline(db, vi.fn(), vi.fn())

    const file1 = createMockFile('a.jpg')
    const file2 = createMockFile('b.jpg')
    createdInput.files = [file1, file2]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(compressImage).toHaveBeenCalledWith(file1)
    expect(compressImage).toHaveBeenCalledWith(file2)
  })

  it('uploads and merges with existing photos', async () => {
    const db = createMockDb({
      uploadPhoto: vi.fn(async () => 'https://s.example.com/new.jpg'),
      readPhotos: vi.fn(async () => ({ ok: true, photos: ['https://s.example.com/old.jpg'] })),
      savePhotos: vi.fn(async () => ({ ok: true })),
    })
    wireUpPipeline(db, vi.fn(), vi.fn())
    createdInput.files = [createMockFile()]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(db.uploadPhoto).toHaveBeenCalledTimes(1)
    expect(db.readPhotos).toHaveBeenCalledWith('entry-1')
    expect(db.savePhotos).toHaveBeenCalledWith('entry-1', [
      'https://s.example.com/old.jpg',
      'https://s.example.com/new.jpg',
    ])
  })

  it('dispatches ADD_PHOTOS after successful save', async () => {
    const db = createMockDb()
    const dispatch = vi.fn()
    wireUpPipeline(db, dispatch, vi.fn())
    createdInput.files = [createMockFile()]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'ADD_PHOTOS',
      id: 'entry-1',
      urls: ['https://storage.example.com/photo.jpg'],
    })
  })

  it('shows success toast after save', async () => {
    const db = createMockDb()
    const showToast = vi.fn()
    wireUpPipeline(db, vi.fn(), showToast)
    createdInput.files = [createMockFile()]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('photo'), expect.any(String), expect.any(Number)
    )
  })

  it('shows error toast when save fails', async () => {
    const db = createMockDb({
      savePhotos: vi.fn(async () => ({ ok: false, error: 'disk full' })),
    })
    const showToast = vi.fn()
    wireUpPipeline(db, vi.fn(), showToast)
    createdInput.files = [createMockFile()]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('failed'), expect.any(String), expect.any(Number)
    )
  })

  it('skips failed uploads and saves successful ones', async () => {
    let callCount = 0
    const db = createMockDb({
      uploadPhoto: vi.fn(async () => {
        callCount++
        if (callCount === 1) throw new Error('upload failed')
        return 'https://s.example.com/ok.jpg'
      }),
      readPhotos: vi.fn(async () => ({ ok: true, photos: [] })),
      savePhotos: vi.fn(async () => ({ ok: true })),
    })
    wireUpPipeline(db, vi.fn(), vi.fn())
    createdInput.files = [createMockFile('a.jpg'), createMockFile('b.jpg')]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(db.savePhotos).toHaveBeenCalledWith('entry-1', ['https://s.example.com/ok.jpg'])
  })

  it('does not call savePhotos if all uploads fail', async () => {
    const db = createMockDb({
      uploadPhoto: vi.fn(async () => { throw new Error('all fail') }),
    })
    wireUpPipeline(db, vi.fn(), vi.fn())
    createdInput.files = [createMockFile()]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(db.readPhotos).not.toHaveBeenCalled()
    expect(db.savePhotos).not.toHaveBeenCalled()
  })

  it('resets input value after upload completes', async () => {
    const db = createMockDb()
    wireUpPipeline(db, vi.fn(), vi.fn())
    createdInput.value = 'some-file-path'
    createdInput.files = [createMockFile()]
    getChangeHandler()()
    await new Promise(r => setTimeout(r, 50))

    expect(createdInput.value).toBe('')
  })
})

// ---------------------------------------------------------------------------
//  Tests: compressImage integration
// ---------------------------------------------------------------------------

describe('usePhotoUpload — compression mock', () => {
  it('compressImage mock is correctly wired', async () => {
    const file = createMockFile('test.jpg', 300_000)
    const result = await compressImage(file)
    expect(result).toBe(file)
    expect(compressImage).toHaveBeenCalledWith(file)
  })
})
