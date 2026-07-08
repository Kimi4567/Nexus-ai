'use client'

import AppShell from '@/components/AppShell'
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
  ChevronDown,
  Copy,
  Download,
  Eye,
  FolderOpen,
  ImageIcon,
  Layers,
  Mail,
  MessageSquare,
  Monitor,
  Palette,
  Share2,
  Sparkles,
  Type,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react'

type VisualStyle = 'premium' | 'cinematic' | 'natural' | 'minimal'
type CreativeRatio = '1:1' | '4:5' | '16:9' | '9:16'

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
}: {
  children: React.ReactNode
  tone?: 'primary' | 'secondary' | 'ghost'
  className?: string
}) {
  const toneClass = {
    primary: 'bg-[#071236] text-white shadow-[0_16px_34px_rgba(31,41,130,0.22)] hover:bg-[#101b4d]',
    secondary: 'border border-[#e3e8f3] bg-white text-[#111b3f] hover:border-[#cfd8f2] hover:bg-[#f8faff]',
    ghost: 'border border-transparent bg-transparent text-[#53617f] hover:bg-white',
  }[tone]

  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-semibold transition ${toneClass} ${className}`}
    >
      {children}
    </button>
  )
}

function StudioCard({
  title,
  icon,
  children,
  className = '',
  action,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={`rounded-[22px] border border-[#e5eaf5] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)] ${className}`}>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#e8edf7] bg-[#f8faff] px-4 py-3 text-center">
      <p className="text-[11px] font-semibold text-[#64708f]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#0c1535]">{value}</p>
    </div>
  )
}

function PlatformRow({
  icon,
  name,
  spec,
  ready = true,
}: {
  icon: React.ReactNode
  name: string
  spec: string
  ready?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#edf1f8] bg-[#fbfcff] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</span>
        <span>
          <span className="block text-[13px] font-bold text-[#14204a]">{name}</span>
          <span className="block text-[11px] text-[#7b87a3]">{spec}</span>
        </span>
      </div>
      <span className={`h-5 w-5 rounded-md ${ready ? 'bg-emerald-500' : 'border border-[#cbd4e6] bg-white'}`} />
    </div>
  )
}

