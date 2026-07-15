'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain } from '@/hooks/useBrandBrain'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BadgeCheck,
  FolderOpen,
  Sparkles,
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
  '4:5': { ar: 'منشور عمودي', en: 'Portrait feed', helper: '4:5' },
  '16:9': { ar: 'أفقي', en: 'Landscape', helper: '16:9' },
  '9:16': { ar: 'ستوري / ريلز', en: 'Story / Reel', helper: '9:16' },
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
  const brandTruthReport = reviewBrandTruthConsistency(brand)
  const brandTruthBlocked = !brand || brandTruthReport.status === 'blocked'
  const brandName = brand?.brandName || copy('علامتك التجارية', 'Your brand')
  const campaignName = campaign?.name || copy('لا توجد حملة محددة', 'No campaign selected')
  const campaignHref = campaign ? `/campaigns/${campaign.id}?tab=creative` : '/campaigns'
  const campaignGoal = campaign?.goal || brand?.businessGoal || copy('لم يُحدد بعد في الاستراتيجية', 'Not set in Strategy yet')
  const audience = brand?.targetAudience || copy('غير مكتمل في Brand Brain', 'Missing from Brand Brain')
  const conversionDestination = brand?.conversionDestination?.trim() || ''
  const tone = brand?.toneKeywords?.length
    ? brand.toneKeywords.join(' · ')
    : brand?.writingStyle || copy('غير مكتملة في Brand Brain', 'Missing from Brand Brain')
  const offer = brand?.primaryOffer || copy('العرض الرئيسي غير محدد', 'Primary offer not specified')
  const verifiedProofCount = brand?.verifiedProof?.length ?? 0
  const targetPlatforms = campaign?.platforms?.length ? campaign.platforms : brand?.topPlatforms ?? []
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
            journeyStage="production"
            pageTitle={copy('معاينة الاتجاه الإبداعي', 'Creative direction preview')}
            pageSubtitle={copy(
              'راجع الاتجاه البصري وأصول العلامة قبل إرفاق الوسائط بالمنشورات. أكّد الاتجاه الإبداعي هنا؛ ويظل التوليد داخل مركز المحتوى.',
              'Review visual direction and brand assets before attaching media to posts. Confirm the creative direction here; generation remains in Content Hub.',
            )}
            primaryHref={brandTruthBlocked ? '/brand' : '/content-hub'}
            primaryLabel={brandTruthBlocked ? copy('تصحيح Brand Brain', 'Fix Brand Brain') : copy('مراجعة المحتوى', 'Review content')}
            secondaryHref="/media"
            secondaryLabel={copy('مكتبة الوسائط', 'Media library')}
          />

          {brandTruthBlocked && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-orange-200 bg-orange-50 px-4 py-4 text-orange-950" role="alert">
              <div>
                <p className="text-[13px] font-black">{copy('الاتجاه الإبداعي المشتق محجوب', 'Derived creative direction is blocked')}</p>
                <p className="mt-1 max-w-4xl text-[11px] font-semibold leading-5 text-orange-800">
                  {copy('المجال المحفوظ لا يطابق وصف النشاط، لذلك أخفى NEXUS موجز الحملة والمعاينات المشتقة. تظل أصول العلامة الخام ظاهرة، ولا يبدأ أي توليد أو خصم كريديت.', 'The saved industry conflicts with the business description, so NEXUS has hidden the campaign brief and derived previews. Raw brand assets remain visible, and no generation or credit spend starts.')}
                </p>
              </div>
              <Link href="/brand" className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-orange-700 px-4 text-[11px] font-black text-white">
                {copy('تصحيح Brand Brain', 'Fix Brand Brain')}<ArrowUpRight size={14} />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-12 items-start gap-5">
            {!brandTruthBlocked && (<>
            <StudioCard
              id="studio-brief"
              title={copy('موجز الإبداع', 'Creative brief')}
              icon={<Sparkles size={18} />}
              className="col-span-12 lg:col-span-4"
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
              className="col-span-12 lg:col-span-8"
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
                    {offer}
                  </p>
                  <p className="mt-3 line-clamp-3 max-w-[300px] text-[13px] leading-6 text-white/86">
                    {brand?.description || copy('معاينة تركيب بصري مبنية على السياق المحفوظ. النص النهائي والصورة النهائية غير مُعتمدين.', 'A composition preview based on saved context. Final copy and final imagery are not approved.')}
                  </p>
                  {conversionDestination ? (
                    <span className="mt-6 inline-flex max-w-full rounded-xl bg-[#071236] px-6 py-3 text-sm font-bold text-white shadow-xl">
                      {conversionDestination}
                    </span>
                  ) : (
                    <span className="mt-6 inline-flex rounded-xl border border-white/40 bg-white/12 px-4 py-2 text-[11px] font-bold text-white/85 backdrop-blur">
                      {copy('CTA ينتظر وجهة تحويل معتمدة', 'CTA waits for an approved destination')}
                    </span>
                  )}
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
              className="col-span-12 lg:col-span-6"
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

            </>)}

            <StudioCard id="studio-assets" title={copy('الأصول', 'Assets')} icon={<FolderOpen size={18} />} className={`col-span-12 scroll-mt-6 ${brandTruthBlocked ? '' : 'lg:col-span-6'}`}>
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

          </div>
        </div>
      </main>
    </AppShell>
  )
}
