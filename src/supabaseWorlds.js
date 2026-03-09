import { supabase } from './supabaseClient.js'

/* supabaseWorlds.js — Phase 3: World Creation & Sharing */

// ---- PERSONAL WORLD ----

// Cache personal world IDs to avoid repeated lookups
const personalWorldCache = new Map()

export async function getPersonalWorldId(userId) {
  if (personalWorldCache.has(userId)) return personalWorldCache.get(userId)

  // Find the user's personal world via a two-step lookup
  const { data: memberships, error } = await supabase
    .from('world_members')
    .select('world_id')
    .eq('user_id', userId)
  if (error || !memberships?.length) { if (error) console.error('[getPersonalWorldId]', error); return null }

  const wIds = memberships.map(m => m.world_id)
  const { data: worlds } = await supabase
    .from('worlds')
    .select('id')
    .in('id', wIds)
    .eq('type', 'personal')
    .limit(1)
    .maybeSingle()

  const id = worlds?.id || null
  if (id) personalWorldCache.set(userId, id)
  return id
}

export async function ensurePersonalWorld(userId) {
  const existing = await getPersonalWorldId(userId)
  if (existing) return existing

  // Create personal world + membership via direct inserts
  const { data: world, error: wErr } = await supabase
    .from('worlds')
    .insert({ name: 'My World', type: 'personal', created_by: userId })
    .select('id')
    .single()

  if (wErr) { console.error('[ensurePersonalWorld] create world:', wErr); return null }

  const { error: mErr } = await supabase
    .from('world_members')
    .insert({ world_id: world.id, user_id: userId, role: 'owner' })

  if (mErr) { console.error('[ensurePersonalWorld] add member:', mErr); return null }

  personalWorldCache.set(userId, world.id)
  return world.id
}

// ---- WORLDS ----

export async function createWorld(userId, name, type = 'shared', { youName = '', partnerName = '', members = [] } = {}) {
  const isGroupWorld = type === 'friends' || type === 'family'
  const memberNames = isGroupWorld ? members.map(m => ({ name: m.name || m })) : []

  const { data, error } = await supabase.rpc('create_world', {
    world_name: name,
    world_type: type,
    you_name: isGroupWorld ? '' : youName,
    partner_name: isGroupWorld ? '' : partnerName,
    member_names: memberNames,
  })

  if (error) {
    console.error('[createWorld] RPC failed:', error.message, error.details, error.hint)
    return { _error: error.message }
  }

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

  // Also fetch config data (names, subtitle, metadata for members) for each world
  const { data: configs, error: cfgErr } = await supabase
    .from('config')
    .select('world_id, you_name, partner_name, subtitle, metadata')
    .in('world_id', worldIds)
  if (cfgErr) console.error('[loadMyWorlds] config fetch error:', cfgErr.message, cfgErr.code)
  const cfgMap = Object.fromEntries((configs || []).map(c => [c.world_id, c]))

  const roleMap = Object.fromEntries(memberships.map(m => [m.world_id, m.role]))
  // Filter out personal worlds — they appear as the center orb, not as shared world orbs
  return (worlds || []).filter(w => w.type !== 'personal').map(w => {
    const cfg = cfgMap[w.id] || {}
    const meta = cfg.metadata || {}
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      role: roleMap[w.id] || 'member',
      createdBy: w.created_by,
      palette: w.palette || {},
      scene: w.scene || {},
      createdAt: w.created_at,
      youName: cfg.you_name ?? '',
      partnerName: cfg.partner_name ?? '',
      subtitle: cfg.subtitle ?? '',
      members: Array.isArray(meta.members) ? meta.members : [],
      customPalette: meta.customPalette || {},
      customScene: meta.customScene || {},
    }
  })
}

// Quick fetch of My World subtitle + custom colors for cosmos screen
export async function loadMyWorldSubtitle(userId) {
  const personalId = await getPersonalWorldId(userId)
  if (!personalId) return { subtitle: '', customPalette: {}, customScene: {} }
  const { data, error } = await supabase
    .from('config')
    .select('subtitle, metadata')
    .eq('world_id', personalId)
    .maybeSingle()
  if (error || !data) return { subtitle: '', customPalette: {}, customScene: {} }
  const meta = data.metadata || {}
  return { subtitle: data.subtitle ?? '', customPalette: meta.customPalette || {}, customScene: meta.customScene || {} }
}

