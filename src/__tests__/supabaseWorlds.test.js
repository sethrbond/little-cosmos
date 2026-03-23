import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Chainable supabase mock ─────────────────────────────────────────
// Each from() call returns a fresh chain. By default every method
// returns the chain itself. Terminal methods (maybeSingle, single) are
// async. Use `c._terminalEq(n, value)` to make the Nth call to eq()
// resolve as a terminal (returns Promise instead of chain).

function createChainMock() {
  let eqCallCount = 0
  const eqTerminals = {} // { callNumber: resolvedValue }

  const chain = {}
  const methods = [
    'select', 'insert', 'update', 'delete',
    'in', 'or', 'is', 'order', 'limit',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain).mockName(m)
  }
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }).mockName('maybeSingle')
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null }).mockName('single')
  chain.eq = vi.fn(function () {
    eqCallCount++
    if (eqTerminals[eqCallCount] !== undefined) {
      return Promise.resolve(eqTerminals[eqCallCount])
    }
    return chain
  }).mockName('eq')

  // Make the Nth eq() call in this chain act as a terminal
  chain._terminalEq = (n, value) => { eqTerminals[n] = value }
  return chain
}

let fromFn = vi.fn()
let rpcFn = vi.fn()

vi.mock('../supabaseClient.js', () => ({
  supabase: {
    get from() { return fromFn },
    get rpc() { return rpcFn },
    auth: { getUser: vi.fn().mockResolvedValue({ data: null }) },
    storage: {
      from: vi.fn(() => ({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
  },
}))

vi.mock('../debug.js', () => ({ debugWarn: vi.fn() }))

import {
  leaveWorld, updateMemberRole, deleteWorld,
  searchCrossWorld, createWorld, clearWorldCaches,
} from '../supabaseWorlds.js'
import { supabase } from '../supabaseClient.js'

beforeEach(() => {
  vi.clearAllMocks()
  clearWorldCaches()
  fromFn = vi.fn(() => createChainMock())
  rpcFn = vi.fn()
})

// Helper: configure a sequence of from() calls
function setupFromSequence(behaviors) {
  const calls = []
  fromFn = vi.fn(() => {
    const c = createChainMock()
    const idx = calls.length
    calls.push(c)
    if (behaviors[idx]) behaviors[idx](c)
    return c
  })
  return calls
}

// ── leaveWorld ───────────────────────────────────────────────────────

describe('leaveWorld', () => {
  it('prevents the sole owner from leaving', async () => {
    setupFromSequence([
      // from('world_members').select('role').eq(wid).eq(uid).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner' }, error: null }),
      // from('world_members').select('*',{count}).eq(wid).eq('role','owner')
      // The 2nd eq is the terminal, returning { count: 1 }
      c => c._terminalEq(2, { count: 1 }),
    ])

    const result = await leaveWorld('world-1', 'user-1')
    expect(result).toBe(false)
  })

  it('allows a non-owner to leave', async () => {
    setupFromSequence([
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'member' }, error: null }),
      // from('world_members').delete().eq(wid).eq(uid)
      // The 2nd eq is the terminal
      c => c._terminalEq(2, { error: null }),
    ])

    const result = await leaveWorld('world-1', 'user-1')
    expect(result).toBe(true)
  })

  it('allows an owner to leave when there are other owners', async () => {
    setupFromSequence([
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner' }, error: null }),
      // count owners → 2 (2nd eq is terminal)
      c => c._terminalEq(2, { count: 2 }),
      // delete → success (2nd eq is terminal)
      c => c._terminalEq(2, { error: null }),
    ])

    const result = await leaveWorld('world-1', 'user-1')
    expect(result).toBe(true)
  })
})

// ── updateMemberRole ────────────────────────────────────────────────

describe('updateMemberRole', () => {
  it('rejects invalid role values', async () => {
    expect(await updateMemberRole('member-1', 'admin')).toBe(false)
    expect(await updateMemberRole('member-1', 'superuser')).toBe(false)
    expect(await updateMemberRole('member-1', '')).toBe(false)
    expect(await updateMemberRole('member-1', null)).toBe(false)
    expect(await updateMemberRole('member-1', undefined)).toBe(false)
  })

  it('rejects missing callerUserId', async () => {
    expect(await updateMemberRole('member-1', 'owner')).toBe(false)
    expect(await updateMemberRole('member-1', 'owner', null)).toBe(false)
    expect(await updateMemberRole('member-1', 'owner', '')).toBe(false)
  })

  it('accepts valid role "owner" (no demotion guard)', async () => {
    setupFromSequence([
      // lookup world_id: from().select('world_id').eq(id).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { world_id: 'world-1' }, error: null }),
      // caller auth: from().select('role').eq(wid).eq(uid).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner' }, error: null }),
      // update: from().update({role}).eq(id) → 1st eq is terminal
      c => c._terminalEq(1, { error: null }),
    ])

    const result = await updateMemberRole('member-1', 'owner', 'caller-1')
    expect(result).toBe(true)
  })

  it('prevents demoting the last owner to member', async () => {
    setupFromSequence([
      // lookup member: from().select().eq(id).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner', world_id: 'world-1' }, error: null }),
      // count owners: from().select().eq(wid).eq('role','owner')
      c => c._terminalEq(2, { count: 1 }),
    ])

    const result = await updateMemberRole('member-1', 'member', 'caller-1')
    expect(result).toBe(false)
  })

  it('prevents demoting the last owner to viewer', async () => {
    setupFromSequence([
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner', world_id: 'world-1' }, error: null }),
      c => c._terminalEq(2, { count: 1 }),
    ])

    const result = await updateMemberRole('member-1', 'viewer', 'caller-1')
    expect(result).toBe(false)
  })

  it('allows demoting an owner when there are other owners', async () => {
    setupFromSequence([
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner', world_id: 'world-1' }, error: null }),
      c => c._terminalEq(2, { count: 2 }),
      // caller auth: from().select('role').eq(wid).eq(uid).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner' }, error: null }),
      // update: from().update({role}).eq(id) → 1st eq is terminal
      c => c._terminalEq(1, { error: null }),
    ])

    const result = await updateMemberRole('member-1', 'member', 'caller-1')
    expect(result).toBe(true)
  })

  it('allows changing a non-owner role without owner count check', async () => {
    setupFromSequence([
      // current role is viewer → no demotion guard triggered
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'viewer', world_id: 'world-1' }, error: null }),
      // caller auth: from().select('role').eq(wid).eq(uid).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'owner' }, error: null }),
      // update
      c => c._terminalEq(1, { error: null }),
    ])

    const result = await updateMemberRole('member-1', 'member', 'caller-1')
    expect(result).toBe(true)
  })

  it('rejects caller who is not owner', async () => {
    setupFromSequence([
      // lookup world_id for promotion case
      c => c.maybeSingle.mockResolvedValue({ data: { world_id: 'world-1' }, error: null }),
      // caller auth: caller is a member, not owner
      c => c.maybeSingle.mockResolvedValue({ data: { role: 'member' }, error: null }),
    ])

    const result = await updateMemberRole('member-1', 'owner', 'non-owner')
    expect(result).toBe(false)
  })
})

