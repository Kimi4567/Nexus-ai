'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain } from '@/hooks/useBrandBrain'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  Brush,
  Copy,
  Eye,
  FolderOpen,
  ImageIcon,
  Layers,
  Mail,
  MessageSquare,
  Monitor,
  Palette,
  Sparkles,
  Type,
  Upload,
  Zap,
} from 'lucide-react'

type VisualStyle = 'premium' | 'cinematic' | 'natural' | 'minimal'
type CreativeRatio = '1:1' | '4:5' | '16:9' | '9:16'

interface StudioCampaign {
  id: string
  name: string
  goal?: string | null
  status?: string | null
  platforms?: string[]
  updatedAt?: string
}

const styleLabels: Record<VisualStyle, { ar: string; en: string }> = {
  premium: { ar: 'فخم', en: 'Premium' },
  cinematic: { ar: 'سينمائي', en: 'Cinematic' },
  natural: { ar: 'مستوحى من الطبيعة', en: 'Natural' },
  minimal: { ar: 'بسيط', en: 'Minimal' },
}

const ratioLabels: Record<CreativeRatio, { ar: string; en: string; helper: string }> = {
  '1:1': { ar: 'منشورات', en: 'Feed', helper: '1:1' },
  '4:5': { ar: 'ريلز', en: 'Portrait', helper: '4:5' },
  '16:9': { ar: 'أفقي', en: 'Landscape', helper: '16:9' },
  '9:16': { ar: 'ستوري', en: 'Story', helper: '9:16' },
}

function StudioButton({
  children,
  tone = 'secondary',
  className = '',
  disabled = false,
  href,
  onClick,
  title,
}: {
  children: React.ReactNode
  tone?: 'primary' | 'secondary' | 'ghost'
  className?: string
  disabled?: boolean
  href?: string
  onClick?: () => void
  title?: string
}) {
  const toneClass = {
    primary: 'bg-[#071236] text-white shadow-[0_16px_34px_rgba(31,41,130,0.22)] hover:bg-[#101b4d]',
    secondary: 'border border-[#e3e8f3] bg-white text-[#111b3f] hover:border-[#cfd8f2] hover:bg-[#f8faff]',
    ghost: 'border border-transparent bg-transparent text-[#53617f] hover:bg-white',
  }[tone]

  const classes = `inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${toneClass} ${className}`

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={title}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={classes}
    >
      {children}
    </button>
  )
}

