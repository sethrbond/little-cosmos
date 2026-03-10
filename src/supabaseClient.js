import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')

export const supabase = createClient(supabaseUrl, supabaseKey)

// Shared utilities (used by supabase.js, supabaseMyWorld.js, supabaseWorlds.js)

export async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn() }
    catch (err) {
      if (i === retries) { console.error('[withRetry] all retries failed:', err); throw err }
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

export function safeArray(v) {
  if (Array.isArray(v)) return v
  if (v == null || v === '') return []
  if (typeof v === 'string') {
    let parsed = v
    for (let i = 0; i < 3; i++) {
      try { parsed = JSON.parse(parsed); if (Array.isArray(parsed)) return parsed }
      catch { return [] }
    }
  }
  return []
}

export function cleanArray(v) { return Array.isArray(v) ? v : safeArray(v) }
