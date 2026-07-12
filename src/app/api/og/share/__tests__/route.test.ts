import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFindFirst } = vi.hoisted(() => ({ mockFindFirst: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { campaign: { findFirst: mockFindFirst } },
}))

import { GET } from '../route'

describe('public share OG image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirst.mockResolvedValue({
      name: '<script>alert(1)</script>',
      goal: 'LEADS',
      platforms: ['LINKEDIN'],
      tone: 'PROFESSIONAL',
      project: { workspace: { name: '<img src=x onerror=alert(1)>' } },
    })
  })

  it('escapes workspace-controlled values and sandboxes the SVG', async () => {
    const searchParams = new URLSearchParams({ token: 'abcdefghijklmnop' })
    const response = await GET({ nextUrl: { searchParams } } as any)
    const svg = await response.text()
    expect(response.status).toBe(200)
    expect(svg).not.toContain('<script>')
    expect(svg).not.toContain('<img src=x')
    expect(svg).toContain('&lt;script&gt;')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('rejects malformed share tokens without querying the database', async () => {
    const response = await GET({ nextUrl: { searchParams: new URLSearchParams({ token: '../bad' }) } } as any)
    expect(response.status).toBe(400)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })
})
