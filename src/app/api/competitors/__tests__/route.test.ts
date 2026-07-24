import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  workspaceFindFirst: vi.fn(),
  transaction: vi.fn(),
  competitorCount: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({
  getAuthUser: mocks.getAuthUser,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    competitor: { count: mocks.competitorCount },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/competitors/route'

function request(websiteUrl: string) {
  return new NextRequest('http://localhost/api/competitors', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer session',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Validation Test', websiteUrl }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
})

describe('POST /api/competitors', () => {
  it.each([
    ['a malformed URL', 'http://[', 'Invalid URL'],
    ['a non-web protocol', 'ftp://example.com', 'Only public HTTP or HTTPS URLs are supported.'],
    ['a private hostname', 'http://localhost', 'A public website URL is required.'],
    ['embedded credentials', 'https://user:pass@example.com', 'URLs containing credentials are not supported.'],
    ['a non-standard port', 'https://example.com:8080', 'Only standard public web ports are supported.'],
  ])('returns 400 for %s without writing data', async (_case, websiteUrl, expectedError) => {
    const response = await POST(request(websiteUrl))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: expectedError })
    expect(mocks.competitorCount).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
