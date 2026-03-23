import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reducer, getFirstBadges } from '../entryReducer.js'

describe('entryReducer', () => {
  const entry1 = { id: '1', city: 'Paris', lat: 48.8, lng: 2.3 }
  const entry2 = { id: '2', city: 'Tokyo', lat: 35.6, lng: 139.7 }

  let db
  beforeEach(() => {
    db = {
      saveEntry: vi.fn().mockResolvedValue({}),
      deleteEntry: vi.fn().mockResolvedValue({}),
      deletePhoto: vi.fn().mockResolvedValue({}),
      savePhotos: vi.fn().mockResolvedValue({}),
    }
  })

  describe('LOAD', () => {
    it('sets entries from action', () => {
      const state = { entries: [] }
      const result = reducer(state, { type: 'LOAD', entries: [entry1, entry2] })
      expect(result.entries).toEqual([entry1, entry2])
    })

    it('initializes undo/redo stacks', () => {
      const state = { entries: [] }
      const result = reducer(state, { type: 'LOAD', entries: [entry1] })
      expect(result.undoStack).toEqual([])
      expect(result.redoStack).toEqual([])
    })

    it('preserves existing undo stack', () => {
      const state = { entries: [], undoStack: [{ type: 'DELETE', id: '1' }], redoStack: [] }
      const result = reducer(state, { type: 'LOAD', entries: [entry1] })
      expect(result.undoStack).toEqual([{ type: 'DELETE', id: '1' }])
    })
  })

  describe('ADD', () => {
    it('adds entry to state', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'ADD', entry: entry2 })
      expect(result.entries).toHaveLength(2)
      expect(result.entries[1]).toEqual(entry2)
    })

    it('pushes inverse DELETE to undo stack', () => {
      const state = { entries: [], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'ADD', entry: entry1 })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0]).toEqual({ type: 'DELETE', id: '1' })
    })

    it('clears redo stack on new action', () => {
      const state = { entries: [], undoStack: [], redoStack: [{ type: 'ADD', entry: entry2 }] }
      const result = reducer(state, { type: 'ADD', entry: entry1 })
      expect(result.redoStack).toEqual([])
    })

    it('calls saveEntry from db', () => {
      const state = { entries: [], undoStack: [], redoStack: [] }
      reducer(state, { type: 'ADD', entry: entry1, db })
      expect(db.saveEntry).toHaveBeenCalledWith(entry1)
    })

    it('skips saveEntry when _skipSave is true', () => {
      const state = { entries: [], undoStack: [], redoStack: [] }
      reducer(state, { type: 'ADD', entry: entry1, db, _skipSave: true })
      expect(db.saveEntry).not.toHaveBeenCalled()
    })
  })

  describe('DELETE', () => {
    it('removes entry from state', () => {
      const state = { entries: [entry1, entry2], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'DELETE', id: '1' })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].id).toBe('2')
    })

    it('pushes inverse ADD to undo stack with full entry', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'DELETE', id: '1' })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0].type).toBe('ADD')
      expect(result.undoStack[0].entry).toEqual(entry1)
    })

    it('calls deleteEntry from db', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      reducer(state, { type: 'DELETE', id: '1', db })
      expect(db.deleteEntry).toHaveBeenCalledWith('1')
    })

    it('calls deletePhoto for each photo when entry has photos', () => {
      const entryWithPhotos = { ...entry1, photos: ['url1.jpg', 'url2.jpg'] }
      const state = { entries: [entryWithPhotos], undoStack: [], redoStack: [] }
      reducer(state, { type: 'DELETE', id: '1', db })
      expect(db.deletePhoto).toHaveBeenCalledWith('url1.jpg')
      expect(db.deletePhoto).toHaveBeenCalledWith('url2.jpg')
      expect(db.deletePhoto).toHaveBeenCalledTimes(2)
    })

    it('does not call deletePhoto when entry has no photos', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      reducer(state, { type: 'DELETE', id: '1', db })
      expect(db.deletePhoto).not.toHaveBeenCalled()
    })
  })

  describe('UNDO', () => {
    it('returns same state when undo stack is empty', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'UNDO' })
      expect(result).toBe(state)
    })

    it('undoes a DELETE by re-adding the entry', () => {
      const state = {
        entries: [],
        undoStack: [{ type: 'ADD', entry: entry1 }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO' })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toEqual(entry1)
      expect(result.undoStack).toHaveLength(0)
    })

    it('pushes redo action when undoing', () => {
      const state = {
        entries: [],
        undoStack: [{ type: 'ADD', entry: entry1 }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO' })
      expect(result.redoStack).toHaveLength(1)
      expect(result.redoStack[0]).toEqual({ type: 'DELETE', id: '1' })
    })

    it('undoes an ADD by removing the entry', () => {
      const state = {
        entries: [entry1, entry2],
        undoStack: [{ type: 'DELETE', id: '2' }],
        redoStack: [],
      }
      const result = reducer(state, { type: 'UNDO' })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].id).toBe('1')
    })
  })

  describe('REDO', () => {
    it('returns same state when redo stack is empty', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'REDO' })
      expect(result).toBe(state)
    })

    it('redoes a DELETE after undo', () => {
      const state = {
        entries: [entry1],
        undoStack: [],
        redoStack: [{ type: 'DELETE', id: '1' }],
      }
      const result = reducer(state, { type: 'REDO' })
      expect(result.entries).toHaveLength(0)
    })

    it('redoes an ADD after undo', () => {
      const state = {
        entries: [],
        undoStack: [],
        redoStack: [{ type: 'ADD', entry: entry1 }],
      }
      const result = reducer(state, { type: 'REDO' })
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toEqual(entry1)
    })

    it('pushes inverse to undo stack when redoing', () => {
      const state = {
        entries: [],
        undoStack: [],
        redoStack: [{ type: 'ADD', entry: entry1 }],
      }
      const result = reducer(state, { type: 'REDO' })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0]).toEqual({ type: 'DELETE', id: '1' })
    })

    it('full undo/redo cycle preserves data', () => {
      let state = { entries: [], undoStack: [], redoStack: [] }

      // ADD
      state = reducer(state, { type: 'ADD', entry: entry1 })
      expect(state.entries).toHaveLength(1)

      // DELETE
      state = reducer(state, { type: 'DELETE', id: '1' })
      expect(state.entries).toHaveLength(0)

      // UNDO (restores via inverse ADD)
      state = reducer(state, { type: 'UNDO' })
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0].id).toBe('1')

      // REDO (re-deletes)
      state = reducer(state, { type: 'REDO' })
      expect(state.entries).toHaveLength(0)
    })
  })

  describe('UPDATE', () => {
    it('updates entry fields', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'UPDATE', id: '1', data: { city: 'Lyon' } })
      expect(result.entries[0].city).toBe('Lyon')
      expect(result.entries[0].lat).toBe(48.8)
    })

    it('pushes inverse UPDATE to undo stack with previous data', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'UPDATE', id: '1', data: { city: 'Lyon' } })
      expect(result.undoStack).toHaveLength(1)
      expect(result.undoStack[0].type).toBe('UPDATE')
      expect(result.undoStack[0].data.city).toBe('Paris')
    })

    it('calls saveEntry from db with the updated entry', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      reducer(state, { type: 'UPDATE', id: '1', data: { city: 'Lyon' }, db })
      expect(db.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ id: '1', city: 'Lyon' }))
    })
  })

  describe('ADD_PHOTOS', () => {
    it('appends photos to existing entry photos array', () => {
      const entryWithPhotos = { ...entry1, photos: ['existing.jpg'] }
      const state = { entries: [entryWithPhotos, entry2], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'ADD_PHOTOS', id: '1', urls: ['new1.jpg', 'new2.jpg'] })
      expect(result.entries[0].photos).toEqual(['existing.jpg', 'new1.jpg', 'new2.jpg'])
    })

    it('creates photos array when entry had none', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'ADD_PHOTOS', id: '1', urls: ['photo.jpg'] })
      expect(result.entries[0].photos).toEqual(['photo.jpg'])
    })

    it('does not modify other entries', () => {
      const state = { entries: [entry1, entry2], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'ADD_PHOTOS', id: '1', urls: ['photo.jpg'] })
      expect(result.entries[1]).toEqual(entry2)
    })
  })

  describe('REMOVE_PHOTO', () => {
    it('removes photo at the given index', () => {
      const entryWithPhotos = { ...entry1, photos: ['a.jpg', 'b.jpg', 'c.jpg'] }
      const state = { entries: [entryWithPhotos], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'REMOVE_PHOTO', id: '1', photoIndex: 1, db })
      expect(result.entries[0].photos).toEqual(['a.jpg', 'c.jpg'])
    })

    it('calls db.deletePhoto with the removed photo URL', () => {
      const entryWithPhotos = { ...entry1, photos: ['a.jpg', 'b.jpg'] }
      const state = { entries: [entryWithPhotos], undoStack: [], redoStack: [] }
      reducer(state, { type: 'REMOVE_PHOTO', id: '1', photoIndex: 0, db })
      expect(db.deletePhoto).toHaveBeenCalledWith('a.jpg')
    })

    it('calls db.savePhotos with updated photos array', () => {
      const entryWithPhotos = { ...entry1, photos: ['a.jpg', 'b.jpg', 'c.jpg'] }
      const state = { entries: [entryWithPhotos], undoStack: [], redoStack: [] }
      reducer(state, { type: 'REMOVE_PHOTO', id: '1', photoIndex: 1, db })
      expect(db.savePhotos).toHaveBeenCalledWith('1', ['a.jpg', 'c.jpg'])
    })
  })

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'UNKNOWN' })
      expect(result).toBe(state)
    })
  })
})

