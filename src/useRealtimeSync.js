import { supabase } from './supabaseClient.js'
import { rowToEntry } from './rowMapper.js'
import { useState, useEffect, useRef, useCallback } from 'react'

/* useRealtimeSync.js — Supabase Realtime subscriptions for My Cosmos
 *
 * Default export: useRealtimeSync — syncs table changes (INSERT/UPDATE/DELETE)
 * Named export:   useRealtimePresence — tracks who's online in a shared world
 */

// ---- MAIN HOOK: useRealtimeSync ----

/**
 * Subscribes to Supabase Realtime postgres_changes on a table.
 *
 * @param {Object} opts
 * @param {string} opts.tableName    — 'entries', 'my_entries', etc.
 * @param {string} opts.userId       — current user's UUID (used for personal world filtering)
 * @param {string} [opts.worldId]    — for shared worlds, filter by world_id instead of user_id
 * @param {function} opts.onInsert   — called with (entry) when a row is inserted
 * @param {function} opts.onUpdate   — called with (entry) when a row is updated
 * @param {function} opts.onDelete   — called with ({ id }) when a row is deleted
 *
 * @returns {{ isConnected: boolean, lastSync: Date|null }}
 */
export default function useRealtimeSync({
  tableName,
  userId,
  worldId,
  onInsert,
  onUpdate,
  onDelete,
}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const channelRef = useRef(null)
  const visibilityRef = useRef(true)
  const reconnectTimerRef = useRef(null)
  const syncTimerRef = useRef(null)
  const debouncedSetLastSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => setLastSync(new Date()), 500);
  }, [])

  // Store callbacks in refs so the channel subscription doesn't re-fire on every render
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onInsertRef.current = onInsert }, [onInsert])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])

  // Exponential backoff reconnect
  const reconnectAttemptRef = useRef(0)

  // Determine the filter column and value
  const filterCol = worldId ? 'world_id' : 'user_id'
  const filterVal = worldId || userId

  const subscribe = useCallback(() => {
    if (!tableName || !filterVal) return null

    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channelName = `realtime:${tableName}:${filterCol}:${filterVal}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: `${filterCol}=eq.${filterVal}`,
        },
        (payload) => {
          const entry = rowToEntry(payload.new)
          if (entry && onInsertRef.current) {
            onInsertRef.current(entry)
            debouncedSetLastSync()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: `${filterCol}=eq.${filterVal}`,
        },
        (payload) => {
          const entry = rowToEntry(payload.new)
          if (entry && onUpdateRef.current) {
            onUpdateRef.current(entry)
            debouncedSetLastSync()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: tableName,
          filter: `${filterCol}=eq.${filterVal}`,
        },
        (payload) => {
          const old = payload.old
          if (old?.id && onDeleteRef.current) {
            onDeleteRef.current({ id: old.id })
            debouncedSetLastSync()
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          reconnectAttemptRef.current = 0
        } else if (status === 'CLOSED') {
          setIsConnected(false)
          // disconnected
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false)
          console.error(`[realtime] channel error on ${tableName}:`, err)
          // Schedule reconnect with exponential backoff
          scheduleReconnect()
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false)
          console.warn(`[realtime] timed out on ${tableName}`)
          scheduleReconnect()
        }
      })

    channelRef.current = channel
    return channel
  }, [tableName, filterCol, filterVal])

  const MAX_RECONNECT_ATTEMPTS = 10

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    const attempt = reconnectAttemptRef.current
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[realtime] max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${tableName} — giving up`)
      return
    }
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // max 30s
    // exponential backoff reconnect
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current = attempt + 1
      subscribe()
    }, delay)
  }, [subscribe, tableName])

  // Visibility change handling — pause when tab is hidden, resume when visible
  useEffect(() => {
    function handleVisibility() {
      const isVisible = document.visibilityState === 'visible'
      visibilityRef.current = isVisible

      if (isVisible) {
        // Tab came back — resubscribe if not connected
        reconnectAttemptRef.current = 0
        if (!channelRef.current || channelRef.current.state !== 'SUBSCRIBED') {
          subscribe()
        }
      }
      // We don't unsubscribe on hide — Supabase handles idle channels gracefully.
      // If the connection drops while hidden, we'll reconnect on visibility change.
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [subscribe])

  // Online/offline handling
  useEffect(() => {
    function handleOnline() {
      // network restored
      reconnectAttemptRef.current = 0
      subscribe()
    }

    function handleOffline() {
      // network lost
      setIsConnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [subscribe])

  // Main subscription lifecycle
  useEffect(() => {
    reconnectAttemptRef.current = 0
    subscribe()

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [subscribe])

  return { isConnected, lastSync }
}


// ---- PRESENCE HOOK: useRealtimePresence ----

/**
 * Tracks which users are currently viewing a shared world.
 *
 * @param {Object} opts
 * @param {string} opts.worldId     — the shared world ID to track presence in
 * @param {string} opts.userId      — current user's UUID
 * @param {string} opts.displayName — current user's display name
 * @param {boolean} [opts.enabled=true] — set false to disable presence tracking
 *
 * @returns {{ onlineUsers: Array<{ user_id, name, online_at }> }}
 */
export function useRealtimePresence({
  worldId,
  userId,
  displayName,
  enabled = true,
}) {
  const [onlineUsers, setOnlineUsers] = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!enabled || !worldId || !userId) return

    const channelName = `presence:world:${worldId}`
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    })

    let destroyed = false

    channel
      .on('presence', { event: 'sync' }, () => {
        if (destroyed) return
        const state = channel.presenceState()
        if (!state) return
        const users = []
        for (const key of Object.keys(state)) {
          const presences = state[key]
          if (presences && presences.length > 0) {
            // Take the most recent presence for each user
            const latest = presences[presences.length - 1]
            users.push({
              user_id: latest.user_id || key,
              name: latest.name || 'Anonymous',
              online_at: latest.online_at || new Date().toISOString(),
            })
          }
        }
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !destroyed) {
          try {
            await channel.track({
              user_id: userId,
              name: displayName || 'Traveler',
              online_at: new Date().toISOString(),
            })
          } catch (err) {
            // Channel may have been removed during track() — safe to ignore
            if (!destroyed) console.warn('[presence] track error:', err)
          }
        }
      })

    channelRef.current = channel

    return () => {
      destroyed = true
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {})
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setOnlineUsers([])
    }
  }, [worldId, userId, displayName, enabled])

  return { onlineUsers }
}