export async function updateWorld(worldId, updates) {
  try {
    const row = {}
    if (updates.name !== undefined) row.name = updates.name
    if (updates.palette !== undefined) row.palette = updates.palette
    if (updates.scene !== undefined) row.scene = updates.scene
    const { error } = await supabase.from('worlds').update(row).eq('id', worldId)
    if (error) { console.error('[updateWorld]', error); return false }
    return true
  } catch (err) { console.error('[updateWorld] exception:', err); return false }
}

export async function deleteWorld(worldId, userId) {
  // 0. Verify the caller owns this world
  if (!userId) { console.error('[deleteWorld] userId required'); return false }
  const { data: world, error: fetchErr } = await supabase.from('worlds').select('created_by').eq('id', worldId).maybeSingle()
  if (fetchErr || !world) { console.error('[deleteWorld] world not found or error:', fetchErr); return false }
  if (world.created_by !== userId) { console.error('[deleteWorld] not the owner'); return false }

  // 1. Clean up photos from Supabase Storage for all entries in this world
  try {
    const { data: entries } = await supabase
      .from('entries')
      .select('id, photos')
      .eq('world_id', worldId)
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        // Delete photos folder from storage
        const { data: files } = await supabase.storage.from('photos').list(`${entry.id}`)
        if (files && files.length > 0) {
          const paths = files.map(f => `${entry.id}/${f.name}`)
          await supabase.storage.from('photos').remove(paths)
        }
      }
    }
  } catch (err) {
    console.error('[deleteWorld] photo cleanup error (non-blocking):', err)
  }

  // 2. Delete the world row (CASCADE handles entries, members, invites, comments, reactions)
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
  try {
    // Guard: prevent the sole owner from leaving — must transfer ownership first
    const { data: membership } = await supabase
      .from('world_members')
      .select('role')
      .eq('world_id', worldId)
      .eq('user_id', userId)
      .maybeSingle()
    if (membership && membership.role === 'owner') {
      const { count } = await supabase
        .from('world_members')
        .select('*', { count: 'exact', head: true })
        .eq('world_id', worldId)
        .eq('role', 'owner')
      if (count <= 1) { console.error('[leaveWorld] Cannot leave — transfer ownership first'); return false }
    }

    const { error } = await supabase
      .from('world_members')
      .delete()
      .eq('world_id', worldId)
      .eq('user_id', userId)
    if (error) { console.error('[leaveWorld]', error); return false }
    return true
  } catch (err) { console.error('[leaveWorld] exception:', err); return false }
}

export async function removeWorldMember(worldId, memberId) {
  try {
    const { error } = await supabase
      .from('world_members')
      .delete()
      .eq('world_id', worldId)
      .eq('id', memberId)
    if (error) { console.error('[removeWorldMember]', error); return false }
    return true
  } catch (err) { console.error('[removeWorldMember] exception:', err); return false }
}