function StudioCard({
  id,
  title,
  icon,
  children,
  className = '',
  action,
}: {
  id?: string
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section id={id} className={`nx-os-card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#111b3f]">
          {icon ? <span className="text-[#4f46e5]">{icon}</span> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function MiniMetric({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-[14px] border border-[#e8edf7] bg-[#f8faff] px-4 py-3 text-center">
      <p className="text-[11px] font-semibold text-[#64708f]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#0c1535]">{value}</p>
      {helper ? <p className="mt-1 text-[10px] leading-4 text-[#7b87a3]">{helper}</p> : null}
    </div>
  )
}

function PlatformRow({
  icon,
  name,
  spec,
  ready = true,
  readyLabel,
  missingLabel,
}: {
  icon: React.ReactNode
  name: string
  spec: string
  ready?: boolean
  readyLabel: string
  missingLabel: string
}) {
  return (
    <div className="rounded-[14px] border border-[#edf1f8] bg-[#fbfcff] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-bold text-[#14204a]">{name}</span>
          <span className="block text-[11px] text-[#7b87a3]">{spec}</span>
        </span>
      </div>
      <span className={`mt-2 block w-full rounded-full px-2 py-1 text-center text-[10px] font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {ready ? readyLabel : missingLabel}
      </span>
    </div>
  )
}

export default function StudioPage() {
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const { brand, loading: brandLoading } = useBrandBrain()
  const [campaign, setCampaign] = useState<StudioCampaign | null>(null)
  const [campaignLoading, setCampaignLoading] = useState(true)
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('premium')
  const [ratio, setRatio] = useState<CreativeRatio>('4:5')
  const [activeThumb, setActiveThumb] = useState(0)
  const [activeSection, setActiveSection] = useState('studio-overview')
  const [selectedCopyVariant, setSelectedCopyVariant] = useState(0)
  const [selectedCta, setSelectedCta] = useState(0)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return

    let cancelled = false
    const loadLatestCampaign = async () => {
      setCampaignLoading(true)
      try {
        const response = await fetch('/api/campaigns?limit=20&sort=updatedAt', {
          headers: { Authorization: authHeader() },
        })
        if (!response.ok) return
        const payload = await response.json()
        const campaigns = Array.isArray(payload.campaigns) ? payload.campaigns : []
        if (!cancelled) setCampaign(campaigns[0] ?? null)
      } catch {
        if (!cancelled) setCampaign(null)
      } finally {
        if (!cancelled) setCampaignLoading(false)
      }
    }

    void loadLatestCampaign()
    return () => {
      cancelled = true
    }
  }, [authHeader, authLoading, isAuthenticated])

  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const brandName = brand?.brandName || copy('علامتك التجارية', 'Your brand')
  const campaignName = campaign?.name || copy('لا توجد حملة محددة', 'No campaign selected')
  const campaignHref = campaign ? `/campaigns/${campaign.id}?tab=creative` : '/campaigns'
  const campaignGoal = campaign?.goal || brand?.businessGoal || copy('لم يُحدد بعد في الاستراتيجية', 'Not set in Strategy yet')
  const audience = brand?.targetAudience || copy('غير مكتمل في Brand Brain', 'Missing from Brand Brain')
  const tone = brand?.toneKeywords?.length
    ? brand.toneKeywords.join(' · ')
    : brand?.writingStyle || copy('غير مكتملة في Brand Brain', 'Missing from Brand Brain')
  const offer = brand?.primaryOffer || copy('العرض الرئيسي غير محدد', 'Primary offer not specified')
  const verifiedProofCount = brand?.verifiedProof?.length ?? 0
  const targetPlatforms = campaign?.platforms?.length ? campaign.platforms : brand?.topPlatforms ?? []
  const normalizedPlatforms = targetPlatforms.map((platform) => platform.toLowerCase())
  const hasPlatform = (...aliases: string[]) => normalizedPlatforms.some((platform) => aliases.some((alias) => platform.includes(alias)))
  const safeBrandColors = (brand?.colorPalette ?? []).filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 4)
  const palette = safeBrandColors.length ? safeBrandColors : ['#071236', '#5E63FF', '#E8ECF7', '#F8FAFC']
  const usingNeutralPalette = safeBrandColors.length === 0

  const thumbnails = useMemo(() => [
    'from-[#342b26] via-[#a9885b] to-[#f4efe5]',
    'from-[#f9f5ef] via-[#ceb083] to-[#8c6a3e]',
    'from-[#1c1b20] via-[#70675b] to-[#ded5c9]',
    'from-[#1c2a1c] via-[#6a7f4c] to-[#efe7d2]',
    'from-[#11131a] via-[#39404d] to-[#c8b18a]',
  ], [])

  const cycleThumb = (directionValue: -1 | 1) => {
    setActiveThumb((current) => (current + directionValue + thumbnails.length) % thumbnails.length)
  }

  const jumpToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const layers = [
    copy('النص الرئيسي', 'Headline'),
    copy('النص الثانوي', 'Subheading'),
    copy('زر CTA', 'CTA button'),
    copy('شعار أو اسم العلامة', 'Logo or brand name'),
    copy('خلفية المسودة', 'Draft background'),
    copy('مساحة آمنة', 'Safe zone'),
  ]

  const copyVariants = [
    brandName,
    offer,
    campaignName,
  ]

  const ctaOptions = [
    copy('راجع التفاصيل', 'Review details'),
    copy('اعرف المزيد', 'Learn more'),
    copy('تواصل معنا', 'Contact us'),
  ]

  const aiTools = [
    { icon: <Brush size={18} />, title: copy('تحسين النص', 'Polish copy'), helper: copy('حسّن وضوح وجاذبية النصوص تلقائياً.', 'Improve clarity and appeal automatically.') },
    { icon: <Sparkles size={18} />, title: copy('إزالة الخلفية', 'Remove background'), helper: copy('نظّف الخلفية واحتفظ بحواف المنتج.', 'Clean background while preserving product edges.') },
    { icon: <Upload size={18} />, title: copy('توسيع الصورة', 'Expand image'), helper: copy('وسّع أبعاد الصورة مع الحفاظ على النسق.', 'Expand image dimensions while preserving composition.') },
    { icon: <Palette size={18} />, title: copy('تغيير النمط', 'Change style'), helper: copy('حوّل الاتجاه البصري لأنماط مختلفة.', 'Translate the visual into different styles.') },
    { icon: <Zap size={18} />, title: copy('توليد نسخة بديلة', 'Generate variant'), helper: copy('أنشئ خياراً إبداعياً جديداً للمراجعة.', 'Create another creative option for review.') },
  ]

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={copy('استوديو الإبداع', 'Creative Studio')}
            pageSubtitle={copy('تحويل الاستراتيجية والأصول إلى اتجاهات إبداعية قابلة للمراجعة.', 'Turn strategy and assets into reviewable creative directions.')}
            primaryHref="/content-hub"
            primaryLabel={copy('افتح مركز المحتوى', 'Open Content Hub')}
            secondaryHref="/brand"
            secondaryLabel="Brand Brain"
          />

          <StrategySpineCard
            current="creative"
            nextHref="/content-hub"
            nextLabel={copy('راجع المنشورات النهائية', 'Review final posts')}
            title={copy('الإبداع يترجم الاستراتيجية، ولا يستبدل Content Hub', 'Creative translates strategy, not Content Hub')}
            body={copy(
              'هذه الصفحة تحول الهدف والجمهور والرسائل إلى اتجاه بصري قابل للمراجعة. لا يتم توليد أو إرفاق أو نشر أصل نهائي من هنا بدون مسار مؤكد لاحقاً.',
              'This page turns goal, audience, and messages into a reviewable visual direction. It does not generate, attach, or publish final assets without a later confirmed flow.',
            )}
            className="mb-5"
          />

          <nav id="studio-overview" className="nx-os-card mb-5 flex scroll-mt-6 overflow-x-auto px-2">
            {[
              { id: 'studio-overview', label: copy('نظرة عامة', 'Overview') },
              { id: 'studio-brief', label: copy('الموجز', 'Brief') },
              { id: 'studio-directions', label: copy('القوالب', 'Templates') },
              { id: 'studio-assets', label: copy('مكتبة الأصول', 'Asset library') },
              { id: 'studio-placements', label: copy('أماكن النشر', 'Placements') },
              { id: 'studio-tools', label: copy('أدوات مخططة', 'Planned tools') },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpToSection(item.id)}
                className={`min-w-max border-b-2 px-8 py-4 text-sm font-semibold transition ${
                  activeSection === item.id
                    ? 'border-[#4f46e5] text-[#321bdc]'
                    : 'border-transparent text-[#65728f] hover:text-[#111b3f]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="grid grid-cols-12 items-start gap-5">
            <StudioCard
              id="studio-brief"
              title={copy('موجز الإبداع', 'Creative brief')}
              icon={<Sparkles size={18} />}
              className="col-span-12 lg:col-span-3"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  {campaign ? copy('أحدث حملة محفوظة', 'Latest saved campaign') : copy('السياق غير مكتمل', 'Context incomplete')}
                </span>
                <Link href={campaignHref} dir="auto" className="text-[12px] font-semibold text-[#4f46e5] hover:underline">
                  {campaignLoading || brandLoading ? copy('جارٍ التحميل...', 'Loading...') : campaignName}
                </Link>
              </div>
              <div className="space-y-5 text-[13px] leading-6">
                {[
                  [copy('الهدف المحفوظ', 'Saved goal'), campaignGoal],
                  [copy('الجمهور المستهدف', 'Audience'), audience],
                  [copy('نبرة الصوت', 'Tone'), tone],
                  [copy('حدود القياس', 'Measurement boundary'), copy('لا توجد وعود أداء قبل اتصال التحليلات ووجود بيانات حقيقية.', 'No performance promise is shown before analytics are connected and real data exists.')],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="font-bold text-[#111b3f]">{label}</p>
                    <p className="mt-1 line-clamp-4 text-[#6a7692]" title={value}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <MiniMetric
                  label={copy('سياق الحملة', 'Campaign context')}
                  value={campaign ? copy('متاح', 'Available') : copy('ناقص', 'Missing')}
                  helper={copy('بيانات محفوظة فقط', 'Saved data only')}
                />
                <MiniMetric
                  label={copy('إثباتات موثقة', 'Verified proof')}
                  value={String(verifiedProofCount)}
                  helper={copy('من Brand Brain', 'From Brand Brain')}
                />
                <MiniMetric
                  label={copy('قنوات مستهدفة', 'Target channels')}
                  value={String(targetPlatforms.length)}
                  helper={copy('من الحملة أو العلامة', 'Campaign or brand')}
                />
              </div>
            </StudioCard>

            <StudioCard
              id="studio-preview"
              title={copy('المعاينة الرئيسية', 'Main preview')}
              icon={<BadgeCheck size={18} />}
              className="col-span-12 lg:col-span-6"
            >
              <div className={`relative min-h-[330px] overflow-hidden rounded-[20px] bg-gradient-to-br ${thumbnails[activeThumb]} shadow-inner`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_24%,rgba(255,255,255,0.32),transparent_32%),radial-gradient(circle_at_78%_38%,rgba(255,255,255,0.24),transparent_24%)]" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent" />
                <div className="absolute start-10 top-16 max-w-[320px] text-white">
                  <div className="mb-4 flex flex-wrap gap-2 text-[10px] font-bold">
                    <span className="rounded-full bg-white/16 px-3 py-1.5 backdrop-blur">{copy('مسودة مراجعة', 'Review draft')}</span>
                    <span className="rounded-full bg-white/16 px-3 py-1.5 backdrop-blur">{ratio}</span>
                    <span className="rounded-full bg-white/16 px-3 py-1.5 backdrop-blur">{copy(styleLabels[visualStyle].ar, styleLabels[visualStyle].en)}</span>
                  </div>
                  <p className="line-clamp-2 break-words text-[34px] font-black leading-tight tracking-[-0.03em]">
                    {copyVariants[selectedCopyVariant]}
                  </p>
                  <p className="mt-3 line-clamp-3 max-w-[300px] text-[13px] leading-6 text-white/86">
                    {brand?.description || copy('معاينة تركيب بصري مبنية على السياق المحفوظ. النص النهائي والصورة النهائية غير مُعتمدين.', 'A composition preview based on saved context. Final copy and final imagery are not approved.')}
                  </p>
                  <span className="mt-6 inline-flex rounded-xl bg-[#071236] px-6 py-3 text-sm font-bold text-white shadow-xl">
                    {ctaOptions[selectedCta]}
                  </span>
                </div>
                <div className="absolute end-12 top-14 flex h-56 w-44 items-center justify-center rounded-[34px] border border-white/40 bg-white/14 px-5 text-center text-white shadow-[0_34px_70px_rgba(0,0,0,0.24)] backdrop-blur-md">
                  <div>
                    {brand?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brand.logoUrl} alt={copy(`شعار ${brandName}`, `${brandName} logo`)} className="mx-auto max-h-20 max-w-full object-contain" />
                    ) : (
                      <Sparkles className="mx-auto text-white/90" size={42} />
                    )}
                    <p className="mt-4 text-sm font-black">{brandName}</p>
                    <p className="mt-1 text-[10px] text-white/74">{copy('عنصر علامة قابل للاستبدال', 'Replaceable brand layer')}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={() => cycleThumb(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e3e8f3] bg-white text-[#6a7692]">‹</button>
                <div className="grid flex-1 grid-cols-5 gap-2">
                  {thumbnails.map((tone, index) => (
                    <button
                      type="button"
                      key={tone}
                      onClick={() => setActiveThumb(index)}
                      className={`h-16 rounded-xl border-2 bg-gradient-to-br ${tone} ${activeThumb === index ? 'border-[#4f46e5]' : 'border-transparent'}`}
                      aria-label={copy(`اختيار المعاينة ${index + 1}`, `Select preview ${index + 1}`)}
                    />
                  ))}
                </div>
                <button type="button" onClick={() => cycleThumb(1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e3e8f3] bg-white text-[#6a7692]">›</button>
              </div>
            </StudioCard>

            <StudioCard
              id="studio-directions"
              title={copy('تعليمات التوليد', 'Generation directions')}
              icon={<Sparkles size={18} />}
              className="col-span-12 lg:col-span-3"
            >
              <label className="text-[12px] font-bold text-[#111b3f]">{copy('وصف الفكرة', 'Idea description')}</label>
              <div className="mt-2 rounded-[16px] border border-[#e3e8f3] bg-[#fbfcff] p-4">
                <p className="text-sm leading-7 text-[#52607d]">
                  {copy(
                    `مسودة خلفية بصرية لحملة «${campaignName}» وبأسلوب ${styleLabels[visualStyle].ar}. تستخدم ألوان العلامة عند توفرها، وتترك النص والشعار والقياسات كطبقات منفصلة قابلة للمراجعة. لا تتضمن أرقام أداء أو ادعاءات غير موثقة.`,
                    `Draft visual background for “${campaignName}” in a ${styleLabels[visualStyle].en.toLowerCase()} direction. Use saved brand colors when available; keep copy, logo, and metrics as separate reviewable layers. Do not render unverified performance figures or claims.`,
                  )}
                </p>
                <p className="mt-3 text-[11px] font-semibold text-[#8a95ad]">{copy('وصف مشتق من السياق الحالي، وليس أمر توليد.', 'Derived from current context; this is not a generation command.')}</p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[12px] font-bold text-[#111b3f]">{copy('النمط البصري', 'Visual style')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(styleLabels) as VisualStyle[]).map((style) => (
                    <button
                      type="button"
                      key={style}
                      onClick={() => setVisualStyle(style)}
                      className={`rounded-[12px] border px-3 py-2 text-sm font-semibold transition ${
                        visualStyle === style
                          ? 'border-[#635bff] bg-[#f3f1ff] text-[#4f46e5]'
                          : 'border-[#e5eaf5] bg-white text-[#66728f]'
                      }`}
                    >
                      {copy(styleLabels[style].ar, styleLabels[style].en)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[12px] font-bold text-[#111b3f]">{copy('الأبعاد', 'Format')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(ratioLabels) as CreativeRatio[]).map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setRatio(item)}
                      className={`rounded-[12px] border px-2 py-2 text-center transition ${
                        ratio === item
                          ? 'border-[#635bff] bg-[#f3f1ff] text-[#4f46e5]'
                          : 'border-[#e5eaf5] bg-white text-[#66728f]'
                      }`}
                    >
                      <span className="block text-sm font-black">{item}</span>
                      <span className="mt-1 block text-[10px] font-semibold">{copy(ratioLabels[item].ar, ratioLabels[item].en)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[15px] border border-[#e3e8f3] bg-[#f8faff] p-3">
                <p className="text-[11px] font-semibold leading-5 text-[#64708f]">
                  {copy('التوليد يبدأ من منشور محدد داخل مركز المحتوى بعد مراجعة التكلفة والتأكيد. هذه اللوحة للمعاينة فقط.', 'Generation starts from a specific post in Content Hub after cost review and confirmation. This desk is preview-only.')}
                </p>
                <Link href="/content-hub" className="mt-3 inline-flex items-center gap-2 text-[12px] font-black text-[#4f46e5]">
                  {copy('فتح مركز المحتوى', 'Open Content Hub')}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </StudioCard>

            <StudioCard id="studio-assets" title={copy('الأصول', 'Assets')} icon={<FolderOpen size={18} />} className="col-span-12 scroll-mt-6 lg:col-span-3">
              <p className="mb-4 text-[11px] leading-5 text-[#6a7692]">
                {copy('يعرض هذا القسم أصول Brand Brain الحالية فقط. مكتبة الوسائط هي مصدر ملفات الصور والفيديو.', 'This section shows current Brand Brain assets only. Media Library remains the source for image and video files.')}
              </p>
              <div className="rounded-[16px] border border-[#e3e8f3] bg-[#fbfcff] p-4">
                <div className="flex h-24 items-center justify-center rounded-[14px] bg-white">
                  {brand?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logoUrl} alt={copy(`شعار ${brandName}`, `${brandName} logo`)} className="max-h-16 max-w-[82%] object-contain" />
                  ) : (
                    <div className="text-center">
                      <p className="text-xl font-black text-[#111b3f]">{brandName}</p>
                      <p className="mt-1 text-[10px] font-semibold text-[#7b87a3]">{copy('بديل نصي لعدم وجود شعار محفوظ', 'Text fallback: no saved logo')}</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  {palette.map((color) => (
                    <span key={color} className="h-9 w-9 rounded-lg border border-[#e3e8f3]" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <p className="mt-3 text-[10px] font-semibold text-[#7b87a3]">
                  {usingNeutralPalette
                    ? copy('ألوان واجهة محايدة مؤقتة؛ لم تُحفظ لوحة ألوان للعلامة.', 'Neutral UI fallback; no brand palette is saved.')
                    : copy('لوحة الألوان المحفوظة في Brand Brain.', 'Palette saved in Brand Brain.')}
                </p>
              </div>
              <div className="mt-4 rounded-[16px] border border-[#e3e8f3] bg-white p-4">
                <p className="text-[34px] font-black text-[#111b3f]">Aa</p>
                <p className="text-sm font-semibold text-[#64708f]">{copy('خط الواجهة الحالي؛ الطباعة الخاصة بالعلامة غير محفوظة.', 'Current UI type; brand typography is not saved.')}</p>
              </div>
              <Link href="/media" className="mt-4 block w-full text-center text-sm font-bold text-[#4f46e5]">
                {copy('عرض جميع الأصول', 'View all assets')}
              </Link>
            </StudioCard>

            <StudioCard id="studio-layers" title={copy('الطبقات والمكونات', 'Layers and components')} icon={<Layers size={18} />} className="col-span-12 scroll-mt-6 lg:col-span-2">
              <div className="space-y-2">
                {layers.map((layer, index) => (
                  <div key={layer} className="flex items-center justify-between rounded-[12px] border border-[#edf1f8] bg-[#fbfcff] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Eye size={13} className="text-[#64708f]" />
                      {index < 3 ? <Type size={13} className="text-[#64708f]" /> : <ImageIcon size={13} className="text-[#64708f]" />}
                      <span className="text-[12px] font-semibold text-[#33415f]">{layer}</span>
                    </div>
                    <span className="text-[#9aa5bb]">⋮⋮</span>
                  </div>
                ))}
              </div>
            </StudioCard>

            <StudioCard id="studio-copy" title={copy('نسخ النصوص', 'Copy variants')} icon={<Copy size={18} />} className="col-span-12 scroll-mt-6 lg:col-span-3">
              <div className="space-y-3">
                {copyVariants.map((variant, index) => (
                  <button
                    type="button"
                    key={variant}
                    onClick={() => setSelectedCopyVariant(index)}
                    className={`w-full rounded-[15px] border px-4 py-3 text-start transition ${
                      selectedCopyVariant === index ? 'border-[#635bff] bg-[#f6f4ff]' : 'border-[#e5eaf5] bg-white'
                    }`}
                  >
                    <span className="line-clamp-4 block text-sm font-bold text-[#111b3f]" title={variant}>{variant}</span>
                    <span className="mt-1 block text-[11px] text-[#7b87a3]">
                      {index === 0
                        ? copy('اسم العلامة المحفوظ؛ ليس عنوان إعلان نهائياً.', 'Saved brand name; not a final ad headline.')
                        : index === 1
                          ? copy('العرض المحفوظ في Brand Brain؛ يحتاج صياغة منشور معتمدة.', 'Saved Brand Brain offer; it still needs approved post copy.')
                          : copy('اسم أحدث حملة محفوظة؛ يستخدم للسياق فقط.', 'Latest saved campaign name; context only.')}
                    </span>
                  </button>
                ))}
              </div>
              <Link href="/content-hub" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#4f46e5]">
                {copy('راجع النسخ داخل المنشور', 'Review copy inside the post')}
                <ArrowUpRight size={14} />
              </Link>
            </StudioCard>

            <StudioCard title={copy('خيارات CTA', 'CTA options')} icon={<MessageSquare size={18} />} className="col-span-12 lg:col-span-2">
              <p className="mb-3 text-[11px] leading-5 text-[#6a7692]">
                {copy('خيارات صياغة أولية للمعاينة فقط. CTA النهائي يأتي من الاستراتيجية والمنشور المحدد.', 'Draft preview labels only. Final CTA comes from the strategy and selected post.')}
              </p>
              <div className="space-y-3">
                {ctaOptions.map((cta, index) => (
                  <button
                    type="button"
                    key={cta}
                    onClick={() => setSelectedCta(index)}
                    className={`w-full rounded-[13px] border px-4 py-3 text-sm font-bold transition ${
                      selectedCta === index ? 'border-[#071236] bg-[#071236] text-white' : 'border-[#e5eaf5] bg-white text-[#111b3f]'
                    }`}
                  >
                    {cta}
                  </button>
                ))}
              </div>
              <Link href="/strategy" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#4f46e5]">
                {copy('راجع CTA في الاستراتيجية', 'Review CTA in strategy')}
                <ArrowUpRight size={14} />
              </Link>
            </StudioCard>

            <StudioCard id="studio-placements" title={copy('أماكن النشر', 'Publishing placements')} icon={<Monitor size={18} />} className="col-span-12 scroll-mt-6 lg:col-span-2">
              <p className="mb-3 text-[11px] leading-5 text-[#6a7692]">
                {targetPlatforms.length
                  ? copy('تُعرض القنوات الموجودة في الحملة أو Brand Brain كنطاق، وليس كحسابات متصلة أو جاهزة للنشر.', 'Campaign or Brand Brain channels are shown as scope, not as connected or publish-ready accounts.')
                  : copy('لا توجد قنوات مستهدفة محفوظة بعد.', 'No target channels are saved yet.')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                <PlatformRow icon={<span className="font-black text-pink-500">◎</span>} name="Instagram Feed" spec="1080x1350" ready={hasPlatform('instagram')} readyLabel={copy('ضمن النطاق', 'In scope')} missingLabel={copy('غير محدد', 'Not selected')} />
                <PlatformRow icon={<span className="font-black text-black">♪</span>} name="TikTok" spec="1080x1920" ready={hasPlatform('tiktok')} readyLabel={copy('ضمن النطاق', 'In scope')} missingLabel={copy('غير محدد', 'Not selected')} />
                <PlatformRow icon={<span className="font-black text-pink-500">◎</span>} name="Instagram Story" spec="1080x1920" ready={hasPlatform('instagram')} readyLabel={copy('ضمن النطاق', 'In scope')} missingLabel={copy('غير محدد', 'Not selected')} />
                <PlatformRow icon={<span className="font-black text-[#4285F4]">G</span>} name="Google Ads" spec="1200x628" ready={hasPlatform('google')} readyLabel={copy('ضمن النطاق', 'In scope')} missingLabel={copy('غير محدد', 'Not selected')} />
                <PlatformRow icon={<span className="font-black text-blue-600">f</span>} name="Facebook Feed" spec="1200x1500" ready={hasPlatform('facebook', 'meta')} readyLabel={copy('ضمن النطاق', 'In scope')} missingLabel={copy('غير محدد', 'Not selected')} />
                <PlatformRow icon={<Mail className="text-slate-700" size={18} />} name="Email Header" spec="600x200" ready={hasPlatform('email')} readyLabel={copy('ضمن النطاق', 'In scope')} missingLabel={copy('غير محدد', 'Not selected')} />
              </div>
            </StudioCard>

            <StudioCard id="studio-tools" title={copy('أدوات الذكاء الاصطناعي', 'AI tools')} icon={<Sparkles size={18} />} className="col-span-12 scroll-mt-6 xl:col-span-10">
              <p className="mb-4 text-[11px] leading-5 text-[#6a7692]">
                {copy('هذه قدرات مخططة وليست إجراءات متاحة في هذه الصفحة. تظهر كمعلومات فقط حتى يكتمل لكل أداة مسار تكلفة وتأكيد وحفظ واضح.', 'These are planned capabilities, not actions available on this page. They remain informational until each has an explicit cost, confirmation, and save path.')}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {aiTools.map((tool) => (
                  <div
                    key={tool.title}
                    title={copy('هذه أداة مخططة وتحتاج مسار تأكيد قبل أي تكلفة أو تعديل.', 'This planned tool needs a confirmation flow before any cost or edit.')}
                    className="rounded-[18px] border border-[#e8edf7] bg-[#fbfcff] p-4 text-start"
                  >
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1f0ff] text-[#4f46e5]">{tool.icon}</span>
                    <span className="block text-sm font-bold text-[#111b3f]">{tool.title}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-[#7b87a3]">{tool.helper}</span>
                    <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {copy('مخطط — غير متاح', 'Planned — unavailable')}
                    </span>
                  </div>
                ))}
              </div>
            </StudioCard>

            <aside className="col-span-12 flex items-center justify-between rounded-[14px] border border-[#dce4f5] bg-[#071236] p-5 text-white shadow-[0_18px_44px_rgba(7,18,54,0.22)] xl:col-span-2 xl:flex-col xl:items-start">
              <div>
                <p className="text-lg font-black">Nexus {copy('مساعد', 'Assistant')}</p>
                <p className="mt-1 text-sm text-white/72">{copy('جاهز لمساعدتك في الإبداع.', 'Ready to help with creative work.')}</p>
              </div>
              <Link href="/content-hub" className="mt-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white xl:mt-6">
                <ArrowUpRight size={20} />
              </Link>
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
