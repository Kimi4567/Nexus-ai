import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  getDelivery: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/campaignDeliveryPackageService', () => ({ getCampaignDeliveryPackage: mocks.getDelivery }))

import { GET } from '@/app/api/campaigns/[id]/delivery-package/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.getDelivery.mockResolvedValue({ manifest: { state: 'REVIEW_DRAFT' }, posts: [] })
})

describe('GET /api/campaigns/[id]/delivery-package', () => {
  it('requires authentication', async () => {
    mocks.getServerUserId.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/campaigns/campaign-1/delivery-package'), {
      params: Promise.resolve({ id: 'campaign-1' }),
    })
    expect(response.status).toBe(401)
    expect(mocks.getDelivery).not.toHaveBeenCalled()
  })

  it('loads the package through the ownership-scoped service', async () => {
    const response = await GET(new NextRequest('http://localhost/api/campaigns/campaign-1/delivery-package', {
      headers: { Authorization: 'Bearer session' },
    }), { params: Promise.resolve({ id: 'campaign-1' }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.getDelivery).toHaveBeenCalledWith('user-1', 'campaign-1')
  })
})
