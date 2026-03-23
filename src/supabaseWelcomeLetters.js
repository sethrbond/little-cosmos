import { supabase } from './supabaseClient.js'

// Fetch all unread welcome letters addressed to the current user's email
export async function getAllWelcomeLetters(email) {
  if (!email) return []
  const { data, error } = await supabase
    .from('welcome_letters')
    .select('*')
    .eq('to_email', email.toLowerCase())
    .eq('read', false)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data
}

// Mark a welcome letter as read
export async function markLetterRead(letterId) {
  const { error } = await supabase
    .from('welcome_letters')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', letterId)
  if (error) console.error('[markLetterRead]', error)
  return !error
}

// Send a welcome letter (from current user to a specific email)
export async function sendWelcomeLetter(fromUserId, fromName, toEmail, letterText) {
  const { data, error } = await supabase
    .from('welcome_letters')
    .insert({
      from_user_id: fromUserId,
      from_name: fromName,
      to_email: toEmail.toLowerCase(),
      letter_text: letterText,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Get all letters the current user has written
export async function getMyLetters(userId) {
  const { data, error } = await supabase
    .from('welcome_letters')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

// Delete a letter the current user wrote
export async function deleteWelcomeLetter(letterId) {
  const { error } = await supabase
    .from('welcome_letters')
    .delete()
    .eq('id', letterId)
  if (error) console.error('[deleteWelcomeLetter]', error)
  return !error
}