// ── deleteWorld ─────────────────────────────────────────────────────

describe('deleteWorld', () => {
  it('requires userId (null)', async () => {
    expect(await deleteWorld('world-1', null)).toBe(false)
  })

  it('requires userId (undefined)', async () => {
    expect(await deleteWorld('world-1', undefined)).toBe(false)
  })

  it('requires userId (empty string)', async () => {
    expect(await deleteWorld('world-1', '')).toBe(false)
  })

  it('rejects deletion by non-owner', async () => {
    setupFromSequence([
      // from('worlds').select('created_by').eq('id',wid).maybeSingle()
      c => c.maybeSingle.mockResolvedValue({ data: { created_by: 'other-user' }, error: null }),
    ])

    const result = await deleteWorld('world-1', 'not-the-owner')
    expect(result).toBe(false)
  })

  it('returns false when world not found', async () => {
    setupFromSequence([
      c => c.maybeSingle.mockResolvedValue({ data: null, error: null }),
    ])

    const result = await deleteWorld('nonexistent', 'user-1')
    expect(result).toBe(false)
  })

  it('returns false on fetch error', async () => {
    setupFromSequence([
      c => c.maybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } }),
    ])

    const result = await deleteWorld('world-1', 'user-1')
    expect(result).toBe(false)
  })

  it('allows deletion by the actual owner', async () => {
    const userId = 'user-1'
    setupFromSequence([
      // ownership check
      c => c.maybeSingle.mockResolvedValue({ data: { created_by: userId }, error: null }),
      // entries query: from('entries').select().eq(wid) → { data: [] }
      c => c._terminalEq(1, { data: [] }),
      // delete world: from('worlds').delete().eq(wid) → { error: null }
      c => c._terminalEq(1, { error: null }),
    ])

    const result = await deleteWorld('world-1', userId)
    expect(result).toBe(true)
  })
})

