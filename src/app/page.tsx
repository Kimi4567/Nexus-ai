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
  FileText,
  Globe,
  Layers,
  Menu,
  MonitorCheck,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { FREE_TRIAL_CREDITS, PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'NEXUS AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://nexus-grow.com',
  description: 'AI-powered marketing operating system for reviewed strategy, content planning, approval-gated execution, and evidence-backed analytics.',
}

function Header({ ar, setLang }: { ar: boolean; setLang: (lang: 'ar' | 'en') => void }) {
  const [open, setOpen] = useState(false)
  const links = [
    { href: '#overview', label: ar ? 'نظرة عامة' : 'Overview' },
    { href: '#workflow', label: ar ? 'طريقة العمل' : 'Workflow' },
    { href: '#resources', label: ar ? 'الأدوات' : 'Tools' },
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

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="nx-public-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => setLang(ar ? 'en' : 'ar')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-3 text-[12px] font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
          >
            <Globe className="h-3.5 w-3.5" />
            {ar ? 'English' : 'العربية'}
          </button>
          <Link href="/auth/login" className="rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-white/70 hover:text-slate-950">
            {ar ? 'دخول' : 'Sign in'}
          </Link>
          <Link href="/auth/register" className="nx-public-button-primary min-h-9 rounded-xl px-4 text-[12px]">
            {ar ? 'ابدأ' : 'Get started'}
          </Link>
        </div>

        <button onClick={() => setOpen(true)} className="rounded-xl border border-slate-200/80 bg-white/70 p-2 text-slate-700 hover:bg-white md:hidden" aria-label={ar ? 'فتح القائمة' : 'Open menu'}>
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#f6f8fc] md:hidden">
          <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-4">
            <span className="nx-brand-word">NEXUS</span>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700" aria-label={ar ? 'إغلاق القائمة' : 'Close menu'}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col px-4 py-6">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="border-b border-slate-200/80 py-4 text-[20px] font-semibold text-slate-950">
                {link.label}
              </a>
            ))}
            <button
              onClick={() => {
                setLang(ar ? 'en' : 'ar')
                setOpen(false)
              }}
              className="mt-6 text-start text-[16px] font-medium text-slate-700"
            >
              {ar ? 'English' : 'العربية'}
            </button>
            <Link href="/auth/register" className="nx-public-button-primary mt-8">
              {ar ? 'ابدأ الآن' : 'Start now'}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
      <p className="nx-section-kicker mb-4">{eyebrow}</p>
      <h2 className="nx-section-title text-balance">{title}</h2>
      <p className="mx-auto mt-5 max-w-2xl text-pretty text-[16px] leading-7 text-slate-600 sm:text-[17px]">{body}</p>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, body, href, cta }: { icon: ElementType; title: string; body: string; href: string; cta: string }) {
  return (
    <Link href={href} className="nx-public-card group p-6">
      <div className="nx-public-card-icon mb-5">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-[21px] font-semibold tracking-[-0.025em] text-slate-950">{title}</h3>
      <p className="mt-2 min-h-[88px] text-[14px] leading-6 text-slate-600">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-[14px] font-semibold text-violet-700">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

function ProductPreview({ ar }: { ar: boolean }) {
  const rows = [
    { label: 'Brand Brain', value: ar ? 'مدخلات يراجعها المستخدم' : 'User-reviewed inputs', icon: Brain },
    { label: ar ? 'الاستراتيجية' : 'Strategy', value: ar ? 'مسودة للمراجعة' : 'Reviewable draft', icon: Target },
    { label: ar ? 'المحتوى' : 'Content', value: ar ? 'موافقة لكل منشور' : 'Per-post approval', icon: Layers },
    { label: ar ? 'النشر' : 'Publishing', value: ar ? 'مقفل حتى الربط' : 'Locked until connected', icon: ShieldCheck },
  ]

  return (
    <div className="nx-product-frame mx-auto mt-14 max-w-5xl text-start sm:mt-16">
      <div className="nx-product-window">
        <div className="nx-product-toolbar">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <p className="font-mono text-[10px] font-medium text-slate-500 sm:text-[11px]">nexus-grow.com/workspace</p>
          <span className="h-5 w-16" />
        </div>

        <div className="grid gap-4 p-3 sm:p-5 md:grid-cols-[1.08fr_0.92fr]">
          <div className="nx-product-card p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-violet-600">{ar ? 'كيف يعمل المسار' : 'How the workflow works'}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">{ar ? 'من بيانات البراند إلى قرار واضح' : 'From brand inputs to a clear decision'}</h3>
              </div>
              <span className="hidden rounded-full border border-violet-100 bg-violet-50/70 px-2.5 py-1 text-[10px] font-bold text-violet-700 sm:inline-flex">
                {ar ? 'مسار توضيحي' : 'Illustrative flow'}
              </span>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.label} className="nx-product-row">
                  <div className="flex items-center gap-3">
                    <span className="nx-product-row-icon">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-slate-700">{row.label}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-slate-950 sm:text-[13px]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="nx-product-intelligence p-5">
              <div className="relative z-10">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200"><span className="nx-ai-core" />{ar ? 'مصدر الحقيقة' : 'Source of truth'}</p>
              <p className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Brand Brain</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">
                {ar ? 'يستخدم النظام ما حفظته وراجعته، ولا يعرض نتائج أداء قبل وصول تحليلات حقيقية.' : 'The system uses what you saved and reviewed, and shows no performance result before real analytics arrive.'}
              </p>
              </div>
            </div>

            <div className="nx-product-card p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{ar ? 'القرار التالي' : 'Next decision'}</p>
              <p className="mt-3 text-[16px] font-semibold leading-6 text-slate-950">
                {ar ? 'راجع اتجاه الحملة أولاً. يظل النشر والإنفاق مقفلين حتى الربط والموافقة الصريحة.' : 'Review campaign direction first. Publishing and spend stay locked until connection and explicit approval.'}
              </p>
              <Link href="/auth/register" className="nx-public-button-primary mt-4 min-h-10 rounded-xl px-4 text-[12px]">
                {ar ? 'ابدأ ببيانات البراند' : 'Start with brand inputs'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowStep({ index, icon: Icon, title, body }: { index: string; icon: ElementType; title: string; body: string }) {
  return (
    <div className="nx-workflow-card">
      <div className="flex items-center gap-3">
        <span className="nx-workflow-number">{index}</span>
        <span className="nx-public-card-icon h-10 w-10">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
        <p className="mt-2 max-w-2xl text-[16px] leading-7 text-slate-600">{body}</p>
      </div>
    </div>
  )
}

function PriceCard({ name, price, credits, posts, governance, featured, cta, href, ar }: { name: string; price: string; credits: string; posts: string; governance: string; featured?: boolean; cta: string; href: string; ar: boolean }) {
  return (
    <div className="nx-pricing-card p-7" data-featured={featured === true}>
      <p className={`text-[15px] font-semibold ${featured ? 'text-white' : 'text-slate-950'}`}>{name}</p>
      <div className="mt-4 flex items-end gap-1">
        <span className="font-heading text-4xl font-semibold tracking-[-0.04em]">{price}</span>
        {price !== '$0' && <span className={`mb-1 text-[15px] ${featured ? 'text-slate-300' : 'text-slate-500'}`}>/mo</span>}
      </div>
      <div className={`mt-5 space-y-3 text-[15px] ${featured ? 'text-slate-200' : 'text-slate-600'}`}>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {credits}</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {posts}</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {governance}</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {ar ? 'سجل كريدت واضح' : 'Clear credit history'}</p>
      </div>
      <Link href={href} className={`mt-7 flex min-h-11 items-center justify-center rounded-xl px-4 text-center text-[13px] font-bold ${featured ? 'bg-white text-slate-950 shadow-lg' : 'nx-public-button-primary'}`}>
        {cta}
      </Link>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(!open)} className="nx-faq-item" aria-expanded={open}>
      <div className="flex items-start justify-between gap-4">
        <span className="text-[16px] font-semibold text-slate-950 sm:text-[17px]">{q}</span>
        <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && <p className="mt-3 max-w-3xl text-[15px] leading-6 text-slate-600">{a}</p>}
    </button>
  )
}

export default function LandingPage() {
  const { lang, setLang } = useTranslation()
  const ar = lang === 'ar'
  const dir = ar ? 'rtl' : 'ltr'

  const copy = {
    navCta: ar ? 'ابدأ' : 'Get started',
    heroEyebrow: ar ? 'نظام تشغيل للتسويق بالذكاء الاصطناعي' : 'AI marketing operating system',
    heroBody: ar
      ? 'كل قرار يبدأ من بيانات تحفظها وتراجعها في Brand Brain. يساعدك Nexus على التخطيط والإنتاج والمراجعة، ولا ينشر أو ينفق أو يتعلم من الأداء قبل الربط والموافقة ووجود بيانات حقيقية.'
      : 'Every decision starts with inputs you save and review in Brand Brain. Nexus helps plan, produce, and review, but does not publish, spend, or learn from performance before connection, approval, and real data.',
    primary: ar ? 'ابدأ مجانا' : 'Start free',
    secondary: ar ? 'شاهد طريقة العمل' : 'See workflow',
  }

  const features = [
    {
      icon: Brain,
      title: ar ? 'Brand Brain' : 'Brand Brain',
      body: ar ? 'ذاكرة البراند التي تحفظ الصناعة، الجمهور، النبرة، إشارات الزوايا المراجَعة، والمنافسين.' : 'A brand memory that stores industry, audience, voice, reviewed angle signals, and competitors.',
      href: '/brand',
      cta: ar ? 'افتح Brand Brain' : 'Open Brand Brain',
    },
    {
      icon: Wand2,
      title: ar ? 'استراتيجية كاملة' : 'Full Strategy',
      body: ar ? 'تشغيل واحد يولد positioning، hooks، خطة محتوى، وnext actions قابلة للتنفيذ.' : 'One run generates positioning, hooks, content direction, and actionable next steps.',
      href: '/dashboard',
      cta: ar ? 'شغل الاستراتيجية' : 'Run strategy',
    },
    {
      icon: FileText,
      title: ar ? 'Content Hub' : 'Content Hub',
      body: ar ? 'مراجعة، تعديل، اعتماد، وجدولة المحتوى من مكان واحد بدون فوضى.' : 'Review, edit, approve, and schedule campaign content from one organized place.',
      href: '/content-hub',
      cta: ar ? 'راجع المحتوى' : 'Review content',
    },
    {
      icon: MonitorCheck,
      title: ar ? 'التعلم والتحسين' : 'Learning and improvement',
      body: ar ? 'النظام يعرض التحليلات الحقيقية عند توفرها، ثم يحوّلها إلى إشارات مراجعة قبل تحديث ذاكرة العلامة.' : 'The system shows real analytics when they exist, then turns them into reviewable signals before Brand Brain updates.',
      href: '/analytics',
      cta: ar ? 'عرض التحليلات' : 'View analytics',
    },
  ]

  return (
    <main dir={dir} className="nx-public-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSON_LD) }} />
      <Header ar={ar} setLang={setLang} />

      <section id="overview" className="nx-public-hero mx-auto max-w-7xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28">
        <div className="nx-ai-chip mx-auto mb-6">
          <span className="nx-ai-core" aria-hidden="true" />
          <span>{copy.heroEyebrow}</span>
        </div>
        <h1 className="nx-public-hero-title mx-auto max-w-6xl text-balance">
          {ar ? (
            <>حوّل موجز البراند إلى <span className="nx-public-hero-accent">استراتيجية ومحتوى قابلين للمراجعة.</span></>
          ) : (
            <>Turn your brand brief into <span className="nx-public-hero-accent">reviewable strategy and content.</span></>
          )}
        </h1>
        <p className="nx-public-hero-copy mx-auto mt-7 max-w-3xl text-pretty">
          {copy.heroBody}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/register" className="nx-public-button-primary min-w-40">
            {copy.primary}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#workflow" className="nx-public-button-secondary min-w-40">
            {copy.secondary}
          </a>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <span className="nx-public-trust-chip"><Check className="h-3.5 w-3.5" />{ar ? 'بدون بطاقة للتجربة' : 'No card for trial'}</span>
          <span className="nx-public-trust-chip"><ShieldCheck className="h-3.5 w-3.5" />{ar ? 'تنفيذ بموافقة واضحة' : 'Approval-gated execution'}</span>
          <span className="nx-public-trust-chip"><BarChart3 className="h-3.5 w-3.5" />{ar ? 'تعلّم من بيانات حقيقية' : 'Learning from real data'}</span>
        </div>
        <ProductPreview ar={ar} />
      </section>

      <section id="resources" className="nx-public-section nx-public-section-alt">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'الأدوات الأساسية' : 'Core tools'}
            title={ar ? 'كل جزء له وظيفة واضحة.' : 'Every tool has a clear job.'}
            body={ar ? 'أقسام قليلة ومنظمة؛ كل قسم يفتح خطوة محددة داخل رحلة التسويق.' : 'A small set of organized areas; each one opens a specific step in the marketing journey.'}
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
          </div>
        </div>
      </section>

      <section id="workflow" className="nx-public-section">
        <div className="mx-auto max-w-5xl">
          <SectionTitle
            eyebrow={ar ? 'طريقة العمل' : 'Workflow'}
            title={ar ? 'من الذاكرة إلى التنفيذ.' : 'From memory to execution.'}
            body={ar ? 'بدل مولد نصوص منفصل، Nexus يتحرك كمشغّل تسويق: يفهم، يخطط، ينتج، يراجع، وينتظر بيانات حقيقية قبل التعلم.' : 'Instead of a standalone generator, Nexus works like a marketing operator: understand, plan, produce, review, and wait for real data before learning.'}
          />
          <div className="grid gap-4">
            <WorkflowStep
              index="01"
              icon={Brain}
              title={ar ? 'املأ Brand Brain' : 'Complete the Brand Brain'}
              body={ar ? 'ابدأ بالبراند، الجمهور، النبرة، المنافسين، والصور. هذه هي الذاكرة التي يعتمد عليها كل وكيل.' : 'Start with brand, audience, voice, competitors, and media. This is the memory every agent uses.'}
            />
            <WorkflowStep
              index="02"
              icon={Sparkles}
              title={ar ? 'شغل الاستراتيجية' : 'Run the strategy'}
              body={ar ? 'النظام يحول البيانات إلى positioning، hooks، campaign idea، وخطة محتوى واضحة.' : 'The system turns your inputs into positioning, hooks, campaign ideas, and a clear content plan.'}
            />
            <WorkflowStep
              index="03"
              icon={Calendar}
              title={ar ? 'راجع واعتمد' : 'Review and approve'}
              body={ar ? 'كل منشور يدخل Content Hub للمراجعة، اختيار الصور، الجدولة، والتحسين قبل النشر.' : 'Every post lands in Content Hub for editing, media selection, scheduling, and final approval.'}
            />
            <WorkflowStep
              index="04"
              icon={BarChart3}
              title={ar ? 'راجع إشارات الأداء' : 'Review performance signals'}
              body={ar ? 'بعد النشر وظهور analyticsData، تتحول النتائج إلى إشارات قابلة للمراجعة قبل أي تحديث لـ Brand Brain.' : 'After publishing and analyticsData exists, results become reviewable signals before any Brand Brain update.'}
            />
          </div>
        </div>
      </section>

      <section className="nx-public-section nx-public-section-alt">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: ar ? 'شفافية الكريدت' : 'Credit transparency', body: ar ? 'كل عملية لها تكلفة واضحة وسجل يظهر أين ذهب الكريدت.' : 'Every action has a clear cost and a history showing where credits went.' },
            { icon: Zap, title: ar ? 'تنفيذ أسرع' : 'Faster execution', body: ar ? 'من الاستراتيجية إلى المحتوى بدون نقل يدوي بين أدوات كثيرة.' : 'Move from strategy to content without stitching together many tools.' },
            { icon: PlayCircle, title: ar ? 'جاهز للتجربة' : 'Ready to try', body: ar ? 'ابدأ بحملة واحدة، راقب النتيجة، ثم وسع النظام تدريجيا.' : 'Start with one campaign, inspect the result, then scale the system gradually.' },
          ].map((item) => (
            <div key={item.title} className="nx-public-card p-7">
              <span className="nx-public-card-icon"><item.icon className="h-5 w-5" /></span>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
              <p className="mt-2 text-[16px] leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="nx-public-section">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'الأسعار' : 'Pricing'}
            title={ar ? 'باقتان فقط. وكريدت مفهوم.' : 'Two plans. Understandable credits.'}
            body={ar ? `ابدأ بـ${FREE_TRIAL_CREDITS} رصيداً تجريبياً بدون بطاقة، ثم اختر Growth أو Autopilot. التجربة ليست باقة ثالثة.` : `Start with ${FREE_TRIAL_CREDITS} trial credits without a card, then choose Growth or Autopilot. The trial is not a third plan.`}
          />
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            <PriceCard
              ar={ar}
              name="Growth"
              price={`$${PUBLIC_PAID_PLANS[0].priceUsd}`}
              credits={ar ? `${PUBLIC_PAID_PLANS[0].monthlyCredits} كريدت شهرياً` : `${PUBLIC_PAID_PLANS[0].monthlyCredits} credits monthly`}
              posts={ar ? `حتى ${PUBLIC_PAID_PLANS[0].postsPerMonth} مسودة نص مخططة شهرياً` : `Up to ${PUBLIC_PAID_PLANS[0].postsPerMonth} planned copy drafts monthly`}
              governance={ar ? 'موافقات منفصلة قبل التنفيذ' : 'Separate approvals before execution'}
              featured
              cta={ar ? 'استكشف Growth' : 'Review Growth'}
              href="/auth/register?plan=growth"
            />
            <PriceCard
              ar={ar}
              name="Autopilot"
              price={`$${PUBLIC_PAID_PLANS[1].priceUsd}`}
              credits={ar ? `${PUBLIC_PAID_PLANS[1].monthlyCredits} كريدت شهرياً` : `${PUBLIC_PAID_PLANS[1].monthlyCredits} credits monthly`}
              posts={ar ? `حتى ${PUBLIC_PAID_PLANS[1].postsPerMonth} مسودة نص مخططة شهرياً` : `Up to ${PUBLIC_PAID_PLANS[1].postsPerMonth} planned copy drafts monthly`}
              governance={ar ? 'مراقبة مجدولة وقائمة قرارات' : 'Scheduled monitoring and action queue'}
              cta={ar ? 'استكشف Autopilot' : 'Review Autopilot'}
              href="/auth/register?plan=autopilot"
            />
          </div>
          <p className="mx-auto mt-5 max-w-3xl text-center text-[13px] leading-6 text-slate-500">
            {ar
              ? 'الأسعار والسعات معروضة للتقييم قبل الإطلاق التجاري. لا يبدأ اشتراك أو خصم حقيقي حتى تفعيل Stripe Live ونشر بيانات الجهة المتعاقدة وشروط الفوترة النهائية.'
              : 'Pricing and capacity are shown for pre-launch evaluation. No live subscription or real-money charge starts until Stripe Live and the final contracting and billing terms are activated.'}
          </p>
        </div>
      </section>

      <section className="nx-public-section nx-public-section-alt">
        <div className="mx-auto max-w-4xl">
          <p className="nx-section-kicker mb-4">{ar ? 'الوضوح والثقة' : 'Clarity & trust'}</p>
          <h2 className="nx-section-title mb-8">{ar ? 'أسئلة مهمة' : 'Important questions'}</h2>
          <div className="grid gap-3">
          <FAQItem
            q={ar ? 'هل Nexus بديل وكالة تسويق كاملة؟' : 'Is Nexus a full agency replacement?'}
            a={ar ? 'هو يتحرك في هذا الاتجاه: استراتيجية، محتوى، مراجعة، تنفيذ، وتقارير. لكنه يصبح بديلاً تشغيلياً كاملاً فقط بعد اكتمال ربط المنصات وتصاريح النشر/الإعلانات وبيانات الأداء الحقيقية.' : 'It is moving in that direction: strategy, content, review, execution, and reporting. It becomes a true operating replacement only after platform connections, publishing/ad permissions, and real performance data loops are active.'}
          />
          <FAQItem
            q={ar ? 'هل الكريدت واضح؟' : 'Are credits clear?'}
            a={ar ? 'نعم. تظهر تكلفة كل إجراء قبل التأكيد، وتختلف الاستراتيجية حسب النطاق، ويعرض سجل المعاملات كل خصم وإضافة.' : 'Yes. Every action shows its cost before confirmation, strategy cost varies by scope, and the ledger shows every deduction and grant.'}
          />
          <FAQItem
            q={ar ? 'كيف يحافظ Nexus على وضوح تجربة العمل؟' : 'How does Nexus keep the workflow clear?'}
            a={ar ? 'يعرض النظام مرحلة واحدة وقراراً رئيسياً واضحاً في كل خطوة، مع فصل المراجعة والموافقة عن التنفيذ حتى تظل السيطرة في يد المستخدم.' : 'The system presents one stage and one clear primary decision at a time, while keeping review and approval separate from execution so the user stays in control.'}
          />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-[#eef1f8] px-4 pb-24 pt-10 sm:px-6 lg:py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-[13px] text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>Copyright © 2026 Nexus AI. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-slate-950">{ar ? 'الخصوصية' : 'Privacy'}</Link>
            <Link href="/terms" className="hover:text-slate-950">{ar ? 'الشروط' : 'Terms'}</Link>
            <Link href="/billing" className="hover:text-slate-950">{ar ? 'الفواتير' : 'Billing'}</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
