import { supabase } from './supabaseClient.js'

/* supabaseWorlds.js — Phase 3: World Creation & Sharing */

// ---- WORLDS ----

export async function createWorld(userId, name, type = 'shared') {
  const { data, error } = await supabase
    .from('worlds')
    .insert({ name, type, created_by: userId })
    .select()
    .single()
  if (error) { console.error('[createWorld]', error); return null }

  // Add creator as owner
  const { error: memErr } = await supabase
    .from('world_members')
    .insert({ world_id: data.id, user_id: userId, role: 'owner' })
  if (memErr) console.error('[createWorld] member insert:', memErr)

  // Create default config for this world
  const { error: cfgErr } = await supabase
    .from('config')
    .insert({
      id: data.id,
      world_id: data.id,
      user_id: userId,
      title: name,
      subtitle: 'every moment, every adventure',
      you_name: '',
      partner_name: '',
      start_date: '',
      love_letter: '',
      metadata: {
        loveLetters: [],
        dreamDestinations: [],
        chapters: [],
        darkMode: false,
        customPalette: {},
        customScene: {},
      },
    })
  if (cfgErr) console.error('[createWorld] config insert:', cfgErr)

  return data
}

export async function loadMyWorlds(userId) {
  // Get all worlds this user is a member of
  const { data: memberships, error: memErr } = await supabase
    .from('world_members')
    .select('world_id, role')
    .eq('user_id', userId)
  if (memErr) { console.error('[loadMyWorlds] memberships:', memErr); return [] }
  if (!memberships || memberships.length === 0) return []

  const worldIds = memberships.map(m => m.world_id)
  const { data: worlds, error } = await supabase
    .from('worlds')
    .select('*')
    .in('id', worldIds)
    .order('created_at', { ascending: true })
  if (error) { console.error('[loadMyWorlds]', error); return [] }

  const roleMap = Object.fromEntries(memberships.map(m => [m.world_id, m.role]))
  return (worlds || []).map(w => ({
    id: w.id,
    name: w.name,
    type: w.type,
    role: roleMap[w.id] || 'member',
    createdBy: w.created_by,
    palette: w.palette || {},
    scene: w.scene || {},
    createdAt: w.created_at,
  }))
}

export async function updateWorld(worldId, updates) {
  const row = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.palette !== undefined) row.palette = updates.palette
  if (updates.scene !== undefined) row.scene = updates.scene
  const { error } = await supabase.from('worlds').update(row).eq('id', worldId)
  if (error) console.error('[updateWorld]', error)
  return !error
}

export async function deleteWorld(worldId) {
  const { error } = await supabase.from('worlds').delete().eq('id', worldId)
  if (error) console.error('[deleteWorld]', error)
  return !error
}

// ---- MEMBERS ----

export async function getWorldMembers(worldId) {
  const { data, error } = await supabase
    .from('world_members')
    .select('*')
    .eq('world_id', worldId)
  if (error) { console.error('[getWorldMembers]', error); return [] }
  return data || []
}

export async function leaveWorld(worldId, userId) {
  const { error } = await supabase
    .from('world_members')
    .delete()
    .eq('world_id', worldId)
    .eq('user_id', userId)
  if (error) console.error('[leaveWorld]', error)
  return !error
}

// ---- INVITES ----

export async function createInvite(worldId, userId, role = 'member', maxUses = 1) {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const { data, error } = await supabase
    .from('world_invites')
    .insert({
      world_id: worldId,
      token,
      created_by: userId,
      role,
      max_uses: maxUses,
    })
    .select()
    .single()
  if (error) { console.error('[createInvite]', error); return null }
  return data
}

export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc('accept_world_invite', { invite_token: token })
  if (error) { console.error('[acceptInvite]', error); return { ok: false, error: error.message } }
  return data
}

export async function getInviteInfo(token) {
  const { data, error } = await supabase
    .from('world_invites')
    .select('*, worlds(name, type)')
    .eq('token', token)
    .single()
  if (error) { console.error('[getInviteInfo]', error); return null }
  return data
}

// Create invite + optionally send a welcome letter to the invitee's email
export async function createInviteWithLetter(worldId, userId, fromName, toEmail, letterText) {
  // 1. Create the invite token
  const invite = await createInvite(worldId, userId)
  if (!invite) return null

  // 2. If letter text provided, create a welcome letter for that email
  if (letterText && letterText.trim()) {
    const { error: letterErr } = await supabase
      .from('welcome_letters')
      .insert({
        from_user_id: userId,
        from_name: fromName,
        to_email: toEmail.toLowerCase(),
        letter_text: letterText.trim(),
      })
    if (letterErr) console.error('[createInviteWithLetter] letter error:', letterErr)
  }

  return { invite, inviteLink: `${window.location.origin}?invite=${invite.token}` }
}