// ── searchCrossWorld — input sanitization ───────────────────────────

describe('searchCrossWorld', () => {
  it('returns empty for empty query', async () => {
    const result = await searchCrossWorld(['w1'], 'user-1', '')
    expect(result).toEqual([])
  })

  it('returns empty for whitespace-only query', async () => {
    const result = await searchCrossWorld(['w1'], 'user-1', '   ')
    expect(result).toEqual([])
  })

  it('returns empty for null query', async () => {
    const result = await searchCrossWorld(['w1'], 'user-1', null)
    expect(result).toEqual([])
  })

  it('strips special characters — SQL injection becomes empty', async () => {
    const result = await searchCrossWorld(['w1'], 'user-1', "'; DROP TABLE entries; --")
    expect(result).toEqual([])
  })

  it('strips LIKE wildcards (% and _)', async () => {
    const result = await searchCrossWorld(['w1'], 'user-1', '%_%')
    expect(result).toEqual([])
  })

  it('preserves alphanumeric content from mixed input', async () => {
    setupFromSequence([
      // getPersonalWorldId: world_members lookup → no memberships
      c => c._terminalEq(1, { data: [], error: null }),
      // search: from('entries').select().in().or().order().limit()
      c => c.limit.mockReturnValue(Promise.resolve({ data: [], error: null })),
    ])

    const result = await searchCrossWorld(['w1'], 'user-1', 'Par!is$')
    expect(Array.isArray(result)).toBe(true)
  })

  it('allows hyphens and apostrophes in query', async () => {
    setupFromSequence([
      c => c._terminalEq(1, { data: [], error: null }),
      c => c.limit.mockReturnValue(Promise.resolve({ data: [], error: null })),
    ])

    const result = await searchCrossWorld(['w1'], 'user-1', "Côte d'Ivoire")
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns empty array when no worldIds provided', async () => {
    const result = await searchCrossWorld([], 'user-1', 'Paris')
    expect(result).toEqual([])
  })
})

// ── createWorld — type validation ───────────────────────────────────

describe('createWorld', () => {
  it('falls back to shared for invalid world type', async () => {
    rpcFn.mockResolvedValueOnce({ data: { id: 'w1' }, error: null })
    await createWorld('user-1', 'Test', 'invalid_type')
    expect(rpcFn).toHaveBeenCalledWith('create_world', expect.objectContaining({
      world_type: 'shared',
    }))
  })

  it('accepts valid world types', async () => {
    for (const type of ['personal', 'shared', 'partner', 'friends', 'family']) {
      rpcFn.mockResolvedValueOnce({ data: { id: 'w1' }, error: null })
      await createWorld('user-1', 'Test', type)
      expect(rpcFn).toHaveBeenCalledWith('create_world', expect.objectContaining({
        world_type: type,
      }))
    }
  })

  it('returns error object when RPC fails', async () => {
    rpcFn.mockResolvedValueOnce({ data: null, error: { message: 'RPC failed', details: null, hint: null } })
    const result = await createWorld('user-1', 'Test', 'shared')
    expect(result).toEqual({ _error: 'RPC failed' })
  })

  it('passes member_names for group world types (friends/family)', async () => {
    rpcFn.mockResolvedValueOnce({ data: { id: 'w1' }, error: null })
    await createWorld('user-1', 'Family', 'family', { members: [{ name: 'Alice' }, { name: 'Bob' }] })
    expect(rpcFn).toHaveBeenCalledWith('create_world', expect.objectContaining({
      world_type: 'family',
      member_names: [{ name: 'Alice' }, { name: 'Bob' }],
      you_name: '',
      partner_name: '',
    }))
  })

  it('passes you/partner names for partner type', async () => {
    rpcFn.mockResolvedValueOnce({ data: { id: 'w1' }, error: null })
    await createWorld('user-1', 'Our World', 'partner', { youName: 'Seth', partnerName: 'Rosie' })
    expect(rpcFn).toHaveBeenCalledWith('create_world', expect.objectContaining({
      world_type: 'partner',
      you_name: 'Seth',
      partner_name: 'Rosie',
      member_names: [],
    }))
  })
})