describe('getFirstBadges', () => {
  it('returns empty object for empty entries', () => {
    expect(getFirstBadges([])).toEqual({})
  })

  it('returns "First time together" badge for earliest "both" entry', () => {
    const entries = [
      { id: '2', who: 'both', dateStart: '2024-06-01', country: 'USA' },
      { id: '1', who: 'both', dateStart: '2024-01-15', country: 'USA' },
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

  it('returns "First Christmas together" badge for December entry', () => {
    const entries = [
      { id: '1', who: 'both', dateStart: '2024-12-25', country: 'USA' },
    ]
    const badges = getFirstBadges(entries)
    expect(badges['1']).toBe('First Christmas together')
  })

  it('ignores solo entries (who !== "both")', () => {
    const entries = [
      { id: '1', who: 'solo', dateStart: '2024-01-01', country: 'France' },
    ]
    const badges = getFirstBadges(entries)
    expect(badges).toEqual({})
  })

  it('does not override existing badge with "First trip abroad"', () => {
    const entries = [
      { id: '1', who: 'both', dateStart: '2024-01-01', country: 'France' },
    ]
    const badges = getFirstBadges(entries)
    // id '1' gets "First time together" since it's the earliest — "First trip abroad" should not overwrite it
    expect(badges['1']).toBe('First time together')
  })
})
