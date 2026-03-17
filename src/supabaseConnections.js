import { supabase } from './supabaseClient.js'

/* supabaseConnections.js — Friend connections / follow system */

// Send a friend/follow request to someone by email
export async function sendConnectionRequest(fromUserId, fromName, toEmail, shareBack = false, letterText = '') {
  const { data, error } = await supabase
    .from('cosmos_connections')
    .insert({
      requester_id: fromUserId,
      requester_name: fromName,
      target_email: toEmail.toLowerCase(),
      share_back: shareBack,
      letter_text: letterText,
    })
    .select()
    .single()
  if (error) {
    console.error('[sendConnectionRequest]', error.message, error.details, error.hint, error.code)
    return { _error: error.message }
  }
  return data
}

// Get pending requests addressed to the current user (by email)
export async function getPendingRequests(userEmail) {
  if (!userEmail) return []
  const { data, error } = await supabase
    .from('cosmos_connections')
    .select('*')
    .eq('target_email', userEmail.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) { console.error('[getPendingRequests]', error); return [] }
  return data || []
}

// Get all accepted connections for a user (as requester or target)
export async function getMyConnections(userId) {
  // Validate userId is a proper UUID to prevent injection via .or() template literal
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!userId || !uuidRegex.test(userId)) {
    console.error('[getMyConnections] invalid userId format')
    return []
  }
  const { data, error } = await supabase
    .from('cosmos_connections')
    .select('*')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},target_user_id.eq.${userId}`)
  if (error) { console.error('[getMyConnections]', error); return [] }
  return data || []
}

// Accept a connection request (SECURITY DEFINER function)
export async function acceptConnection(connectionId) {
  const { data, error } = await supabase.rpc('accept_cosmos_connection', { connection_id: connectionId })
  if (error) { console.error('[acceptConnection]', error); return { ok: false, error: error.message } }
  if (data && typeof data === 'object' && data.ok !== undefined) return data
  return { ok: !!data }
}

// Decline a connection request
export async function declineConnection(connectionId) {
  const { error } = await supabase
    .from('cosmos_connections')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', connectionId)
  if (error) { console.error('[declineConnection]', error); return false }
  return true
}


