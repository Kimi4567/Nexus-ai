'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import {
  deriveContentHubMediaState,
  isContentPostMediaReadyForScheduling,
} from '@/lib/contentHubMediaState'
import { deriveContentLifecycleTruth } from '@/lib/contentLifecycleTruth'
import { useI18n } from '@/lib/i18n-context'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { hasBrandTruthVerificationFailure, isBrandTruthExecutionLocked } from '@/lib/brandTruthGate'
import {
  ArrowUpRight,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface CampaignRecord {
  id: string
  name: string
  goal?: string | null
  status?: string | null
  thumbnail?: string | null
  platforms?: string[]
  createdAt?: string
}

interface SocialPostRecord {
  id: string
  campaignId: string
  campaignName: string
  platform: string
  caption: string
  imageUrl?: string | null
  imagePrompt?: string | null
  videoPrompt?: string | null
  isVideoPost?: boolean
  generationStatus?: string | null
  mediaSource?: string | null
  uploadedMediaId?: string | null
  contentPlanIndex?: number | null
  scheduledAt?: string | null
  approvedAt?: string | null
  approvedSnapshotId?: string | null
  mediaApprovalSnapshotId?: string | null
  scheduledSnapshotId?: string | null
  status?: string | null
  publishedAt?: string | null
  manuallyPublishedAt?: string | null
  platformUrl?: string | null
}

interface ContentHubOverviewResponse {
  campaigns?: CampaignRecord[]
  posts?: SocialPostRecord[]
}

const toneClasses = {
  violet: 'bg-[#EEF2FF] text-[#5E63FF]',
  amber: 'bg-amber-50 text-amber-600',
}

const platformColors: Record<string, string> = {
  INSTAGRAM: '#E1306C',
  META: '#1877F2',
  FACEBOOK: '#1877F2',
  TIKTOK: '#111827',
  LINKEDIN: '#0A66C2',
  YOUTUBE: '#FF0000',
  X: '#111827',
  TWITTER: '#111827',
  SNAPCHAT: '#FFFC00',
  GOOGLE: '#4285F4',
}

function SoftPanel({
  children,
  className = '',
  dir,
}: {
  children: React.ReactNode
  className?: string
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <section
      dir={dir}
      className={`nx-os-card ${className}`}
    >
      {children}
    </section>
  )
}

function PlatformMark({ platform }: { platform: string }) {
  const normalized = platform.toUpperCase()
  const color = platformColors[normalized] ?? '#5E63FF'
  const label = normalized === 'META' ? 'f' : normalized === 'INSTAGRAM' ? '◎' : normalized === 'TIKTOK' ? '♪' : normalized === 'LINKEDIN' ? 'in' : normalized === 'YOUTUBE' ? '▶' : normalized.slice(0, 1)
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black text-white" style={{ background: color }}>
      {label}
    </span>
  )
}

function MediaThumb({ src, label }: { src?: string | null; label: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className="h-full w-full object-cover" />
    )
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_20%,rgba(94,99,255,0.24),transparent_36%),linear-gradient(135deg,#F8FAFC,#EEF2FF)] text-[#5E63FF]">
      <Sparkles className="h-5 w-5" />
    </div>
  )
}

function safeSnippet(text: string | undefined, fallback: string) {
  const value = (text || '').replace(/\s+/g, ' ').trim()
  if (!value) return fallback
  return value.length > 86 ? `${value.slice(0, 86)}...` : value
}

