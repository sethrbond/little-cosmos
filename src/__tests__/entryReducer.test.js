import { describe, it, expect, vi, beforeEach } from 'vitest'

// The reducer lives inside OurWorld.jsx as a module-private function.
// We replicate it here for isolated testing of the reducer logic.
function reducer(st, a) {
  let next = st
  const _saveEntry = a.db?.saveEntry
  const _deleteEntry = a.db?.deleteEntry
  const _deletePhoto = a.db?.deletePhoto
  const _savePhotos = a.db?.savePhotos
  const pushUndo = (inverse) => {
    if (!a._skipSave && !a._skipUndo) {
      next = { ...next, undoStack: [...(next.undoStack || []).slice(-29), inverse], redoStack: [] }
    }
  }
  switch (a.type) {
    case "LOAD": return { ...st, entries: a.entries, undoStack: st.undoStack || [], redoStack: st.redoStack || [] }
    case "UNDO": {
      const stack = [...(st.undoStack || [])]
      if (stack.length === 0) return st
      const action = stack.pop()
      if (action.type === "ADD") {
        next = { ...st, entries: [...st.entries, action.entry], undoStack: stack, redoStack: [...(st.redoStack || []), { type: "DELETE", id: action.entry.id }] }
        if (_saveEntry) _saveEntry(action.entry).catch(() => {})
      } else if (action.type === "DELETE") {
        const doomed = st.entries.find(e => e.id === action.id)
        next = { ...st, entries: st.entries.filter(e => e.id !== action.id), undoStack: stack, redoStack: [...(st.redoStack || []), { type: "ADD", entry: doomed }] }
        if (_deleteEntry) _deleteEntry(action.id)
      } else if (action.type === "UPDATE") {
        const prev = st.entries.find(e => e.id === action.id)
        next = { ...st, entries: st.entries.map(e => e.id === action.id ? { ...e, ...action.data } : e), undoStack: stack, redoStack: [...(st.redoStack || []), { type: "UPDATE", id: action.id, data: prev ? { ...prev } : {} }] }
        const updated = next.entries.find(e => e.id === action.id)
        if (_saveEntry && updated) _saveEntry(updated).catch(() => {})
      }
      return next
    }
    case "REDO": {
      const stack = [...(st.redoStack || [])]
      if (stack.length === 0) return st
      const action = stack.pop()
      if (action.type === "ADD") {
        next = { ...st, entries: [...st.entries, action.entry], redoStack: stack, undoStack: [...(st.undoStack || []), { type: "DELETE", id: action.entry.id }] }
        if (_saveEntry) _saveEntry(action.entry).catch(() => {})
      } else if (action.type === "DELETE") {
        const doomed = st.entries.find(e => e.id === action.id)
        next = { ...st, entries: st.entries.filter(e => e.id !== action.id), redoStack: stack, undoStack: [...(st.undoStack || []), { type: "ADD", entry: doomed }] }
        if (_deleteEntry) _deleteEntry(action.id)
      } else if (action.type === "UPDATE") {
        const prev = st.entries.find(e => e.id === action.id)
        next = { ...st, entries: st.entries.map(e => e.id === action.id ? { ...e, ...action.data } : e), redoStack: stack, undoStack: [...(st.undoStack || []), { type: "UPDATE", id: action.id, data: prev ? { ...prev } : {} }] }
        const updated = next.entries.find(e => e.id === action.id)
        if (_saveEntry && updated) _saveEntry(updated).catch(() => {})
      }
      return next
    }
    case "ADD":
      next = { ...st, entries: [...st.entries, a.entry] }
      pushUndo({ type: "DELETE", id: a.entry.id })
      if (_saveEntry && !a._skipSave) _saveEntry(a.entry).catch(() => {})
      break
    case "UPDATE":
      { const prev = st.entries.find(e => e.id === a.id)
        if (prev) pushUndo({ type: "UPDATE", id: a.id, data: { ...prev } })
      }
      next = { ...next, entries: (next.entries || st.entries).map(e => e.id === a.id ? { ...e, ...a.data } : e) }
      if (_saveEntry && !a._skipSave) { const updated = next.entries.find(e => e.id === a.id); if (updated) _saveEntry(updated).catch(() => {}) }
      break
    case "DELETE":
      { const doomed = st.entries.find(e => e.id === a.id)
        if (doomed) pushUndo({ type: "ADD", entry: { ...doomed } })
      }
      next = { ...next, entries: (next.entries || st.entries).filter(e => e.id !== a.id) }
      if (_deleteEntry && !a._skipSave) _deleteEntry(a.id)
      break
    default: return st
  }
  return next
}

describe('entryReducer', () => {
  const entry1 = { id: '1', city: 'Paris', lat: 48.8, lng: 2.3 }
  const entry2 = { id: '2', city: 'Tokyo', lat: 35.6, lng: 139.7 }

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
      const saveEntry = vi.fn().mockResolvedValue({})
      const state = { entries: [], undoStack: [], redoStack: [] }
      reducer(state, { type: 'ADD', entry: entry1, db: { saveEntry } })
      expect(saveEntry).toHaveBeenCalledWith(entry1)
    })

    it('skips saveEntry when _skipSave is true', () => {
      const saveEntry = vi.fn().mockResolvedValue({})
      const state = { entries: [], undoStack: [], redoStack: [] }
      reducer(state, { type: 'ADD', entry: entry1, db: { saveEntry }, _skipSave: true })
      expect(saveEntry).not.toHaveBeenCalled()
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
      const deleteEntry = vi.fn()
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      reducer(state, { type: 'DELETE', id: '1', db: { deleteEntry } })
      expect(deleteEntry).toHaveBeenCalledWith('1')
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
  })

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const state = { entries: [entry1], undoStack: [], redoStack: [] }
      const result = reducer(state, { type: 'UNKNOWN' })
      expect(result).toBe(state)
    })
  })
})
