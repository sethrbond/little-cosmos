import { supabase } from './supabaseClient.js'

/* supabaseWorlds.js — Phase 3: World Creation & Sharing */

// ---- WORLDS ----

export async function createWorld(userId, name, type = 'shared', { youName = '', partnerName = '' } = {}) {
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

  // Build subtitle from names if provided
  const subtitle = (youName && partnerName)
    ? type === 'family' ? `The ${youName} Family`
      : type === 'friends' ? `${youName}, ${partnerName} & friends`
      : `${youName} & ${partnerName}`
    : type === 'family' ? 'family adventures'
      : type === 'friends' ? 'adventures together'
      : 'every moment, every adventure'

  // Create default config for this world
  const { error: cfgErr } = await supabase
    .from('config')
    .insert({
      id: data.id,
      world_id: data.id,
      user_id: userId,
      title: name,
      subtitle,
      you_name: youName,
      partner_name: partnerName,
      start_date: null,
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

  // Also fetch config data (names, subtitle) for each world
  const { data: configs, error: cfgErr } = await supabase
    .from('config')
    .select('world_id, you_name, partner_name, subtitle')
    .in('world_id', worldIds)
  if (cfgErr) console.error('[loadMyWorlds] config fetch error:', cfgErr.message, cfgErr.code)
  console.log('[loadMyWorlds] configs loaded:', (configs || []).map(c => ({ world_id: c.world_id, you_name: c.you_name, partner_name: c.partner_name, subtitle: c.subtitle })))
  const cfgMap = Object.fromEntries((configs || []).map(c => [c.world_id, c]))

  const roleMap = Object.fromEntries(memberships.map(m => [m.world_id, m.role]))
  return (worlds || []).map(w => {
    const cfg = cfgMap[w.id] || {}
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      role: roleMap[w.id] || 'member',
      createdBy: w.created_by,
      palette: w.palette || {},
      scene: w.scene || {},
      createdAt: w.created_at,
      youName: cfg.you_name || '',
      partnerName: cfg.partner_name || '',
      subtitle: cfg.subtitle || '',
    }
  })
}

// Quick fetch of My World subtitle for cosmos screen
export async function loadMyWorldSubtitle(userId) {
  const { data, error } = await supabase
    .from('my_config')
    .select('subtitle')
    .eq('id', userId)
    .single()
  if (error || !data) return 'every step, every discovery'
  return data.subtitle || 'every step, every discovery'
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

export async function removeWorldMember(worldId, memberId) {
  const { error } = await supabase
    .from('world_members')
    .delete()
    .eq('world_id', worldId)
    .eq('id', memberId)
  if (error) console.error('[removeWorldMember]', error)
  return !error
}

export async function updateMemberRole(memberId, newRole) {
  if (!['owner', 'member', 'viewer'].includes(newRole)) {
    console.error('[updateMemberRole] Invalid role:', newRole)
    return false
  }
  const { error } = await supabase
    .from('world_members')
    .update({ role: newRole })
    .eq('id', memberId)
  if (error) console.error('[updateMemberRole]', error)
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
  if (data && typeof data === 'object' && data.ok !== undefined) return data
  if (data && typeof data === 'object' && data.world_id) return { ok: true, ...data }
  return { ok: !!data, world_id: data?.world_id || null }
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

// Create invite + send a welcome letter notification to the invitee's email
// Always creates a letter (used for in-app notifications) — uses default message if none provided
export async function createInviteWithLetter(worldId, userId, fromName, toEmail, letterText) {
  // 1. Create the invite token
  const invite = await createInvite(worldId, userId)
  if (!invite) return null

  // 2. Always create a welcome letter so the invitee gets an in-app notification
  const text = (letterText && letterText.trim())
    ? letterText.trim()
    : `${fromName} has invited you to join a shared world on My Cosmos!`
  if (toEmail) {
    const { error: letterErr } = await supabase
      .from('welcome_letters')
      .insert({
        from_user_id: userId,
        from_name: fromName,
        to_email: toEmail.toLowerCase(),
        letter_text: text,
      })
    if (letterErr) console.error('[createInviteWithLetter] letter error:', letterErr)
  }

  return { invite, inviteLink: `${window.location.origin}?invite=${invite.token}` }
}

// Create a viewer invite (read-only access to someone's world)
export async function createViewerInvite(worldId, userId, toEmail, letterText, fromName) {
  const invite = await createInvite(worldId, userId, 'viewer')
  if (!invite) return null

  const name = fromName || 'A friend'
  const text = (letterText && letterText.trim())
    ? letterText.trim()
    : `${name} has invited you to view their world on My Cosmos!`
  if (toEmail) {
    const { error: letterErr } = await supabase
      .from('welcome_letters')
      .insert({
        from_user_id: userId,
        from_name: name,
        to_email: toEmail.toLowerCase(),
        letter_text: text,
      })
    if (letterErr) console.error('[createViewerInvite] letter error:', letterErr)
  }

  return { invite, inviteLink: `${window.location.origin}?invite=${invite.token}` }
}

// ---- SENT INVITES (for tracking invite status) ----

export async function getSentInvites(worldId, userId) {
  if (!worldId || !userId) return []
  const { data, error } = await supabase
    .from('world_invites')
    .select('id, token, role, max_uses, use_count, created_at')
    .eq('world_id', worldId)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('[getSentInvites]', error); return [] }
  // Enrich with recipient email from welcome_letters (match by closest creation time)
  const { data: letters } = await supabase
    .from('welcome_letters')
    .select('to_email, created_at')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
  const usedLetters = new Set()
  return (data || []).map(inv => {
    const invTime = new Date(inv.created_at).getTime()
    let bestMatch = null, bestDiff = Infinity
    for (const l of (letters || [])) {
      if (usedLetters.has(l.created_at)) continue
      const diff = Math.abs(new Date(l.created_at).getTime() - invTime)
      if (diff < bestDiff && diff < 60000) { bestDiff = diff; bestMatch = l }
    }
    if (bestMatch) usedLetters.add(bestMatch.created_at)
    return {
      ...inv,
      toEmail: bestMatch?.to_email || null,
      status: inv.use_count >= inv.max_uses ? 'accepted' : 'pending',
    }
  })
}

// ---- PENDING WORLD INVITES (for in-app notifications) ----

export async function getPendingWorldInvites(userEmail) {
  if (!userEmail) return []
  // Find invites created with this email that haven't been used yet
  // We check welcome_letters for matching email to find associated invites
  const { data: letters, error: letErr } = await supabase
    .from('welcome_letters')
    .select('from_user_id, from_name, to_email, created_at')
    .eq('to_email', userEmail.toLowerCase())
    .eq('read', false)
  if (letErr || !letters || letters.length === 0) return []

  // For each unread letter, find the matching unused invite from that user (closest in time)
  const results = []
  for (const letter of letters) {
    const { data: invites } = await supabase
      .from('world_invites')
      .select('token, world_id, max_uses, use_count, created_at, worlds(name, type)')
      .eq('created_by', letter.from_user_id)
    if (!invites || invites.length === 0) continue
    // Match by closest creation time to the letter
    const letterTime = new Date(letter.created_at).getTime()
    let best = null, bestDiff = Infinity
    for (const inv of invites) {
      if (inv.use_count >= inv.max_uses) continue
      const diff = Math.abs(new Date(inv.created_at).getTime() - letterTime)
      if (diff < bestDiff) { bestDiff = diff; best = inv }
    }
    if (best && bestDiff < 120000) {
      results.push({
        token: best.token,
        worldName: best.worlds?.name || 'A Shared World',
        worldType: best.worlds?.type || 'shared',
        fromName: letter.from_name || 'Someone',
      })
    }
  }
  return results
}

// ---- COMMENTS ----

export async function loadComments(worldId, entryId) {
  const { data, error } = await supabase
    .from('entry_comments')
    .select('*')
    .eq('world_id', worldId)
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true })
  if (error) { console.error('[loadComments]', error); return [] }
  return data || []
}

