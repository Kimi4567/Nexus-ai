'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Link2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from 'lucide-react'

interface ConnectedAccount {
  id: string
  platform: string
  status: string
  accountName: string
  pages: Array<{ id: string; name: string; igAccountId: string | null }>
  organizations?: Array<{ id: string; name: string }>
  boards?: Array<{ id: string; name: string; privacy?: string | null }>
  selectedOrganizationId?: string | null
  scopes?: string[]
  expiresAt?: string | null
  refreshExpiresAt?: string | null
  lastSyncedAt?: string | null
  channelUrl?: string | null
  profileUrl?: string | null
  accessTier?: 'TRIAL' | 'STANDARD' | 'DEVELOPMENT' | 'LIVE' | null
  capabilities?: {
    facebookPublishing?: boolean
    instagramPublishing?: boolean
    linkedInMemberPublishing?: boolean
    linkedInOrganizationPublishing?: boolean
    tikTokDirectPosting?: boolean
    tikTokCreatorInfoVerified?: boolean
    youtubeVideoPublishing?: boolean
    youtubeReadback?: boolean
    xPublishing?: boolean
    xMediaPublishing?: boolean
    xReadback?: boolean
    pinterestPinPublishing?: boolean
    pinterestReadback?: boolean
    pinterestBoardSelection?: boolean
    pinterestPublicPublishing?: boolean
    threadsPostPublishing?: boolean
    threadsReadback?: boolean
    threadsPublicPublishing?: boolean
    tokenRefresh?: boolean
  }
  connectedAt: string
}

interface ConnectedAdAccount {
  id: string
  platform: string
  status: string
  platformAccountId: string
  platformAccountName: string | null
  businessName: string | null
  hasApiAccess: boolean
  pageId: string | null
  pageName: string | null
  apiAccessTier?: 'NONE' | 'TEST' | 'EXPLORER' | 'BASIC' | 'STANDARD' | null
  loginCustomerId?: string | null
  lastError?: string | null
}

interface GoogleAdsConnectionState {
  id: string
  platform: 'GOOGLE'
  status: string
  accountId: string | null
  accountName: string | null
  connectionRole: 'MANAGER' | 'ADVERTISER' | 'UNKNOWN'
  advertiserAccountCount: number
  advertiserReadiness: 'DISCOVERED' | 'NOT_VISIBLE' | 'UNKNOWN'
  accessTier: 'NONE' | 'TEST' | 'EXPLORER' | 'BASIC' | 'STANDARD'
  hasRefreshToken: boolean
  managerAccounts: Array<{
    customerId: string
    descriptiveName: string
    status: string
    testAccount: boolean
  }>
  lastSyncedAt: string | null
  connectedAt: string
}

interface ProviderReadiness {
  platform: 'META' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'X' | 'PINTEREST' | 'THREADS'
  credentialsConfigured: boolean
  callbackUrl: string
  requestedScopes: string[]
  deferredScopes: string[]
  testBoundary: string
  publicAccess: string
  proofState: 'configuration_only'
}

const PROVIDER_TEST_BOUNDARY_AR: Record<ProviderReadiness['platform'], string> = {
  META: 'اختبار صفحة Facebook لا يثبت جاهزية Instagram. يجب التحقق من صلاحيات كل هوية ومسار مراجعة المنصة بصورة منفصلة.',
  LINKEDIN: 'ربط العضو متاح؛ نشر صفحات الشركات مؤجل حتى توفر تصريح Community Management والتحقق منه.',
  TIKTOK: 'اختبار Direct Post غير المعتمد يظل محدودًا داخل المنصة؛ لا نعتبر الظهور العام متاحًا قبل وجود دليل اعتماد.',
  YOUTUBE: 'ربط OAuth والرفع الخاص لا يثبتان النشر العام. يلزم إثبات الرفع وقراءة المعالجة وتجديد الرمز واعتماد مشروع API.',
  X: 'إعداد OAuth لا يثبت أن الخطة تسمح بالنشر. يلزم التحقق من الكتابة والوسائط والقراءة والتجديد ومعرّف المنشور والوصول للحساب.',
  PINTEREST: 'الوصول التجريبي لا يثبت النشر العام. يلزم Standard access واختيار Board وتجديد الرمز ومعرّف Pin وقراءة النتيجة.',
  THREADS: 'وضع التطوير لا يثبت النشر العام. يلزم Live access وتجديد الرمز ومعرّف المنشور وقراءة مؤشرات الأداء.',
}

function providerTestBoundary(provider: ProviderReadiness, ar: boolean): string {
  return ar ? PROVIDER_TEST_BOUNDARY_AR[provider.platform] : provider.testBoundary
}

interface PlatformDef {
  id: string
  name: { ar: string; en: string }
  helper: { ar: string; en: string }
  scope: { ar: string; en: string }
  available: boolean
  accent: string
  icon: string
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'META',
    name: { ar: 'Meta — Facebook وInstagram', en: 'Meta — Facebook & Instagram' },
    helper: {
      ar: 'ينشر Facebook بعد تحقق الصفحة والصلاحيات. يظهر حساب Instagram للربط والمراجعة، ولا يُعتمد نشره حتى نجاح فحص الصلاحيات.',
      en: 'Facebook and Instagram readiness are checked separately against the selected Page and professional Instagram identity.',
    },
    scope: { ar: 'نشر Facebook وInstagram', en: 'Facebook & Instagram publishing' },
    available: true,
    accent: '#2563eb',
    icon: '∞',
  },
  {
    id: 'LINKEDIN',
    name: { ar: 'LinkedIn', en: 'LinkedIn' },
    helper: {
      ar: 'يفحص NEXUS النشر باسم العضو وصفحات الشركات كلٌ على حدة، ولا يعتبر صفحة شركة متاحة دون صلاحية إدارة مثبتة.',
      en: 'NEXUS checks member and Company Page publishing separately and never treats an organization as available without proven admin access.',
    },
    scope: { ar: 'عضو وصفحات شركات', en: 'Member & Company Pages' },
    available: true,
    accent: '#0a66c2',
    icon: 'in',
  },
  {
    id: 'TIKTOK',
    name: { ar: 'TikTok', en: 'TikTok' },
    helper: {
      ar: 'النشر المباشر يظل مقفلاً حتى نجاح فحص creator-info واختيار الخصوصية والإفصاحات وموافقة المستخدم الصريحة.',
      en: 'Direct posting stays locked until creator-info, privacy, disclosures, and explicit user consent are verified.',
    },
    scope: { ar: 'فيديو Direct Post', en: 'Video Direct Post' },
    available: true,
    accent: '#111827',
    icon: '♪',
  },
  {
    id: 'SNAPCHAT',
    name: { ar: 'Snapchat Ads', en: 'Snapchat Ads' },
    helper: {
      ar: 'مخطط ضمن خريطة التنفيذ. لن يظهر كجاهز قبل تكامل رسمي.',
      en: 'Planned in the execution map. It will not appear ready before official integration.',
    },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#facc15',
    icon: 'S',
  },
  {
    id: 'GOOGLE',
    name: { ar: 'Google Ads', en: 'Google Ads' },
    helper: {
      ar: 'مسار Search متوقف للمراجعة ثم تفعيل منفصل وقياس من Google Ads. يحتاج OAuth وDeveloper Token ومستوى وصول مناسب.',
      en: 'Paused Search drafts, separate activation, and Google Ads measurement. Requires OAuth, a developer token, and the appropriate access tier.',
    },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#4285f4',
    icon: 'G',
  },
  {
    id: 'YOUTUBE',
    name: { ar: 'YouTube', en: 'YouTube' },
    helper: {
      ar: 'يرفع الفيديوهات والشورتس المعتمدة، ثم يراقب المعالجة. قد تفرض Google الخصوصية على Private حتى اعتماد مشروع API.',
      en: 'Uploads approved videos and Shorts, then monitors processing. Google may force Private visibility until the API project passes audit.',
    },
    scope: { ar: 'رفع فيديو ومراقبة المعالجة', en: 'Video upload & processing status' },
    available: true,
    accent: '#ef4444',
    icon: '▶',
  },
  {
    id: 'X',
    name: { ar: 'X', en: 'X' },
    helper: {
      ar: 'ينشر النص والصورة المعتمدة فقط بعد موافقة صريحة، ثم يجلب مقاييس المنشور المتاحة من X بدون اختلاق وصول أو تحويلات.',
      en: 'Publishes approved text and image only after explicit consent, then reads available X post metrics without inventing reach or conversions.',
    },
    scope: { ar: 'نص وصورة معتمدة', en: 'Approved text & image' },
    available: true,
    accent: '#111827',
    icon: 'X',
  },
  {
    id: 'THREADS',
    name: { ar: 'Threads', en: 'Threads' },
    helper: {
      ar: 'ينشر النصوص والصور المعتمدة بعد اختيار من يستطيع الرد والموافقة الصريحة، ثم يجمع المشاهدات والتفاعلات المتاحة بدون اختلاق وصول أو نقرات.',
      en: 'Publishes approved text and images after reply-control review and explicit consent, then collects available views and interactions without inventing reach or clicks.',
    },
    scope: { ar: 'نص وصورة + قياس عضوي', en: 'Text, image & organic insights' },
    available: true,
    accent: '#111827',
    icon: '@',
  },
  {
    id: 'PINTEREST',
    name: { ar: 'Pinterest', en: 'Pinterest' },
    helper: {
      ar: 'ينشر Image Pins المعتمدة إلى Board محدد بعد مراجعة العنوان والوصف وAlt Text وإفصاح الذكاء. Trial يتيح اختبارًا مرئيًا لصاحب الحساب فقط؛ النشر العام يتطلب Standard access.',
      en: 'Publishes approved image Pins to an exact Board after title, description, alt text, and AI-disclosure review. Trial is creator-visible testing only; public distribution requires Standard access.',
    },
    scope: { ar: 'Image Pins معتمدة', en: 'Approved image Pins' },
    available: true,
    accent: '#e11d48',
    icon: 'P',
  },
  {
    id: 'WHATSAPP',
    name: { ar: 'WhatsApp Business', en: 'WhatsApp Business' },
    helper: { ar: 'مخطط لتسليم العملاء والرسائل المعتمدة؛ ليس قناة نشر اجتماعي عادية.', en: 'Planned for lead handoff and approved templates; it is not a standard social publishing channel.' },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#16a34a',
    icon: 'W',
  },
]

