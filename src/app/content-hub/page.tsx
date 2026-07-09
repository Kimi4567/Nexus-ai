'use client'

import AppShell from '@/components/AppShell'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import { useI18n } from '@/lib/i18n-context'
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Search,
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
      className={`rounded-[20px] border border-slate-200/80 bg-white/92 shadow-[0_14px_42px_rgba(15,23,42,0.055)] ${className}`}
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
  const { authHeader, isAuthenticated, loading: authLoading, user } = useAuth()
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
    const approved = posts.filter(post => ['APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(String(post.status || '').toUpperCase())).length
    const scheduled = posts.filter(post => String(post.status || '').toUpperCase() === 'SCHEDULED' && post.scheduledAt).length
    const published = posts.filter(post => String(post.status || '').toUpperCase() === 'PUBLISHED').length
    const mediaReady = posts.filter(post => String(post.generationStatus || '').toUpperCase() === 'DONE' && Boolean(post.imageUrl || post.uploadedMediaId)).length
    const needsReview = posts.filter(post => ['DRAFT', 'APPROVED'].includes(String(post.status || 'DRAFT').toUpperCase())).length
    const inCreation = posts.filter(post => String(post.status || 'DRAFT').toUpperCase() === 'DRAFT').length
    const inReview = Math.max(0, needsReview - approved)
    const readyForPublishReview = Math.max(0, scheduled + posts.filter(post => String(post.status || '').toUpperCase() === 'APPROVED').length)
    const readiness = total === 0 ? 0 : Math.round(((approved * 0.28) + (mediaReady * 0.36) + (scheduled * 0.22) + (published * 0.14)) / Math.max(total, 1) * 100)

    return {
      total,
      approved,
      scheduled,
      published,
      mediaReady,
      needsReview,
      inCreation,
      inReview,
      readyForPublishReview,
      readiness: Math.max(0, Math.min(100, readiness)),
    }
  }, [posts])

  const filteredPosts = useMemo(() => {
    if (activeFormat === 'all') return posts
    return posts.filter(post => {
      const platform = String(post.platform || '').toUpperCase()
      const caption = String(post.caption || '').toLowerCase()
      if (activeFormat === 'videos') return Boolean(post.isVideoPost)
      if (activeFormat === 'posts') return !post.isVideoPost
      if (activeFormat === 'reels') return Boolean(post.isVideoPost) && (platform.includes('TIKTOK') || platform.includes('INSTAGRAM') || platform.includes('YOUTUBE'))
      if (activeFormat === 'stories') return platform.includes('INSTAGRAM') && (caption.includes('story') || caption.includes('قصة'))
      if (activeFormat === 'ads') return platform.includes('META') || platform.includes('FACEBOOK') || platform.includes('GOOGLE')
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
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const mediaGeneratedText = isAr ? 'وسائط مولّدة' : 'Media generated'
  const mediaGeneratedHelper = isAr ? 'هذه حالة وسائط فقط وليست نشرًا.' : 'media generated only, not published.'

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
    { key: 'ads', label: isAr ? 'إعلانات' : 'Ads' },
    { key: 'posts', label: isAr ? 'منشورات' : 'Posts' },
    { key: 'reels', label: isAr ? 'ريلز' : 'Reels' },
    { key: 'stories', label: isAr ? 'قصص' : 'Stories' },
    { key: 'videos', label: isAr ? 'فيديوهات' : 'Videos' },
    { key: 'presentations', label: isAr ? 'عروض تقديمية' : 'Presentations', disabled: true },
    { key: 'email', label: isAr ? 'بريد إلكتروني' : 'Email', disabled: true },
  ]

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB]">
          <div className="rounded-[24px] border border-slate-200 bg-white px-7 py-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#5E63FF]" />
            <p className="mt-3 text-[13px] font-bold text-slate-500">{isAr ? 'جار تجهيز مركز المحتوى...' : 'Preparing Content Hub...'}</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#F4F7FB] text-[#0B1028]">
        <div className="mx-auto flex w-full max-w-[1620px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-7">
          <header dir="ltr" className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#101A4D] text-white shadow-[0_16px_34px_rgba(16,26,77,0.20)]">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div dir={isAr ? 'rtl' : 'ltr'}>
                <p className="text-[12px] font-semibold text-slate-500">{isAr ? 'مساحة الإنتاج' : 'Production workspace'}</p>
                <h1 className="text-[18px] font-black tracking-normal text-[#0B1028]">
                  {isAr ? 'مركز إنتاج المحتوى' : 'Content Production Hub'}
                </h1>
              </div>
              <Link href="/campaigns" aria-label={isAr ? 'العودة إلى محفظة الحملات' : 'Back to campaign portfolio'} className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 md:flex">
                <ChevronDown className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl lg:flex-row lg:items-center lg:justify-end">
              <div className="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-slate-400 lg:w-[360px]">
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate text-[13px]" dir={isAr ? 'rtl' : 'ltr'}>{isAr ? 'ابحث في Nexus...' : 'Search in Nexus...'}</span>
                <span className="ms-auto rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] text-slate-400">⌘K</span>
              </div>
              <Link href={latestCampaignContentHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-[#101A4D]">
                <Eye className="h-4 w-4" />
                {isAr ? 'مراجعة الإنتاج' : 'Review production'}
              </Link>
              <Link href="/campaigns" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#5E63FF]">
                <Sparkles className="h-4 w-4" />
              </Link>
              <Link href="/analytics" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                <Bell className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2FF] text-[13px] font-black text-[#5E63FF]">
                  {(displayName || 'N').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[#0B1028]">
                    {displayName ? (isAr ? `مرحباً ${displayName}` : `Hi, ${displayName}`) : (isAr ? 'مرحباً' : 'Welcome')}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{isAr ? 'مدير النمو' : 'Growth operator'}</p>
                </div>
              </div>
            </div>
          </header>

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

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
              {[
                { icon: <Sparkles className="h-4 w-4" />, title: isAr ? 'أفكار معتمدة' : 'Approved ideas', value: campaigns.length, tone: 'amber' as Tone },
                { icon: <Pencil className="h-4 w-4" />, title: isAr ? 'قيد الإنشاء' : 'In creation', value: stats.inCreation, tone: 'violet' as Tone },
                { icon: <Eye className="h-4 w-4" />, title: isAr ? 'قيد المراجعة' : 'In review', value: stats.inReview, tone: 'amber' as Tone },
                { icon: <CheckCircle2 className="h-4 w-4" />, title: isAr ? 'موافق عليه' : 'Approved', value: stats.approved, tone: 'green' as Tone },
                { icon: <Send className="h-4 w-4" />, title: isAr ? 'جاهز لمراجعة النشر' : 'Ready for publish review', value: stats.readyForPublishReview, tone: 'green' as Tone },
                { icon: <BarChart3 className="h-4 w-4" />, title: isAr ? 'منشور' : 'Published', value: stats.published, tone: 'blue' as Tone },
              ].map((stage, index, list) => (
                <div key={stage.title} className="contents">
                  <div className="flex min-h-[72px] items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                    <MiniIcon tone={stage.tone}>{stage.icon}</MiniIcon>
                    <div className="min-w-0 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                      <p className="truncate text-[12px] font-bold text-slate-600">{stage.title}</p>
                      <p className="mt-1 text-[20px] font-black text-[#0B1028]" dir="ltr">{stage.value}</p>
                    </div>
                  </div>
                  {index < list.length - 1 && <div className="hidden items-center justify-center text-slate-300 xl:flex">•••</div>}
                </div>
              ))}
            </div>
          </SoftPanel>

          <SoftPanel className="flex flex-wrap items-center justify-end gap-2 p-3" dir="rtl">
            {formatChips.map(chip => (
              <button
                type="button"
                key={chip.key}
                disabled={Boolean(chip.disabled)}
                aria-pressed={activeFormat === chip.key}
                onClick={() => {
                  if (!chip.disabled) setActiveFormat(chip.key)
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-[12px] font-bold transition ${
                  activeFormat === chip.key ? 'border-[#5E63FF]/25 bg-[#F2F4FF] text-[#5E63FF]' : 'border-slate-200 bg-white text-slate-600'
                } ${chip.disabled ? 'cursor-not-allowed opacity-45' : 'hover:border-[#5E63FF]/30 hover:text-[#5E63FF]'}`}
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
                        {mediaGeneratedText}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex -space-x-2 rtl:space-x-reverse">
                        {[0, 1, 2].map(item => (
                          <span key={item} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#EEF2FF] text-[10px] font-black text-[#5E63FF]">N</span>
                        ))}
                      </div>
                      <p className="text-[12px] font-bold text-slate-500">{mediaGeneratedHelper}</p>
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
                  <div className="space-y-2">
                    {(isAr ? ['تسوّق الآن', 'اكتشف المجموعة', 'احجز استشارة'] : ['Shop now', 'Explore collection', 'Book a consultation']).map(item => (
                      <div key={item} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <span className="text-[12px] font-black text-[#0B1028]">{item}</span>
                        <ArrowUpRight className="h-4 w-4 text-[#5E63FF]" />
                      </div>
                    ))}
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
                <p className="mt-1 text-[11px] font-bold text-slate-400">{isAr ? 'آخر 7 أيام' : 'Last 7 days'}</p>
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
                <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'جاهزية النشر' : 'Publishing readiness'}</h2>
                <div className="mt-4 flex items-center gap-4">
                  <div
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(#5E63FF ${stats.readiness * 3.6}deg, #E9EDF7 0deg)` }}
                  >
                    <div className="absolute inset-2 rounded-full bg-white" />
                    <div className="relative text-center">
                      <p className="text-[24px] font-black text-[#0B1028]" dir="ltr">{stats.readiness}%</p>
                      <p className="text-[10px] font-bold text-slate-500">{isAr ? 'جاهزية' : 'Ready'}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-[12px] font-semibold text-slate-600">
                    <p>{isAr ? 'النصوص' : 'Copy'} <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500" /></p>
                    <p>{isAr ? 'الصور' : 'Media'} <CheckCircle2 className={`inline h-3.5 w-3.5 ${stats.mediaReady > 0 ? 'text-emerald-500' : 'text-slate-300'}`} /></p>
                    <p>{isAr ? 'المقاسات' : 'Formats'} <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500" /></p>
                    <p>{isAr ? 'التحسين' : 'Optimization'} <span className="text-amber-500">△</span></p>
                  </div>
                </div>
                <Link href={latestCampaignPublishHref} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-[12px] font-black text-[#5E63FF]">
                  {isAr ? 'عرض التفاصيل' : 'View details'}
                </Link>
              </SoftPanel>

              <SoftPanel className="p-4" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="mb-3 flex items-center justify-between">
                  <Link href="/campaigns" className="text-[12px] font-bold text-[#5E63FF]">{isAr ? 'عرض الكل' : 'View all'}</Link>
                  <h2 className="text-[15px] font-black text-[#0B1028]">{isAr ? 'ملاحظات المراجعين' : 'Reviewer notes'}</h2>
                </div>
                <div className="space-y-3">
                  {[
                    isAr ? 'مراجعة الوسائط قبل النشر.' : 'Review media before publishing.',
                    isAr ? 'لا توجد بيانات أداء منشورة بعد.' : 'No published performance data yet.',
                    isAr ? 'الأصول النهائية ترتبط من Content Hub فقط.' : 'Final assets attach from Content Hub only.',
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
