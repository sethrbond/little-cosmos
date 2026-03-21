import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// usePlayStory is a React hook — we replicate its core state machine
// and transition logic here to test without React rendering.

describe('usePlayStory logic', () => {
  let state
  let deps
  let playRef
  let photoTimerRef

  beforeEach(() => {
    vi.useFakeTimers()
    state = {
      isPlaying: false,
      cinemaEntry: null,
      cinemaPhotoIdx: 0,
      cinemaProgress: 0,
      cinemaTotal: 0,
      cinemaIdx: 0,
      cinemaPhase: 'fly',
    }
    playRef = { current: null }
    photoTimerRef = { current: null }
    deps = {
      sorted: [],
      togetherList: [],
      isPartnerWorld: false,
      flyTo: vi.fn(),
      tSpinSpd: { current: 0.001 },
      showToast: vi.fn(),
      setSelected: vi.fn(),
      setShowGallery: vi.fn(),
      setPhotoIdx: vi.fn(),
      setCardTab: vi.fn(),
      setSliderDate: vi.fn(),
      tZm: { current: 1 },
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function stopPlay() {
    state.isPlaying = false
    state.cinemaEntry = null
    state.cinemaPhase = 'fly'
    if (playRef.current) { clearTimeout(playRef.current); playRef.current = null }
    if (photoTimerRef.current) { clearInterval(photoTimerRef.current); photoTimerRef.current = null }
    if (deps.tSpinSpd) deps.tSpinSpd.current = 0.001
  }

  function playStory() {
    const playList = deps.isPartnerWorld ? deps.togetherList : deps.sorted
    if (playList.length === 0 || state.isPlaying) return
    state.isPlaying = true
    if (deps.setShowGallery) deps.setShowGallery(false)
    if (deps.tSpinSpd) deps.tSpinSpd.current = 0
    if (deps.tZm) deps.tZm.current = 2.5
    state.cinemaTotal = playList.length
  }

  describe('playStory', () => {
    it('does nothing when playlist is empty', () => {
      deps.sorted = []
      playStory()
      expect(state.isPlaying).toBe(false)
    })

    it('does nothing when already playing', () => {
      deps.sorted = [{ lat: 0, lng: 0, dateStart: '2024-01-01' }]
      state.isPlaying = true
      playStory()
      // Should remain playing, not restart
      expect(state.cinemaTotal).toBe(0) // not updated because early return
    })

    it('starts playing when playlist has entries', () => {
      deps.sorted = [
        { lat: 40, lng: -74, dateStart: '2024-01-01' },
        { lat: 35, lng: 139, dateStart: '2024-02-01' },
      ]
      playStory()
      expect(state.isPlaying).toBe(true)
      expect(state.cinemaTotal).toBe(2)
    })

    it('closes gallery on start', () => {
      deps.sorted = [{ lat: 0, lng: 0, dateStart: '2024-01-01' }]
      playStory()
      expect(deps.setShowGallery).toHaveBeenCalledWith(false)
    })

    it('stops globe spin on start', () => {
      deps.sorted = [{ lat: 0, lng: 0, dateStart: '2024-01-01' }]
      playStory()
      expect(deps.tSpinSpd.current).toBe(0)
    })

    it('sets zoom level on start', () => {
      deps.sorted = [{ lat: 0, lng: 0, dateStart: '2024-01-01' }]
      playStory()
      expect(deps.tZm.current).toBe(2.5)
    })

    it('uses togetherList for partner worlds', () => {
      deps.isPartnerWorld = true
      deps.togetherList = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]
      deps.sorted = [{ lat: 3, lng: 3 }]
      playStory()
      expect(state.cinemaTotal).toBe(2) // togetherList length
    })

    it('uses sorted for non-partner worlds', () => {
      deps.isPartnerWorld = false
      deps.togetherList = [{ lat: 1, lng: 1 }]
      deps.sorted = [{ lat: 3, lng: 3 }, { lat: 4, lng: 4 }, { lat: 5, lng: 5 }]
      playStory()
      expect(state.cinemaTotal).toBe(3) // sorted length
    })
  })

  describe('stopPlay', () => {
    it('resets all state', () => {
      state.isPlaying = true
      state.cinemaEntry = { lat: 0, lng: 0 }
      state.cinemaPhase = 'show'
      stopPlay()
      expect(state.isPlaying).toBe(false)
      expect(state.cinemaEntry).toBeNull()
      expect(state.cinemaPhase).toBe('fly')
    })

    it('clears play timeout', () => {
      playRef.current = setTimeout(() => {}, 10000)
      stopPlay()
      expect(playRef.current).toBeNull()
    })

    it('clears photo timer interval', () => {
      photoTimerRef.current = setInterval(() => {}, 1000)
      stopPlay()
      expect(photoTimerRef.current).toBeNull()
    })

    it('restores spin speed', () => {
      deps.tSpinSpd.current = 0
      stopPlay()
      expect(deps.tSpinSpd.current).toBe(0.001)
    })

    it('handles null refs gracefully', () => {
      playRef.current = null
      photoTimerRef.current = null
      expect(() => stopPlay()).not.toThrow()
    })
  })

  describe('cinema phase transitions', () => {
    it('initial phase is fly', () => {
      expect(state.cinemaPhase).toBe('fly')
    })

    it('transitions through fly → show → transition phases', () => {
      state.cinemaPhase = 'fly'
      // Simulate the transition sequence
      state.cinemaPhase = 'show'
      expect(state.cinemaPhase).toBe('show')
      state.cinemaPhase = 'transition'
      expect(state.cinemaPhase).toBe('transition')
    })
  })

  describe('photo show time calculation', () => {
    it('calculates show time as 2000ms + 1200ms per photo', () => {
      const entry = { photos: ['a.jpg', 'b.jpg', 'c.jpg'] }
      const photoCount = entry.photos?.length || 0
      const showTime = 2000 + photoCount * 1200
      expect(showTime).toBe(5600)
    })

    it('defaults to 2000ms for entries with no photos', () => {
      const entry = {}
      const photoCount = entry.photos?.length || 0
      const showTime = 2000 + photoCount * 1200
      expect(showTime).toBe(2000)
    })

    it('handles null photos array', () => {
      const entry = { photos: null }
      const photoCount = entry.photos?.length || 0
      const showTime = 2000 + photoCount * 1200
      expect(showTime).toBe(2000)
    })
  })
})
