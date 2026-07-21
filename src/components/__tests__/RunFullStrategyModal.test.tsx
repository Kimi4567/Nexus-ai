// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RunFullStrategyModal, { strategyDefaultsFromBrand } from '@/components/RunFullStrategyModal'

const fetchMock = vi.fn()
const { billingPlan } = vi.hoisted(() => ({ billingPlan: { current: 'growth' } }))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ authHeader: () => 'Bearer test-token' }),
}))

vi.mock('@/lib/useBillingStatus', () => ({
  useBillingStatus: () => ({ status: { plan: billingPlan.current }, invalidate: vi.fn() }),
}))

vi.mock('@/components/UpgradeModal', () => ({
  default: () => null,
}))

vi.mock('@/lib/i18n-context', () => ({
  useI18n: () => ({
    locale: 'en',
    dir: 'ltr',
    t: (key: string) => {
      if (key === 'runStrategy') {
        return {
          langSelectTitle: 'Set up strategy request',
          langSelectDesc: 'Choose strategy type, duration, content intensity, and output language before reviewing cost.',
          langOptAr: 'Arabic',
          langOptArDesc: 'Arabic output',
          langOptEn: 'English',
          langOptEnDesc: 'English output',
          langOptMix: 'Smart Mix',
          langOptMixDesc: 'Bilingual output',
          chipLangAr: 'Arabic',
          chipLangEn: 'English',
          chipLangMix: 'Bilingual',
          modalTitle: 'Building Your Strategy',
          modalSubtitle: 'Working from Brand Brain',
          step1: 'Reading Brand Brain',
          step2: 'Preparing positioning',
          step3: 'Building strategy',
          step4: 'Creating execution plan',
          step5: 'Finalizing brief',
          errorClose: 'Close',
          successTitle: 'Strategy complete!',
          successSub: 'Your new campaign is ready and saved.',
          campaignCreated: 'Campaign created',
          statCampaign: 'Campaign',
          statSuggestions: 'Suggestions',
          statCreditsUsed: 'Credits used',
          statCreditsLeft: 'Credits left',
          chipBrandBrain: 'Brand Brain',
          successCampaign: 'Open strategy decision desk',
          successCampaigns: 'Open campaigns',
          successSuggestions: 'Close',
        }
      }
      if (key === 'brandGate') {
        return {
          fieldBrandName: 'Brand name',
          fieldIndustry: 'Industry',
          fieldDescription: 'Business description',
          fieldPrimaryOffer: 'Main offer',
          fieldAudiencePainPoints: 'Audience pain points',
          fieldBusinessGoal: 'Business goal',
          fieldTargetAudience: 'Target audience',
          fieldTopPlatforms: 'Main platforms',
        }
      }
      return key
    },
  }),
}))

const readyProfile = {
  brandName: 'ClinicFlow AI',
  industry: 'Healthcare technology',
  description: 'Clinic operations platform',
  primaryOffer: 'Clinic operations software',
  targetAudience: 'Clinic owners and operations managers',
  audiencePainPoints: ['Manual follow-up', 'Missed handoffs'],
  businessGoal: 'Generate qualified demos',
  topPlatforms: ['LinkedIn', 'Instagram'],
  writingStyle: 'Calm and professional',
  languagePreference: 'English',
  audienceLocation: 'UAE',
  verifiedProof: [],
}