const DEFAULT_PUBLISHING_PLATFORM_IDS = ['META', 'LINKEDIN', 'YOUTUBE'] as const

function publishingPlatformIds(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) return []
  const mapped = platforms.map(value => {
    const platform = String(value || '').trim().toUpperCase()
    if (platform === 'INSTAGRAM' || platform === 'FACEBOOK' || platform === 'META') return 'META'
    return platform
  })
  return [...new Set(mapped)].filter(platform => PLATFORMS.some(item => item.available && item.id === platform))
}

function adExecutionEligible(
  account: ConnectedAdAccount,
  googleConnection: GoogleAdsConnectionState | null,
): boolean {
  if (!account.hasApiAccess) return false
  if (account.platform.toUpperCase() !== 'GOOGLE') return true
  return account.apiAccessTier !== 'NONE'
    && Boolean(account.apiAccessTier)
    && googleConnection?.accessTier !== 'NONE'
}

function connectionTruth(account: ConnectedAccount, ar: boolean, readiness?: ProviderReadiness): {
  tone: 'ready' | 'needs'
  label: string
  checks: Array<{ ok: boolean; text: string }>
} {
  const capability = account.capabilities || {}
  if (account.status !== 'CONNECTED') {
    return {
      tone: 'needs',
      label: account.status === 'EXPIRED'
        ? (ar ? 'انتهت الصلاحية · أعد الربط' : 'Expired · reconnect')
        : (ar ? 'خطأ في الاتصال · أعد الربط' : 'Connection error · reconnect'),
      checks: [{ ok: false, text: ar ? 'رمز وصول صالح مطلوب قبل أي نشر' : 'A valid access token is required before publishing' }],
    }
  }
  if (account.platform === 'META') {
    const facebook = capability.facebookPublishing === true
    const instagram = capability.instagramPublishing === true
    const instagramDeferred = readiness?.deferredScopes.includes('instagram_content_publish') === true
    return {
      tone: facebook && instagram ? 'ready' : 'needs',
      label: facebook && instagram
        ? (ar ? 'النشر جاهز للوجهتين' : 'Both destinations ready')
        : facebook
          ? instagramDeferred
            ? (ar ? 'Facebook اختباري جاهز · Instagram مؤجل للتصريح' : 'Facebook test-ready · Instagram deferred for review')
            : (ar ? 'Facebook جاهز · Instagram ناقص' : 'Facebook ready · Instagram missing')
          : (ar ? 'إعداد الوجهة مطلوب' : 'Destination setup required'),
      checks: [
        { ok: facebook, text: ar ? 'صفحة Facebook مخولة للنشر' : 'Facebook Page authorized for publishing' },
        {
          ok: instagram,
          text: instagramDeferred
            ? (ar ? 'نشر Instagram مؤجل حتى مسار التصريح' : 'Instagram publishing deferred until provider review')
            : (ar ? 'حساب Instagram احترافي مربوط بالصفحة' : 'Professional Instagram account linked to the Page'),
        },
      ],
    }
  }
  if (account.platform === 'LINKEDIN') {
    const member = capability.linkedInMemberPublishing === true
    const organization = capability.linkedInOrganizationPublishing === true
    const organizationDeferred = readiness?.deferredScopes.includes('w_organization_social') === true
    return {
      tone: member || organization ? 'ready' : 'needs',
      label: organization
        ? (ar ? 'نشر العضو وصفحة الشركة متاح' : 'Member and Company Page ready')
        : member
          ? organizationDeferred
            ? (ar ? 'نشر العضو جاهز · صفحة الشركة مؤجلة للتصريح' : 'Member ready · Company Page deferred for review')
            : (ar ? 'نشر العضو جاهز · لا صفحة شركة' : 'Member ready · no Company Page')
          : (ar ? 'صلاحية النشر غير مثبتة' : 'Publishing permission unverified'),
      checks: [
        { ok: member, text: ar ? 'هوية العضو متاحة للنشر' : 'Member publishing identity available' },
        {
          ok: organization,
          text: organizationDeferred
            ? (ar ? 'نشر صفحة الشركة مؤجل حتى تصريح Community Management' : 'Company Page publishing deferred until Community Management access')
            : (ar ? 'صفحة شركة بإدارة مثبتة' : 'Admin-authorized Company Page available'),
        },
      ],
    }
  }
  if (account.platform === 'YOUTUBE') {
    const upload = capability.youtubeVideoPublishing === true
    const readback = capability.youtubeReadback === true
    const refresh = capability.tokenRefresh === true
    return {
      tone: upload && readback && refresh ? 'ready' : 'needs',
      label: upload && readback && refresh
        ? (ar ? 'رفع الفيديو والمراقبة جاهزان' : 'Upload and monitoring ready')
        : (ar ? 'صلاحيات YouTube غير مكتملة' : 'YouTube permissions incomplete'),
      checks: [
        { ok: upload, text: ar ? 'صلاحية رفع الفيديو مثبتة' : 'Video upload permission verified' },
        { ok: readback, text: ar ? 'قراءة حالة المعالجة مثبتة' : 'Processing status readback verified' },
        { ok: refresh, text: ar ? 'رمز تحديث محفوظ للجدولة' : 'Refresh token stored for scheduling' },
      ],
    }
  }
  if (account.platform === 'X') {
    const publishing = capability.xPublishing === true
    const media = capability.xMediaPublishing === true
    const readback = capability.xReadback === true
    const refresh = capability.tokenRefresh === true
    return {
      tone: publishing && media && readback && refresh ? 'ready' : 'needs',
      label: publishing && media && readback && refresh
        ? (ar ? 'النشر والقياس جاهزان للمراجعة' : 'Publishing and measurement review-ready')
        : (ar ? 'صلاحيات X غير مكتملة' : 'X permissions incomplete'),
      checks: [
        { ok: publishing, text: ar ? 'صلاحية إنشاء المنشورات مثبتة' : 'Post creation permission verified' },
        { ok: media, text: ar ? 'صلاحية رفع الصور مثبتة' : 'Image upload permission verified' },
        { ok: readback, text: ar ? 'قراءة المنشور والمقاييس مثبتة' : 'Post and metrics readback verified' },
        { ok: refresh, text: ar ? 'رمز تحديث محفوظ للجدولة' : 'Refresh token stored for scheduling' },
      ],
    }
  }
  if (account.platform === 'PINTEREST') {
    const publishing = capability.pinterestPinPublishing === true
    const readback = capability.pinterestReadback === true
    const board = capability.pinterestBoardSelection === true
    const refresh = capability.tokenRefresh === true
    const publicPublishing = capability.pinterestPublicPublishing === true
    const operational = publishing && readback && board && refresh
    return {
      tone: operational && publicPublishing ? 'ready' : 'needs',
      label: operational
        ? publicPublishing
          ? (ar ? 'النشر العام والقياس جاهزان للمراجعة' : 'Public publishing and measurement review-ready')
          : (ar ? 'اختبار Trial جاهز · النشر العام يحتاج Standard' : 'Trial testing ready · Standard needed for public distribution')
        : (ar ? 'إعداد Pinterest غير مكتمل' : 'Pinterest setup incomplete'),
      checks: [
        { ok: publishing, text: ar ? 'صلاحيات إنشاء وقراءة Pins مثبتة' : 'Pin creation and read permissions verified' },
        { ok: board, text: ar ? 'Board عامة واحدة على الأقل متاحة للاختيار' : 'At least one public Board is available for selection' },
        { ok: readback, text: ar ? 'قراءة مقاييس Pin مثبتة' : 'Pin metric readback verified' },
        { ok: refresh, text: ar ? 'رمز تحديث مستمر محفوظ للجدولة' : 'Continuous refresh token stored for scheduling' },
        { ok: publicPublishing, text: ar ? 'Standard access مثبت للنشر العام' : 'Standard access configured for public distribution' },
      ],
    }
  }
  if (account.platform === 'THREADS') {
    const publishing = capability.threadsPostPublishing === true
    const readback = capability.threadsReadback === true
    const refresh = capability.tokenRefresh === true
    const publicPublishing = capability.threadsPublicPublishing === true
    const operational = publishing && readback && refresh
    return {
      tone: operational && publicPublishing ? 'ready' : 'needs',
      label: operational
        ? publicPublishing
          ? (ar ? 'النشر العام والقياس جاهزان للمراجعة' : 'Public publishing and measurement review-ready')
          : (ar ? 'اختبار التطوير جاهز · تفعيل Live مطلوب للعامة' : 'Development testing ready · Live mode needed for public users')
        : (ar ? 'إعداد Threads غير مكتمل' : 'Threads setup incomplete'),
      checks: [
        { ok: publishing, text: ar ? 'صلاحيات الهوية والنشر مثبتة' : 'Identity and publishing permissions verified' },
        { ok: readback, text: ar ? 'صلاحية قراءة مؤشرات الأداء مثبتة' : 'Insight readback permission verified' },
        { ok: refresh, text: ar ? 'توكن طويل العمر قابل للتجديد' : 'Renewable long-lived token available' },
        {
          ok: publicPublishing,
          text: publicPublishing
            ? (ar ? 'تطبيق Meta في وضع Live' : 'Meta app is in Live mode')
            : (ar ? 'تطبيق Meta ما زال في وضع التطوير' : 'Meta app remains in Development mode'),
        },
      ],
    }
  }
  const directPost = capability.tikTokDirectPosting === true
  const creator = capability.tikTokCreatorInfoVerified === true
  return {
    tone: directPost && creator ? 'ready' : 'needs',
    label: directPost && creator
      ? (ar ? 'Direct Post جاهز للمراجعة' : 'Direct Post review-ready')
      : (ar ? 'إعادة الربط أو التحقق مطلوبة' : 'Reconnect or verification required'),
    checks: [
      { ok: directPost, text: ar ? 'صلاحية video.publish موجودة' : 'video.publish scope granted' },
      { ok: creator, text: ar ? 'creator-info والخصوصية تم التحقق منهما' : 'Creator info and privacy options verified' },
      { ok: capability.tokenRefresh === true, text: ar ? 'رمز تحديث محفوظ للتجديد' : 'Refresh token stored for renewal' },
    ],
  }
}

