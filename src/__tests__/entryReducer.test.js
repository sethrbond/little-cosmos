import { describe, it, expect, vi } from 'vitest'
import { reducer, getFirstBadges } from '../entryReducer.js'

// ---- reducer ----

describe('reducer', () => {
  const baseState = () => ({
    entries: [],
    undoStack: [],
    redoStack: [],
  })

  const mockDb = () => ({
    saveEntry: vi.fn(() => Promise.resolve()),
    deleteEntry: vi.fn(() => Promise.resolve()),
    deletePhoto: vi.fn(() => Promise.resolve()),
    savePhotos: vi.fn(() => Promise.resolve()),
  })

  describe('LOAD', () => {
    it('sets entries array', () => {
      const entries = [{ id: '1', city: 'Paris' }, { id: '2', city: 'Rome' }]
      const result = reducer(baseState(), { type: 'LOAD', entries })
      expect(result.entries).toEqual(entries)
    })

    it('preserves existing undoStack', () => {
      const state = { ...baseState(), undoStack: [{ type: 'DELETE', id: '1' }] }
      const result = reducer(state, { type: 'LOAD', entries: [] })
      expect(result.undoStack).toEqual([{ type: 'DELETE', id: '1' }])
    })

    it('initializes undoStack and redoStack if missing', () => {
      const result = reducer({ entries: [] }, { type: 'LOAD', entries: [{ id: '1' }] })
      expect(result.undoStack).toEqual([])
      expect(result.redoStack).toEqual([])
    })
  })

  describe('ADD', () => {
    it('adds entry to entries array', () => {
      const entry = { id: '1', city: 'Tokyo' }
      const result = reducer(baseState(), { type: 'ADD', entry, db: mockDb() })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toEqual(entry)
    })

    it('pushes DELETE inverse onto undoStack', () => {
      const entry = { id: '1', city: 'Tokyo' }
      const result = reducer(baseState(), { type: 'ADD', entry, db: mockDb() })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0]).toEqual({ type: 'DELETE', id: '1' })
    })

    it('clears redoStack on new action', () => {
      const state = { ...baseState(), redoStack: [{ type: 'ADD', entry: { id: 'x' } }] }
      const entry = { id: '1', city: 'Tokyo' }
      const result = reducer(state, { type: 'ADD', entry, db: mockDb() })
      expect(result.redoStack).toEqual([])
    })

    it('calls _saveEntry', () => {
      const db = mockDb()
      const entry = { id: '1', city: 'Tokyo' }
      reducer(baseState(), { type: 'ADD', entry, db })
      expect(db.saveEntry).toHaveBeenCalledWith(entry)
    })

    it('skips save when _skipSave is set', () => {
      const db = mockDb()
      const entry = { id: '1', city: 'Tokyo' }
      reducer(baseState(), { type: 'ADD', entry, db, _skipSave: true })
      expect(db.saveEntry).not.toHaveBeenCalled()
    })
  })

  describe('UPDATE', () => {
    it('updates entry by id', () => {
      const state = { ...baseState(), entries: [{ id: '1', city: 'Paris', note: 'old' }] }
      const result = reducer(state, { type: 'UPDATE', id: '1', data: { note: 'new' }, db: mockDb() })
      expect(result.entries[0].note).toBe('new')
      expect(result.entries[0].city).toBe('Paris')
    })

    it('pushes UPDATE inverse onto undoStack with previous data', () => {
      const state = { ...baseState(), entries: [{ id: '1', city: 'Paris', note: 'old' }] }
      const result = reducer(state, { type: 'UPDATE', id: '1', data: { note: 'new' }, db: mockDb() })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0].type).toBe('UPDATE')
      expect(result.undoStack[0].data.note).toBe('old')
    })

    it('calls _saveEntry with updated entry', () => {
      const db = mockDb()
      const state = { ...baseState(), entries: [{ id: '1', city: 'Paris' }] }
      reducer(state, { type: 'UPDATE', id: '1', data: { note: 'new' }, db })
      expect(db.saveEntry).toHaveBeenCalled()
      expect(db.saveEntry.mock.calls[0][0].note).toBe('new')
    })
  })

  describe('DELETE', () => {
    it('removes entry by id', () => {
      const state = { ...baseState(), entries: [{ id: '1', city: 'Paris' }, { id: '2', city: 'Rome' }] }
      const result = reducer(state, { type: 'DELETE', id: '1', db: mockDb() })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].id).toBe('2')
    })

    it('pushes ADD inverse onto undoStack with deleted entry', () => {
      const entry = { id: '1', city: 'Paris' }
      const state = { ...baseState(), entries: [entry] }
      const result = reducer(state, { type: 'DELETE', id: '1', db: mockDb() })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0].type).toBe('ADD')
      expect(result.undoStack[0].entry.city).toBe('Paris')
    })

    it('calls _deleteEntry', () => {
      const db = mockDb()
      const state = { ...baseState(), entries: [{ id: '1', city: 'Paris' }] }
      reducer(state, { type: 'DELETE', id: '1', db })
      expect(db.deleteEntry).toHaveBeenCalledWith('1')
    })

    it('calls _deletePhoto for each photo on the entry', () => {
      const db = mockDb()
      const state = { ...baseState(), entries: [{ id: '1', photos: ['a.jpg', 'b.jpg'] }] }
      reducer(state, { type: 'DELETE', id: '1', db })
      expect(db.deletePhoto).toHaveBeenCalledTimes(2)
      expect(db.deletePhoto).toHaveBeenCalledWith('a.jpg')
      expect(db.deletePhoto).toHaveBeenCalledWith('b.jpg')
    })
  })

  describe('UNDO', () => {
    it('returns same state when undoStack is empty', () => {
      const state = baseState()
      const result = reducer(state, { type: 'UNDO', db: mockDb() })
      expect(result).toBe(state)
    })

    it('restores deleted entry (undo a DELETE = re-add)', () => {
      const entry = { id: '1', city: 'Paris' }
      const state = {
        entries: [],
        undoStack: [{ type: 'ADD', entry }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO', db: mockDb() })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].city).toBe('Paris')
      expect(result.undoStack).toHaveLength(0)
    })

    it('pushes inverse onto redoStack', () => {
      const entry = { id: '1', city: 'Paris' }
      const state = {
        entries: [],
        undoStack: [{ type: 'ADD', entry }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO', db: mockDb() })
      expect(result.redoStack).toHaveLength(1)
      expect(result.redoStack[0].type).toBe('DELETE')
    })

    it('undo a DELETE inverse removes the entry', () => {
      const state = {
        entries: [{ id: '1', city: 'Paris' }],
        undoStack: [{ type: 'DELETE', id: '1' }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO', db: mockDb() })
      expect(result.entries).toHaveLength(0)
    })

    it('undo an UPDATE restores previous data', () => {
      const state = {
        entries: [{ id: '1', city: 'Paris', note: 'new' }],
        undoStack: [{ type: 'UPDATE', id: '1', data: { city: 'Paris', note: 'old' } }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO', db: mockDb() })
      expect(result.entries[0].note).toBe('old')
    })
  })

  describe('REDO', () => {
    it('returns same state when redoStack is empty', () => {
      const state = baseState()
      const result = reducer(state, { type: 'REDO', db: mockDb() })
      expect(result).toBe(state)
    })

    it('restores state from redoStack (re-add)', () => {
      const entry = { id: '1', city: 'Paris' }
      const state = {
        entries: [],
        undoStack: [],
        redoStack: [{ type: 'ADD', entry }],
      }
      const result = reducer(state, { type: 'REDO', db: mockDb() })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].city).toBe('Paris')
      expect(result.redoStack).toHaveLength(0)
    })

    it('pushes inverse onto undoStack', () => {
      const entry = { id: '1', city: 'Paris' }
      const state = {
        entries: [],
        undoStack: [],
        redoStack: [{ type: 'ADD', entry }],
      }
      const result = reducer(state, { type: 'REDO', db: mockDb() })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0].type).toBe('DELETE')
    })

    it('redo a DELETE removes the entry', () => {
      const state = {
        entries: [{ id: '1', city: 'Paris' }],
        undoStack: [],
        redoStack: [{ type: 'DELETE', id: '1' }],
      }
      const result = reducer(state, { type: 'REDO', db: mockDb() })
      expect(result.entries).toHaveLength(0)
    })

    it('redo an UPDATE applies data', () => {
      const state = {
        entries: [{ id: '1', note: 'old' }],
        undoStack: [],
        redoStack: [{ type: 'UPDATE', id: '1', data: { note: 'new' } }],
      }
      const result = reducer(state, { type: 'REDO', db: mockDb() })
      expect(result.entries[0].note).toBe('new')
    })
  })

  describe('ADD_PHOTOS', () => {
    it('appends photos to entry', () => {
      const state = { ...baseState(), entries: [{ id: '1', photos: ['a.jpg'] }] }
      const result = reducer(state, { type: 'ADD_PHOTOS', id: '1', urls: ['b.jpg', 'c.jpg'] })
      expect(result.entries[0].photos).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
    })

    it('initializes photos array if missing', () => {
      const state = { ...baseState(), entries: [{ id: '1' }] }
      const result = reducer(state, { type: 'ADD_PHOTOS', id: '1', urls: ['a.jpg'] })
      expect(result.entries[0].photos).toEqual(['a.jpg'])
    })

    it('does not affect other entries', () => {
      const state = { ...baseState(), entries: [{ id: '1', photos: ['a.jpg'] }, { id: '2', photos: ['x.jpg'] }] }
      const result = reducer(state, { type: 'ADD_PHOTOS', id: '1', urls: ['b.jpg'] })
      expect(result.entries[1].photos).toEqual(['x.jpg'])
    })
  })

  describe('REMOVE_PHOTO', () => {
    it('removes photo at given index', () => {
      const db = mockDb()
      const state = { ...baseState(), entries: [{ id: '1', photos: ['a.jpg', 'b.jpg', 'c.jpg'] }] }
      const result = reducer(state, { type: 'REMOVE_PHOTO', id: '1', photoIndex: 1, db })
      expect(result.entries[0].photos).toEqual(['a.jpg', 'c.jpg'])
    })

    it('calls _deletePhoto with the removed URL', () => {
      const db = mockDb()
      const state = { ...baseState(), entries: [{ id: '1', photos: ['a.jpg', 'b.jpg'] }] }
      reducer(state, { type: 'REMOVE_PHOTO', id: '1', photoIndex: 0, db })
      expect(db.deletePhoto).toHaveBeenCalledWith('a.jpg')
    })

    it('calls _savePhotos with remaining photos', () => {
      const db = mockDb()
      const state = { ...baseState(), entries: [{ id: '1', photos: ['a.jpg', 'b.jpg'] }] }
      reducer(state, { type: 'REMOVE_PHOTO', id: '1', photoIndex: 0, db })
      expect(db.savePhotos).toHaveBeenCalledWith('1', ['b.jpg'])
    })
  })

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = baseState()
      const result = reducer(state, { type: 'UNKNOWN' })
      expect(result).toBe(state)
    })
  })
})

