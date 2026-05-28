'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UploadPanel } from '@/components/UploadPanel'

const STEPS = [
  { id: 1, title: 'Business Info', description: 'Tell us about your business' },
  { id: 2, title: 'Campaign Goal', description: 'What do you want to achieve?' },
  { id: 3, title: 'Target Audience', description: 'Who are you targeting?' },
  { id: 4, title: 'Brand Tone', description: 'How should the content feel?' },
  { id: 5, title: 'Platforms', description: 'Where will you publish?' },
  { id: 6, title: 'Review & Generate', description: 'Create your campaign' },
]

interface CampaignData {
  businessType?: string
  businessInfo?: Record<string, any>
  goal?: string
  audience?: string
  tone?: string
  platforms?: string[]
  mediaIds?: string[]
}

export function CampaignWizard({ projectId, workspaceId }: { projectId: string; workspaceId: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<CampaignData>({})
  const [loading, setLoading] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'creating' | 'saving'>('idle')
  const [draftError, setDraftError] = useState<string | null>(null)

  const updateData = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const createDraftCampaign = async () => {
    setDraftStatus('creating')
    setDraftError(null)
    try {
      const response = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name: `Draft campaign for ${new Date().toLocaleDateString()}` }),
      })
      const payload = await response.json()
      if (!response.ok || payload.error) {
        throw new Error(payload.error || 'Unable to create draft campaign')
      }
      setCampaignId(payload.campaign.id)
      window.localStorage.setItem(`nexus_draft_campaign_${projectId}`, JSON.stringify({ campaignId: payload.campaign.id, data }))
    } catch (err: any) {
      console.error('Draft creation error', err)
      setDraftError(err.message || 'Draft creation failed')
    } finally {
      setDraftStatus('idle')
    }
  }

  const saveDraftCampaign = async () => {
    if (!campaignId) return
    setDraftStatus('saving')
    setDraftError(null)
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.businessType ? `Campaign for ${data.businessType}` : undefined,
          goal: data.goal,
          audience: data.audience,
          tone: data.tone,
          platforms: data.platforms,
          description: data.businessInfo?.description,
        }),
      })
      window.localStorage.setItem(`nexus_draft_campaign_${projectId}`, JSON.stringify({ campaignId, data }))
    } catch (err: any) {
      console.error('Draft save failed', err)
      setDraftError(err.message || 'Draft save failed')
    } finally {
      setDraftStatus('idle')
    }
  }

  const handleNext = () => {
    if (step < STEPS.length) setStep(step + 1)
  }

  const handlePrev = () => {
    if (step > 1) setStep(step - 1)
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(`nexus_draft_campaign_${projectId}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.campaignId) {
          setCampaignId(parsed.campaignId)
        }
        if (parsed.data) {
          setData((prev) => ({ ...prev, ...parsed.data }))
        }
      } catch {
        // ignore invalid storage
      }
    }

    if (!campaignId) {
      createDraftCampaign().catch(() => {})
    }
  }, [campaignId, projectId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (campaignId) saveDraftCampaign().catch(() => {})
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [campaignId, data])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      if (campaignId) {
        await saveDraftCampaign()
        router.push(`/campaign/${campaignId}`)
        return
      }

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: data.businessType ? `Campaign - ${data.businessType}` : `Campaign - ${new Date().toLocaleDateString()}`,
          goal: data.goal,
          audience: data.audience,
          tone: data.tone,
          platforms: data.platforms || [],
          mediaIds: data.mediaIds || [],
        }),
      })

      if (!response.ok) throw new Error('Failed to create campaign')

      const campaign = await response.json()
      router.push(`/campaign/${campaign.id}`)
    } catch (error) {
      console.error('Campaign creation error:', error)
      alert('Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <nav className="border-b border-dark-tertiary bg-dark-secondary sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-accent hover:text-accent-light transition">
            ← Back
          </Link>
          <div className="text-sm text-gray-400">
            Step {step} of {STEPS.length}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between mb-4">
            {STEPS.map((s, idx) => (
              <div
                key={s.id}
                className={`flex-1 h-1 ${idx < step ? 'bg-accent' : 'bg-dark-tertiary'} ${
                  idx < STEPS.length - 1 ? 'mr-2' : ''
                }`}
              />
            ))}
          </div>

          <div className="flex justify-between mb-8">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="text-center flex-1">
                <div
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                    idx < step
                      ? 'bg-accent text-dark'
                      : idx === step - 1
                      ? 'bg-accent/50 text-accent'
                      : 'bg-dark-tertiary text-gray-500'
                  } mb-2`}
                >
                  {idx + 1}
                </div>
                <div className="text-xs font-semibold">{s.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-lg p-12 mb-8">
          <h2 className="text-3xl font-bold mb-2">{STEPS[step - 1].title}</h2>
          <p className="text-gray-400 mb-8">{STEPS[step - 1].description}</p>

          {/* Step 1: Business Type */}
          {step === 1 && (
            <div className="space-y-4">
              {[
                'Ecommerce Store',
                'Restaurant/Cafe',
                'Real Estate',
                'Beauty/Salon',
                'Fitness/Gym',
                'Clinic/Healthcare',
                'Personal Brand',
                'SaaS/Tech',
              ].map(type => (
                <button
                  key={type}
                  onClick={() => updateData('businessType', type)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                    data.businessType === type
                      ? 'bg-accent/20 border-accent'
                      : 'bg-dark-tertiary border-dark-tertiary hover:border-accent/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Campaign Goal */}
          {step === 2 && (
            <div className="space-y-4">
              {[
                {
                  value: 'SALES',
                  label: 'Drive Sales',
                  desc: 'Convert viewers into customers',
                },
                {
                  value: 'AWARENESS',
                  label: 'Build Awareness',
                  desc: 'Increase brand visibility',
                },
                { value: 'LEADS', label: 'Generate Leads', desc: 'Collect customer info' },
                { value: 'TRAFFIC', label: 'Drive Traffic', desc: 'Send people to your site' },
                {
                  value: 'ENGAGEMENT',
                  label: 'Boost Engagement',
                  desc: 'Likes, comments, shares',
                },
              ].map(goal => (
                <button
                  key={goal.value}
                  onClick={() => updateData('goal', goal.value)}
                  className={`w-full text-left px-4 py-4 rounded-lg border transition ${
                    data.goal === goal.value
                      ? 'bg-accent/20 border-accent'
                      : 'bg-dark-tertiary border-dark-tertiary hover:border-accent/50'
                  }`}
                >
                  <div className="font-semibold">{goal.label}</div>
                  <div className="text-sm text-gray-400">{goal.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Target Audience */}
          {step === 3 && (
            <div>
              <label className="block text-sm font-semibold mb-3">Describe your target audience</label>
              <textarea
                value={data.audience || ''}
                onChange={e => updateData('audience', e.target.value)}
                placeholder="E.g., Women aged 25-40, interested in sustainable fashion, high disposable income, Instagram users..."
                className="w-full bg-dark-tertiary border border-dark-tertiary rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                rows={4}
              />
            </div>
          )}

          {/* Step 4: Brand Tone */}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-4">
              {[
                'Luxury',
                'Modern',
                'Energetic',
                'Corporate',
                'Minimal',
                'Aggressive Sales',
                'Friendly',
                'Professional',
              ].map(tone => (
                <button
                  key={tone}
                  onClick={() => updateData('tone', tone)}
                  className={`px-4 py-3 rounded-lg border transition text-center ${
                    data.tone === tone
                      ? 'bg-accent/20 border-accent'
                      : 'bg-dark-tertiary border-dark-tertiary hover:border-accent/50'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          )}

          {/* Step 5: Platforms */}
          {step === 5 && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'TikTok', icon: '🎵' },
                { name: 'Instagram', icon: '📷' },
                { name: 'Facebook', icon: '👍' },
                { name: 'YouTube Shorts', icon: '▶️' },
                { name: 'LinkedIn', icon: '💼' },
                { name: 'Snapchat', icon: '👻' },
              ].map(platform => (
                <button
                  key={platform.name}
                  onClick={() => {
                    const current = data.platforms || []
                    const updated = current.includes(platform.name)
                      ? current.filter(p => p !== platform.name)
                      : [...current, platform.name]
                    updateData('platforms', updated)
                  }}
                  className={`px-4 py-4 rounded-lg border transition text-center ${
                    data.platforms?.includes(platform.name)
                      ? 'bg-accent/20 border-accent'
                      : 'bg-dark-tertiary border-dark-tertiary hover:border-accent/50'
                  }`}
                >
                  <div className="text-2xl mb-2">{platform.icon}</div>
                  <div className="text-sm">{platform.name}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="bg-dark-tertiary rounded-lg p-6 space-y-4">
                <div>
                  <div className="text-sm text-gray-400">Business Type</div>
                  <div className="font-semibold">{data.businessType}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Campaign Goal</div>
                  <div className="font-semibold">{data.goal}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Target Audience</div>
                  <div className="font-semibold">{data.audience}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Brand Tone</div>
                  <div className="font-semibold">{data.tone}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Platforms</div>
                  <div className="font-semibold">{data.platforms?.join(', ')}</div>
                </div>
              </div>
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-6">
                <p className="text-sm">
                  Ready to generate? We'll create a marketing strategy, ad concepts, scripts, and content variations optimized for your goals.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8">
            <UploadPanel
              workspaceId={workspaceId}
              projectId={projectId}
              campaignId={campaignId || undefined}
              onMediaAdded={(media) => {
                if (!data.mediaIds) {
                  setData((prev) => ({ ...prev, mediaIds: [media.id] }))
                } else if (!data.mediaIds.includes(media.id)) {
                  setData((prev) => ({ ...prev, mediaIds: [...(prev.mediaIds || []), media.id] }))
                }
              }}
            />
            {draftStatus !== 'idle' && (
              <div className="mt-3 rounded-lg bg-dark-tertiary px-4 py-3 text-sm text-gray-300">
                {draftStatus === 'creating' ? 'Creating draft campaign…' : 'Saving draft campaign…'}
              </div>
            )}
            {draftError && (
              <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-200">
                {draftError}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="px-6 py-3 border border-dark-tertiary rounded-lg hover:bg-dark-tertiary transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          {step < STEPS.length ? (
            <button
              onClick={handleNext}
              disabled={!validateStep(step, data)}
              className="px-6 py-3 bg-accent text-dark rounded-lg hover:bg-accent-light transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-accent text-dark rounded-lg hover:bg-accent-light transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function validateStep(step: number, data: CampaignData): boolean {
  switch (step) {
    case 1:
      return !!data.businessType
    case 2:
      return !!data.goal
    case 3:
      return !!data.audience && data.audience.length > 10
    case 4:
      return !!data.tone
    case 5:
      return (data.platforms?.length || 0) > 0
    default:
      return true
  }
}
