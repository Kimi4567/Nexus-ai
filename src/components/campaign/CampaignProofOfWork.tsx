'use client'

/**
 * CampaignProofOfWork — Operator Foundation PR-1C1 ("What NEXUS did here")
 *
 * Read-only, honest proof of completed work for ONE campaign. Mounted on the
 * Campaign page. Reads the existing GET /api/campaigns/[id]/content-plan (posts)
 * and the already-loaded campaign (for strategy). No writes, no execution CTAs.
 * Design System v3 only. Plain-business copy; no raw IDs/JSON/enums.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  deriveCampaignProofOfWork,
  type ProofItem,
  type ProofPostInput,
  type ProofCampaignInput,
  type ProofStatus,
} from '@/lib/campaignProofOfWork'

type TFn = (key: string) => string

const STATUS_CHIP: Record<ProofStatus, string> = {
  done: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  published: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  scheduled: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  needs_review: 'bg-amber-50 text-amber-700 border border-amber-200',
  failed: 'bg-red-50 text-red-700 border border-red-200',
}

const PLATFORM_LABEL: Record<string, string> = {
  META: 'Meta', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok', LINKEDIN: 'LinkedIn', YOUTUBE_SHORTS: 'YouTube', SNAPCHAT: 'Snapchat',
}

function fillTitle(tt: TFn, item: ProofItem): string {
  let s = tt(item.titleKey)
  if (item.count != null) s = s.replace('{count}', String(item.count))
  if (item.platform) s = s.replace('{platform}', PLATFORM_LABEL[item.platform] || item.platform)
  return s
}

export interface CampaignProofOfWorkProps {
  campaignId: string
  campaign: ProofCampaignInput
  compact?: boolean
}

export default function CampaignProofOfWork({ campaignId, campaign, compact = false }: CampaignProofOfWorkProps) {
  const { authHeader } = useAuth()
  const { t, dir } = useI18n()
  const tt = t as TFn

  const [posts, setPosts] = useState<ProofPostInput[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const token = authHeader()
      if (!token) { setLoading(false); return }
      const res = await fetch(`/api/campaigns/${campaignId}/content-plan`, { headers: { Authorization: token } })
      if (res.ok) {
        const d = await res.json()
        setPosts(Array.isArray(d.posts) ? d.posts : [])
      }
    } catch { /* non-critical surface */ }
    finally { setLoading(false) }
  }, [authHeader, campaignId])

  useEffect(() => { load() }, [load])

  if (loading) return null

  const { groups, isEmpty, items } = deriveCampaignProofOfWork(campaign, posts)

  if (compact) {
    if (isEmpty) return null
    const visibleItems = items.slice(0, 3)
    const hiddenCount = Math.max(0, items.length - visibleItems.length)

    return (
      <section
        data-campaign-proof-compact
        className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        dir={dir}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--nx-text-1)]">{tt('campaign.proof.title')}</h3>
            <p className="mt-0.5 text-xs leading-5 text-[var(--nx-text-3)]">{tt('campaign.proof.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {visibleItems.map((item) => (
              <span
                key={item.key}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                <span className="truncate">{fillTitle(tt, item)}</span>
                <span className={`rounded-full px-1.5 py-0.5 ${STATUS_CHIP[item.status]}`}>
                  {tt(item.statusKey)}
                </span>
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                +{hiddenCount}
              </span>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="nx-card overflow-hidden mb-4" dir={dir}>
      <div className="px-5 py-4 border-b border-[var(--nx-border)]">
        <h3 className="text-sm font-bold text-[var(--nx-text-1)]">{tt('campaign.proof.title')}</h3>
        <p className="mt-0.5 text-xs text-[var(--nx-text-3)]">{tt('campaign.proof.subtitle')}</p>
      </div>

      {isEmpty ? (
        <div className="px-5 py-5">
          <p className="text-sm text-[var(--nx-text-2)] leading-relaxed max-w-[60ch]">
            {tt('campaign.proof.emptyBody')}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--nx-border)]">
          <Group label={tt('campaign.proof.group.strategy')} items={groups.strategy} tt={tt} />
          <Group label={tt('campaign.proof.group.content')} items={groups.content} tt={tt} />
          <Group label={tt('campaign.proof.group.publishing')} items={groups.publishing} tt={tt} />
        </div>
      )}
    </section>
  )
}

function Group({ label, items, tt }: { label: string; items: ProofItem[]; tt: TFn }) {
  if (items.length === 0) return null
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--nx-text-3)] mb-3">{label}</p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm text-[var(--nx-text-1)]">{fillTitle(tt, item)}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CHIP[item.status]}`}>
              {tt(item.statusKey)}
            </span>
            {item.modeKey && (
              <span className="text-[11px] text-[var(--nx-text-3)]">· {tt(item.modeKey)}</span>
            )}
            {item.canViewPost && item.platformUrl && (
              <a
                href={item.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-accent hover:opacity-80 transition-opacity"
              >
                {tt('campaign.proof.viewPost')}
              </a>
            )}
            {item.status === 'failed' && item.errorMessage && (
              <span className="w-full text-xs text-[var(--nx-text-2)] mt-0.5">{item.errorMessage}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
