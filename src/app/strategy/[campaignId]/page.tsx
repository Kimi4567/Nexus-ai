'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Circle, Loader2 } from 'lucide-react'
import AppShell from '@/components/AppShell'
import StrategyReviewDocument, { type StrategyReviewCampaign } from '@/components/strategy/StrategyReviewDocument'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'

export default function StrategyReviewPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'

  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<StrategyReviewCampaign | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated || !campaignId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) {
        setCampaign(null)
        return
      }
      const data = await res.json()
      setCampaign(data.campaign ?? null)
    } catch {
      setCampaign(null)
    } finally {
      setLoading(false)
    }
  }, [authHeader, campaignId, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  if (!authLoading && !isAuthenticated) return null

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#8B5CF6' }} />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="max-w-[920px] mx-auto px-4 py-10">
          <div className="rounded-2xl p-6 text-center" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <Circle className="w-9 h-9 mx-auto mb-3" style={{ color: '#94a3b8' }} />
            <h1 className="text-xl font-black" style={{ color: '#0f172a' }}>
              {ar ? 'لا توجد استراتيجية للمراجعة' : 'No strategy to review'}
            </h1>
            <p className="text-sm mt-2" style={{ color: '#64748b' }}>
              {ar
                ? 'لم يتم العثور على مسودة استراتيجية لهذا المسار. ارجع إلى صفحة الاستراتيجية لإنشاء أو تحديث الاستراتيجية.'
                : 'No strategy draft was found for this route. Return to Strategy to create or update the strategy.'}
            </p>
            <Link href="/strategy" className="inline-flex items-center justify-center gap-2 mt-5 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#111827', color: '#FFFFFF' }}>
              <ArrowLeft className="w-4 h-4" />
              {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <StrategyReviewDocument campaign={campaign} locale={ar ? 'ar' : 'en'} />
    </AppShell>
  )
}
