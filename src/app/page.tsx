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

const blue = '#0071e3'

function Header({ ar, setLang }: { ar: boolean; setLang: (lang: 'ar' | 'en') => void }) {
  const [open, setOpen] = useState(false)
  const links = [
    { href: '#overview', label: ar ? 'نظرة عامة' : 'Overview' },
    { href: '#workflow', label: ar ? 'طريقة العمل' : 'Workflow' },
    { href: '#resources', label: ar ? 'الأدوات' : 'Tools' },
    { href: '#pricing', label: ar ? 'الأسعار' : 'Pricing' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-slate-950">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-950 text-[11px] font-bold text-white">N</span>
          Nexus
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => setLang(ar ? 'en' : 'ar')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Globe className="h-3.5 w-3.5" />
            {ar ? 'English' : 'العربية'}
          </button>
          <Link href="/auth/login" className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950">
            {ar ? 'دخول' : 'Sign in'}
          </Link>
          <Link href="/auth/register" className="rounded-lg bg-slate-950 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800">
            {ar ? 'ابدأ' : 'Get started'}
          </Link>
        </div>

        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-white md:hidden">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
            <span className="font-semibold text-slate-950">Nexus</span>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col px-4 py-6">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="border-b border-slate-100 py-4 text-[20px] font-semibold text-slate-950">
                {link.label}
              </a>
            ))}
            <button onClick={() => setLang(ar ? 'en' : 'ar')} className="mt-6 text-left text-[16px] font-medium text-slate-700">
              {ar ? 'English' : 'العربية'}
            </button>
            <Link href="/auth/register" className="mt-8 rounded-lg bg-slate-950 px-4 py-3 text-center text-[15px] font-semibold text-white">
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
    <div className="mx-auto mb-8 max-w-3xl text-center">
      <p className="mb-2 text-[13px] font-semibold" style={{ color: blue }}>{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-pretty text-[17px] leading-7 text-slate-600">{body}</p>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, body, href, cta }: { icon: ElementType; title: string; body: string; href: string; cta: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-950">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-[21px] font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 min-h-[72px] text-[15px] leading-6 text-slate-600">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-[15px] font-medium" style={{ color: blue }}>
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
    <div className="mx-auto mt-12 max-w-5xl rounded-lg border border-slate-200 bg-white p-3 shadow-[0_35px_90px_rgba(15,23,42,0.12)]">
      <div className="rounded-md border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <p className="text-[12px] font-medium text-slate-500">nexus-grow.com/dashboard</p>
          <span className="h-5 w-16" />
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-500">{ar ? 'كيف يعمل المسار' : 'How the workflow works'}</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{ar ? 'من بيانات البراند إلى قرار واضح' : 'From brand inputs to a clear decision'}</h3>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">
                {ar ? 'مسار توضيحي' : 'Illustrative flow'}
              </span>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm">
                      <row.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] font-medium text-slate-700">{row.label}</span>
                  </div>
                  <span className="text-[14px] font-semibold text-slate-950">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-[13px] font-semibold text-slate-500">{ar ? 'مصدر الحقيقة' : 'Source of truth'}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Brand Brain</p>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">
                {ar ? 'يستخدم النظام ما حفظته وراجعته، ولا يعرض نتائج أداء قبل وصول تحليلات حقيقية.' : 'The system uses what you saved and reviewed, and shows no performance result before real analytics arrive.'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-[13px] font-semibold text-slate-500">{ar ? 'القرار التالي' : 'Next decision'}</p>
              <p className="mt-2 text-[17px] font-semibold leading-6 text-slate-950">
                {ar ? 'راجع اتجاه الحملة أولاً. يظل النشر والإنفاق مقفلين حتى الربط والموافقة الصريحة.' : 'Review campaign direction first. Publishing and spend stay locked until connection and explicit approval.'}
              </p>
              <Link href="/auth/register" className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-[14px] font-semibold text-white">
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
    <div className="grid gap-5 border-t border-slate-200 py-8 md:grid-cols-[160px_1fr]">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-slate-400">{index}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h3>
        <p className="mt-2 max-w-2xl text-[17px] leading-7 text-slate-600">{body}</p>
      </div>
    </div>
  )
}