export default function ContentHubPage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([])
  const [posts, setPosts] = useState<SocialPostRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFormat, setActiveFormat] = useState('all')
  const [brandTruthState, setBrandTruthState] = useState<'checking' | 'passed' | 'blocked' | 'unavailable'>('checking')

  const loadBoard = useCallback(async () => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) {
      setLoading(false)
      setError(isAr ? 'تعذّر التحقق من جلسة الدخول. أعد المحاولة.' : 'Could not verify your session. Retry.')
      return
    }
    setLoading(true)
    setError(null)
    setBrandTruthState('checking')

    try {
      const [overviewRes, brandRes] = await Promise.all([
        fetchWithTimeout('/api/content-hub/overview', {
          headers: { Authorization: token },
        }, 9_000),
        fetchWithTimeout('/api/brand', {
          headers: { Authorization: token },
        }, 8_000),
      ])

      if (!overviewRes.ok) throw new Error(isAr ? 'تعذر تحميل مركز المحتوى' : 'Failed to load Content Hub')
      if (brandRes.ok) {
        const brandData = await brandRes.json() as { brandProfile?: Parameters<typeof reviewBrandTruthConsistency>[0] }
        setBrandTruthState(!brandData.brandProfile || reviewBrandTruthConsistency(brandData.brandProfile).status === 'blocked' ? 'blocked' : 'passed')
      } else {
        setBrandTruthState('unavailable')
      }

      const overviewData = (await overviewRes.json()) as ContentHubOverviewResponse
      setCampaigns(overviewData.campaigns ?? [])
      setPosts(overviewData.posts ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? 'حدث خطأ غير متوقع' : 'Unexpected error')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [authHeader, isAr, isAuthenticated])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadBoard()
  }, [authLoading, isAuthenticated, loadBoard])

  const stats = useMemo(() => {
    const total = posts.length
    const lifecycle = posts.map(post => ({ post, truth: deriveContentLifecycleTruth(post) }))
    const approved = lifecycle.filter(({ truth }) => truth.status === 'APPROVED' && truth.hasImmutableCopyApproval).length
    const scheduled = lifecycle.filter(({ truth }) => truth.isValidScheduled).length
    const invalidScheduled = lifecycle.filter(({ truth }) => truth.isInvalidScheduled).length
    const published = posts.filter(post => String(post.status || '').toUpperCase() === 'PUBLISHED').length
    const mediaReady = posts.filter(isContentPostMediaReadyForScheduling).length
    const copyReady = posts.filter(post => Boolean(String(post.caption || '').trim())).length
    const platformAssigned = posts.filter(post => Boolean(String(post.platform || '').trim())).length
    const drafts = posts.filter(post => String(post.status || 'DRAFT').toUpperCase() === 'DRAFT').length
    const needsReview = lifecycle.filter(({ post, truth }) => {
      const status = truth.status
      if (status === 'PUBLISHED') return false
      return status === 'DRAFT'
        || truth.hasApprovalEvidenceGap
        || truth.isInvalidScheduled
        || !truth.hasFinalMediaApproval
    }).length
    const reviewed = lifecycle.filter(({ truth }) => {
      return truth.requiresApprovalEvidence && truth.hasImmutableCopyApproval
    }).length
    const productionProgress = total === 0
      ? 0
      : Math.round(((copyReady + mediaReady + reviewed) / (total * 3)) * 100)

    return {
      total,
      approved,
      scheduled,
      invalidScheduled,
      published,
      mediaReady,
      copyReady,
      platformAssigned,
      reviewed,
      needsReview,
      drafts,
      productionProgress: Math.max(0, Math.min(100, productionProgress)),
    }
  }, [posts])

  const filteredPosts = useMemo(() => {
    if (activeFormat === 'all') return posts
    return posts.filter(post => {
      if (activeFormat === 'videos') return Boolean(post.isVideoPost)
      if (activeFormat === 'posts') return !post.isVideoPost
      return false
    })
  }, [activeFormat, posts])

  const latestCampaign = campaigns[0]
  const contentTruthLocked = isBrandTruthExecutionLocked(brandTruthState)
  const contentTruthFailure = hasBrandTruthVerificationFailure(brandTruthState)
  const latestCampaignContentHref = contentTruthLocked ? '/brand' : latestCampaign ? `/campaigns/${latestCampaign.id}/content-hub` : '/strategy'
  const samplePost = filteredPosts.find(post => post.imageUrl) ?? filteredPosts[0] ?? posts.find(post => post.imageUrl) ?? posts[0]
  const recentPosts = filteredPosts.filter(post => {
    const truth = deriveContentLifecycleTruth(post)
    const status = truth.status
    if (status === 'PUBLISHED') return false
    return status === 'DRAFT' || truth.hasApprovalEvidenceGap || truth.isInvalidScheduled || !truth.hasFinalMediaApproval
  }).slice(0, 5)
  const sampleMediaState = deriveContentHubMediaState(samplePost ?? {})

  const platformRows = useMemo(() => {
    const map = new Map<string, { platform: string; count: number; ready: number }>()
    posts.forEach(post => {
      const key = String(post.platform || 'UNKNOWN').toUpperCase()
      const row = map.get(key) ?? { platform: key, count: 0, ready: 0 }
      row.count += 1
      if (isContentPostMediaReadyForScheduling(post)) row.ready += 1
      map.set(key, row)
    })
    return Array.from(map.values()).slice(0, 5)
  }, [posts])

  const formatChips = [
    { key: 'all', label: isAr ? 'الكل' : 'All' },
    { key: 'posts', label: isAr ? 'منشورات ثابتة' : 'Static posts' },
    { key: 'videos', label: isAr ? 'منشورات فيديو' : 'Video posts' },
  ]

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="nx-os-page">
          <div className="nx-os-container nx-os-stack">
            <LuxuryWorkspaceHeader
              journeyStage="production"
              pageTitle={isAr ? 'إنتاج المحتوى' : 'Content production'}
              pageSubtitle={isAr ? 'النص والوسائط والمراجعة في حزمة منشور واحدة.' : 'Copy, media, and review in one post package.'}
              primaryHref={null}
              secondaryHref="/strategy"
              secondaryLabel={isAr ? 'الاستراتيجية والحملات' : 'Strategy & campaigns'}
            />
            <div className="nx-os-card px-7 py-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#5E63FF]" />
              <p className="mt-3 text-[13px] font-bold text-slate-500">
                {isAr ? 'جارٍ تحميل لقطة موحّدة للحملات والمحتوى والاعتمادات...' : 'Loading one consistent snapshot of campaigns, content, and approvals...'}
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            journeyStage="production"
            pageTitle={isAr ? 'إنتاج المحتوى' : 'Content production'}
            pageSubtitle={isAr ? 'راجع النص والوسائط لكل حملة، ثم سلّم الحزمة المعتمدة للتنفيذ.' : 'Review campaign copy and media, then hand the approved package to execution.'}
            primaryHref={latestCampaignContentHref}
            primaryLabel={contentTruthLocked ? (isAr ? 'تصحيح Brand Brain' : 'Fix Brand Brain') : latestCampaign ? (isAr ? 'مراجعة الإنتاج' : 'Review production') : (isAr ? 'إنشاء استراتيجية' : 'Create strategy')}
            secondaryHref="/strategy"
            secondaryLabel={isAr ? 'الاستراتيجية والحملات' : 'Strategy & campaigns'}
          />

          {error && (
            <SoftPanel className="flex flex-col gap-3 p-4 text-[13px] font-bold text-rose-600 sm:flex-row sm:items-center sm:justify-between" dir={isAr ? 'rtl' : 'ltr'}>
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadBoard()}
                className="shrink-0 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white"
              >
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </SoftPanel>
          )}

          {contentTruthFailure && (
            <SoftPanel className="border-orange-200 bg-orange-50 p-4 text-orange-950" dir={isAr ? 'rtl' : 'ltr'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-black">
                    {brandTruthState === 'blocked'
                      ? (isAr ? 'المحتوى الحالي مرجع قديم حتى تصحيح Brand Brain' : 'Current content is reference-only until Brand Brain is corrected')
                      : (isAr ? 'تعذر التحقق من Brand Brain؛ تم إيقاف التنفيذ احتياطياً' : 'Brand Brain could not be verified; execution is safely paused')}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-orange-800">
                    {brandTruthState === 'blocked'
                      ? (isAr ? 'المجال المحفوظ لا يطابق وصف النشاط. لا يمكن اعتماد هذه النصوص أو توليد وسائط لها أو جدولتها، ولن يُخصم كريديت حتى تصحيح مصدر الحقيقة.' : 'The saved industry conflicts with the business description. These drafts cannot be approved, given paid media, or scheduled, and no credits are spent until the source of truth is fixed.')
                      : (isAr ? 'لن يسمح NEXUS باعتماد أو توليد أو جدولة مدفوعة قبل استعادة مصدر الحقيقة والتحقق منه.' : 'NEXUS will not allow paid approval, generation, or scheduling until the source of truth is available and verified.')}
                  </p>
                </div>
                <Link href="/brand" className="inline-flex h-10 items-center gap-2 rounded-xl bg-orange-700 px-4 text-[12px] font-black text-white">
                  <ArrowUpRight className="h-4 w-4" />{isAr ? 'فتح Brand Brain' : 'Open Brand Brain'}
                </Link>
              </div>
            </SoftPanel>
          )}

          <div className="nx-os-action-strip" dir={isAr ? 'rtl' : 'ltr'}>
            <div>
              <p className="text-[13px] font-black text-[#0B1028]">
                {contentTruthLocked
                  ? (isAr ? `${stats.total} سجلات محتوى محجوبة للمراجعة` : `${stats.total} content records are held for review`)
                  : isAr ? `${stats.needsReview} منشورات تحتاج قرارك` : `${stats.needsReview} posts need your decision`}
              </p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                {isAr ? `${stats.total} إجمالي · ${stats.reviewed} نصوص موثقة · ${stats.mediaReady} وسائط جاهزة · ${stats.scheduled} جدولة موثقة` : `${stats.total} total · ${stats.reviewed} copy revisions evidenced · ${stats.mediaReady} media ready · ${stats.scheduled} verified schedules`}
              </p>
              {stats.invalidScheduled > 0 && (
                <p className="mt-1 text-[10px] font-black text-rose-600">
                  {isAr ? `${stats.invalidScheduled} سجل جدولة غير مكتمل الدليل ويحتاج إعادة اعتماد.` : `${stats.invalidScheduled} schedule record${stats.invalidScheduled === 1 ? ' lacks' : 's lack'} complete evidence and need${stats.invalidScheduled === 1 ? 's' : ''} re-approval.`}
                </p>
              )}
              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                {isAr ? 'تُراجع CTA داخل كل منشور؛ لا يفترض NEXUS دعوة عامة من دون دليل.' : 'CTA is reviewed per post; NEXUS does not assume a generic CTA here.'}
              </p>
            </div>
            <Link href={latestCampaignContentHref} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-black text-white ${contentTruthLocked ? 'bg-orange-700' : 'bg-[#101A4D]'}`}>
              <ArrowUpRight className="h-4 w-4" />
              {contentTruthLocked ? (isAr ? 'تصحيح Brand Brain' : 'Fix Brand Brain') : (isAr ? 'فتح إنتاج الحملة' : 'Open campaign production')}
            </Link>
          </div>

          <SoftPanel className="flex flex-wrap items-center justify-start gap-2 p-3" dir={isAr ? 'rtl' : 'ltr'}>
            {formatChips.map(chip => (
              <button
                type="button"
                key={chip.key}
                aria-pressed={activeFormat === chip.key}
                onClick={() => setActiveFormat(chip.key)}
                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-[12px] font-bold transition ${
                  activeFormat === chip.key ? 'border-[#5E63FF]/25 bg-[#F2F4FF] text-[#5E63FF]' : 'border-slate-200 bg-white text-slate-600'
                } hover:border-[#5E63FF]/30 hover:text-[#5E63FF]`}
              >
                {chip.label}
              </button>
            ))}
          </SoftPanel>

          <div dir="ltr">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr_1fr]">
                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-4 flex items-center justify-between">
                    <Link href="/strategy" className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض مسار الحملات' : 'View campaign workflow'}</Link>
                    <div className="text-right">
                      <p className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'قائمة قرارات الإنتاج' : 'Production decisions'}</p>
                      <h2 className="text-[17px] font-black text-[#0B1028]">{isAr ? 'عناصر غير مكتملة' : 'Incomplete items'}</h2>
                    </div>
                    <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-black text-[#5E63FF]" dir="ltr">{stats.needsReview}</span>
                  </div>
                  <div className="space-y-2.5">
                    {recentPosts.slice(0, 3).map(post => {
                      const status = String(post.status || 'DRAFT').toUpperCase()
                      const lifecycle = deriveContentLifecycleTruth(post)
                      const decisionLabel = contentTruthLocked
                        ? (isAr ? 'محجوب' : 'Blocked')
                        : lifecycle.isInvalidScheduled
                        ? (isAr ? 'أعد اعتماد الجدولة' : 'Re-approve schedule')
                        : status === 'DRAFT'
                        ? (isAr ? 'راجع النص' : 'Review copy')
                        : (isAr ? 'أكمل الوسائط' : 'Complete media')
                      return (
                      <Link
                        key={post.id}
                        href={`/campaigns/${post.campaignId}/content-hub`}
                        className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[16px] bg-slate-50 px-3 py-2.5"
                      >
                        <div className="h-10 w-10 overflow-hidden rounded-xl">
                          <MediaThumb src={post.imageUrl} label={post.campaignName} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-[#0B1028]">
                            {contentTruthLocked
                              ? (isAr ? 'مسودة قديمة — مرجع فقط حتى تصحيح Brand Brain' : 'Older draft — reference-only until Brand Brain is fixed')
                              : safeSnippet(post.caption, post.campaignName)}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-slate-500">{post.isVideoPost ? (isAr ? 'فيديو قصير' : 'Short video') : (isAr ? 'منشور / صورة' : 'Post / image')} · {post.campaignName}</p>
                        </div>
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${contentTruthLocked ? toneClasses.amber : status === 'DRAFT' ? toneClasses.violet : toneClasses.amber}`}>
                          {decisionLabel}
                        </span>
                      </Link>
                      )
                    })}
                    {recentPosts.length === 0 && (
                      <div className="rounded-[16px] bg-slate-50 px-4 py-6 text-center text-[12px] font-bold text-slate-500">
                        {isAr ? 'لا توجد منشورات للمراجعة بعد.' : 'No posts ready for review yet.'}
                      </div>
                    )}
                  </div>
                </SoftPanel>

                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-4 flex items-center justify-between">
                    <LayoutGrid className="h-4 w-4 text-[#5E63FF]" />
                    <div className="text-right">
                      <p className="text-[12px] font-bold text-slate-500">{isAr ? 'مثال لمحتوى (قيد المراجعة)' : 'Content sample in review'}</p>
                      <h2 className="text-[17px] font-black text-[#0B1028]">
                        {contentTruthLocked && samplePost
                          ? (isAr ? 'عينة قديمة محجوبة — لا تعتمدها' : 'Older sample blocked — do not approve')
                          : samplePost ? safeSnippet(samplePost.caption, isAr ? 'مسودة محتوى' : 'Content draft') : (isAr ? 'لا توجد عينة بعد' : 'No sample yet')}
                      </h2>
                    </div>
                  </div>
                  {samplePost ? <Link href={`/campaigns/${samplePost.campaignId}/content-hub`} className="block overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50">
                    <div className="relative aspect-[16/7] overflow-hidden">
                      <MediaThumb src={samplePost?.imageUrl} label={samplePost?.campaignName || 'Content sample'} />
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-600">
                        {samplePost?.isVideoPost ? (isAr ? 'فيديو' : 'Video') : (isAr ? 'صورة / منشور' : 'Post asset')}
                      </div>
                      <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-[#5E63FF]">
                        {isAr ? sampleMediaState.badgeLabel.ar : sampleMediaState.badgeLabel.en}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { ar: 'نص', en: 'Copy' },
                          { ar: 'وسائط', en: 'Media' },
                          { ar: 'مراجعة', en: 'Review' },
                        ].map(stage => (
                          <span key={stage.en} className="rounded-full border border-[#DDE2FF] bg-[#EEF2FF] px-2 py-1 text-[9px] font-black text-[#5E63FF]">
                            {isAr ? stage.ar : stage.en}
                          </span>
                        ))}
                      </div>
                      <p className="text-[12px] font-bold text-slate-500">{isAr ? sampleMediaState.explanatoryCopy.ar : sampleMediaState.explanatoryCopy.en}</p>
                    </div>
                  </Link> : (
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                      <LayoutGrid className="mx-auto h-7 w-7 text-slate-400" />
                      <p className="mt-3 text-sm font-black text-slate-800">{isAr ? 'لا توجد حزمة منشور فعلية بعد' : 'No real post package yet'}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{isAr ? 'اختر حملة معتمدة وأنشئ خطة المحتوى؛ لن يعرض NEXUS أصلًا وهميًا مكانها.' : 'Choose an approved campaign and build its content plan; NEXUS will not show a placeholder asset as real work.'}</p>
                      <Link href={latestCampaign ? `/campaigns/${latestCampaign.id}` : '/strategy'} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">
                        {latestCampaign ? (isAr ? 'فتح الحملة' : 'Open campaign') : (isAr ? 'إنشاء استراتيجية' : 'Create strategy')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </SoftPanel>

                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-4 text-right">
                    <p className="text-[12px] font-bold text-slate-500">{isAr ? 'المنصات المستهدفة' : 'Target platforms'}</p>
                    <h2 className="text-[17px] font-black text-[#0B1028]">{isAr ? 'تجهيزات الصيغ' : 'Format readiness'}</h2>
                  </div>
                  <div className="space-y-3">
                    {platformRows.map(row => {
                      const pct = row.count ? Math.round((row.ready / row.count) * 100) : 0
                      return (
                        <div key={row.platform} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
                          <PlatformMark platform={row.platform} />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black text-[#0B1028]">{row.platform}</p>
                            <p className="text-[11px] text-slate-500">{row.count ? `${row.count} ${isAr ? 'عنصر' : 'items'}` : (isAr ? 'لا توجد عناصر بعد' : 'No items yet')}</p>
                          </div>
                          <CheckCircle2 className={`h-4 w-4 ${pct > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                        </div>
                      )
                    })}
                    {platformRows.length === 0 && (
                      <div className="rounded-[16px] bg-slate-50 px-4 py-5 text-center text-[12px] font-bold text-slate-500">
                        {isAr ? 'ستظهر جاهزية الصيغ بعد إنشاء خطة محتوى مرتبطة بمنصات الحملة.' : 'Format readiness appears after a content plan is created for the campaign platforms.'}
                      </div>
                    )}
                  </div>
                </SoftPanel>
              </div>

              {/* Duplicate copy, CTA, studio, and asset modules were removed from the rendered overview.
                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-3 flex items-center justify-between">
                    <Link href={samplePost ? `/campaigns/${samplePost.campaignId}/content-hub` : latestCampaignContentHref} className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض المنشورات' : 'View posts'}</Link>
                    <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'خيارات النص (Copy)' : 'Copy options'}</h2>
                  </div>
                  <div className="space-y-2">
                    {(filteredPosts.length ? filteredPosts.slice(0, 3) : [{ id: 'empty-1', caption: '', campaignName: '', campaignId: '', platform: 'META' } as SocialPostRecord]).map((post, index) => (
                      <div key={`${post.id}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-bold text-slate-400">{isAr ? `نسخة ${index + 1}` : `Version ${index + 1}`}</p>
                        <p className="mt-1 text-[12px] font-semibold leading-5 text-[#0B1028]">{safeSnippet(post.caption, isAr ? 'لم يتم توليد نص بعد.' : 'No copy generated yet.')}</p>
                      </div>
                    ))}
                  </div>
                  <Link href={samplePost ? `/campaigns/${samplePost.campaignId}/content-hub` : latestCampaignContentHref} className="mt-4 inline-flex w-full items-center justify-center gap-2 text-[12px] font-black text-[#5E63FF]">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {isAr ? 'راجع النسخ داخل المنشور' : 'Review copy inside the post'}
                  </Link>
                </SoftPanel>

                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-3 flex items-center justify-between">
                    <Link href={latestCampaignStrategyHref} className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض منطق CTA' : 'View CTA logic'}</Link>
                    <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'خيارات CTA' : 'CTA options'}</h2>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[12px] font-black text-[#0B1028]">
                      {isAr ? 'تُراجع الدعوة للإجراء داخل كل منشور' : 'CTA is reviewed per post'}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                      {isAr
                        ? 'لا يفترض NEXUS دعوة عامة هنا؛ النص النهائي يجب أن يأتي من استراتيجية الحملة وحزمة المنشور.'
                        : 'NEXUS does not assume a generic CTA here; final wording must come from campaign strategy and the post package.'}
                    </p>
                  </div>
                  <Link href={latestCampaignStrategyHref} className="mt-4 inline-flex w-full items-center justify-center gap-2 text-[12px] font-black text-[#5E63FF]">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {isAr ? 'راجع CTA في الاستراتيجية' : 'Review CTA in strategy'}
                  </Link>
                </SoftPanel>

                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-3 flex items-center justify-between">
                    <Link href="/studio" className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض الكل' : 'View all'}</Link>
                    <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'استوديو الإبداع' : 'Creative Studio'}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(index => {
                      const post = visualPosts[index]
                      return (
                        <Link key={index} href={post ? `/campaigns/${post.campaignId}/content-hub` : '/studio'} className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <MediaThumb src={post?.imageUrl} label={post?.campaignName || 'Creative slot'} />
                        </Link>
                      )
                    })}
                  </div>
                  <Link href="/studio" className="mt-4 inline-flex w-full items-center justify-center gap-2 text-[12px] font-black text-[#5E63FF]">
                    <Plus className="h-3.5 w-3.5" />
                    {isAr ? 'فتح الاستوديو' : 'Open studio'}
                  </Link>
                </SoftPanel>

                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-3 flex items-center justify-between">
                    <Link href="/media" className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض جميع الأصول' : 'View all assets'}</Link>
                    <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'مكتبة الأصول (المصدر الرسمي)' : 'Official asset library'}</h2>
                  </div>
                  <div className="mb-3 flex flex-wrap justify-end gap-2">
                    {[isAr ? 'الكل' : 'All', isAr ? 'صور' : 'Images', isAr ? 'فيديو' : 'Video', isAr ? 'تصاميم' : 'Designs', isAr ? 'مستندات' : 'Docs'].map((item, index) => (
                      <span key={item} className={`rounded-full px-3 py-1 text-[11px] font-bold ${index === 0 ? toneClasses.violet : 'bg-slate-50 text-slate-500'}`}>{item}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(index => {
                      const asset = media[index]
                      const isImage = asset?.type === 'IMAGE' || asset?.mimeType?.startsWith('image/')
                      return (
                        <Link key={asset?.id ?? index} href="/media" className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {asset && isImage ? <MediaThumb src={asset.url} label={asset.fileName} /> : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                              {asset?.type === 'VIDEO' ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                              <span className="text-[9px] font-black">{asset ? asset.type : 'ASSET'}</span>
                            </div>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </SoftPanel>
              */}
            </div>

            {/* Duplicate summary, progress, and operating-boundary modules were removed from the rendered overview.
              <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'ملخص المحتوى' : 'Content summary'}</h2>
                <p className="mt-1 text-[11px] font-bold text-slate-400">{isAr ? 'لقطة مساحة العمل الحالية' : 'Current workspace snapshot'}</p>
                <div className="mt-4 space-y-3">
                  {[
                    { label: isAr ? 'إجمالي المحتويات' : 'Total content', value: stats.total, tone: 'green' as Tone },
                    { label: isAr ? 'موافق عليه' : 'Approved', value: stats.approved, tone: 'green' as Tone },
                    { label: isAr ? 'منشور' : 'Published', value: stats.published, tone: 'green' as Tone },
                    { label: isAr ? 'مطلوب مراجعة' : 'Needs review', value: stats.needsReview, tone: 'amber' as Tone },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-slate-500">{item.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${toneClasses[item.tone]}`} dir="ltr">{item.value}</span>
                    </div>
                  ))}
                </div>
              </SoftPanel>

              <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'تقدم الإنتاج' : 'Production progress'}</h2>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-400">
                  {isAr ? 'محسوب من اكتمال النص والوسائط والمراجعة فقط، وليس جاهزية حسابات النشر.' : 'Based on copy, media, and review state only; not publishing-account readiness.'}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(#5E63FF ${stats.productionProgress * 3.6}deg, #E9EDF7 0deg)` }}
                  >
                    <div className="absolute inset-2 rounded-full bg-white" />
                    <div className="relative text-center">
                      <p className="text-[24px] font-black text-[#0B1028]" dir="ltr">{stats.productionProgress}%</p>
                      <p className="text-[10px] font-bold text-slate-500">{isAr ? 'إنتاج' : 'Production'}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                    <p>{isAr ? 'نص مكتمل' : 'Copy complete'} <span dir="ltr">{stats.copyReady}/{stats.total}</span></p>
                    <p>{isAr ? 'وسائط مؤكدة' : 'Confirmed media'} <span dir="ltr">{stats.mediaReady}/{stats.total}</span></p>
                    <p>{isAr ? 'تمت مراجعته' : 'Reviewed'} <span dir="ltr">{stats.reviewed}/{stats.total}</span></p>
                    <p>{isAr ? 'منصة محددة' : 'Platform assigned'} <span dir="ltr">{stats.platformAssigned}/{stats.total}</span></p>
                  </div>
                </div>
                <Link href={latestCampaignPublishHref} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-[12px] font-black text-[#5E63FF]">
                  {isAr ? 'تحقق من جاهزية النشر الفعلية' : 'Check actual publishing readiness'}
                </Link>
              </SoftPanel>

              <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="mb-3 flex items-center justify-between">
                  <Link href="/campaigns" className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض الحملات' : 'View campaigns'}</Link>
                  <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'حدود التشغيل' : 'Operating boundaries'}</h2>
                </div>
                <div className="space-y-3">
                  {[
                    isAr ? 'الاستراتيجية تحدد الوعد والنطاق؛ مركز المحتوى لا يعيد اختراعهما.' : 'Strategy owns the promise and scope; Content Hub does not reinvent them.',
                    isAr ? 'هنا تتم مراجعة حزمة المنشور النهائية وربط وسائطه بتأكيد صريح.' : 'Final post packages and media are reviewed here with explicit confirmation.',
                    isAr ? 'الحسابات والصلاحيات والجدولة تُفحص في جاهزية النشر قبل التنفيذ.' : 'Accounts, permissions, and scheduling are checked in publishing readiness before execution.',
                  ].map((note, index) => (
                    <div key={note} className="grid grid-cols-[32px_1fr] items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF] text-[10px] font-black text-[#5E63FF]">{index + 1}</span>
                      <p className="text-[12px] font-semibold leading-5 text-slate-600">{note}</p>
                    </div>
                  ))}
                </div>
              </SoftPanel>
            */}
          </div>

          <details className="nx-os-card group p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-black text-[#0B1028]">
              <span>{isAr ? 'أدوات إنتاج اختيارية' : 'Optional production tools'}</span>
              <span className="text-[11px] font-bold text-slate-400 group-open:hidden">
                {isAr ? 'افتح عند الحاجة فقط' : 'Open only when needed'}
              </span>
            </summary>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">
              {isAr
                ? 'هذه أدوات مساعدة داخل إنتاج المحتوى، وليست مراحل إضافية ولا تغيّر حالة أي منشور تلقائياً.'
                : 'These are supporting tools inside Content production, not extra workflow stages, and they never change a post automatically.'}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href="/media" className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#C7D2FE] hover:bg-[#F8F9FF]">
                <p className="text-[12px] font-black text-[#0B1028]">{isAr ? 'مكتبة الأصول' : 'Asset library'}</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                  {isAr ? 'ارفع الأصول وراجع الحقوق، ثم اربط الأصل من حزمة المنشور.' : 'Upload assets and review rights, then attach from the post package.'}
                </p>
              </Link>
              <Link href="/studio" className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#C7D2FE] hover:bg-[#F8F9FF]">
                <p className="text-[12px] font-black text-[#0B1028]">{isAr ? 'معاينة الاتجاه الإبداعي' : 'Creative direction preview'}</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                  {isAr ? 'معاينة فقط؛ التوليد والربط النهائيان يبدآن من منشور محدد.' : 'Preview only; final generation and attachment start from a specific post.'}
                </p>
              </Link>
            </div>
          </details>

        </div>
      </div>
    </AppShell>
  )
}