export async function updateMemberRole(memberId, newRole) {
  try {
    if (!['owner', 'member', 'viewer'].includes(newRole)) {
      console.error('[updateMemberRole] Invalid role:', newRole)
      return false
    }
    // Guard: prevent demoting the last owner
    if (newRole !== 'owner') {
      const { data: member } = await supabase
        .from('world_members')
        .select('role, world_id')
        .eq('id', memberId)
        .maybeSingle()
      if (member && member.role === 'owner') {
        const { count } = await supabase
          .from('world_members')
          .select('*', { count: 'exact', head: true })
          .eq('world_id', member.world_id)
          .eq('role', 'owner')
        if (count <= 1) {
          console.error('[updateMemberRole] Cannot demote the last owner')
          return false
        }
      }
    }
    const { error } = await supabase
      .from('world_members')
      .update({ role: newRole })
      .eq('id', memberId)
    if (error) { console.error('[updateMemberRole]', error); return false }
    return true
  } catch (err) { console.error('[updateMemberRole] exception:', err); return false }
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
    .maybeSingle()
  if (error) { console.error('[getInviteInfo]', error); return null }
  // Check if invite has expired
  if (data && data.expires_at && new Date(data.expires_at) < new Date()) return null
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
        invite_token: invite.token,
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
        invite_token: invite.token,
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
  // FRAGILE: Matching invites to letters by time proximity. A direct FK (invite_id on
  // welcome_letters) should be added in a future migration to make this relationship explicit.
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
  const email = userEmail.toLowerCase()

  // Find unread welcome letters for this email
  const { data: letters, error: letErr } = await supabase
    .from('welcome_letters')
    .select('from_user_id, from_name, to_email, created_at, invite_token')
    .eq('to_email', email)
    .eq('read', false)

  const results = []
  const seenTokens = new Set()

  // Strategy 1: Direct token link (new invites have invite_token on the letter)
  if (!letErr && letters) {
    for (const letter of letters) {
      if (letter.invite_token) {
        const { data: inv } = await supabase
          .from('world_invites')
          .select('token, world_id, max_uses, use_count, worlds(name, type)')
          .eq('token', letter.invite_token)
          .maybeSingle()
        if (inv && (inv.max_uses === null || inv.use_count < inv.max_uses)) {
          seenTokens.add(inv.token)
          results.push({
            token: inv.token,
            worldName: inv.worlds?.name || 'A Shared World',
            worldType: inv.worlds?.type || 'shared',
            fromName: letter.from_name || 'Someone',
          })
        }
        continue
      }

      // Strategy 2: Fallback to time-proximity matching (old invites without invite_token)
      const { data: invites } = await supabase
        .from('world_invites')
        .select('token, world_id, max_uses, use_count, created_at, worlds(name, type)')
        .eq('created_by', letter.from_user_id)
      if (!invites || invites.length === 0) continue
      const letterTime = new Date(letter.created_at).getTime()
      let best = null, bestDiff = Infinity
      for (const inv of invites) {
        if (seenTokens.has(inv.token)) continue
        if (inv.max_uses !== null && inv.use_count >= inv.max_uses) continue
        const diff = Math.abs(new Date(inv.created_at).getTime() - letterTime)
        if (diff < bestDiff) { bestDiff = diff; best = inv }
      }
      if (best && bestDiff < 300000) { // 5 minutes (was 2, now more generous)
        seenTokens.add(best.token)
        results.push({
          token: best.token,
          worldName: best.worlds?.name || 'A Shared World',
          worldType: best.worlds?.type || 'shared',
          fromName: letter.from_name || 'Someone',
        })
      }
    }
  }

  // Strategy 3: Also check for any unused invites where this user might be the target
  // even if the welcome letter was already read or never created
  // This catches edge cases like: letter read during onboarding but invite not accepted
  const { data: user } = await supabase.auth.getUser()
  if (user?.user?.id) {
    const uid = user.user.id
    // Find worlds this user is NOT a member of but has unused invites for
    const { data: allInvites } = await supabase
      .from('world_invites')
      .select('token, world_id, max_uses, use_count, created_by, worlds(name, type)')
    if (allInvites) {
      // Get user's current world memberships
      const { data: memberships } = await supabase
        .from('world_members')
        .select('world_id')
        .eq('user_id', uid)
      const memberWorldIds = new Set((memberships || []).map(m => m.world_id))

      // Check welcome_letters (including read ones) to find invites meant for this user
      const { data: allLetters } = await supabase
        .from('welcome_letters')
        .select('from_user_id, from_name, invite_token, created_at')
        .eq('to_email', email)

      for (const letter of (allLetters || [])) {
        const matchingInvite = letter.invite_token
          ? allInvites.find(i => i.token === letter.invite_token)
          : allInvites.find(i =>
              i.created_by === letter.from_user_id &&
              Math.abs(new Date(i.created_at).getTime() - new Date(letter.created_at).getTime()) < 300000
            )
        if (matchingInvite && !seenTokens.has(matchingInvite.token) &&
            !memberWorldIds.has(matchingInvite.world_id) &&
            (matchingInvite.max_uses === null || matchingInvite.use_count < matchingInvite.max_uses)) {
          seenTokens.add(matchingInvite.token)
          results.push({
            token: matchingInvite.token,
            worldName: matchingInvite.worlds?.name || 'A Shared World',
            worldType: matchingInvite.worlds?.type || 'shared',
            fromName: letter.from_name || 'Someone',
          })
        }
      }
    }
  }

  return results
}