export async function addComment(worldId, entryId, userId, userName, text) {
  const { data, error } = await supabase
    .from('entry_comments')
    .insert({ world_id: worldId, entry_id: entryId, user_id: userId, user_name: userName, comment_text: text })
    .select()
    .single()
  if (error) { console.error('[addComment]', error); return null }
  return data
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('entry_comments').delete().eq('id', commentId)
  if (error) console.error('[deleteComment]', error)
  return !error
}

// ---- REACTIONS ----

export async function loadReactions(worldId, entryId) {
  const { data, error } = await supabase
    .from('entry_reactions')
    .select('*')
    .eq('world_id', worldId)
    .eq('entry_id', entryId)
  if (error) { console.error('[loadReactions]', error); return [] }
  return data || []
}

export async function toggleReaction(worldId, entryId, userId, reactionType = 'heart', photoUrl = null) {
  // Check if already exists
  let query = supabase.from('entry_reactions')
    .select('id')
    .eq('world_id', worldId)
    .eq('entry_id', entryId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType)
  if (photoUrl) query = query.eq('photo_url', photoUrl)
  else query = query.is('photo_url', null)

  const { data: existing, error: queryErr } = await query.single()

  if (queryErr && queryErr.code !== 'PGRST116') { console.error('[toggleReaction]', queryErr); return { action: 'error' } }
  if (existing) {
    const { error: delErr } = await supabase.from('entry_reactions').delete().eq('id', existing.id)
    if (delErr) { console.error('[toggleReaction] delete:', delErr); return { action: 'error' } }
    return { action: 'removed' }
  } else {
    const row = { world_id: worldId, entry_id: entryId, user_id: userId, reaction_type: reactionType }
    if (photoUrl) row.photo_url = photoUrl
    const { error: insErr } = await supabase.from('entry_reactions').insert(row)
    if (insErr) { console.error('[toggleReaction] insert:', insErr); return { action: 'error' } }
    return { action: 'added' }
  }
}

