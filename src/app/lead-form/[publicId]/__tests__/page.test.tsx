import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requested: vi.fn(),
  readiness: vi.fn(),
  findUnique: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leadCaptureForm: { findUnique: mocks.findUnique },
  },
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('../PublicLeadFormClient', () => ({
  default: () => null,
}))

import PublicLeadFormPage from '../page'

const props = { params: Promise.resolve({ publicId: 'public-form-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND')
  })
})

describe('public lead form page', () => {
  it('returns a real 404 when the public form no longer exists', async () => {
    mocks.findUnique.mockResolvedValue(null)

    await expect(PublicLeadFormPage(props)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })

  it('returns a real 404 for an inactive public form', async () => {
    mocks.findUnique.mockResolvedValue({
      publicId: 'public-form-1',
      title: 'Closed form',
      description: null,
      consentStatement: null,
      status: 'ARCHIVED',
    })

    await expect(PublicLeadFormPage(props)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })

  it('renders an active public form with server-validated configuration', async () => {
    mocks.findUnique.mockResolvedValue({
      publicId: 'public-form-1',
      title: 'Book a consultation',
      description: 'Tell us how to contact you.',
      consentStatement: 'I agree to receive a follow-up.',
      status: 'ACTIVE',
    })

    const result = await PublicLeadFormPage(props)

    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(result.props).toMatchObject({
      publicId: 'public-form-1',
      config: {
        publicId: 'public-form-1',
        title: 'Book a consultation',
        description: 'Tell us how to contact you.',
        consentStatement: 'I agree to receive a follow-up.',
      },
    })
  })
})
