'use client'

import Link from 'next/link'
import { useState, type ElementType } from 'react'
import {
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  LineChart,
  LockKeyhole,
  Menu,
  MessageSquareText,
  MonitorCheck,
  MousePointerClick,
  PackageCheck,
  PanelsTopLeft,
  Radar,
  RefreshCw,
  Route,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wand2,
  Workflow,
  X,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { FREE_TRIAL_CREDITS, PUBLIC_PAID_PLANS, type PublicPaidPlan } from '@/lib/commercialPlans'

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'NEXUS AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.nexus-grow.com',
  description:
    'AI marketing operating system for brand intelligence, strategy, content production, approvals, scheduled operations, lead management, and evidence-backed learning.',
}

function Header({ ar, setLang }: { ar: boolean; setLang: (lang: 'ar' | 'en') => void }) {
  const [open, setOpen] = useState(false)
  const links = [
    { href: '#product', label: ar ? 'المنتج' : 'Product' },
    { href: '#capabilities', label: ar ? 'الإمكانات' : 'Capabilities' },
    { href: '#workflow', label: ar ? 'طريقة العمل' : 'Workflow' },
    { href: '#pricing', label: ar ? 'الأسعار' : 'Pricing' },
  ]

  return (
    <header className="nx-public-header sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="nx-brand-lockup" aria-label="NEXUS AI home">
          <span className="nx-brand-mark h-9 w-9">
            <Sparkles className="relative z-10 h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="nx-brand-word">NEXUS</span>
            <span className="nx-brand-caption">AI MARKETING OS</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label={ar ? 'التنقل الرئيسي' : 'Primary navigation'}>
          {links.map((link) => (
            <a key={link.href} href={link.href} className="nx-public-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => setLang(ar ? 'en' : 'ar')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-3 text-[12px] font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
            aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            {ar ? 'English' : 'العربية'}
          </button>
          <Link href="/auth/login" className="rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-white/70 hover:text-slate-950">
            {ar ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
          <Link href="/auth/register" className="nx-public-button-primary min-h-9 rounded-xl px-4 text-[12px]">
            {ar ? 'ابدأ مجاناً' : 'Start free'}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-slate-200/80 bg-white/70 p-2 text-slate-700 hover:bg-white md:hidden"
          aria-label={ar ? 'فتح القائمة' : 'Open menu'}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#f6f8fc] md:hidden">
          <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4">
            <span className="nx-brand-word">NEXUS</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700"
              aria-label={ar ? 'إغلاق القائمة' : 'Close menu'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col px-4 py-6" aria-label={ar ? 'التنقل على الهاتف' : 'Mobile navigation'}>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-slate-200/80 py-4 text-[20px] font-semibold text-slate-950"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setLang(ar ? 'en' : 'ar')
                setOpen(false)
              }}
              className="mt-6 text-start text-[16px] font-medium text-slate-700"
            >
              {ar ? 'English' : 'العربية'}
            </button>
            <Link href="/auth/register" className="nx-public-button-primary mt-8">
              {ar ? 'ابدأ مجاناً' : 'Start free'}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

function SectionTitle({
  eyebrow,
  title,
  body,
  align = 'center',
}: {
  eyebrow: string
  title: string
  body: string
  align?: 'center' | 'start'
}) {
  return (
    <div className={align === 'center' ? 'mx-auto mb-10 max-w-3xl text-center sm:mb-12' : 'mb-9 max-w-3xl text-start'}>
      <p className="nx-section-kicker mb-4">{eyebrow}</p>
      <h2 className="nx-section-title text-balance">{title}</h2>
      <p className={`mt-5 max-w-2xl text-pretty text-[16px] leading-7 text-slate-600 sm:text-[17px] ${align === 'center' ? 'mx-auto' : ''}`}>{body}</p>
    </div>
  )
}

function ProductSystemPreview({ ar }: { ar: boolean }) {
  const stages = [
    {
      icon: Brain,
      label: 'Brand Brain',
      body: ar ? 'هوية، عرض، جمهور، نبرة، أدلة ومنافسون' : 'Identity, offer, audience, voice, proof, and competitors',
      state: ar ? 'مصدر الحقيقة' : 'Source of truth',
    },
    {
      icon: Target,
      label: ar ? 'خطّط' : 'Plan',
      body: ar ? 'استراتيجية، حملات، زوايا وخطة محتوى' : 'Strategy, campaigns, angles, and content plans',
      state: ar ? 'مسودة للمراجعة' : 'Reviewable draft',
    },
    {
      icon: Wand2,
      label: ar ? 'أنتج' : 'Produce',
      body: ar ? 'نصوص، صور، فيديو وصفحات هبوط' : 'Copy, media, video, and landing pages',
      state: ar ? 'بوابة جودة' : 'Quality gate',
    },
    {
      icon: ClipboardCheck,
      label: ar ? 'تحكّم' : 'Control',
      body: ar ? 'مراجعات، موافقات وجدولة داخلية' : 'Reviews, approvals, and internal schedules',
      state: ar ? 'موافقة منفصلة' : 'Separate approval',
    },
    {
      icon: LineChart,
      label: ar ? 'تعلّم' : 'Learn',
      body: ar ? 'عملاء محتملون، أداء ومقترحات تحسين' : 'Leads, performance, and improvement proposals',
      state: ar ? 'بيانات موثقة' : 'Evidence-backed',
    },
  ]

  return (
    <div className="nx-system-map mx-auto mt-14 max-w-6xl text-start sm:mt-16">
      <div className="nx-system-map-toolbar">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <span className="font-mono text-[10px] font-medium text-slate-500 sm:text-[11px]">
          {ar ? 'مسار عمل تسويقي واحد' : 'One marketing operating flow'}
        </span>
        <span className="hidden items-center gap-1.5 text-[10px] font-bold text-emerald-700 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {ar ? 'قرارات قابلة للتتبع' : 'Traceable decisions'}
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="nx-system-core">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">
              <span className="nx-ai-core" aria-hidden="true" />
              {ar ? 'الذاكرة المشتركة' : 'Shared intelligence'}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Brand Brain</h3>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-300 sm:text-[14px]">
              {ar
                ? 'كل جزء في Nexus يقرأ من معرفة البراند التي راجعتها. التعلّم الجديد يظهر كمقترح قبل أن يصبح جزءاً من الذاكرة.'
                : 'Every part of Nexus reads from brand knowledge you reviewed. New learning appears as a proposal before it becomes memory.'}
            </p>
          </div>
          <div className="nx-system-core-lock">
            <LockKeyhole className="h-4 w-4" />
            <span>{ar ? 'لا تحديث صامت للبراند' : 'No silent brand updates'}</span>
          </div>
        </div>

        <div className="nx-system-stages">
          {stages.map((stage, index) => (
            <div key={stage.label} className="nx-system-stage">
              <div className="flex items-start justify-between gap-3">
                <span className="nx-system-stage-icon">
                  <stage.icon className="h-4 w-4" />
                </span>
                <span className="font-mono text-[9px] font-semibold text-slate-400">0{index + 1}</span>
              </div>
              <h4 className="mt-4 text-[15px] font-bold text-slate-950">{stage.label}</h4>
              <p className="mt-1.5 min-h-[54px] text-[11px] leading-[18px] text-slate-500">{stage.body}</p>
              <span className="nx-system-stage-state">
                <Check className="h-3 w-3" />
                {stage.state}
              </span>
            </div>
          ))}
        </div>

        <div className="nx-system-guardrail">
          <ShieldCheck className="h-5 w-5 shrink-0 text-violet-600" />
          <p>
            <strong>{ar ? 'قاعدة التشغيل:' : 'Operating rule:'}</strong>{' '}
            {ar
              ? 'لا نشر خارجي ولا إنفاق إعلاني من دون منصة مربوطة، وصلاحية صحيحة، وموافقة صريحة.'
              : 'No external publishing or ad spend without a connected platform, valid permission, and explicit consent.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function BrainNode({ icon: Icon, title, body }: { icon: ElementType; title: string; body: string }) {
  return (
    <div className="nx-brain-node">
      <span className="nx-brain-node-icon"><Icon className="h-4 w-4" /></span>
      <div>
        <h3 className="text-[14px] font-bold text-slate-950">{title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-slate-500">{body}</p>
      </div>
    </div>
  )
}

function CapabilityCard({
  icon: Icon,
  title,
  body,
  points,
  gate,
}: {
  icon: ElementType
  title: string
  body: string
  points: string[]
  gate: string
}) {
  return (
    <article className="nx-capability-card">
      <div className="flex items-start justify-between gap-4">
        <span className="nx-public-card-icon"><Icon className="h-5 w-5" /></span>
        <span className="nx-capability-tag">{gate}</span>
      </div>
      <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.025em] text-slate-950">{title}</h3>
      <p className="mt-2 text-[14px] leading-6 text-slate-600">{body}</p>
      <ul className="mt-5 space-y-2.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-[12px] font-semibold leading-5 text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function WorkflowStep({
  index,
  icon: Icon,
  title,
  body,
  output,
}: {
  index: string
  icon: ElementType
  title: string
  body: string
  output: string
}) {
  return (
    <article className="nx-workflow-card">
      <div className="flex items-center gap-3">
        <span className="nx-workflow-number">{index}</span>
        <span className="nx-public-card-icon h-10 w-10">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">{title}</h3>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600 sm:text-[16px]">{body}</p>
      </div>
      <span className="nx-workflow-output">{output}</span>
    </article>
  )
}

function PriceCard({
  plan,
  featured,
  ar,
}: {
  plan: PublicPaidPlan
  featured?: boolean
  ar: boolean
}) {
  const details = [
    ar ? `${plan.monthlyCredits} كريدت شهرياً` : `${plan.monthlyCredits} monthly credits`,
    ar ? `حتى ${plan.postsPerMonth} مسودة محتوى مخططة شهرياً` : `Up to ${plan.postsPerMonth} planned content drafts monthly`,
    ar ? `${plan.videoSlotsPerMonth} مساحات فيديو شهرياً` : `${plan.videoSlotsPerMonth} monthly video slots`,
    ar ? `${plan.workspaces} مساحة عمل و${plan.campaignLimit} حملات شهرياً` : `${plan.workspaces} workspaces and ${plan.campaignLimit} campaigns monthly`,
    ar ? 'سجل كريدت وموافقات قابلة للتتبع' : 'Traceable credit ledger and approvals',
  ]

  return (
    <div className="nx-pricing-card p-7" data-featured={featured === true}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[15px] font-semibold ${featured ? 'text-white' : 'text-slate-950'}`}>{plan.name}</p>
        {featured && (
          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-bold text-cyan-100">
            {ar ? 'للفرق النامية' : 'For growing teams'}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end gap-1">
        <span className="font-heading text-4xl font-semibold tracking-[-0.04em]">${plan.priceUsd}</span>
        <span className={`mb-1 text-[15px] ${featured ? 'text-slate-300' : 'text-slate-500'}`}>{ar ? '/شهر' : '/mo'}</span>
      </div>
      <div className={`mt-5 space-y-3 text-[14px] ${featured ? 'text-slate-200' : 'text-slate-600'}`}>
        {details.map((detail) => (
          <p key={detail} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{detail}</span>
          </p>
        ))}
      </div>
      <Link
        href={`/auth/register?plan=${plan.slug}`}
        className={`mt-7 flex min-h-11 items-center justify-center rounded-xl px-4 text-center text-[13px] font-bold ${featured ? 'bg-white text-slate-950 shadow-lg' : 'nx-public-button-primary'}`}
      >
        {ar ? `استكشف ${plan.name}` : `Review ${plan.name}`}
      </Link>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" onClick={() => setOpen(!open)} className="nx-faq-item" aria-expanded={open}>
      <span className="flex items-start justify-between gap-4">
        <span className="text-[16px] font-semibold text-slate-950 sm:text-[17px]">{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </span>
      {open && <span className="mt-3 block max-w-3xl text-[15px] leading-6 text-slate-600">{a}</span>}
    </button>
  )
}

export default function LandingPage() {
  const { lang, setLang } = useTranslation()
  const ar = lang === 'ar'
  const dir = ar ? 'rtl' : 'ltr'

  const capabilities = [
    {
      icon: Brain,
      title: ar ? 'ذكاء البراند والمنافسين' : 'Brand & competitor intelligence',
      body: ar ? 'ذاكرة مشتركة تجعل الاستراتيجية والمحتوى متسقين مع البراند.' : 'A shared memory that keeps strategy and content grounded in your brand.',
      points: ar
        ? ['هوية وعرض وجمهور ونبرة', 'مكتبة أدلة ومقترحات مراجعة', 'مراقبة يومية لمواقع المنافسين العامة']
        : ['Identity, offer, audience, and voice', 'Evidence library and review proposals', 'Daily monitoring of public competitor websites'],
      gate: ar ? 'أساسي' : 'CORE',
    },
    {
      icon: Target,
      title: ar ? 'الاستراتيجية والحملات' : 'Strategy & campaigns',
      body: ar ? 'حوّل أهداف البراند إلى اتجاه واضح وخطة عمل قابلة للمراجعة.' : 'Turn brand goals into a clear direction and a reviewable operating plan.',
      points: ar
        ? ['Positioning وزوايا ورسائل', 'خطة محتوى وتقويم', 'تخطيط عضوي ومدفوع']
        : ['Positioning, angles, and messaging', 'Content plan and calendar', 'Organic and paid planning'],
      gate: ar ? 'قابل للمراجعة' : 'REVIEWABLE',
    },
    {
      icon: ImageIcon,
      title: ar ? 'إنتاج المحتوى والوسائط' : 'Content & media production',
      body: ar ? 'أنتج أصول الحملة داخل مسار واحد يحترم معرفة البراند.' : 'Produce campaign assets inside one workflow grounded in brand knowledge.',
      points: ar
        ? ['نصوص وHooks وCTAs', 'صور وفيديوهات وقوالب', 'بوابة جودة قبل المراجعة']
        : ['Copy, hooks, and CTAs', 'Images, video, and templates', 'Quality gate before review'],
      gate: ar ? 'بالكريدت' : 'CREDITED',
    },
    {
      icon: ClipboardCheck,
      title: ar ? 'المراجعة والموافقات' : 'Review & approvals',
      body: ar ? 'افصل قرار النص عن الوسيط والجدولة حتى يظل كل قرار واضحاً.' : 'Keep copy, media, and schedule decisions separate so every approval is clear.',
      points: ar
        ? ['Snapshots مستقلة وغير قابلة للتغيير', 'حالات دورة حياة واضحة', 'سجل قرارات قابل للتتبع']
        : ['Separate immutable snapshots', 'Clear lifecycle states', 'Traceable decision history'],
      gate: ar ? 'بموافقة' : 'APPROVAL-GATED',
    },
    {
      icon: PackageCheck,
      title: ar ? 'التشغيل والتسليم' : 'Execution & delivery',
      body: ar ? 'حوّل العمل المعتمد إلى جدول داخلي وحزمة تسليم جاهزة.' : 'Turn approved work into an internal schedule and a ready delivery package.',
      points: ar
        ? ['جدولة داخلية آمنة', 'Delivery Package للتصدير', 'فحص جاهزية المنصات']
        : ['Safe internal scheduling', 'Exportable Delivery Package', 'Platform readiness checks'],
      gate: ar ? 'مقيد بالربط' : 'CONNECTION-GATED',
    },
    {
      icon: PanelsTopLeft,
      title: ar ? 'صفحات الهبوط والتحويل' : 'Landing pages & conversion',
      body: ar ? 'اربط الحملة بوجهة تحويل ونموذج يجمع الطلبات المؤكدة.' : 'Connect a campaign to a conversion destination and server-confirmed lead form.',
      points: ar
        ? ['منشئ صفحات هبوط', 'نماذج عملاء محتملين', 'تتبع التحويل المؤكد']
        : ['Landing-page builder', 'Lead capture forms', 'Confirmed conversion tracking'],
      gate: ar ? 'طرف أول' : 'FIRST-PARTY',
    },
    {
      icon: Users,
      title: ar ? 'العملاء المحتملون والمتابعة' : 'Leads & follow-up',
      body: ar ? 'نظّم العملاء والمهام ورسائل المتابعة من نفس مساحة العمل.' : 'Organize leads, tasks, and lifecycle messages in the same workspace.',
      points: ar
        ? ['CRM للعملاء المحتملين', 'مهام وتنبيهات', 'مسودات Lifecycle بموافقات']
        : ['Lead CRM', 'Tasks and alerts', 'Approval-gated lifecycle drafts'],
      gate: ar ? 'موافقة وإرسال' : 'SEND-GATED',
    },
    {
      icon: BarChart3,
      title: ar ? 'التحليلات والتعلّم' : 'Analytics & learning',
      body: ar ? 'حوّل بيانات الطرف الأول والمنصات المربوطة إلى قرارات موثقة.' : 'Turn first-party and connected-platform data into evidence-backed decisions.',
      points: ar
        ? ['لوحات أداء مبنية على بيانات حقيقية', 'إشارات تعلّم قابلة للمراجعة', 'تحديث Brand Brain بعد القبول فقط']
        : ['Data-backed performance views', 'Reviewable learning signals', 'Brand Brain updates only after acceptance'],
      gate: ar ? 'مدعوم بالدليل' : 'EVIDENCE-BACKED',
    },
  ]

  const workflow = [
    {
      icon: Brain,
      title: ar ? 'عرّف البراند مرة واحدة' : 'Define the brand once',
      body: ar ? 'اجمع الهوية، العرض، الجمهور، النبرة، الأهداف، الأدلة والمنافسين في Brand Brain.' : 'Capture identity, offer, audience, voice, goals, evidence, and competitors in Brand Brain.',
      output: ar ? 'المخرج: ذاكرة مراجَعة' : 'OUTPUT: REVIEWED MEMORY',
    },
    {
      icon: Sparkles,
      title: ar ? 'ابنِ الاتجاه والخطة' : 'Build the direction and plan',
      body: ar ? 'ولّد استراتيجية وحملة وزوايا ورسائل وتقويماً، ثم راجع المنطق قبل الإنتاج.' : 'Generate strategy, campaign direction, angles, messaging, and calendar, then review the logic before production.',
      output: ar ? 'المخرج: خطة معتمدة' : 'OUTPUT: APPROVED PLAN',
    },
    {
      icon: Wand2,
      title: ar ? 'أنتج وطبّق بوابة الجودة' : 'Produce and pass the quality gate',
      body: ar ? 'أنشئ النصوص والوسائط، وافحص الدقة والجودة والادعاءات قبل إرفاق أي أصل للمراجعة.' : 'Create copy and media, then check accuracy, quality, and claims before attaching any asset for review.',
      output: ar ? 'المخرج: أصول جاهزة للمراجعة' : 'OUTPUT: REVIEW-READY ASSETS',
    },
    {
      icon: ClipboardCheck,
      title: ar ? 'اعتمد القرارات بشكل منفصل' : 'Approve decisions separately',
      body: ar ? 'اعتمد النص والوسيط والجدولة بقرارات مستقلة حتى لا يتحول اقتراح إلى تنفيذ بالخطأ.' : 'Approve copy, media, and schedule as separate decisions so a suggestion never becomes execution by accident.',
      output: ar ? 'المخرج: Snapshots مستقلة' : 'OUTPUT: SEPARATE SNAPSHOTS',
    },
    {
      icon: RefreshCw,
      title: ar ? 'شغّل، سلّم، ثم تعلّم' : 'Operate, deliver, then learn',
      body: ar ? 'جهّز الجدول وحزمة التسليم، واجمع النتائج الحقيقية، ثم راجع مقترحات التعلّم قبل تحديث الذاكرة.' : 'Prepare schedules and delivery packages, collect real outcomes, then review learning proposals before updating memory.',
      output: ar ? 'المخرج: قرار تالي موثّق' : 'OUTPUT: EVIDENCE-BACKED NEXT MOVE',
    },
  ]

  return (
    <main dir={dir} className="nx-public-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSON_LD) }} />
      <Header ar={ar} setLang={setLang} />

      <section className="nx-public-hero mx-auto max-w-7xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28">
        <div className="nx-ai-chip mx-auto mb-6">
          <span className="nx-ai-core" aria-hidden="true" />
          <span>{ar ? 'نظام تشغيل لقسم التسويق' : 'THE OPERATING SYSTEM FOR YOUR MARKETING DEPARTMENT'}</span>
        </div>
        <h1 className="nx-public-hero-title mx-auto max-w-6xl text-balance">
          {ar ? (
            <>عقل واحد للبراند. <span className="nx-public-hero-accent">وقسم تسويق يعمل باستمرار.</span></>
          ) : (
            <>One Brand Brain. <span className="nx-public-hero-accent">An always-on marketing department.</span></>
          )}
        </h1>
        <p className="nx-public-hero-copy mx-auto mt-7 max-w-4xl text-pretty">
          {ar
            ? 'يحوّل NEXUS معرفة البراند التي راجعتها إلى استراتيجية، حملات، محتوى، موافقات، تشغيل مجدول، عملاء محتملين، وتعلّم مدعوم بالأدلة—داخل نظام واحد.'
            : 'NEXUS turns reviewed brand knowledge into strategy, campaigns, content, approvals, scheduled operations, leads, and evidence-backed learning—inside one system.'}
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-[13px] font-semibold leading-6 text-slate-500">
          {ar
            ? 'ولا ينشر أو ينفق أي شيء دون ربط وصلاحية وموافقة صريحة منك.'
            : 'Nothing publishes or spends without a connection, valid permission, and your explicit consent.'}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/register" className="nx-public-button-primary min-w-44">
            {ar ? 'ابدأ بـ Brand Brain' : 'Start with Brand Brain'}
            <ArrowRight className="h-4 w-4 nx-directional-arrow" />
          </Link>
          <a href="#product" className="nx-public-button-secondary min-w-44">
            {ar ? 'شاهد النظام كاملاً' : 'Explore the system'}
          </a>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <span className="nx-public-trust-chip"><Check className="h-3.5 w-3.5" />{ar ? `${FREE_TRIAL_CREDITS} كريدت تجريبي` : `${FREE_TRIAL_CREDITS} trial credits`}</span>
          <span className="nx-public-trust-chip"><CircleDollarSign className="h-3.5 w-3.5" />{ar ? 'بدون بطاقة للتجربة' : 'No card for trial'}</span>
          <span className="nx-public-trust-chip"><ShieldCheck className="h-3.5 w-3.5" />{ar ? 'تنفيذ محكوم بالموافقة' : 'Approval-gated execution'}</span>
          <span className="nx-public-trust-chip"><BarChart3 className="h-3.5 w-3.5" />{ar ? 'تعلّم من بيانات حقيقية' : 'Learning from real data'}</span>
        </div>
        <ProductSystemPreview ar={ar} />
      </section>

      <section id="product" className="nx-public-section nx-public-section-alt scroll-mt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <SectionTitle
              align="start"
              eyebrow={ar ? 'العمود الفقري' : 'THE BACKBONE'}
              title={ar ? 'Brand Brain هو الذاكرة التي يقرأ منها كل قرار.' : 'Brand Brain is the memory every decision reads from.'}
              body={ar
                ? 'بدلاً من إعادة شرح البراند لكل أداة أو موظف، تحفظ المعرفة مرة واحدة، تراجعها، ثم يستخدمها النظام في التخطيط والإنتاج والمتابعة والتعلّم.'
                : 'Instead of re-explaining your brand to every tool or handoff, capture the knowledge once, review it, then let the system use it across planning, production, follow-up, and learning.'}
            />
            <Link href="/auth/register" className="inline-flex items-center gap-2 text-[14px] font-bold text-violet-700">
              {ar ? 'ابدأ بناء ذاكرة البراند' : 'Start building your brand memory'}
              <ArrowRight className="h-4 w-4 nx-directional-arrow" />
            </Link>
          </div>

          <div className="nx-brain-map">
            <div className="nx-brain-core">
              <span className="nx-ai-core" aria-hidden="true" />
              <Brain className="h-7 w-7 text-white" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-cyan-200">{ar ? 'مصدر الحقيقة' : 'SOURCE OF TRUTH'}</p>
                <p className="mt-1 text-xl font-semibold text-white">Brand Brain</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BrainNode icon={Layers} title={ar ? 'الهوية والعرض' : 'Identity & offer'} body={ar ? 'ما الذي تبيعه، ولماذا يهم.' : 'What you sell and why it matters.'} />
              <BrainNode icon={Users} title={ar ? 'الجمهور والنبرة' : 'Audience & voice'} body={ar ? 'لمن تتحدث وكيف تبدو.' : 'Who you speak to and how you sound.'} />
              <BrainNode icon={ShieldCheck} title={ar ? 'الأدلة والقيود' : 'Proof & constraints'} body={ar ? 'ما يمكن قوله وما يحتاج دليلاً.' : 'What can be said and what needs proof.'} />
              <BrainNode icon={Radar} title={ar ? 'السوق والمنافسون' : 'Market & competitors'} body={ar ? 'سياق موثّق ومقترحات لا تغييرات صامتة.' : 'Sourced context and proposals, never silent changes.'} />
            </div>
            <div className="nx-brain-flow">
              <span>{ar ? 'الاستراتيجية' : 'STRATEGY'}</span>
              <span>{ar ? 'المحتوى' : 'CONTENT'}</span>
              <span>{ar ? 'التشغيل' : 'OPERATIONS'}</span>
              <span>{ar ? 'التعلّم' : 'LEARNING'}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="nx-public-section scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'منظومة واحدة' : 'ONE OPERATING SYSTEM'}
            title={ar ? 'كل ما يحتاجه فريق التسويق. في مسار متصل.' : 'The work of a marketing team. In one connected flow.'}
            body={ar
              ? 'من التفكير إلى التحويل والتعلّم، كل وحدة لها وظيفة حقيقية وحاجز أمان واضح.'
              : 'From thinking to conversion and learning, every module has a real job and a clear control boundary.'}
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((capability) => <CapabilityCard key={capability.title} {...capability} />)}
          </div>
        </div>
      </section>

      <section className="nx-operations-section">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.86fr_1.14fr] lg:gap-16">
          <div>
            <p className="nx-dark-kicker">{ar ? 'المراقبة والتشغيل' : 'MONITORING & OPERATIONS'}</p>
            <h2 className="mt-5 text-balance font-heading text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              {ar ? 'هو يراقب. وأنت تظل صاحب القرار.' : 'It keeps watch. You keep control.'}
            </h2>
            <p className="mt-5 text-[16px] leading-7 text-slate-300">
              {ar
                ? 'فحوصات مجدولة تتابع العمل المستحق، وصحة الربط، والمواقع العامة للمنافسين. تظهر لك القرارات المطلوبة، ولا تنشر أو تنفق بصمت.'
                : 'Scheduled checks watch due work, connection health, and public competitor websites. They surface decisions for you; they never silently publish or spend.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {[ar ? 'مراقبة يومية للمنافسين' : 'Daily competitor monitoring', ar ? 'قائمة قرارات' : 'Action queue', ar ? 'فحص الجاهزية' : 'Readiness checks'].map((item) => (
                <span key={item} className="nx-dark-chip"><Check className="h-3 w-3" />{item}</span>
              ))}
            </div>
          </div>

          <div className="nx-ops-console">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-300">{ar ? 'مركز العمليات' : 'Operations center'}</span>
              </div>
              <span className="font-mono text-[9px] text-slate-500">{ar ? 'فحوصات مجدولة' : 'SCHEDULED CHECKS'}</span>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {[
                { icon: ScanSearch, title: ar ? 'مراقب المنافسين' : 'Competitor monitor', detail: ar ? 'يفحص الصفحات العامة كل 24 ساعة ويعرض التغييرات للمراجعة.' : 'Checks public pages every 24 hours and surfaces changes for review.', state: ar ? 'بدون تكلفة AI' : 'NO AI COST' },
                { icon: Calendar, title: ar ? 'العمل المستحق' : 'Due work', detail: ar ? 'يكتشف المراجعات والجداول والمهام التي تحتاج قراراً.' : 'Finds reviews, schedules, and tasks that need a decision.', state: ar ? 'قائمة قرارات' : 'ACTION QUEUE' },
                { icon: MonitorCheck, title: ar ? 'جاهزية التنفيذ' : 'Execution readiness', detail: ar ? 'يفحص الربط والصلاحيات والموافقة قبل أي تنفيذ خارجي.' : 'Checks connection, permission, and consent before external execution.', state: ar ? 'مقفل افتراضياً' : 'LOCKED BY DEFAULT' },
              ].map((item) => (
                <div key={item.title} className="nx-ops-row">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-cyan-200">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[13px] font-bold text-white">{item.title}</h3>
                      <span className="font-mono text-[8px] font-bold tracking-[0.08em] text-emerald-300">{item.state}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="nx-public-section scroll-mt-20">
        <div className="mx-auto max-w-5xl">
          <SectionTitle
            eyebrow={ar ? 'دورة العمل الكاملة' : 'THE COMPLETE LOOP'}
            title={ar ? 'من معرفة البراند إلى القرار التالي.' : 'From brand knowledge to the next decision.'}
            body={ar
              ? 'مسار واحد ينقل العمل بين المراحل بدون أن يخلط الاقتراح بالموافقة أو الجدولة بالنشر.'
              : 'One operating loop moves work between stages without confusing a suggestion with approval—or a schedule with publishing.'}
          />
          <div className="grid gap-4">
            {workflow.map((step, index) => (
              <WorkflowStep key={step.title} index={`0${index + 1}`} {...step} />
            ))}
          </div>
        </div>
      </section>

      <section className="nx-public-section nx-public-section-alt">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'بديل لتشتت الأدوات' : 'REPLACE THE FRAGMENTATION'}
            title={ar ? 'هيكل فريق تسويق، بدون تسليمات مشتتة.' : 'The structure of a marketing team—without fragmented handoffs.'}
            body={ar
              ? 'NEXUS مصمم ليحل محل العمل التشغيلي المتناثر، وليس الحكم البشري. أنت تملك القرار، والنظام يحافظ على الذاكرة والمسار والدليل.'
              : 'NEXUS is designed to replace fragmented operating work—not human judgment. You own the decision; the system preserves memory, workflow, and evidence.'}
          />
          <div className="nx-comparison">
            <div className="nx-comparison-column">
              <p className="nx-comparison-label text-slate-500">{ar ? 'الطريقة المشتتة' : 'THE FRAGMENTED WAY'}</p>
              {[
                { icon: MessageSquareText, text: ar ? 'إعادة شرح البراند في كل تسليم' : 'Re-explain the brand at every handoff' },
                { icon: Layers, text: ar ? 'استراتيجية ومحتوى وCRM في أدوات منفصلة' : 'Strategy, content, and CRM in separate tools' },
                { icon: MousePointerClick, text: ar ? 'موافقات غير واضحة وتنفيذ يدوي' : 'Unclear approvals and manual execution' },
              ].map((item) => (
                <div key={item.text} className="nx-comparison-item nx-comparison-item-muted">
                  <item.icon className="h-4 w-4 shrink-0" /><span>{item.text}</span>
                </div>
              ))}
            </div>
            <div className="nx-comparison-column nx-comparison-column-nexus">
              <p className="nx-comparison-label text-violet-700">{ar ? 'طريقة NEXUS' : 'THE NEXUS WAY'}</p>
              {[
                { icon: Brain, text: ar ? 'Brand Brain واحد لكل قرار' : 'One Brand Brain behind every decision' },
                { icon: Workflow, text: ar ? 'مسار متصل من الخطة إلى العميل المحتمل' : 'One flow from plan to lead' },
                { icon: ShieldCheck, text: ar ? 'موافقات منفصلة وحدود تنفيذ واضحة' : 'Separate approvals and explicit execution gates' },
              ].map((item) => (
                <div key={item.text} className="nx-comparison-item nx-comparison-item-nexus">
                  <item.icon className="h-4 w-4 shrink-0" /><span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="nx-public-section scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'الأسعار' : 'PRICING'}
            title={ar ? 'باقتان واضحتان. كريدت مفهوم.' : 'Two clear plans. Understandable credits.'}
            body={ar
              ? `ابدأ بـ${FREE_TRIAL_CREDITS} كريدت تجريبي بدون بطاقة، ثم اختر الباقة المناسبة لحجم تشغيلك.`
              : `Start with ${FREE_TRIAL_CREDITS} trial credits without a card, then choose the plan that fits your operating volume.`}
          />
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            <PriceCard plan={PUBLIC_PAID_PLANS[0]} ar={ar} featured />
            <PriceCard plan={PUBLIC_PAID_PLANS[1]} ar={ar} />
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-center text-[13px] leading-6 text-slate-500">
            {ar
              ? 'الأسعار والسعات معروضة للتقييم قبل الإطلاق التجاري. لا يبدأ اشتراك أو خصم مالي حقيقي حتى تفعيل Stripe Live ونشر بيانات الجهة المتعاقدة وشروط الفوترة النهائية.'
              : 'Pricing and capacity are shown for pre-launch evaluation. No live subscription or real-money charge starts until Stripe Live and the final contracting and billing terms are activated.'}
          </p>
        </div>
      </section>

      <section className="nx-public-section nx-public-section-alt">
        <div className="mx-auto max-w-4xl">
          <SectionTitle
            align="start"
            eyebrow={ar ? 'وضوح قبل البدء' : 'CLARITY BEFORE YOU START'}
            title={ar ? 'الأسئلة التي تهم فعلاً.' : 'The questions that actually matter.'}
            body={ar ? 'إجابات مباشرة عن التعلّم، المراقبة، النشر، والكريدت.' : 'Direct answers about learning, monitoring, publishing, and credits.'}
          />
          <div className="grid gap-3">
            <FAQItem
              q={ar ? 'كيف يتعلم Brand Brain عن البراند؟' : 'How does Brand Brain learn the brand?'}
              a={ar
                ? 'يبدأ بالمدخلات والأصول التي تحفظها وتراجعها. الأدلة الجديدة ونتائج الحملات تتحول إلى مقترحات قابلة للمراجعة، ولا تدخل الذاكرة الدائمة إلا بعد قبولك.'
                : 'It starts with inputs and assets you save and review. New evidence and campaign outcomes become reviewable proposals, and only enter permanent memory after you accept them.'}
            />
            <FAQItem
              q={ar ? 'هل ينشر NEXUS تلقائياً؟' : 'Does NEXUS publish automatically?'}
              a={ar
                ? 'لا. الجدولة الداخلية ليست نشراً. التنفيذ الخارجي يحتاج منصة مربوطة وصلاحية صحيحة وموافقة صريحة، ويظل مقفلاً عند غياب أي شرط.'
                : 'No. Internal scheduling is not publishing. External execution requires a connected platform, valid permission, and explicit consent, and stays locked when any requirement is missing.'}
            />
            <FAQItem
              q={ar ? 'ماذا يراقب على مدار الوقت؟' : 'What does it monitor over time?'}
              a={ar
                ? 'فحوصات مجدولة تراقب العمل المستحق، جاهزية الربط، والمواقع العامة للمنافسين كل 24 ساعة. هذه ليست مراقبة لحظية، ولا تغيّر استراتيجية البراند تلقائياً.'
                : 'Scheduled checks monitor due work, connection readiness, and public competitor websites every 24 hours. This is not real-time surveillance, and it never changes brand strategy automatically.'}
            />
            <FAQItem
              q={ar ? 'هل مراقبة المنافسين تستهلك كريدت؟' : 'Does competitor monitoring use credits?'}
              a={ar
                ? 'الفحص الحالي للصفحات العامة واكتشاف التغييرات لا يستخدم AI ولا يخصم كريدت. أي تحليل مدفوع مستقبلاً يجب أن يعرض تكلفته قبل التأكيد.'
                : 'The current public-page scan and change detection use no AI and deduct no credits. Any future paid analysis must show its cost before confirmation.'}
            />
            <FAQItem
              q={ar ? 'هل NEXUS بديل وكالة تسويق كاملة؟' : 'Is NEXUS a full agency replacement?'}
              a={ar
                ? 'هو بديل تشغيلي للعمل المتناثر: ذاكرة، استراتيجية، إنتاج، مراجعة، تشغيل، عملاء محتملون وتعلّم. يظل الحكم والمسؤولية والموافقة النهائية للمستخدم، والتنفيذ على المنصات يحتاج تصاريحها.'
                : 'It is an operating replacement for fragmented work: memory, strategy, production, review, operations, leads, and learning. Final judgment, responsibility, and approval remain with the user, and platform execution requires platform permissions.'}
            />
            <FAQItem
              q={ar ? 'ماذا تغطي التجربة المجانية؟' : 'What does the free trial cover?'}
              a={ar
                ? `تمنحك التجربة ${FREE_TRIAL_CREDITS} كريدت لمسار تفعيل محدود: إعداد اتجاه استراتيجي ومراجعته. إنتاج المحتوى الثقيل غير مشمول في المنحة التجريبية. يظهر سجل المعاملات كل خصم أو استرداد.`
                : `The trial grants ${FREE_TRIAL_CREDITS} credits for one bounded activation path: create and review strategic direction. Heavy content production is not included in the trial grant. The transaction ledger shows every deduction or refund.`}
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="nx-final-cta mx-auto max-w-6xl">
          <div className="relative z-10 max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200">{ar ? 'ابدأ من المصدر' : 'START FROM THE SOURCE'}</p>
            <h2 className="mt-4 text-balance font-heading text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              {ar ? 'ابنِ قسم التسويق حول عقل البراند.' : 'Build your marketing department around the Brand Brain.'}
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-[16px]">
              {ar
                ? 'ابدأ بمعرفة البراند، اختبر الاتجاه، ووسّع التشغيل عندما تصبح جاهزاً—من دون فقدان السيطرة.'
                : 'Start with brand knowledge, validate the direction, and expand operations when you are ready—without giving up control.'}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[14px] font-bold text-slate-950 shadow-xl">
                {ar ? 'ابدأ مجاناً' : 'Start free'}
                <ArrowRight className="h-4 w-4 nx-directional-arrow" />
              </Link>
              <Link href="/auth/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-[14px] font-bold text-white">
                {ar ? 'تسجيل الدخول' : 'Sign in'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-[#eef1f8] px-4 pb-24 pt-10 sm:px-6 lg:py-10">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.4fr_0.6fr_0.6fr]">
          <div>
            <Link href="/" className="nx-brand-lockup" aria-label="NEXUS AI home">
              <span className="nx-brand-mark h-9 w-9"><Sparkles className="relative z-10 h-4 w-4" /></span>
              <span>
                <span className="nx-brand-word">NEXUS</span>
                <span className="nx-brand-caption">AI MARKETING OS</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-[13px] leading-6 text-slate-500">
              {ar ? 'نظام تشغيل تسويقي مبني حول ذاكرة البراند والموافقة والدليل.' : 'A marketing operating system built around brand memory, approval, and evidence.'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-950">{ar ? 'المنتج' : 'Product'}</p>
            <div className="mt-4 flex flex-col gap-3 text-[13px] text-slate-500">
              <a href="#product" className="hover:text-slate-950">Brand Brain</a>
              <a href="#capabilities" className="hover:text-slate-950">{ar ? 'الإمكانات' : 'Capabilities'}</a>
              <a href="#pricing" className="hover:text-slate-950">{ar ? 'الأسعار' : 'Pricing'}</a>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-950">{ar ? 'قانوني' : 'Legal'}</p>
            <div className="mt-4 flex flex-col gap-3 text-[13px] text-slate-500">
              <Link href="/privacy" className="hover:text-slate-950">{ar ? 'الخصوصية' : 'Privacy'}</Link>
              <Link href="/terms" className="hover:text-slate-950">{ar ? 'الشروط' : 'Terms'}</Link>
              <Link href="/cookies" className="hover:text-slate-950">{ar ? 'ملفات الارتباط' : 'Cookies'}</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-slate-200/80 pt-5 text-[12px] text-slate-500">
          © 2026 Nexus AI. {ar ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
        </div>
      </footer>
    </main>
  )
}