// Bulk load reactions for all entries in a world (for badges/counts)
export async function loadAllWorldReactions(worldId) {
  const { data, error } = await supabase
    .from('entry_reactions')
    .select('entry_id, reaction_type, user_id, photo_url')
    .eq('world_id', worldId)
  if (error) { console.error('[loadAllWorldReactions]', error); return [] }
  return data || []
}

// ---- ACTIVITY FEED (cross-world recent entries) ----

export async function loadCrossWorldActivity(worldIds, limit = 20) {
  if (!worldIds || worldIds.length === 0) return []
  const { data, error } = await supabase
    .from('entries')
    .select('id, city, country, entry_type, date_start, photos, user_id, world_id, created_at')
    .in('world_id', worldIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[loadCrossWorldActivity]', error); return [] }
  return (data || []).map(r => ({ ...r, type: r.entry_type }))
}


export async function loadWorldEntryCounts(worldIds) {
  if (!worldIds || worldIds.length === 0) return {}
  const counts = {}
  for (const wid of worldIds) {
    const { count, error } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('world_id', wid)
    if (!error) counts[wid] = count || 0
  }
  return counts
}

export async function searchCrossWorld(worldIds, userId, query, limit = 20) {
  if (!query || query.trim().length === 0) return []
  const q = query.trim().toLowerCase().replace(/[%_,.*()\\'";\n\r\t]/g, '')
  if (!q) return []
  const results = []

  // Search shared worlds
  if (worldIds.length > 0) {
    const { data, error } = await supabase
      .from('entries')
      .select('id, city, country, entry_type, date_start, notes, photos, world_id')
      .in('world_id', worldIds)
      .or(`city.ilike.%${q}%,country.ilike.%${q}%,notes.ilike.%${q}%`)
      .order('date_start', { ascending: false })
      .limit(limit)
    if (!error && data) results.push(...data.map(e => ({ ...e, type: e.entry_type, source: 'shared' })))
  }

  // Search my world
  if (userId) {
    const { data, error } = await supabase
      .from('my_entries')
      .select('id, city, country, entry_type, date_start, notes, photos')
      .eq('user_id', userId)
      .or(`city.ilike.%${q}%,country.ilike.%${q}%,notes.ilike.%${q}%`)
      .order('date_start', { ascending: false })
      .limit(limit)
    if (!error && data) results.push(...data.map(e => ({ ...e, type: e.entry_type, source: 'my', world_id: 'my' })))
  }

  // Sort combined by date descending
  results.sort((a, b) => (b.date_start || '').localeCompare(a.date_start || ''))
  return results.slice(0, limit)
}

export async function loadMyWorldEntryCount(userId) {
  const { count, error } = await supabase
    .from('my_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) return 0
  return count || 0
}