function response(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

describe('RunFullStrategyModal preflight', () => {
  beforeEach(() => {
    billingPlan.current = 'growth'
    sessionStorage.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/brand') return response({ brandProfile: readyProfile })
      if (url === '/api/user/credits') return response({ creditsRemaining: 189 })
      if (url === '/api/strategy/run-full' && init?.method === 'POST') {
        return new Promise(() => {})
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('uses four explicit gates and makes no generation request before final confirmation', async () => {
    render(<RunFullStrategyModal isOpen onClose={() => {}} />)

    expect(await screen.findByText('What NEXUS understands about your brand')).toBeTruthy()
    expect(screen.getByText('Core context is ready for an organic request')).toBeTruthy()
    expect(screen.getByText('Ready for organic request')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Set up strategy request' }))
    expect(await screen.findByRole('heading', { name: 'Set up strategy request' })).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Review strategy scope' }))
    expect(await screen.findByRole('heading', { name: 'Review strategy scope' })).toBeTruthy()
    expect(screen.getByText("What you'll receive")).toBeTruthy()
    expect(screen.getByText('Not included')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Review cost — 12 credits' }))
    expect(await screen.findByRole('heading', { name: 'Review cost and confirm' })).toBeTruthy()
    expect(screen.getByText('177')).toBeTruthy()
    expect(screen.getByText(/only action that starts generation/i)).toBeTruthy()
    expect(screen.getByText('Journey estimate before you start')).toBeTruthy()
    expect(screen.getByText('No media charge now')).toBeTruthy()
    expect(screen.getByText('21 credits')).toBeTruthy()
    expect(screen.getByText('61–201 credits')).toBeTruthy()
    expect(screen.getByText(/actual mix is quoted and approved per post later/i)).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('starts exactly one generation request from the final confirmation action', async () => {
    render(<RunFullStrategyModal isOpen onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Set up strategy request' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review strategy scope' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review cost — 12 credits' }))

    const finalAction = await screen.findByRole('button', { name: 'Confirm and generate strategy — 12 credits' })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    fireEvent.click(finalAction)

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    })
    const generationCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(String(generationCall?.[0])).toBe('/api/strategy/run-full')
    expect(JSON.parse(String(generationCall?.[1]?.body))).toMatchObject({ uiLocale: 'en' })
  })

  it('routes a campaign-limit response to the plan recovery action without retrying generation', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/brand') return response({ brandProfile: readyProfile })
      if (url === '/api/user/credits') return response({ creditsRemaining: 189 })
      if (url === '/api/strategy/run-full' && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({
            error: 'CAMPAIGN_LIMIT_REACHED',
            message: 'Campaign limit reached. Nothing was charged.',
            upgradeUrl: '/billing',
            creditsUsed: 0,
          }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<RunFullStrategyModal isOpen startFresh onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Set up strategy request' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review strategy scope' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review cost — 12 credits' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm and generate strategy — 12 credits' }))

    expect(await screen.findByRole('heading', { name: 'Campaign limit reached' })).toBeTruthy()
    expect(screen.getByText('Campaign limit reached. Nothing was charged.')).toBeTruthy()
    expect((await screen.findByRole('link', { name: 'View plans' })).getAttribute('href')).toBe('/billing')
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('keeps the success receipt visible until the user leaves it', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/brand') return response({ brandProfile: readyProfile })
      if (url === '/api/user/credits') return response({ creditsRemaining: 189 })
      if (url === '/api/strategy/run-full' && init?.method === 'POST') {
        return response({
          ok: true,
          campaignId: 'campaign-success',
          campaignName: 'Verified strategy',
          suggestions: 3,
          creditsUsed: 12,
          creditsRemaining: 177,
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    render(<RunFullStrategyModal isOpen startFresh onClose={onClose} onSuccess={onSuccess} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Set up strategy request' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review strategy scope' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review cost — 12 credits' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm and generate strategy — 12 credits' }))

    expect(await screen.findByRole('heading', { name: 'Strategy complete!' })).toBeTruthy()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the plan-capped post count on final confirmation', async () => {
    billingPlan.current = 'free'
    render(<RunFullStrategyModal isOpen onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Set up strategy request' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Set an exact post-direction count for the first 30 days' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Post direction count' }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review strategy scope' }))

    expect(await screen.findByText('Your plan caps the first 30 days at 3 post directions; this request will use 3.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Review cost — 12 credits' }))

    expect(await screen.findByText('3 post directions (requested 9)')).toBeTruthy()
    expect(screen.queryByText('9 post directions')).toBeNull()
  })

  it('shows both organic and exact paid deliverables for a full request', async () => {
    render(<RunFullStrategyModal isOpen onClose={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Set up strategy request' }))
    fireEvent.click(screen.getByRole('button', { name: /Full Organic plus paid planning/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Set an exact post-direction count for the first 30 days' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Post direction count' }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review strategy scope' }))

    expect(await screen.findByText('Organic direction')).toBeTruthy()
    expect(screen.getByText('Paid planning package')).toBeTruthy()
    expect(screen.getByText('9 exact organic post directions for the first 30 days')).toBeTruthy()
    expect(screen.getByText('3 audience hypotheses + 4 ad angles')).toBeTruthy()
    expect(screen.getByText('9 ad-copy variations + 4 creative briefs')).toBeTruthy()
  })
})

describe('strategyDefaultsFromBrand', () => {
  it('hydrates the strategy request from saved Brand Brain preferences', () => {
    expect(strategyDefaultsFromBrand({
      strategyType: 'full',
      strategyDuration: 'custom',
      strategyCustomDays: 120,
      languagePreference: 'both',
    })).toEqual({
      strategyType: 'full',
      strategyDuration: 'custom',
      selectedLanguage: 'bilingual',
      customDurationDays: 120,
    })
  })

  it('uses safe defaults and clamps invalid custom horizons', () => {
    expect(strategyDefaultsFromBrand({
      strategyType: 'unknown',
      strategyDuration: 'unknown',
      strategyCustomDays: 999,
      languagePreference: 'unknown',
    } as unknown as Parameters<typeof strategyDefaultsFromBrand>[0])).toEqual({
      strategyType: 'organic',
      strategyDuration: '30',
      selectedLanguage: 'ar',
      customDurationDays: 180,
    })
  })
})