const CONNECT_ROUTES: Record<string, string> = {
  META: '/api/social/connect/meta',
  META_ADS: '/api/social/connect/meta-ads',
  GOOGLE_ADS: '/api/social/connect/google-ads',
  LINKEDIN: '/api/social/connect/linkedin',
  TIKTOK: '/api/social/connect/tiktok',
  YOUTUBE: '/api/social/connect/youtube',
  X: '/api/social/connect/x',
  PINTEREST: '/api/social/connect/pinterest',
  THREADS: '/api/social/connect/threads',
}

function ShellButton({
  children,
  onClick,
  disabled,
  loading,
  tone = 'secondary',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
}) {
  const toneClass = {
    primary: 'bg-[#071236] text-white shadow-[0_18px_38px_rgba(18,26,66,0.24)] hover:bg-[#111d4d]',
    secondary: 'border border-[#e3e8f3] bg-white text-[#111b3f] hover:border-[#c9d4ea] hover:bg-[#f8faff]',
    danger: 'border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100',
    ghost: 'border border-transparent bg-transparent text-[#53617f] hover:bg-white',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[13px] px-4 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

function Panel({
  title,
  icon,
  children,
  className = '',
  action,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={`nx-os-card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-black text-[#111b3f]">
          {icon ? <span className="text-[#4f46e5]">{icon}</span> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'ready' | 'needs' | 'planned' }) {
  const toneClass = {
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    needs: 'bg-amber-50 text-amber-700 border-amber-100',
    planned: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass}`}>
      {children}
    </span>
  )
}

export default function ConnectionsPage() {
  const { isAuthenticated, loading, authHeader, session } = useAuth()
  const router = useRouter()
  const { locale, localeReady, dir } = useI18n()
  const ar = locale === 'ar'
  const copy = useCallback((arabic: string, english: string) => (ar ? arabic : english), [ar])

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [adAccounts, setAdAccounts] = useState<ConnectedAdAccount[]>([])
  const [googleAdsConnection, setGoogleAdsConnection] = useState<GoogleAdsConnectionState | null>(null)
  const [strategyPlatformIds, setStrategyPlatformIds] = useState<string[]>([])
  const [strategyCampaignName, setStrategyCampaignName] = useState<string | null>(null)
  const [providerReadiness, setProviderReadiness] = useState<ProviderReadiness[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const messageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!message) return
    const frame = window.requestAnimationFrame(() => {
      messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      messageRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [message])

  const fetchAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) {
      setLoadingAccounts(false)
      return
    }
    setLoadingAccounts(true)
    try {
      const [socialRes, adRes, campaignRes, readinessRes] = await Promise.all([
        fetch('/api/social/accounts', { headers: { Authorization: token } }),
        fetch('/api/ad-accounts', { headers: { Authorization: token } }),
        fetch('/api/campaigns?limit=20&sort=updatedAt&order=desc', { headers: { Authorization: token }, cache: 'no-store' }),
        fetch('/api/social/readiness', { headers: { Authorization: token }, cache: 'no-store' }),
      ])
      const [socialData, adData, campaignData, readinessData] = await Promise.all([
        socialRes.json(),
        adRes.json(),
        campaignRes.ok ? campaignRes.json() : Promise.resolve({ campaigns: [] }),
        readinessRes.ok ? readinessRes.json() : Promise.resolve({ providers: [] }),
      ])
      setAccounts(socialData.accounts || [])
      setAdAccounts(adData.accounts || [])
      setGoogleAdsConnection(adData.googleAdsConnection || null)
      setProviderReadiness(Array.isArray(readinessData.providers) ? readinessData.providers : [])
      const currentCampaign = Array.isArray(campaignData.campaigns)
        ? campaignData.campaigns.find((campaign: { status?: string }) => campaign.status === 'ACTIVE') || campaignData.campaigns[0]
        : null
      setStrategyPlatformIds(publishingPlatformIds(currentCampaign?.platforms))
      setStrategyCampaignName(typeof currentCampaign?.name === 'string' ? currentCampaign.name : null)
    } catch {
      setAccounts([])
      setAdAccounts([])
      setGoogleAdsConnection(null)
      setProviderReadiness([])
      setStrategyPlatformIds([])
      setStrategyCampaignName(null)
    } finally {
      setLoadingAccounts(false)
    }
  }, [authHeader])

  useEffect(() => {
    // Browsers may restore this page from the back/forward cache after the user
    // cancels OAuth. React state is restored too, so clear the in-flight label
    // and re-read provider truth instead of leaving the button disabled forever.
    const handleOAuthReturn = () => {
      setConnecting(null)
      if (document.visibilityState === 'visible') void fetchAccounts()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleOAuthReturn()
    }
    window.addEventListener('pageshow', handleOAuthReturn)
    window.addEventListener('focus', handleOAuthReturn)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pageshow', handleOAuthReturn)
      window.removeEventListener('focus', handleOAuthReturn)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchAccounts])

  useEffect(() => {
    // Wait for the persisted interface language before converting OAuth query
    // parameters into a visible message. Otherwise the provider's SSR-safe
    // Arabic default can briefly win even when the saved interface is English.
    if (!localeReady || typeof window === 'undefined') return
    let messageTimeout: ReturnType<typeof setTimeout> | undefined
    const params = new URLSearchParams(window.location.search)
    const social = params.get('social')
    const platform = params.get('platform')
    const discoveredAdAccounts = params.get('accounts')

    if (social === 'connected') {
      const platformName = platform ? platform.toUpperCase() : copy('المنصة', 'platform')
      setMessage({
        type: 'success',
        text: platform === 'google_ads' && discoveredAdAccounts === '0'
          ? copy(
              'تم التحقق من اتصال Google Ads وحفظ حساب المدير. لا يعرض Google حالياً حساب معلن جاهزاً للـAPI، لذلك سيظل التنفيذ والإنفاق مقفلين حتى اكتمال الحساب الفرعي.',
              'Google Ads OAuth and the manager account were verified. Google does not currently expose an API-ready advertiser account, so execution and spend remain locked until the child account is completed.',
            )
          : copy(`تم ربط ${platformName}. راجع الصلاحيات قبل أي تشغيل.`, `${platformName} connected. Review permissions before execution.`),
      })
      window.history.replaceState({}, '', '/connections')
      messageTimeout = setTimeout(() => setMessage(null), 5000)
    } else if (social === 'error' || social === 'denied') {
      const rawMsg = params.get('msg')
      const decodedMsg = rawMsg ? decodeURIComponent(rawMsg) : ''
      const wasCancelled = social === 'denied' || decodedMsg === 'authorization_not_granted'
      setMessage({
        type: wasCancelled ? 'info' : 'error',
        text: wasCancelled
          ? copy(
              'تم إلغاء الربط. لم يتم ربط أي حساب أو منح أي صلاحية.',
              'Connection cancelled. No account was connected and no permission was granted.',
            )
          : rawMsg
            ? copy(`تعذر إكمال الربط: ${decodedMsg}`, `Connection failed: ${decodedMsg}`)
          : copy('تعذر إكمال الربط. حاول مرة أخرى بعد مراجعة إعدادات المنصة.', 'Connection failed. Review platform settings and try again.'),
      })
      window.history.replaceState({}, '', '/connections')
      messageTimeout = setTimeout(() => setMessage(null), 9000)
    }
    return () => { if (messageTimeout) clearTimeout(messageTimeout) }
  }, [copy, localeReady])

  useEffect(() => {
    if (!loading && isAuthenticated && session?.access_token) fetchAccounts()
  }, [fetchAccounts, isAuthenticated, loading, session])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLoadingAccounts(false)
      router.replace('/auth/login')
    }
  }, [isAuthenticated, loading, router])

  const handleConnect = async (platformId: string) => {
    const route = CONNECT_ROUTES[platformId]
    if (!route) return

    const token = authHeader()
    if (!token) {
      setMessage({
        type: 'error',
        text: copy('انتهت صلاحية الجلسة. سجل الدخول مرة أخرى ثم حاول الربط.', 'Session expired. Sign in again, then try connecting.'),
      })
      return
    }

    setConnecting(platformId)
    try {
      const res = await fetch(route, { headers: { Authorization: token } })
      if (res.status === 401) {
        setMessage({
          type: 'error',
          text: copy('انتهت صلاحية الجلسة. سجل الدخول مرة أخرى ثم حاول الربط.', 'Session expired. Sign in again, then try connecting.'),
        })
        setConnecting(null)
        return
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({
          type: 'error',
          text: data.code === 'X_OAUTH_NOT_CONFIGURED'
            ? copy(
                'ربط X غير متاح الآن لأن إعداد المنصة لم يكتمل. لم يتم تغيير أي بيانات.',
                'X connection is not available because platform setup is incomplete. No data was changed.',
              )
            : data.code === 'PINTEREST_OAUTH_NOT_CONFIGURED'
              ? copy(
                  'ربط Pinterest غير متاح الآن لأن إعداد التطبيق لم يكتمل. لم يتم تغيير أي بيانات.',
                  'Pinterest connection is not available because app setup is incomplete. No data was changed.',
                )
            : data.code === 'THREADS_OAUTH_NOT_CONFIGURED'
              ? copy(
                  'ربط Threads غير متاح الآن لأن إعداد تطبيق Meta لم يكتمل. لم يتم تغيير أي بيانات.',
                  'Threads connection is not available because Meta app setup is incomplete. No data was changed.',
                )
            : data.code === 'GOOGLE_ADS_NOT_CONFIGURED'
              ? copy(
                  'ربط Google Ads غير متاح حتى تكتمل مفاتيح OAuth وDeveloper Token. لم يتم تغيير أي بيانات.',
                  'Google Ads connection is unavailable until OAuth credentials and the developer token are configured. No data was changed.',
                )
            : data.code === 'META_OAUTH_NOT_CONFIGURED'
              ? copy(
                  'مفاتيح Meta على الخادم غير مكتملة. لم يبدأ OAuth ولم تتغير أي بيانات.',
                  'Meta server credentials are incomplete. OAuth did not start and no data was changed.',
                )
            : data.code === 'LINKEDIN_OAUTH_NOT_CONFIGURED'
              ? copy(
                  'مفاتيح LinkedIn على الخادم غير مكتملة. لم يبدأ OAuth ولم تتغير أي بيانات.',
                  'LinkedIn server credentials are incomplete. OAuth did not start and no data was changed.',
                )
            : data.code === 'TIKTOK_OAUTH_NOT_CONFIGURED'
              ? copy(
                  'مفاتيح TikTok على الخادم غير مكتملة. لم يبدأ OAuth ولم تتغير أي بيانات.',
                  'TikTok server credentials are incomplete. OAuth did not start and no data was changed.',
                )
            : data.error || copy('تعذر بدء الربط من NEXUS.', 'NEXUS could not start the connection.'),
        })
        setConnecting(null)
      }
    } catch {
      setMessage({
        type: 'error',
        text: copy('حدث خطأ في الاتصال. لم يتم تغيير أي بيانات.', 'Connection error. No data was changed.'),
      })
      setConnecting(null)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId)
    try {
      const response = await fetch('/api/social/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ integrationId }),
      })
      if (!response.ok) throw new Error('Disconnect failed')
      setAccounts((prev) => prev.filter((account) => account.id !== integrationId))
      setDisconnectConfirmId(null)
      setMessage({
        type: 'success',
        text: copy(
          'تم فصل الحساب ومسح رموز الوصول المحفوظة في NEXUS. لا يعني ذلك حذف الحساب أو إلغاء وصول NEXUS من إعدادات المنصة.',
          'Account disconnected and credentials stored by NEXUS were erased. This does not delete the account or confirm provider-side revocation in the platform settings.',
        ),
      })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({
        type: 'error',
        text: copy('تعذر فصل الحساب. لم يتم تغيير حالة الربط محلياً.', 'Could not disconnect the account. Local connection state was not changed.'),
      })
    } finally {
      setDisconnecting(null)
    }
  }

  const handleDisconnectAd = async (accountId: string) => {
    setDisconnecting(accountId)
    try {
      const response = await fetch(`/api/ad-accounts?id=${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() },
      })
      if (!response.ok) throw new Error('Disconnect failed')
      setAdAccounts(prev => prev.filter(account => account.id !== accountId))
      setDisconnectConfirmId(null)
      setMessage({
        type: 'success',
        text: copy('تم فصل حساب الإعلانات ومسح رموز الوصول المحفوظة.', 'Ad account disconnected and stored access credentials cleared.'),
      })
    } catch {
      setMessage({
        type: 'error',
        text: copy('تعذر فصل حساب الإعلانات. لم تتغير حالته.', 'Could not disconnect the ad account. Its state was not changed.'),
      })
    } finally {
      setDisconnecting(null)
    }
  }

  const handleDisconnectGoogleConnection = async (integrationId: string) => {
    setDisconnecting(integrationId)
    try {
      const response = await fetch(`/api/ad-accounts?integrationId=${encodeURIComponent(integrationId)}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() },
      })
      if (!response.ok) throw new Error('Disconnect failed')
      setGoogleAdsConnection(null)
      setAdAccounts(prev => prev.filter(account => account.platform?.toUpperCase() !== 'GOOGLE'))
      setDisconnectConfirmId(null)
      setMessage({
        type: 'success',
        text: copy('تم فصل Google Ads ومسح رموز الوصول من NEXUS بدون حذف أي حساب أو حملة لدى Google.', 'Google Ads was disconnected and its stored tokens were cleared without deleting any Google account or campaign.'),
      })
    } catch {
      setMessage({
        type: 'error',
        text: copy('تعذر فصل Google Ads. لم تتغير حالة الربط.', 'Could not disconnect Google Ads. Its connection state was not changed.'),
      })
    } finally {
      setDisconnecting(null)
    }
  }

  const paidAdAccounts = adAccounts.filter((account) =>
    ['META', 'GOOGLE'].includes(account.platform?.toUpperCase()) && account.status?.toUpperCase() !== 'DISCONNECTED',
  )
  const hasMetaAdAccount = paidAdAccounts.some((account) => account.platform?.toUpperCase() === 'META')
  const hasGoogleAdAccount = paidAdAccounts.some((account) => account.platform?.toUpperCase() === 'GOOGLE')

  const providerOAuthCount = accounts.length + (googleAdsConnection ? 1 : 0)
  const primaryPublishingPlatformIds = strategyPlatformIds.length > 0
    ? strategyPlatformIds
    : [...DEFAULT_PUBLISHING_PLATFORM_IDS]
  const primaryPublishingPlatformSet = new Set(primaryPublishingPlatformIds)
  const availablePlatforms = PLATFORMS
    .filter(platform => platform.available)
    .sort((left, right) => {
      const leftPriority = primaryPublishingPlatformIds.indexOf(left.id)
      const rightPriority = primaryPublishingPlatformIds.indexOf(right.id)
      return (leftPriority === -1 ? 99 : leftPriority) - (rightPriority === -1 ? 99 : rightPriority)
    })

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <Loader2 className="h-9 w-9 animate-spin text-[#4f46e5]" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) {
    return (
      <AppShell>
        <main dir={dir} className="nx-os-page flex min-h-screen items-center justify-center px-4">
          <section role="status" className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-7 text-center shadow-sm">
            <KeyRound className="mx-auto h-8 w-8 text-indigo-600" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-black text-[#111b3f]">
              {copy('تسجيل الدخول مطلوب', 'Sign in required')}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#64708f]">
              {copy(
                'انتهت الجلسة أو تعذر استعادتها. سجّل الدخول لمراجعة حسابات المنصات وصلاحياتها.',
                'Your session ended or could not be restored. Sign in to review platform accounts and permissions.',
              )}
            </p>
            <Link href="/auth/login" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-black text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">
              {copy('الذهاب لتسجيل الدخول', 'Go to sign in')}
            </Link>
          </section>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={copy('الربط', 'Connections')}
            pageSubtitle={copy('اربط الحسابات ثم راجع القدرة المثبتة لكل منصة قبل النشر أو القياس.', 'Connect accounts, then review the proven capability for each platform before publishing or measurement.')}
            primaryHref={null}
            secondaryHref={null}
          />

          <section className="nx-os-action-strip mb-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><Link2 size={17} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">
                  {loadingAccounts
                    ? copy('جار فحص الحسابات', 'Checking accounts')
                    : copy(
                        `${accounts.length} حسابات نشر · ${paidAdAccounts.length} حسابات إعلانات · ${providerOAuthCount} اتصالات OAuth للمزود`,
                        `${accounts.length} publishing accounts · ${paidAdAccounts.length} ad accounts · ${providerOAuthCount} provider OAuth connections`,
                      )}
                </p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">{copy('الربط وحده لا ينشر أو يصرف ميزانية.', 'A connection never publishes or spends by itself.')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ShellButton onClick={fetchAccounts} loading={loadingAccounts}>
                <RefreshCw className="h-4 w-4" />
                {copy('تحديث الحالة', 'Refresh status')}
              </ShellButton>
            </div>
          </section>

          {message ? (
            <div
              ref={messageRef}
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
              className={`mb-6 flex items-center gap-3 rounded-[18px] border px-5 py-4 text-sm font-semibold ${
                message.type === 'success'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : message.type === 'info'
                    ? 'border-sky-100 bg-sky-50 text-sky-700'
                    : 'border-rose-100 bg-rose-50 text-rose-700'
              }`}
            >
              {message.type === 'success'
                ? <CheckCircle2 className="h-5 w-5" />
                : message.type === 'info'
                  ? <Clock3 className="h-5 w-5" />
                  : <AlertCircle className="h-5 w-5" />}
              <span>{message.text}</span>
              <button type="button" onClick={() => setMessage(null)} className="ms-auto text-lg opacity-70 hover:opacity-100">
                ×
              </button>
            </div>
          ) : null}

          {providerReadiness.length ? (
            <Panel
              title={copy('جاهزية الربط قبل التصريحات', 'Pre-approval connection readiness')}
              icon={<KeyRound size={18} />}
              className="mb-5"
              action={<StatusPill tone="needs">{copy('النشر العام مقفول', 'Public access locked')}</StatusPill>}
            >
              <p className="mb-4 text-[12px] font-semibold leading-6 text-[#64708f]">
                {copy(
                  'هذه اللوحة تثبت إعداد NEXUS نفسه فقط: المفاتيح، رابط العودة، والصلاحيات المطلوبة. لا تدّعي اعتماد التطبيق أو النشر العام قبل إثباته من المنصة.',
                  'This panel proves NEXUS configuration only: credentials, callback URL, and requested scopes. It never claims provider approval or public publishing before the provider proves it.',
                )}
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {providerReadiness.map((provider) => {
                  const account = accounts.find(item => item.platform === provider.platform)
                  const connected = account?.status === 'CONNECTED'
                  const platform = PLATFORMS.find(item => item.id === provider.platform)
                  return (
                    <article key={provider.platform} className="rounded-[18px] border border-[#e3e8f3] bg-[#fbfcff] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-black text-[#111b3f]">{platform ? copy(platform.name.ar, platform.name.en) : provider.platform}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#7b87a3]">
                            {connected
                              ? copy('اتصال اختباري محفوظ', 'Test connection saved')
                              : provider.credentialsConfigured
                                ? copy('جاهز لفتح موافقة المزود', 'Ready for provider consent')
                                : copy('مفاتيح الخادم ناقصة', 'Server credentials missing')}
                          </p>
                        </div>
                        {connected ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Clock3 className="h-5 w-5 text-amber-500" />}
                      </div>
                      <div className="mt-3 space-y-2 text-[11px] font-semibold leading-5 text-[#586684]">
                        <p className="flex gap-2">
                          {provider.credentialsConfigured ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          {provider.credentialsConfigured ? copy('مفاتيح الخادم موجودة', 'Server credentials configured') : copy('المفاتيح غير مكتملة', 'Credentials are incomplete')}
                        </p>
                        <p className="flex gap-2">
                          {connected ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          {connected ? copy('هوية وصلاحيات المزود محفوظة', 'Provider identity and scopes saved') : copy('لم يكتمل OAuth لهذا الحساب', 'Account OAuth is not complete')}
                        </p>
                        <p className="flex gap-2 text-amber-700">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {copy('الوصول العام يحتاج موافقة المنصة', 'Public access requires provider approval')}
                        </p>
                        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] leading-5 text-slate-600">
                          {providerTestBoundary(provider, ar)}
                        </p>
                      </div>
                      <details className="mt-3 rounded-[13px] border border-slate-200 bg-white p-3">
                        <summary className="cursor-pointer text-[10px] font-black text-[#5366f6]">{copy('التفاصيل التقنية', 'Technical details')}</summary>
                        <p dir="ltr" className="mt-2 break-all text-[9px] font-semibold text-slate-500">{provider.callbackUrl}</p>
                        <p dir="ltr" className="mt-2 break-words text-[9px] font-semibold text-slate-500">{provider.requestedScopes.join(', ')}</p>
                        {provider.deferredScopes.length ? (
                          <p dir="ltr" className="mt-2 break-words text-[9px] font-semibold text-amber-600">
                            Deferred: {provider.deferredScopes.join(', ')}
                          </p>
                        ) : null}
                      </details>
                    </article>
                  )
                })}
              </div>
            </Panel>
          ) : null}

          <div>
              <Panel
                title={copy('حسابات المنصات', 'Platform accounts')}
                icon={<Plug size={18} />}
                action={<span className="text-[12px] font-bold text-[#64708f]">{copy('النشر يحتاج موافقة', 'Publishing requires approval')}</span>}
              >
                <span id="available-integrations" className="sr-only" aria-hidden="true" />
                <div className="mb-4 rounded-[18px] border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">
                    {copy('مسار النشر الأساسي', 'Primary publishing path')}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64708f]">
                    {strategyCampaignName
                      ? copy(
                          `هذه أولويات النشر المحفوظة في حملة ${strategyCampaignName}. أضف قناة أخرى فقط بعد تحديث الاستراتيجية بدور واضح لها.`,
                          `These are the publishing priorities saved in ${strategyCampaignName}. Add another channel only after the strategy gives it a clear role.`,
                        )
                      : copy(
                          'لا توجد حملة حالية تحدد الأولوية؛ يعرض NEXUS ترتيب بدء افتراضيًا حتى تُحفظ استراتيجية.',
                          'No current campaign defines priority, so NEXUS shows a default starting order until a strategy is saved.',
                        )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {primaryPublishingPlatformIds.map(platformId => {
                      const platform = PLATFORMS.find(item => item.id === platformId)
                      if (!platform) return null
                      return (
                        <a key={platformId} href={`#platform-${platformId.toLowerCase()}`} className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-[11px] font-black text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200">
                          {copy(platform.name.ar, platform.name.en)}
                        </a>
                      )
                    })}
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {availablePlatforms.map((platform) => {
                    const connectedAccount = accounts.find((account) => account.platform === platform.id)
                    const isConnected = connectedAccount?.status === 'CONNECTED'
                    const readiness = providerReadiness.find(item => item.platform === platform.id)
                    const truth = connectedAccount ? connectionTruth(connectedAccount, ar, readiness) : null
                    const isConnecting = connecting === platform.id
                    const isDisconnecting = disconnecting === connectedAccount?.id
                    const isPrimary = primaryPublishingPlatformSet.has(platform.id)

                    return (
                      <article id={`platform-${platform.id.toLowerCase()}`} key={platform.id} className={`nx-os-card scroll-mt-24 p-4 ${isPrimary ? 'border-indigo-200 bg-white shadow-[0_16px_44px_rgba(79,70,229,0.08)]' : 'bg-[#fbfcff]'}`}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-lg font-black shadow-sm"
                              style={{ color: platform.accent }}
                            >
                              {platform.icon}
                            </span>
                            <div>
                              <h3 className="text-[15px] font-black text-[#111b3f]">{copy(platform.name.ar, platform.name.en)}</h3>
                              <p className="mt-1 text-[11px] font-bold text-[#7b87a3]">{copy(platform.scope.ar, platform.scope.en)}</p>
                              {isPrimary ? <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-indigo-600">{copy('أولوية حالية', 'Current priority')}</p> : null}
                            </div>
                          </div>
                          {isConnected ? (
                            <StatusPill tone={truth?.tone || 'needs'}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {truth?.label || copy('اتصال محفوظ', 'Connection saved')}
                            </StatusPill>
                          ) : platform.available ? (
                            <StatusPill tone="needs">
                              <Clock3 className="h-3.5 w-3.5" />
                              {copy('غير متصل', 'Not connected')}
                            </StatusPill>
                          ) : (
                            <StatusPill tone="planned">
                              {copy('مخطط', 'Planned')}
                            </StatusPill>
                          )}
                        </div>

                        <p className="min-h-[48px] text-[13px] leading-6 text-[#64708f]">{copy(platform.helper.ar, platform.helper.en)}</p>

                        {connectedAccount ? (
                          <div className="mt-4 rounded-[16px] border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold text-slate-500">{copy('الحساب المتصل', 'Connected account')}</p>
                            <p className="mt-1 text-sm font-black text-[#10203f]">{connectedAccount.accountName}</p>
                            {connectedAccount.pages?.length ? (
                              <div className="mt-2 space-y-1">
                                {connectedAccount.pages.slice(0, 3).map((page) => (
                                  <p key={page.id} className="flex items-center gap-2 text-[11px] text-[#586684]">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    {page.name}
                                    {page.igAccountId ? <span className="rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] text-pink-600">IG</span> : null}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {connectedAccount.organizations?.length ? (
                              <div className="mt-2 space-y-1">
                                {connectedAccount.organizations.slice(0, 3).map((organization) => (
                                  <p key={organization.id} className="flex items-center gap-2 text-[11px] text-[#586684]">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    {organization.name}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {connectedAccount.boards?.length ? (
                              <div className="mt-2 space-y-1">
                                {connectedAccount.boards.slice(0, 4).map((board) => (
                                  <p key={board.id} className="flex items-center gap-2 text-[11px] text-[#586684]">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    {board.name}
                                  </p>
                                ))}
                                {connectedAccount.boards.length > 4 ? (
                                  <p className="text-[10px] font-semibold text-slate-400">
                                    {copy(`و${connectedAccount.boards.length - 4} Boards أخرى`, `and ${connectedAccount.boards.length - 4} more Boards`)}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                            {truth ? (
                              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                                {truth.checks.map((check) => (
                                  <p key={check.text} className={`flex items-start gap-2 text-[11px] font-semibold ${check.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {check.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                    {check.text}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {connectedAccount.expiresAt ? (
                              <p className="mt-3 text-[10px] font-semibold text-slate-400">
                                {copy('انتهاء رمز الوصول:', 'Access token expiry:')} {' '}
                                <span dir="ltr">{new Date(connectedAccount.expiresAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</span>
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isConnected && connectedAccount ? (
                            <>
                              <ShellButton onClick={() => handleConnect(platform.id)} loading={isConnecting}>
                                <RefreshCw className="h-4 w-4" />
                                {copy('إعادة الربط', 'Reconnect')}
                              </ShellButton>
                              <ShellButton tone="danger" onClick={() => setDisconnectConfirmId(connectedAccount.id)} loading={isDisconnecting}>
                                <Unplug className="h-4 w-4" />
                                {copy('فصل', 'Disconnect')}
                              </ShellButton>
                            </>
                          ) : platform.available ? (
                            <ShellButton onClick={() => handleConnect(platform.id)} loading={isConnecting} tone="primary">
                              <Plug className="h-4 w-4" />
                              {copy('ربط الآن', 'Connect now')}
                            </ShellButton>
                          ) : (
                            <span className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[#e3e8f3] bg-[#f8faff] px-4 text-[12px] font-bold text-[#7b87a3]">
                              <Clock3 className="h-4 w-4" />
                              {copy('ليس جاهزاً بعد', 'Not ready yet')}
                            </span>
                          )}
                        </div>
                        {connectedAccount && disconnectConfirmId === connectedAccount.id ? (
                          <div className="mt-3 rounded-[14px] border border-rose-100 bg-rose-50/70 p-3">
                            <p className="text-[12px] font-bold leading-5 text-rose-700">
                              {copy(
                                'سيوقف الفصل استخدام الحساب ويمسح رموز الوصول المحفوظة في NEXUS. لن يحذف الحساب أو محتواه، وقد تحتاج لإلغاء وصول التطبيق أيضاً من إعدادات المنصة.',
                                'Disconnecting stops use of this account and erases credentials stored by NEXUS. It does not delete platform content; revoke the app in platform settings if you also want provider-side revocation.',
                              )}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ShellButton onClick={() => setDisconnectConfirmId(null)}>
                                {copy('إلغاء', 'Cancel')}
                              </ShellButton>
                              <ShellButton tone="danger" onClick={() => handleDisconnect(connectedAccount.id)} loading={isDisconnecting}>
                                {copy('تأكيد الفصل', 'Confirm disconnect')}
                              </ShellButton>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </Panel>

              <Panel
                title={copy('جاهزية حسابات الإعلانات', 'Ad account readiness')}
                icon={<KeyRound size={18} />}
                className="mt-5"
                action={<span className="text-[12px] font-bold text-[#64708f]">{copy('لا إنفاق بدون اعتماد', 'No spend without approval')}</span>}
              >
                {googleAdsConnection ? (
                  <article className="mb-4 rounded-[18px] border border-[#dce6fb] bg-[#f7faff] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-[#4285f4]">Google Ads OAuth</p>
                        <p className="mt-1 text-[13px] font-black text-[#111b3f]">
                          {googleAdsConnection.accountName || copy('اتصال Google Ads', 'Google Ads connection')}
                        </p>
                        {googleAdsConnection.accountId ? (
                          <p dir="ltr" className="mt-1 text-[11px] font-semibold text-[#7b87a3]">
                            {googleAdsConnection.accountId}
                          </p>
                        ) : null}
                      </div>
                      <StatusPill tone={googleAdsConnection.status === 'CONNECTED' && googleAdsConnection.hasRefreshToken ? 'ready' : 'needs'}>
                        {googleAdsConnection.status === 'CONNECTED' && googleAdsConnection.hasRefreshToken
                          ? <CheckCircle2 className="h-3.5 w-3.5" />
                          : <Clock3 className="h-3.5 w-3.5" />}
                        {googleAdsConnection.connectionRole === 'MANAGER'
                          ? copy('حساب المدير متصل', 'Manager connected')
                          : copy('اتصال Google محفوظ', 'Google connection saved')}
                      </StatusPill>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold leading-5 text-[#64708f]">
                      {googleAdsConnection.advertiserAccountCount > 0
                        ? copy(
                            `اكتشف Google عدد ${googleAdsConnection.advertiserAccountCount} حساب معلن. راجع بطاقة كل حساب أدناه قبل أي تنفيذ.`,
                            `Google exposed ${googleAdsConnection.advertiserAccountCount} advertiser account(s). Review each account card below before execution.`,
                          )
                        : copy(
                            'تم التحقق من OAuth وحساب المدير، لكن Google لا يعرض حتى الآن حساب معلن غير إداري عبر الـAPI. التخطيط متاح؛ إنشاء الإعلانات والتفعيل والقياس والإنفاق كلها مقفلة.',
                            'OAuth and the manager account are verified, but Google does not yet expose a non-manager advertiser account through the API. Planning is available; ad creation, activation, measurement, and spend are locked.',
                          )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-[#7b87a3]">
                      <span>{copy('مستوى الوصول', 'Access tier')}: {googleAdsConnection.accessTier}</span>
                      {googleAdsConnection.managerAccounts[0]?.status ? (
                        <span>{copy('حالة المدير لدى Google', 'Google manager status')}: {googleAdsConnection.managerAccounts[0].status}</span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ShellButton onClick={() => handleConnect('GOOGLE_ADS')} loading={connecting === 'GOOGLE_ADS'}>
                        <RefreshCw className="h-4 w-4" />
                        {copy('إعادة الفحص والربط', 'Reconnect & rediscover')}
                      </ShellButton>
                      <ShellButton tone="danger" onClick={() => setDisconnectConfirmId(googleAdsConnection.id)} loading={disconnecting === googleAdsConnection.id}>
                        <Unplug className="h-4 w-4" />
                        {copy('فصل Google Ads', 'Disconnect Google Ads')}
                      </ShellButton>
                    </div>
                    {disconnectConfirmId === googleAdsConnection.id ? (
                      <div className="mt-3 rounded-[14px] border border-rose-100 bg-rose-50/70 p-3">
                        <p className="text-[12px] font-bold leading-5 text-rose-700">
                          {copy('سيتم مسح رموز Google Ads من NEXUS وتعطيل حساباته المحفوظة محلياً، بدون حذف أي حساب أو حملة لدى Google.', 'NEXUS will clear Google Ads tokens and disable its locally saved ad accounts without deleting any Google account or campaign.')}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <ShellButton onClick={() => setDisconnectConfirmId(null)}>{copy('إلغاء', 'Cancel')}</ShellButton>
                          <ShellButton tone="danger" onClick={() => handleDisconnectGoogleConnection(googleAdsConnection.id)} loading={disconnecting === googleAdsConnection.id}>{copy('تأكيد الفصل', 'Confirm')}</ShellButton>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ) : null}
                {paidAdAccounts.length === 0 ? (
                  <div className={`rounded-[18px] border border-dashed border-[#d7def0] p-6 text-center ${googleAdsConnection ? 'bg-white/70' : ''}`}>
                    <p className="text-[13px] font-black text-[#111b3f]">
                      {googleAdsConnection
                        ? copy('لا يوجد حساب معلن جاهز من Google حتى الآن', 'No Google advertiser account is ready yet')
                        : copy('لا يوجد حساب إعلانات محفوظ', 'No saved ad account')}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#7b87a3]">
                      {googleAdsConnection
                        ? copy('أكمل تهيئة الحساب الفرعي داخل Google Ads حتى ينتقل من Draft إلى Enabled، ثم استخدم إعادة الفحص والربط.', 'Complete the child account setup in Google Ads so it moves from Draft to Enabled, then use Reconnect & rediscover.')
                        : copy('يمكن إعداد التخطيط بدون حساب؛ إنشاء مسودة منصة أو تفعيلها أو قياسها يتطلب API access مثبتاً.', 'Planning can be prepared without an account; platform draft creation, activation, and measurement require proven API access.')}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {!hasMetaAdAccount ? (
                        <ShellButton tone="primary" onClick={() => handleConnect('META_ADS')} loading={connecting === 'META_ADS'}>
                          <KeyRound className="h-4 w-4" />
                          {copy('ربط حساب إعلانات Meta', 'Connect Meta ad account')}
                        </ShellButton>
                      ) : null}
                      {!googleAdsConnection ? (
                        <ShellButton tone="primary" onClick={() => handleConnect('GOOGLE_ADS')} loading={connecting === 'GOOGLE_ADS'}>
                          <KeyRound className="h-4 w-4" />
                          {copy('ربط Google Ads', 'Connect Google Ads')}
                        </ShellButton>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    {!hasMetaAdAccount || (!hasGoogleAdAccount && !googleAdsConnection) ? (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {!hasMetaAdAccount ? (
                          <ShellButton tone="primary" onClick={() => handleConnect('META_ADS')} loading={connecting === 'META_ADS'}>
                            <KeyRound className="h-4 w-4" />
                            {copy('إضافة حساب إعلانات Meta', 'Add Meta ad account')}
                          </ShellButton>
                        ) : null}
                        {!hasGoogleAdAccount && !googleAdsConnection ? (
                          <ShellButton tone="primary" onClick={() => handleConnect('GOOGLE_ADS')} loading={connecting === 'GOOGLE_ADS'}>
                            <KeyRound className="h-4 w-4" />
                            {copy('إضافة Google Ads', 'Add Google Ads')}
                          </ShellButton>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-3 lg:grid-cols-2">
                      {paidAdAccounts.map((account) => (
                      <article key={account.id} className="rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-[#5366f6]">{account.platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads'}</p>
                            <p className="mt-1 text-[13px] font-black text-[#111b3f]">{account.platformAccountName || account.platformAccountId}</p>
                            {account.businessName ? <p className="mt-1 text-[11px] font-semibold text-[#7b87a3]">{account.businessName}</p> : null}
                          </div>
                          <StatusPill tone={adExecutionEligible(account, googleAdsConnection) ? 'ready' : 'needs'}>
                            {adExecutionEligible(account, googleAdsConnection) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {adExecutionEligible(account, googleAdsConnection)
                              ? copy('تنفيذ API مؤهل', 'API execution eligible')
                              : account.hasApiAccess
                                ? copy('OAuth مثبت · التنفيذ مقفول', 'OAuth verified · execution locked')
                                : copy('مراجعة فقط', 'Review only')}
                          </StatusPill>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold leading-5 text-[#64708f]">
                          {adExecutionEligible(account, googleAdsConnection)
                            ? copy('الحساب مؤهل لخطوات التنفيذ التي يراجعها المستخدم؛ تظل حالة كل حملة والصلاحيات مطلوبة.', 'The account is eligible for user-reviewed execution steps; campaign state and permissions are still required.')
                            : account.platform === 'GOOGLE' && account.hasApiAccess
                              ? copy(
                                  'تم التحقق من OAuth واكتشاف الحساب، لكن مستوى الوصول المكوّن لا يسمح بالتنفيذ. يظل إنشاء المسودات والتفعيل والإنفاق مقفلاً حتى يتطابق مستوى الحساب والـDeveloper Token.',
                                  'OAuth and account discovery are verified, but the configured access tier does not authorize execution. Platform draft creation, activation, and spend stay locked until the account and developer-token tiers agree.',
                                )
                              : copy('يظل التخطيط متاحاً، لكن NEXUS لن يدّعي إطلاق إعلان أو مزامنة نتائج من هذا الحساب.', 'Planning remains available, but NEXUS will not claim to launch ads or sync results from this account.')}
                        </p>
                        {account.platform === 'GOOGLE' ? (
                          <p className="mt-2 text-[10px] font-bold text-[#7b87a3]">
                            {copy('مستوى الوصول المكوّن', 'Configured access tier')}: {account.apiAccessTier || 'NONE'}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <ShellButton onClick={() => handleConnect(account.platform === 'GOOGLE' ? 'GOOGLE_ADS' : 'META_ADS')} loading={connecting === (account.platform === 'GOOGLE' ? 'GOOGLE_ADS' : 'META_ADS')}>
                            <RefreshCw className="h-4 w-4" />
                            {copy('إعادة الربط والتحقق', 'Reconnect & verify')}
                          </ShellButton>
                          <ShellButton tone="danger" onClick={() => setDisconnectConfirmId(account.id)} loading={disconnecting === account.id}>
                            <Unplug className="h-4 w-4" />
                            {copy('فصل', 'Disconnect')}
                          </ShellButton>
                        </div>
                        {disconnectConfirmId === account.id ? (
                          <div className="mt-3 rounded-[14px] border border-rose-100 bg-rose-50/70 p-3">
                            <p className="text-[12px] font-bold leading-5 text-rose-700">
                              {copy('سيتم مسح رموز الوصول من NEXUS بدون حذف حسابك أو حملاتك على المنصة.', 'NEXUS will clear stored access credentials without deleting your platform account or campaigns.')}
                            </p>
                            <div className="mt-3 flex gap-2">
                              <ShellButton onClick={() => setDisconnectConfirmId(null)}>{copy('إلغاء', 'Cancel')}</ShellButton>
                              <ShellButton tone="danger" onClick={() => handleDisconnectAd(account.id)} loading={disconnecting === account.id}>{copy('تأكيد الفصل', 'Confirm')}</ShellButton>
                            </div>
                          </div>
                        ) : null}
                      </article>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>

              <Panel
                title={copy('تكاملات ضمن خريطة الطريق', 'Roadmap integrations')}
                icon={<Clock3 size={18} />}
                className="mt-5"
                action={<StatusPill tone="planned">{copy('غير تشغيلية', 'Not operational')}</StatusPill>}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {PLATFORMS.filter((platform) => !platform.available && platform.id !== 'GOOGLE').map((platform) => (
                    <article key={platform.id} className="rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-white text-sm font-black" style={{ color: platform.accent }}>
                          {platform.icon}
                        </span>
                        <p className="text-[13px] font-black text-[#111b3f]">{copy(platform.name.ar, platform.name.en)}</p>
                      </div>
                      <p className="mt-3 text-[11px] font-semibold leading-5 text-[#7b87a3]">{copy(platform.helper.ar, platform.helper.en)}</p>
                    </article>
                  ))}
                </div>
              </Panel>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
