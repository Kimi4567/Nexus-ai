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
})