// ---- getFirstBadges ----

describe('getFirstBadges', () => {
  it('returns empty object for empty entries', () => {
    expect(getFirstBadges([])).toEqual({})
  })

  it('returns empty object when no "both" entries', () => {
    const entries = [{ id: '1', who: 'solo', dateStart: '2024-01-01' }]
    expect(getFirstBadges(entries)).toEqual({})
  })

  it('returns "First time together" for earliest both entry', () => {
    const entries = [
      { id: '2', who: 'both', dateStart: '2024-06-01' },
      { id: '1', who: 'both', dateStart: '2024-01-01' },
    ]
    const badges = getFirstBadges(entries)
    expect(badges['1']).toBe('First time together')
  })

  it('returns "First trip abroad together" for first non-USA country', () => {
    const entries = [
      { id: '1', who: 'both', dateStart: '2024-01-01', country: 'USA' },
      { id: '2', who: 'both', dateStart: '2024-03-01', country: 'France' },
    ]
    const badges = getFirstBadges(entries)
    expect(badges['2']).toBe('First trip abroad together')
  })

  it('returns "First Christmas together" badge', () => {
    const entries = [
      { id: '1', who: 'both', dateStart: '2024-12-25', country: 'USA' },
    ]
    const badges = getFirstBadges(entries)
    expect(badges['1']).toBe('First Christmas together')
  })

  it('does not duplicate Christmas badge if first-together is on Christmas', () => {
    const entries = [
      { id: '1', who: 'both', dateStart: '2024-12-25' },
    ]
    const badges = getFirstBadges(entries)
    // Christmas badge overwrites first-together on same entry
    expect(badges['1']).toBe('First Christmas together')
  })
})
