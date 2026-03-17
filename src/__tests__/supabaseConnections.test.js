import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factory is hoisted — cannot reference outer variables.
// Instead, define the mock chain inside the factory and retrieve it via the mock.
vi.mock('../supabaseClient.js', () => {
  const mockOr = vi.fn().mockResolvedValue({ data: [], error: null })
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const chain = { select: mockSelect, eq: mockEq, or: mockOr }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)

  return {
    supabase: {
      from: vi.fn(() => chain),
      _chain: chain,           // expose for tests
      _mockOr: mockOr,
      _mockSelect: mockSelect,
    },
  }
})

import { getMyConnections } from '../supabaseConnections.js'
import { supabase } from '../supabaseClient.js'

// Convenience accessors
const mockOr = supabase._mockOr
const mockSelect = supabase._mockSelect
const chain = supabase._chain

beforeEach(() => {
  vi.clearAllMocks()
  // Re-setup chain returns after clearing
  mockSelect.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  mockOr.mockResolvedValue({ data: [], error: null })
})

describe('getMyConnections — UUID validation', () => {
  it('accepts a valid UUID and queries supabase', async () => {
    const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const mockData = [{ id: 1, requester_id: validUUID, status: 'accepted' }]
    mockOr.mockResolvedValueOnce({ data: mockData, error: null })

    const result = await getMyConnections(validUUID)
    expect(result).toEqual(mockData)
    expect(mockOr).toHaveBeenCalledWith(
      `requester_id.eq.${validUUID},target_user_id.eq.${validUUID}`
    )
  })

  it('returns empty array for invalid UUID format', async () => {
    const result = await getMyConnections('not-a-uuid')
    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns empty array for empty string', async () => {
    const result = await getMyConnections('')
    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns empty array for null', async () => {
    const result = await getMyConnections(null)
    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('returns empty array for undefined', async () => {
    const result = await getMyConnections(undefined)
    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('rejects UUID with extra characters', async () => {
    const result = await getMyConnections('a1b2c3d4-e5f6-7890-abcd-ef1234567890-extra')
    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('rejects SQL injection attempt in userId', async () => {
    const result = await getMyConnections("'; DROP TABLE cosmos_connections; --")
    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('accepts uppercase UUID', async () => {
    const uppercaseUUID = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890'
    mockOr.mockResolvedValueOnce({ data: [], error: null })

    const result = await getMyConnections(uppercaseUUID)
    expect(result).toEqual([])
    expect(mockOr).toHaveBeenCalled()
  })

  it('returns empty array when supabase returns error', async () => {
    const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    mockOr.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })

    const result = await getMyConnections(validUUID)
    expect(result).toEqual([])
  })
})
