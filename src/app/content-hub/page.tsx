'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import { useI18n } from '@/lib/i18n-context'
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Users,
  Video,
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
  status?: string | null
  publishedAt?: string | null
  manuallyPublishedAt?: string | null
  platformUrl?: string | null
}

interface MediaRecord {
  id: string
  fileName: string
  type: string
  mimeType?: string | null
  url: string
  createdAt?: string
}

interface CampaignsResponse {
  campaigns?: CampaignRecord[]
}

interface ContentPlanResponse {
  posts?: Omit<SocialPostRecord, 'campaignId' | 'campaignName'>[]
}

interface MediaResponse {
  media?: MediaRecord[]
}

type Tone = 'blue' | 'violet' | 'amber' | 'green' | 'slate' | 'rose'

const toneClasses: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-[#EEF2FF] text-[#5E63FF]',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-500',
  rose: 'bg-rose-50 text-rose-600',
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

function MiniIcon({ children, tone = 'violet' }: { children: React.ReactNode; tone?: Tone }) {
  return <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{children}</div>
}

function ProgressLine({ value, color = '#5E63FF' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, value))}%`, background: color }} />
    </div>
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
  const [media, setMedia] = useState<MediaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFormat, setActiveFormat] = useState('all')

  const loadBoard = useCallback(async () => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const [campaignRes, mediaRes] = await Promise.all([
        fetch('/api/campaigns?limit=20&sort=updatedAt', { headers: { Authorization: token } }),
        fetch('/api/media?limit=8', { headers: { Authorization: token } }),
      ])

      if (!campaignRes.ok) throw new Error(isAr ? 'تعذر تحميل الحملات' : 'Failed to load campaigns')

      const campaignData = (await campaignRes.json()) as CampaignsResponse
      const campaignList = campaignData.campaigns ?? []
      setCampaigns(campaignList)

      if (mediaRes.ok) {
        const mediaData = (await mediaRes.json()) as MediaResponse
        setMedia(mediaData.media ?? [])
      } else {
        setMedia([])
      }

      const planResults = await Promise.allSettled(
        campaignList.slice(0, 12).map(async campaign => {
          const res = await fetch(`/api/campaigns/${campaign.id}/content-plan`, {
            headers: { Authorization: token },
          })
          if (!res.ok) return []
          const data = (await res.json()) as ContentPlanResponse
          return (data.posts ?? []).map(post => ({
            ...post,
            campaignId: campaign.id,
            campaignName: campaign.name,
          }))
        }),
      )

      setPosts(planResults.flatMap(result => result.status === 'fulfilled' ? result.value : []))
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
    const approved = posts.filter(post => String(post.status || '').toUpperCase() === 'APPROVED').length
    const scheduled = posts.filter(post => String(post.status || '').toUpperCase() === 'SCHEDULED' && post.scheduledAt).length
    const published = posts.filter(post => String(post.status || '').toUpperCase() === 'PUBLISHED').length
    const mediaReady = posts.filter(post => String(post.generationStatus || '').toUpperCase() === 'DONE' && Boolean(post.imageUrl || post.uploadedMediaId)).length
    const copyReady = posts.filter(post => Boolean(String(post.caption || '').trim())).length
    const platformAssigned = posts.filter(post => Boolean(String(post.platform || '').trim())).length
    const drafts = posts.filter(post => String(post.status || 'DRAFT').toUpperCase() === 'DRAFT').length
    const needsReview = drafts
    const reviewed = approved + scheduled + published
    const productionProgress = total === 0
      ? 0
      : Math.round(((copyReady + mediaReady + reviewed) / (total * 3)) * 100)

    return {
      total,
      approved,
      scheduled,
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
  const latestCampaignStrategyHref = latestCampaign ? `/campaigns/${latestCampaign.id}?tab=strategy` : '/strategy'
  const latestCampaignContentHref = latestCampaign ? `/campaigns/${latestCampaign.id}/content-hub` : '/content-hub'
  const latestCampaignPublishHref = latestCampaign ? `/campaigns/${latestCampaign.id}?tab=publish` : '/publish'
  const samplePost = filteredPosts.find(post => post.imageUrl) ?? filteredPosts[0] ?? posts.find(post => post.imageUrl) ?? posts[0]
  const recentPosts = filteredPosts.slice(0, 5)
  const visualPosts = filteredPosts.filter(post => post.imageUrl).slice(0, 4)
  const sampleMediaState = (() => {
    if (!samplePost?.imageUrl) {
      return {
        label: isAr ? 'لا توجد وسائط مرفقة' : 'No media attached',
        helper: isAr ? 'المعاينة نصية فقط ولم يحدث نشر.' : 'Text-only preview; nothing has been published.',
      }
    }

    const source = String(samplePost.mediaSource || '').toUpperCase()
    if (source === 'GENERATE') {
      return {
        label: isAr ? 'خلفية مولّدة للمراجعة' : 'Generated review background',
        helper: isAr ? 'أصل بصري للمراجعة فقط، وليس إعلانًا نهائيًا أو نشرًا.' : 'A review asset only, not final creative or a publish event.',
      }
    }
    if (samplePost.uploadedMediaId || source === 'UPLOAD' || source === 'UPLOADED') {
      return {
        label: isAr ? 'أصل مرفوع ومرفق' : 'Attached uploaded asset',
        helper: isAr ? 'مرفق بمعاينة المنشور فقط ولم يتم نشره.' : 'Attached to the post preview only; not published.',
      }
    }
    return {
      label: isAr ? 'وسائط المنشور' : 'Post media',
      helper: isAr ? 'وسائط مرتبطة بالمنشور؛ حالة النشر منفصلة.' : 'Media linked to this post; publishing is a separate state.',
    }
  })()

  const platformRows = useMemo(() => {
    const map = new Map<string, { platform: string; count: number; ready: number }>()
    posts.forEach(post => {
      const key = String(post.platform || 'UNKNOWN').toUpperCase()
      const row = map.get(key) ?? { platform: key, count: 0, ready: 0 }
      row.count += 1
      if (String(post.generationStatus || '').toUpperCase() === 'DONE') row.ready += 1
      map.set(key, row)
    })
    return Array.from(map.values()).slice(0, 5)
  }, [posts])

  const campaignSummary = campaigns[0] ? getCampaignPlatformSummary(campaigns[0].platforms ?? [], locale) : null
  const formatChips = [
    { key: 'all', label: isAr ? 'الكل' : 'All' },
    { key: 'posts', label: isAr ? 'منشورات ثابتة' : 'Static posts' },
    { key: 'videos', label: isAr ? 'منشورات فيديو' : 'Video posts' },
  ]

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="nx-os-page flex min-h-screen items-center justify-center">
          <div className="nx-os-card px-7 py-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#5E63FF]" />
            <p className="mt-3 text-[13px] font-bold text-slate-500">{isAr ? 'جار تجهيز مركز المحتوى...' : 'Preparing Content Hub...'}</p>
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
            pageTitle={isAr ? 'مركز إنتاج المحتوى' : 'Content Production Hub'}
            pageSubtitle={isAr ? 'حوّل الاستراتيجية إلى منشورات ووسائط قابلة للمراجعة قبل النشر.' : 'Turn strategy into reviewable posts and media before publishing.'}
            primaryHref={latestCampaignContentHref}
            primaryLabel={isAr ? 'مراجعة الإنتاج' : 'Review production'}
            secondaryHref="/campaigns"
            secondaryLabel={isAr ? 'محفظة الحملات' : 'Campaign portfolio'}
          />

          {error && (
            <SoftPanel className="p-4 text-[13px] font-bold text-rose-600" dir={isAr ? 'rtl' : 'ltr'}>
              {error}
            </SoftPanel>
          )}

          <StrategySpineCard
            current="content"
            nextHref={latestCampaignContentHref}
            nextLabel={isAr ? 'افتح إنتاج الحملة الأحدث' : 'Open latest campaign production'}
            title={isAr ? 'مركز المحتوى هو طبقة الإنتاج بعد الاستراتيجية' : 'Content Hub is the production layer after strategy'}
            body={
              isAr
                ? 'هنا تتحول الاستراتيجية إلى منشورات ووسائط للمراجعة. هذه الصفحة لا تنشر ولا تتعلم من الأداء ولا تغيّر وعد الحملة؛ Content Hub يحافظ على الحقيقة النهائية للمنشور قبل أي نشر.'
                : 'Here strategy becomes posts and media for review. This page does not publish, learn from performance, or change the campaign promise; Content Hub preserves final post truth before publishing.'
            }
          />

          <SoftPanel className="overflow-hidden p-4" dir="ltr">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Link href="/campaigns" className="inline-flex items-center gap-2 text-[12px] font-bold text-[#5E63FF]">
                <ChevronDown className="h-3.5 w-3.5" />
                {isAr ? 'محفظة الحملات تحدد المسار؛ هنا يتم إنتاج المنشورات' : 'Campaign portfolio chooses the path; this page produces the posts'}
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={latestCampaignPublishHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#5E63FF]">
                  <Sparkles className="h-4 w-4" />
                  {isAr ? 'جاهزية النشر' : 'Publishing readiness'}
                </Link>
                <Link href={latestCampaignStrategyHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-[12px] font-black text-white shadow-[0_16px_34px_rgba(16,26,77,0.16)]">
                  <ArrowUpRight className="h-4 w-4" />
                  {isAr ? 'ابدأ من الاستراتيجية' : 'Start from strategy'}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { icon: <Sparkles className="h-4 w-4" />, title: isAr ? 'مسارات حملات' : 'Campaign workstreams', value: campaigns.length, tone: 'blue' as Tone },
                { icon: <Pencil className="h-4 w-4" />, title: isAr ? 'مسودات منشورات' : 'Post drafts', value: stats.drafts, tone: 'violet' as Tone },
                { icon: <CheckCircle2 className="h-4 w-4" />, title: isAr ? 'موافق عليه' : 'Approved', value: stats.approved, tone: 'green' as Tone },
                { icon: <Send className="h-4 w-4" />, title: isAr ? 'مجدول' : 'Scheduled', value: stats.scheduled, tone: 'green' as Tone },
                { icon: <BarChart3 className="h-4 w-4" />, title: isAr ? 'منشور' : 'Published', value: stats.published, tone: 'blue' as Tone },
                { icon: <ImageIcon className="h-4 w-4" />, title: isAr ? 'وسائط جاهزة' : 'Media ready', value: stats.mediaReady, tone: 'blue' as Tone },
              ].map(stage => (
                <div key={stage.title} className="flex min-h-[72px] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <MiniIcon tone={stage.tone}>{stage.icon}</MiniIcon>
                  <div className="min-w-0 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                    <p className="line-clamp-2 text-[11px] font-bold leading-4 text-slate-600">{stage.title}</p>
                    <p className="mt-1 text-[19px] font-black text-[#0B1028]" dir="ltr">{stage.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </SoftPanel>

          <SoftPanel className="flex flex-wrap items-center justify-end gap-2 p-3" dir="rtl">
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

          <div dir="ltr" className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.25fr_1fr]">
                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-4 flex items-center justify-between">
                    <Link href="/campaigns" className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض الكل' : 'View all'}</Link>
                    <div className="text-right">
                      <p className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'قائمة الموافقات' : 'Approvals queue'}</p>
                      <h2 className="text-[17px] font-black text-[#0B1028]">{isAr ? 'طلبات تحتاج مراجعة' : 'Review queue'}</h2>
                    </div>
                    <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[12px] font-black text-[#5E63FF]" dir="ltr">{stats.needsReview}</span>
                  </div>
                  <div className="space-y-2.5">
                    {(recentPosts.length ? recentPosts : posts.slice(0, 3)).slice(0, 3).map((post, index) => (
                      <Link
                        key={post.id}
                        href={`/campaigns/${post.campaignId}/content-hub`}
                        className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-[16px] bg-slate-50 px-3 py-2.5"
                      >
                        <div className="h-10 w-10 overflow-hidden rounded-xl">
                          <MediaThumb src={post.imageUrl} label={post.campaignName} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-[#0B1028]">{safeSnippet(post.caption, post.campaignName)}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-500">{post.isVideoPost ? (isAr ? 'فيديو قصير' : 'Short video') : (isAr ? 'منشور / صورة' : 'Post / image')} · {post.campaignName}</p>
                        </div>
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${index === 0 ? toneClasses.amber : toneClasses.violet}`}>
                          {isAr ? 'مراجعة' : 'Review'}
                        </span>
                      </Link>
                    ))}
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
                      <h2 className="text-[17px] font-black text-[#0B1028]">{samplePost ? safeSnippet(samplePost.caption, isAr ? 'مسودة محتوى' : 'Content draft') : (isAr ? 'لا توجد عينة بعد' : 'No sample yet')}</h2>
                    </div>
                  </div>
                  <Link href={samplePost ? `/campaigns/${samplePost.campaignId}/content-hub` : '/strategy'} className="block overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50">
                    <div className="relative aspect-[16/7] overflow-hidden">
                      <MediaThumb src={samplePost?.imageUrl} label={samplePost?.campaignName || 'Content sample'} />
                      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-600">
                        {samplePost?.isVideoPost ? (isAr ? 'فيديو' : 'Video') : (isAr ? 'صورة / منشور' : 'Post asset')}
                      </div>
                      <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-[#5E63FF]">
                        {sampleMediaState.label}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex -space-x-2 rtl:space-x-reverse">
                        {[0, 1, 2].map(item => (
                          <span key={item} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#EEF2FF] text-[10px] font-black text-[#5E63FF]">N</span>
                        ))}
                      </div>
                      <p className="text-[12px] font-bold text-slate-500">{sampleMediaState.helper}</p>
                    </div>
                  </Link>
                </SoftPanel>

                <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="mb-4 text-right">
                    <p className="text-[12px] font-bold text-slate-500">{isAr ? 'المنصات المستهدفة' : 'Target platforms'}</p>
                    <h2 className="text-[17px] font-black text-[#0B1028]">{isAr ? 'تجهيزات الصيغ' : 'Format readiness'}</h2>
                  </div>
                  <div className="space-y-3">
                    {(platformRows.length ? platformRows : [{ platform: 'META', count: 0, ready: 0 }, { platform: 'TIKTOK', count: 0, ready: 0 }, { platform: 'LINKEDIN', count: 0, ready: 0 }]).map(row => {
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
                  </div>
                </SoftPanel>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_0.65fr_0.9fr_1.2fr]">
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
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
