import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useNotifications — manages browser notification permission and "On This Day" notifications.
 *
 * @param {object} deps
 * @param {Array}   deps.entries       - all entries in the current world
 * @param {string}  deps.worldId       - current world ID
 * @param {string}  deps.userId        - current user ID
 * @param {boolean} deps.introComplete - whether intro/loading is done
 * @param {function} deps.onEntryClick - callback(entryId) when user clicks a notification
 */
export function useNotifications({ entries = [], worldId, userId, introComplete, onEntryClick }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const promptShownRef = useRef(false)

  // ---- Preference helpers ----
  const PREF_KEY = 'cosmos_notif_pref'
  const getNotifPref = () => {
    try { return localStorage.getItem(PREF_KEY) } catch { return null }
  }
  const setNotifPref = (val) => {
    try { localStorage.setItem(PREF_KEY, val) } catch {}
  }

  // ---- Show gentle prompt after 5+ entries (once) ----
  useEffect(() => {
    if (!introComplete || promptShownRef.current) return
    if (getNotifPref() !== null) return // already accepted or declined
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      // Already decided at browser level
      setNotifPref(Notification.permission === 'granted' ? 'enabled' : 'disabled')
      return
    }
    if (entries.length >= 5) {
      promptShownRef.current = true
      setShowPrompt(true)
    }
  }, [introComplete, entries.length])

  // ---- Accept handler ----
  const acceptNotifications = useCallback(async () => {
    setShowPrompt(false)
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setNotifPref('enabled')
      cacheEntriesForSW(entries, worldId)
    } else {
      setNotifPref('disabled')
    }
  }, [entries, worldId])

  // ---- Decline handler ----
  const declineNotifications = useCallback(() => {
    setShowPrompt(false)
    setNotifPref('disabled')
  }, [])

  // ---- Cache entries for SW "On This Day" check ----
  const cacheEntriesForSW = useCallback((ents, wid) => {
    if (getNotifPref() !== 'enabled') return
    try {
      const slim = ents.filter(e => e.dateStart).map(e => ({
        id: e.id,
        city: e.city || '',
        dateStart: e.dateStart,
        dateEnd: e.dateEnd || null,
        who: e.who || '',
        worldId: wid || '',
      }))
      localStorage.setItem('cosmos_notif_entries', JSON.stringify(slim))
    } catch {}
  }, [])

  // Keep the SW cache up to date whenever entries change
  useEffect(() => {
    if (getNotifPref() === 'enabled' && entries.length > 0) {
      cacheEntriesForSW(entries, worldId)
    }
  }, [entries, worldId, cacheEntriesForSW])

  // ---- Fire "On This Day" notifications from the main thread ----
  // (Backup for when SW periodic check hasn't run yet today)
  useEffect(() => {
    if (!introComplete || getNotifPref() !== 'enabled') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const today = new Date().toISOString().slice(0, 10)
    const md = today.slice(5) // "MM-DD"
    const thisYear = parseInt(today.slice(0, 4))

    const matches = entries.filter(e => {
      if (!e.dateStart) return false
      const eYear = parseInt(e.dateStart.slice(0, 4))
      if (eYear >= thisYear) return false
      const eMd = e.dateStart.slice(5)
      if (eMd === md) return true
      if (e.dateEnd) {
        const endMd = e.dateEnd.slice(5)
        if (eMd <= md && endMd >= md) return true
      }
      return false
    })

    if (matches.length === 0) return

    // Only fire once per day per entry
    const firedKey = `cosmos_otd_notif_${today}`
    let firedIds = []
    try { firedIds = JSON.parse(localStorage.getItem(firedKey) || '[]') } catch {}

    for (const entry of matches) {
      if (firedIds.includes(entry.id)) continue

      const yearsAgo = thisYear - parseInt(entry.dateStart.slice(0, 4))
      const label = yearsAgo === 1 ? '1 year ago today' : `${yearsAgo} years ago today`
      const body = `${label}: ${entry.city || 'A memory'}`

      try {
        const notif = new Notification('On This Day', {
          body,
          icon: '/icons/icon.svg',
          tag: `otd-${entry.id}`,
          data: { entryId: entry.id, worldId: worldId },
        })
        notif.onclick = () => {
          window.focus()
          if (onEntryClick) onEntryClick(entry.id, worldId)
          notif.close()
        }
      } catch {}

      firedIds.push(entry.id)
    }

    try { localStorage.setItem(firedKey, JSON.stringify(firedIds)) } catch {}
  }, [introComplete, entries, worldId, onEntryClick])

  return { showPrompt, acceptNotifications, declineNotifications }
}

/**
 * firePartnerNotification — fires a browser notification when a partner adds an entry.
 *
 * @param {object} entry - the newly inserted entry { city, who, addedBy, id }
 * @param {string} currentUserId - current user's UUID
 * @param {string} partnerName - display name for partner (from config)
 * @param {string} worldId - the world this entry belongs to
 * @param {function} [onEntryClick] - callback(entryId, worldId) when notification is clicked
 */
export function firePartnerNotification(entry, currentUserId, partnerName, worldId, onEntryClick) {
  try {
    const pref = localStorage.getItem('cosmos_notif_pref')
    if (pref !== 'enabled') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    // Only notify for entries added by someone else
    if (entry.addedBy === currentUserId) return

    const name = partnerName || 'Someone'
    const city = entry.city || 'a new place'
    const body = `${name} just added a memory: ${city}`

    const notif = new Notification('New Memory Added', {
      body,
      icon: '/icons/icon.svg',
      tag: `partner-${entry.id}`,
      data: { entryId: entry.id, worldId },
    })
    notif.onclick = () => {
      window.focus()
      if (onEntryClick) onEntryClick(entry.id, worldId)
      notif.close()
    }
  } catch {}
}