function PriceCard({ name, price, credits, posts, workspaces, featured, cta, href, ar }: { name: string; price: string; credits: string; posts: string; workspaces: string; featured?: boolean; cta: string; href: string; ar: boolean }) {
  return (
    <div className={`rounded-lg border p-6 ${featured ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-950'}`}>
      <p className={`text-[15px] font-semibold ${featured ? 'text-white' : 'text-slate-950'}`}>{name}</p>
      <div className="mt-4 flex items-end gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {price !== '$0' && <span className={`mb-1 text-[15px] ${featured ? 'text-slate-300' : 'text-slate-500'}`}>/mo</span>}
      </div>
      <div className={`mt-5 space-y-3 text-[15px] ${featured ? 'text-slate-200' : 'text-slate-600'}`}>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {credits}</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {posts}</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {workspaces}</p>
        <p className="flex items-center gap-2"><Check className="h-4 w-4" /> {ar ? 'سجل كريدت واضح' : 'Clear credit history'}</p>
      </div>
      <Link href={href} className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-[14px] font-semibold ${featured ? 'bg-white text-slate-950' : 'bg-slate-950 text-white'}`}>
        {cta}
      </Link>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(!open)} className="w-full border-t border-slate-200 py-5 text-left">
      <div className="flex items-start justify-between gap-4">
        <span className="text-[17px] font-semibold text-slate-950">{q}</span>
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
    heroTitle: ar ? 'حوّل موجز البراند إلى استراتيجية ومحتوى قابلين للمراجعة.' : 'Turn your brand brief into reviewable strategy and content.',
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
    <main dir={dir} className="min-h-screen bg-[#f5f5f7] text-slate-950">
      <Header ar={ar} setLang={setLang} />

      <section id="overview" className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-24 sm:pt-28">
        <p className="mb-4 text-[15px] font-semibold" style={{ color: blue }}>{copy.heroEyebrow}</p>
        <h1 className="mx-auto max-w-5xl text-balance text-5xl font-semibold tracking-tight text-slate-950 sm:text-7xl">
          {copy.heroTitle}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-pretty text-[19px] leading-8 text-slate-600 sm:text-[21px]">
          {copy.heroBody}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/register" className="inline-flex min-w-36 items-center justify-center rounded-lg bg-slate-950 px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-slate-800">
            {copy.primary}
          </Link>
          <a href="#workflow" className="inline-flex min-w-36 items-center justify-center gap-1 rounded-lg px-5 py-3 text-[15px] font-semibold" style={{ color: blue }}>
            {copy.secondary}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <ProductPreview ar={ar} />
      </section>

      <section id="resources" className="border-t border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'الأدوات الأساسية' : 'Core tools'}
            title={ar ? 'كل جزء له وظيفة واضحة.' : 'Every tool has a clear job.'}
            body={ar ? 'أقسام قليلة ومنظمة؛ كل قسم يفتح خطوة محددة داخل رحلة التسويق.' : 'A small set of organized areas; each one opens a specific step in the marketing journey.'}
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
          </div>
        </div>
      </section>

      <section id="workflow" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <SectionTitle
            eyebrow={ar ? 'طريقة العمل' : 'Workflow'}
            title={ar ? 'من الذاكرة إلى التنفيذ.' : 'From memory to execution.'}
            body={ar ? 'بدل مولد نصوص منفصل، Nexus يتحرك كمشغّل تسويق: يفهم، يخطط، ينتج، يراجع، وينتظر بيانات حقيقية قبل التعلم.' : 'Instead of a standalone generator, Nexus works like a marketing operator: understand, plan, produce, review, and wait for real data before learning.'}
          />
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
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: ar ? 'شفافية الكريدت' : 'Credit transparency', body: ar ? 'كل عملية لها تكلفة واضحة وسجل يظهر أين ذهب الكريدت.' : 'Every action has a clear cost and a history showing where credits went.' },
            { icon: Zap, title: ar ? 'تنفيذ أسرع' : 'Faster execution', body: ar ? 'من الاستراتيجية إلى المحتوى بدون نقل يدوي بين أدوات كثيرة.' : 'Move from strategy to content without stitching together many tools.' },
            { icon: PlayCircle, title: ar ? 'جاهز للتجربة' : 'Ready to try', body: ar ? 'ابدأ بحملة واحدة، راقب النتيجة، ثم وسع النظام تدريجيا.' : 'Start with one campaign, inspect the result, then scale the system gradually.' },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-slate-200 bg-[#f5f5f7] p-6">
              <item.icon className="h-6 w-6 text-slate-800" />
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-2 text-[16px] leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionTitle
            eyebrow={ar ? 'الأسعار' : 'Pricing'}
            title={ar ? 'باقتان فقط. وكريدت مفهوم.' : 'Two plans. Understandable credits.'}
            body={ar ? `ابدأ بـ${FREE_TRIAL_CREDITS} رصيداً تجريبياً بدون بطاقة، ثم اختر Growth أو Autopilot. التجربة ليست باقة ثالثة.` : `Start with ${FREE_TRIAL_CREDITS} trial credits without a card, then choose Growth or Autopilot. The trial is not a third plan.`}
          />
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            <PriceCard
              ar={ar}
              name="Growth"
              price={`$${PUBLIC_PAID_PLANS[0].priceUsd}`}
              credits={ar ? `${PUBLIC_PAID_PLANS[0].monthlyCredits} كريدت شهرياً` : `${PUBLIC_PAID_PLANS[0].monthlyCredits} credits monthly`}
              posts={ar ? `${PUBLIC_PAID_PLANS[0].postsPerMonth} منشوراً مخططاً شهرياً` : `${PUBLIC_PAID_PLANS[0].postsPerMonth} planned posts monthly`}
              workspaces={ar ? `${PUBLIC_PAID_PLANS[0].workspaces} مساحات عمل` : `${PUBLIC_PAID_PLANS[0].workspaces} workspaces`}
              featured
              cta={ar ? 'ابدأ Growth' : 'Start Growth'}
              href="/auth/register?plan=growth"
            />
            <PriceCard
              ar={ar}
              name="Autopilot"
              price={`$${PUBLIC_PAID_PLANS[1].priceUsd}`}
              credits={ar ? `${PUBLIC_PAID_PLANS[1].monthlyCredits} كريدت شهرياً` : `${PUBLIC_PAID_PLANS[1].monthlyCredits} credits monthly`}
              posts={ar ? `${PUBLIC_PAID_PLANS[1].postsPerMonth} منشوراً مخططاً شهرياً` : `${PUBLIC_PAID_PLANS[1].postsPerMonth} planned posts monthly`}
              workspaces={ar ? `${PUBLIC_PAID_PLANS[1].workspaces} مساحات عمل` : `${PUBLIC_PAID_PLANS[1].workspaces} workspaces`}
              cta={ar ? 'ابدأ Autopilot' : 'Start Autopilot'}
              href="/auth/register?plan=autopilot"
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-3xl font-semibold tracking-tight text-slate-950">{ar ? 'أسئلة مهمة' : 'Important questions'}</h2>
          <FAQItem
            q={ar ? 'هل Nexus بديل وكالة تسويق كاملة؟' : 'Is Nexus a full agency replacement?'}
            a={ar ? 'هو يتحرك في هذا الاتجاه: استراتيجية، محتوى، مراجعة، تنفيذ، وتقارير. لكنه يصبح بديلاً تشغيلياً كاملاً فقط بعد اكتمال ربط المنصات وتصاريح النشر/الإعلانات وبيانات الأداء الحقيقية.' : 'It is moving in that direction: strategy, content, review, execution, and reporting. It becomes a true operating replacement only after platform connections, publishing/ad permissions, and real performance data loops are active.'}
          />
          <FAQItem
            q={ar ? 'هل الكريدت واضح؟' : 'Are credits clear?'}
            a={ar ? 'نعم. تظهر تكلفة كل إجراء قبل التأكيد، وتختلف الاستراتيجية حسب النطاق، ويعرض سجل المعاملات كل خصم وإضافة.' : 'Yes. Every action shows its cost before confirmation, strategy cost varies by scope, and the ledger shows every deduction and grant.'}
          />
          <FAQItem
            q={ar ? 'لماذا التصميم بسيط؟' : 'Why is the design so simple?'}
            a={ar ? 'لأن المنتج تشغيلي. المستخدم يريد معرفة الخطوة التالية بسرعة، وليس مشاهدة واجهة مزدحمة.' : 'Because this is an operating product. Users need to know the next action quickly, not fight a noisy interface.'}
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#f5f5f7] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-[13px] text-slate-500 md:flex-row md:items-center md:justify-between">
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
