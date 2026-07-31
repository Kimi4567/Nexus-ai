// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BrandEvidenceLibrary } from '@/components/brand/BrandEvidenceLibrary'
import { buildBrandTruthRegistry } from '@/lib/brandTruthRegistry'

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    storage: {
      from: () => ({ uploadToSignedUrl: vi.fn() }),
    },
  },
}))

describe('BrandEvidenceLibrary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [], truthSummary: buildBrandTruthRegistry() }),
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('explains privacy, pricing, supported documents, and the empty state', async () => {
    render(<BrandEvidenceLibrary locale="en" authHeader={() => 'Bearer token'} onProofChanged={() => undefined} />)

    expect(screen.getByRole('heading', { name: 'Brand Evidence Library' })).toBeTruthy()
    expect(screen.getByText('Analysis: 3 credits')).toBeTruthy()
    expect(screen.getByText(/PPTX/)).toBeTruthy()
    expect(screen.getByText('Upload & review are free')).toBeTruthy()
    expect(screen.getByText('10 sources / 50 MB per workspace')).toBeTruthy()
    expect(screen.getByText(/Files stay private/)).toBeTruthy()
    expect(await screen.findByText('Brand Truth Center')).toBeTruthy()
    expect(screen.getByText(/strong-claim areas remain restricted/)).toBeTruthy()
    expect(await screen.findByText('No source documents yet')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/brand/evidence', {
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('uses service evidence language without product-only proof requirements', async () => {
    render(
      <BrandEvidenceLibrary
        locale="en"
        authHeader={() => 'Bearer token'}
        onProofChanged={() => undefined}
        profile={{
          industry: 'Real estate',
          description: 'A real-estate marketing agency in Dubai.',
          primaryOffer: 'Property campaign strategy service',
        }}
      />,
    )

    expect(await screen.findByText('Service / offer identity')).toBeTruthy()
    expect(screen.getByText('Service visuals')).toBeTruthy()
    expect(screen.getByText('Have real service or campaign assets?')).toBeTruthy()
    expect(screen.queryByText('Sizing & fit')).toBeNull()
    expect(screen.queryByText('Delivery')).toBeNull()
    expect(screen.queryByText('Returns & refunds')).toBeNull()
    expect(screen.queryByText('Materials & quality')).toBeNull()
    expect(screen.queryByText('Product visuals')).toBeNull()
  })
})
