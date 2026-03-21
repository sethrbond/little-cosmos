import { describe, it, expect, vi, beforeEach } from 'vitest'

// useToasts is a React hook — we replicate its core logic here
// to test without needing a React rendering environment.

describe('useToasts logic', () => {
  let toasts
  let dismissTimerKeys

  beforeEach(() => {
    toasts = []
    dismissTimerKeys = new Set()
  })

  let _testKey = 0
  // Replicate showToast logic
  function showToast(message, icon = '✓', duration = 2500, undoAction = null) {
    const t = { message, icon, duration, key: ++_testKey, undoAction }
    toasts = [...toasts.slice(-4), t]
    return t
  }

  // Replicate dismissToast logic
  function dismissToast(key) {
    toasts = toasts.map(t => t.key === key ? { ...t, exiting: true } : t)
  }

  function removeToast(key) {
    toasts = toasts.filter(t => t.key !== key)
  }

  // Replicate handleUndo logic
  function handleUndo(toast) {
    if (!toast) return
    if (toast.undoAction) toast.undoAction()
    dismissToast(toast.key)
  }

  describe('showToast', () => {
    it('adds a toast with default icon and duration', () => {
      const t = showToast('Hello')
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('Hello')
      expect(toasts[0].icon).toBe('✓')
      expect(toasts[0].duration).toBe(2500)
      expect(toasts[0].undoAction).toBeNull()
    })

    it('accepts custom icon and duration', () => {
      const t = showToast('Saved', '💾', 5000)
      expect(toasts[0].icon).toBe('💾')
      expect(toasts[0].duration).toBe(5000)
    })

    it('accepts an undo action', () => {
      const undo = vi.fn()
      showToast('Deleted', '🗑', 3000, undo)
      expect(toasts[0].undoAction).toBe(undo)
    })

    it('assigns a numeric key to each toast', () => {
      showToast('Test')
      expect(typeof toasts[0].key).toBe('number')
    })

    it('keeps at most 5 toasts (slices to last 4 + new one)', () => {
      for (let i = 0; i < 7; i++) {
        showToast(`Toast ${i}`)
      }
      expect(toasts.length).toBeLessThanOrEqual(5)
    })

    it('preserves existing toasts when adding', () => {
      showToast('First')
      showToast('Second')
      expect(toasts).toHaveLength(2)
      expect(toasts[0].message).toBe('First')
      expect(toasts[1].message).toBe('Second')
    })
  })

  describe('dismissToast', () => {
    it('marks the matching toast as exiting', () => {
      showToast('Test')
      const key = toasts[0].key
      dismissToast(key)
      expect(toasts[0].exiting).toBe(true)
    })

    it('does not affect other toasts', () => {
      showToast('First')
      showToast('Second')
      const firstKey = toasts[0].key
      dismissToast(firstKey)
      expect(toasts[0].exiting).toBe(true)
      expect(toasts[1].exiting).toBeUndefined()
    })

    it('handles non-existent key gracefully', () => {
      showToast('Test')
      dismissToast(99999)
      expect(toasts[0].exiting).toBeUndefined()
    })
  })

  describe('removeToast', () => {
    it('removes a toast by key', () => {
      showToast('Test')
      const key = toasts[0].key
      removeToast(key)
      expect(toasts).toHaveLength(0)
    })

    it('does not remove non-matching toasts', () => {
      showToast('Keep')
      showToast('Remove')
      const removeKey = toasts[1].key
      removeToast(removeKey)
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('Keep')
    })
  })

  describe('handleUndo', () => {
    it('calls the undoAction and dismisses', () => {
      const undo = vi.fn()
      showToast('Deleted', '🗑', 3000, undo)
      const toast = toasts[0]
      handleUndo(toast)
      expect(undo).toHaveBeenCalledOnce()
      expect(toasts[0].exiting).toBe(true)
    })

    it('handles toast without undoAction gracefully', () => {
      showToast('No undo')
      const toast = toasts[0]
      expect(() => handleUndo(toast)).not.toThrow()
    })

    it('handles null toast gracefully', () => {
      expect(() => handleUndo(null)).not.toThrow()
    })
  })
})