// Find world invites associated with a specific welcome letter (by sender + time proximity)
export async function getPendingWorldInvitesForLetter(letter) {
  if (!letter?.from_user_id) return []

  // Direct token link (preferred)
  if (letter.invite_token) {
    const { data: inv } = await supabase
      .from('world_invites')
      .select('token, world_id, max_uses, use_count, worlds(name, type)')
      .eq('token', letter.invite_token)
      .maybeSingle()
    if (inv && (inv.max_uses === null || inv.use_count < inv.max_uses)) {
      return [{ token: inv.token, worldName: inv.worlds?.name || 'A Shared World', worldType: inv.worlds?.type || 'shared' }]
    }
    return []
  }

  // Fallback: time-proximity matching
  const { data: invites } = await supabase
    .from('world_invites')
    .select('token, world_id, max_uses, use_count, created_at, worlds(name, type)')
    .eq('created_by', letter.from_user_id)
  if (!invites || invites.length === 0) return []
  const letterTime = new Date(letter.created_at).getTime()
  const results = []
  for (const inv of invites) {
    if (inv.max_uses && inv.use_count >= inv.max_uses) continue
    const diff = Math.abs(new Date(inv.created_at).getTime() - letterTime)
    if (diff < 300000) {
      results.push({ token: inv.token, worldName: inv.worlds?.name || 'A Shared World', worldType: inv.worlds?.type || 'shared' })
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

export async function toggleReaction(worldId, entryId, userId, reactionType = 'heart', photoUrl = null) {
  // Try insert first — if a unique violation occurs, the reaction exists, so delete it instead.
  // This avoids the check-then-act race condition of the previous approach.
  const row = { world_id: worldId, entry_id: entryId, user_id: userId, reaction_type: reactionType }
  if (photoUrl) row.photo_url = photoUrl

  const { error: insErr } = await supabase.from('entry_reactions').insert(row)
  if (!insErr) return { action: 'added' }

  // Unique violation (code 23505) means it already exists — delete it
  if (insErr.code === '23505') {
    let delQuery = supabase.from('entry_reactions')
      .delete()
      .eq('world_id', worldId)
      .eq('entry_id', entryId)
      .eq('user_id', userId)
      .eq('reaction_type', reactionType)
    if (photoUrl) delQuery = delQuery.eq('photo_url', photoUrl)
    else delQuery = delQuery.is('photo_url', null)

    const { error: delErr } = await delQuery
    if (delErr) { console.error('[toggleReaction] delete:', delErr); return { action: 'error' } }
    return { action: 'removed' }
  }

  console.error('[toggleReaction] insert:', insErr)
  return { action: 'error' }
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
  const results = await Promise.all(worldIds.map(wid =>
    supabase.from('entries').select('*', { count: 'exact', head: true }).eq('world_id', wid)
      .then(({ count, error }) => [wid, error ? 0 : (count || 0)])
  ))
  return Object.fromEntries(results)
}

export async function searchCrossWorld(worldIds, userId, query, limit = 20) {
  if (!query || query.trim().length === 0) return []
  // Strict whitelist: only alphanumeric, spaces, dashes, apostrophes
  const q = query.trim().replace(/[^a-zA-Z0-9\s'-]/g, '').trim().toLowerCase()
  if (!q) return []

  // Include personal world in search (all entries now in unified entries table)
  const personalId = await getPersonalWorldId(userId)
  const allWorldIds = personalId ? [...new Set([...worldIds, personalId])] : worldIds

  if (allWorldIds.length === 0) return []

  const { data, error } = await supabase
    .from('entries')
    .select('id, city, country, entry_type, date_start, notes, photos, world_id')
    .in('world_id', allWorldIds)
    .or(`city.ilike.%${q}%,country.ilike.%${q}%,notes.ilike.%${q}%`)
    .order('date_start', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map(e => ({
    ...e,
    type: e.entry_type,
    source: e.world_id === personalId ? 'my' : 'shared',
  }))
}

// ---- SHARE ENTRY TO ANOTHER WORLD ----

export async function shareEntryToWorld(entry, targetWorldId, userId) {
  const newId = `e${Date.now()}`
  const row = {
    id: newId, user_id: userId, world_id: targetWorldId,
    city: entry.city, country: entry.country || '',
    lat: entry.lat, lng: entry.lng,
    date_start: entry.dateStart, date_end: entry.dateEnd || null,
    entry_type: entry.type, who: entry.who || 'solo',
    zoom_level: entry.zoomLevel || 1, notes: entry.notes || '',
    memories: entry.memories || [], museums: entry.museums || [],
    restaurants: entry.restaurants || [], highlights: entry.highlights || [],
    photos: entry.photos || [], stops: entry.stops || [],
    music_url: entry.musicUrl || null, favorite: false,
    love_note: '',
  }
  const { error } = await supabase.from('entries').insert(row)
  if (error) { console.error('[shareEntryToWorld]', error); return { ok: false, error: error.message } }
  return { ok: true, id: newId }
}

export async function loadMyWorldEntryCount(userId) {
  const personalId = await getPersonalWorldId(userId)
  if (!personalId) return 0
  const { count, error } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('world_id', personalId)
  if (error) return 0
  return count || 0
}
