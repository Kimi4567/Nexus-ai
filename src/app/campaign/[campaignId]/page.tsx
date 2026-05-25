"use client"

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function CampaignPage() {
  const router = useRouter()
  const params: any = useParams()
  const campaignId = params?.campaignId
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [campaign, setCampaign] = useState<any>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    if (!isAuthenticated) return
    ;(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`, {
          headers: { Authorization: authHeader() },
        })
        const data = await res.json()
        if (data.campaign) setCampaign(data.campaign)
        else if (data.id) setCampaign(data)
      } catch (err) {
        // ignore
      }
    })()
  }, [campaignId, isAuthenticated, loading, router, authHeader])

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center">Loading...</div>
  if (!isAuthenticated) return null
  if (!campaign)
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center">
        <div className="text-gray-400">Campaign not found.</div>
      </div>
    )

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary">
      <nav className="border-b border-dark-tertiary bg-dark/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-accent">NEXUS</h1>
          </Link>
          <div className="text-sm text-gray-400">Campaign • {campaign.name}</div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-2">{campaign.name}</h1>
          <p className="text-gray-400 mb-6">{campaign.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-dark rounded-lg p-4 border border-dark-tertiary">
              <div className="text-sm text-gray-400">Goal</div>
              <div className="font-semibold mt-1">{campaign.goal}</div>
            </div>

            <div className="bg-dark rounded-lg p-4 border border-dark-tertiary">
              <div className="text-sm text-gray-400">Platforms</div>
              <div className="font-semibold mt-1">{campaign.platforms.join(', ')}</div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Generations</h3>
            <div className="grid grid-cols-1 gap-4">
              {(campaign.generations || []).length === 0 && (
                <div className="text-sm text-gray-400">No generations yet. Run AI Generation to create strategies and concepts.</div>
              )}
              {(campaign.generations || []).map((g: any) => (
                <div key={g.id} className="bg-dark rounded-lg p-4 border border-dark-tertiary flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{g.type} • {g.status}</div>
                    <div className="text-sm text-gray-400">{g.prompt?.slice(0, 120)}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/campaign/${campaign.id}/results`} className="text-accent">View Results</a>
                    <button onClick={async () => { await fetch('/api/generate', { method: 'POST', body: JSON.stringify({ campaignId: campaign.id }), headers: { 'Content-Type': 'application/json', Authorization: authHeader() } }); alert('Regeneration started') }} className="px-3 py-1 bg-accent text-dark rounded">Regenerate</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Attached media</h3>
            {campaign.media?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {campaign.media.map((media: any) => (
                  <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="rounded-3xl border border-dark-tertiary bg-dark-secondary p-4 hover:border-accent transition">
                    <div className="font-semibold text-white truncate">{media.fileName}</div>
                    <div className="text-sm text-gray-400">{media.type?.toUpperCase() || media.mimeType}</div>
                    <div className="text-xs text-gray-500 mt-2">{media.size ? `${Math.round(media.size / 1024)} KB` : 'Unknown size'}</div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400">No media attached to this campaign yet.</div>
            )}
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={async () => {
                try {
                  setGenerating(true)
                  await fetch('/api/generate', { method: 'POST', body: JSON.stringify({ campaignId: campaign.id }), headers: { 'Content-Type': 'application/json', Authorization: authHeader() } })
                  setGenerating(false)
                  alert('AI generation complete — refresh to see results')
                } catch (err) {
                  alert('Generation failed to start')
                }
              }}
              className="px-4 py-2 bg-accent text-dark rounded-md disabled:opacity-50"
              disabled={generating}
            >
              {generating ? '🤖 Generating...' : '🚀 Run AI Generation'}
            </button>

            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/exports', { method: 'POST', body: JSON.stringify({ campaignId: campaign.id }), headers: { 'Content-Type': 'application/json' } })
                  const data = await res.json()
                  if (data.export) window.open(data.export.url, '_blank')
                } catch (err) {
                  alert('Export failed')
                }
              }}
              className="px-4 py-2 bg-dark-tertiary rounded-md"
            >
              Export Campaign
            </button>

            <Link href="/dashboard">
              <button className="px-4 py-2 bg-dark-tertiary rounded-md">Back</button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