export default function StudioPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const { brand } = useBrandBrain()
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('premium')
  const [ratio, setRatio] = useState<CreativeRatio>('4:5')
  const [activeThumb, setActiveThumb] = useState(0)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const brandName = brand?.brandName || copy('منتج العطر الجديد', 'New fragrance product')
  const workspaceName = brand?.brandName || copy('نمي أعمال', 'Growth Workspace')

  const thumbnails = useMemo(() => [
    'from-[#342b26] via-[#a9885b] to-[#f4efe5]',
    'from-[#f9f5ef] via-[#ceb083] to-[#8c6a3e]',
    'from-[#1c1b20] via-[#70675b] to-[#ded5c9]',
    'from-[#1c2a1c] via-[#6a7f4c] to-[#efe7d2]',
    'from-[#11131a] via-[#39404d] to-[#c8b18a]',
  ], [])

  const layers = [
    copy('النص الرئيسي', 'Headline'),
    copy('النص الثانوي', 'Subheading'),
    copy('زر CTA', 'CTA button'),
    copy('المنتج (العطر)', 'Product'),
    copy('الخلفية والإضاءة', 'Background and light'),
    copy('ظلال الأوراق', 'Leaf shadows'),
  ]

  const copyVariants = [
    copy('راحة تترك أثرًا', 'A scent that leaves a mark'),
    copy('فخامة تحكي في كل تفصيلة', 'Luxury in every detail'),
    copy('حيث تبدأ الحكاية', 'Where the story begins'),
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
      <main dir={dir} className="min-h-screen bg-[#f6f8fc] text-[#111b3f]">
        <div className="mx-auto max-w-[1540px] px-6 py-7 lg:px-8">
          <header className="mb-7 flex flex-col gap-5 border-b border-[#dfe6f2] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#071236] text-white shadow-[0_14px_28px_rgba(13,24,63,0.2)]">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#6c7897]">{workspaceName}</p>
                <h1 className="mt-1 flex items-center gap-2 text-[28px] font-black tracking-[-0.02em] text-[#071236]">
                  {copy('استوديو الإبداع', 'Creative Studio')}
                  <Sparkles className="text-[#4f46e5]" size={24} />
                </h1>
                <p className="mt-1 text-sm text-[#60708f]">
                  {copy('حوّل أفكارك إلى محتوى استثنائي مدعوم بالذكاء الاصطناعي.', 'Turn your ideas into premium AI-assisted marketing creatives.')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StudioButton>
                <Eye size={17} />
                {copy('معاينة', 'Preview')}
              </StudioButton>
              <StudioButton>
                <Share2 size={17} />
                {copy('مشاركة', 'Share')}
              </StudioButton>
              <StudioButton tone="primary">
                <Download size={17} />
                {copy('تصدير', 'Export')}
                <ChevronDown size={16} />
              </StudioButton>
            </div>
          </header>

          <nav className="mb-5 flex overflow-x-auto rounded-[18px] border border-[#e1e8f4] bg-white px-2 shadow-sm">
            {[
              copy('نظرة عامة', 'Overview'),
              copy('المشاريع', 'Projects'),
              copy('القوالب', 'Templates'),
              copy('مكتبة الأصول', 'Asset library'),
              copy('التكاملات', 'Integrations'),
              copy('سجل الإصدارات', 'Version history'),
            ].map((label, index) => (
              <button
                key={label}
                type="button"
                className={`min-w-max border-b-2 px-8 py-4 text-sm font-semibold transition ${
                  index === 3
                    ? 'border-[#4f46e5] text-[#321bdc]'
                    : 'border-transparent text-[#65728f] hover:text-[#111b3f]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="grid grid-cols-12 gap-5">
            <StudioCard
              title={copy('موجز الإبداع', 'Creative brief')}
              icon={<Sparkles size={18} />}
              className="col-span-12 lg:col-span-3"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  {copy('حملة', 'Campaign')}
                </span>
                <span className="text-[12px] font-semibold text-[#111b3f]">{brandName}</span>
              </div>
              <div className="space-y-5 text-[13px] leading-6">
                {[
                  [copy('الهدف', 'Goal'), copy('زيادة الوعي والإطلاق عبر منصات التواصل والإلكتروني.', 'Increase awareness and launch across social and digital channels.')],
                  [copy('الجمهور المستهدف', 'Audience'), copy('رجال ونساء 25-45، مهتمون بالفخامة والعطور الراقية.', 'Men and women 25-45 interested in premium fragrances.')],
                  [copy('نبرة الصوت', 'Tone'), copy('راقية، عصرية، ملهمة.', 'Premium, modern, inspiring.')],
                  [copy('النتائج المتوقعة', 'Expected outcomes'), copy('وصول أقوى، تفاعل أعلى، وتحويل أفضل.', 'Higher reach, stronger engagement, better conversion.')],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="font-bold text-[#111b3f]">{label}</p>
                    <p className="mt-1 text-[#6a7692]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <MiniMetric label={copy('الوصول', 'Reach')} value="250K+" />
                <MiniMetric label={copy('التفاعل', 'Engagement')} value="8%+" />
                <MiniMetric label={copy('التحويل', 'Conversion')} value="3%+" />
              </div>
            </StudioCard>

            <StudioCard
              title={copy('المعاينة الرئيسية', 'Main preview')}
              icon={<BadgeCheck size={18} />}
              className="col-span-12 lg:col-span-6"
            >
              <div className={`relative min-h-[330px] overflow-hidden rounded-[20px] bg-gradient-to-br ${thumbnails[activeThumb]} shadow-inner`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_24%,rgba(255,255,255,0.32),transparent_32%),radial-gradient(circle_at_78%_38%,rgba(255,255,255,0.24),transparent_24%)]" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/15 to-transparent" />
                <div className="absolute start-10 top-16 max-w-[320px] text-white">
                  <p className="text-[38px] font-black leading-tight tracking-[-0.03em]">
                    {copy('راحة تترك أثرًا', 'A scent that leaves a mark')}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/86">
                    {copy('اكتشف عطرنا الجديد المستوحى من لحظات لا تُنسى.', 'Discover our new fragrance inspired by unforgettable moments.')}
                  </p>
                  <button type="button" className="mt-6 rounded-xl bg-[#071236] px-6 py-3 text-sm font-bold text-white shadow-xl">
                    {copy('اكتشف الآن', 'Discover now')}
                  </button>
                </div>
                <div className="absolute end-16 top-14 h-56 w-28 rounded-[34px] border border-white/40 bg-gradient-to-b from-white/75 via-[#e0c49b]/75 to-[#785b38]/70 shadow-[0_34px_70px_rgba(0,0,0,0.32)]">
                  <div className="mx-auto mt-[-18px] h-10 w-14 rounded-t-2xl bg-gradient-to-b from-[#d2b073] to-[#7d552c]" />
                  <div className="mx-auto mt-8 h-16 w-16 rounded-full bg-white/24 blur-md" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e3e8f3] bg-white text-[#6a7692]">‹</button>
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
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e3e8f3] bg-white text-[#6a7692]">›</button>
              </div>
            </StudioCard>

            <StudioCard
              title={copy('تعليمات التوليد', 'Generation directions')}
              icon={<Sparkles size={18} />}
              className="col-span-12 lg:col-span-3"
            >
              <label className="text-[12px] font-bold text-[#111b3f]">{copy('وصف الفكرة', 'Idea description')}</label>
              <div className="mt-2 rounded-[16px] border border-[#e3e8f3] bg-[#fbfcff] p-4">
                <p className="text-sm leading-7 text-[#52607d]">
                  {copy(
                    'صورة فاخرة لعطر جديد على صخرة سوداء مع إضاءة ناعمة وظلال أوراق، طابع فاخر وبسيط، ألوان دافئة وتركيز على الزجاج والانعكاسات.',
                    'Premium fragrance on black stone with soft light, leaf shadows, warm minimal styling, and focus on glass reflections.',
                  )}
                </p>
                <p className="mt-3 text-[11px] text-[#8a95ad]">146/500</p>
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

              <div className="mt-5 space-y-2">
                <StudioButton tone="primary" className="w-full">
                  {copy('توليد الآن', 'Generate now')}
                  <Sparkles size={16} />
                </StudioButton>
                <StudioButton className="w-full">
                  {copy('تحسين الفكرة', 'Improve prompt')}
                  <Wand2 size={16} />
                </StudioButton>
              </div>
            </StudioCard>

            <StudioCard title={copy('الأصول', 'Assets')} icon={<FolderOpen size={18} />} className="col-span-12 lg:col-span-3">
              <div className="mb-4 flex gap-2 text-[12px] font-semibold text-[#64708f]">
                {[copy('علامة', 'Brand'), copy('أيقونات', 'Icons'), copy('صور', 'Photos'), copy('مختارة', 'Selected')].map((item, index) => (
                  <button key={item} type="button" className={`rounded-[10px] px-3 py-2 ${index === 3 ? 'border border-[#635bff] text-[#4f46e5]' : 'bg-[#f8faff]'}`}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="rounded-[16px] border border-[#e3e8f3] bg-[#fbfcff] p-4">
                <div className="flex h-24 items-center justify-center rounded-[14px] bg-white">
                  <div className="text-center">
                    <p className="text-2xl font-light tracking-[0.35em] text-[#111b3f]">NEXUS</p>
                    <p className="mt-1 text-[10px] tracking-[0.25em] text-[#7b87a3]">PERFUMES</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  {['#071236', '#d0a45f', '#be8d45', '#f2ede4'].map((color) => (
                    <span key={color} className="h-9 w-9 rounded-lg border border-[#e3e8f3]" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-[16px] border border-[#e3e8f3] bg-white p-4">
                <p className="text-[34px] font-black text-[#111b3f]">Aa</p>
                <p className="text-sm font-semibold text-[#64708f]">Cairo / Tajawal</p>
              </div>
              <button type="button" className="mt-4 w-full text-sm font-bold text-[#4f46e5]">
                {copy('عرض جميع الأصول', 'View all assets')}
              </button>
            </StudioCard>

            <StudioCard title={copy('الطبقات والمكونات', 'Layers and components')} icon={<Layers size={18} />} className="col-span-12 lg:col-span-2">
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

            <StudioCard title={copy('نسخ النصوص', 'Copy variants')} icon={<Copy size={18} />} className="col-span-12 lg:col-span-3">
              <div className="space-y-3">
                {copyVariants.map((variant, index) => (
                  <button
                    type="button"
                    key={variant}
                    className={`w-full rounded-[15px] border px-4 py-3 text-start transition ${
                      index === 0 ? 'border-[#635bff] bg-[#f6f4ff]' : 'border-[#e5eaf5] bg-white'
                    }`}
                  >
                    <span className="block text-sm font-bold text-[#111b3f]">{variant}</span>
                    <span className="mt-1 block text-[11px] text-[#7b87a3]">
                      {index === 0 ? copy('اكتشف عطرنا الجديد المستوحى من لحظات لا تُنسى.', 'A refined launch line for the hero creative.') : copy('نسخة بديلة للمراجعة.', 'Alternative review copy.')}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#4f46e5]">
                <span>+</span>
                {copy('إضافة نسخة جديدة', 'Add new variant')}
              </button>
            </StudioCard>

            <StudioCard title={copy('خيارات CTA', 'CTA options')} icon={<MessageSquare size={18} />} className="col-span-12 lg:col-span-2">
              <div className="space-y-3">
                {[copy('اكتشف الآن', 'Discover now'), copy('تسوّق العطر', 'Shop fragrance'), copy('اطلب الآن', 'Order now')].map((cta, index) => (
                  <button
                    type="button"
                    key={cta}
                    className={`w-full rounded-[13px] border px-4 py-3 text-sm font-bold transition ${
                      index === 0 ? 'border-[#071236] bg-[#071236] text-white' : 'border-[#e5eaf5] bg-white text-[#111b3f]'
                    }`}
                  >
                    {cta}
                  </button>
                ))}
              </div>
              <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-bold text-[#4f46e5]">
                <span>+</span>
                {copy('CTA جديد', 'New CTA')}
              </button>
            </StudioCard>

            <StudioCard title={copy('أماكن النشر', 'Publishing placements')} icon={<Monitor size={18} />} className="col-span-12 lg:col-span-2">
              <div className="grid grid-cols-1 gap-2">
                <PlatformRow icon={<span className="font-black text-pink-500">◎</span>} name="Instagram Feed" spec="1080x1350" />
                <PlatformRow icon={<span className="font-black text-black">♪</span>} name="TikTok" spec="1080x1920" />
                <PlatformRow icon={<span className="font-black text-pink-500">◎</span>} name="Instagram Story" spec="1080x1920" />
                <PlatformRow icon={<span className="font-black text-[#4285F4]">G</span>} name="Google Ads" spec="1200x628" />
                <PlatformRow icon={<span className="font-black text-blue-600">f</span>} name="Facebook Feed" spec="1200x1500" />
                <PlatformRow icon={<Mail className="text-slate-700" size={18} />} name="Email Header" spec="600x200" ready={false} />
              </div>
            </StudioCard>

            <StudioCard title={copy('أدوات الذكاء الاصطناعي', 'AI tools')} icon={<Sparkles size={18} />} className="col-span-12 xl:col-span-10">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                {aiTools.map((tool) => (
                  <button
                    type="button"
                    key={tool.title}
                    className="rounded-[18px] border border-[#e8edf7] bg-[#fbfcff] p-4 text-start transition hover:-translate-y-0.5 hover:border-[#cbd4ff] hover:bg-white"
                  >
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1f0ff] text-[#4f46e5]">{tool.icon}</span>
                    <span className="block text-sm font-bold text-[#111b3f]">{tool.title}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-[#7b87a3]">{tool.helper}</span>
                  </button>
                ))}
              </div>
            </StudioCard>

            <aside className="col-span-12 flex items-center justify-between rounded-[22px] border border-[#dce4f5] bg-[#071236] p-5 text-white shadow-[0_18px_44px_rgba(7,18,54,0.22)] xl:col-span-2 xl:flex-col xl:items-start">
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
