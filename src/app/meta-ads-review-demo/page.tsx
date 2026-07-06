import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  MousePointerClick,
  PauseCircle,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'

const permissions = [
  {
    name: 'ads_management',
    purpose: 'Create Meta campaign, ad set, ad creative, and ad objects after explicit confirmation.',
    boundary: 'Objects are created as paused drafts first. Activation is a separate final approval step.',
  },
  {
    name: 'ads_read',
    purpose: 'Read ad accounts and Ads Insights metrics after real platform data exists.',
    boundary: 'Metrics are shown as platform-reported analytics, not assumptions or manual learning.',
  },
  {
    name: 'business_management',
    purpose: 'Read Business Manager account hierarchy and ad account context for setup readiness.',
    boundary: 'Used for account selection and readiness checks, not automatic execution.',
  },
]

const flow = [
  {
    step: '01',
    title: 'Connect Meta Ads',
    icon: ShieldCheck,
    copy: 'The user connects a Meta ad account from Connections through Meta OAuth. Connecting only grants account context and permissions.',
    result: 'No campaign is created. No ad spend starts.',
  },
  {
    step: '02',
    title: 'Create paid planning draft',
    icon: ClipboardCheck,
    copy: 'The user creates or reviews a paid campaign plan: objective, audience, budget value, copy, creative needs, and tracking notes.',
    result: 'Planning only. Budget values are not spend approval.',
  },
  {
    step: '03',
    title: 'Create paused platform draft',
    icon: PauseCircle,
    copy: 'After explicit platform-draft and budget-readiness acknowledgements, NEXUS may create Meta objects in PAUSED state.',
    result: 'Paused campaign/ad set/ad objects in Meta Ads Manager.',
  },
  {
    step: '04',
    title: 'Activate after final approval',
    icon: MousePointerClick,
    copy: 'Activation is a separate action requiring launch approval, spend approval, budget confirmation, API access, and existing paused objects.',
    result: 'Only this step may start delivery or spend.',
  },
  {
    step: '05',
    title: 'Sync real metrics',
    icon: BarChart3,
    copy: 'After platform data exists, the user can sync Meta performance metrics for reporting and review.',
    result: 'Analytics-backed metrics only; no fake KPI cards.',
  },
]

const safetyChecks = [
  'Connecting Meta Ads does not launch ads.',
  'A planning draft is not a live ad campaign.',
  'Paused platform drafts do not spend budget.',
  'Activation requires separate final launch, spend, and budget acknowledgements.',
  'Generic campaign updates cannot mark paid campaigns active.',
  'Performance learning requires real platform analytics.',
]

export default function MetaAdsReviewDemoPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-lg font-black text-white">N</span>
              <span className="text-lg font-black tracking-wide">NEXUS AI</span>
            </Link>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[2px] text-blue-700">
              Meta Ads review demo
            </span>
          </div>

          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-blue-700">Marketing API review</p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              Approval-gated Meta Ads execution
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
              This read-only page explains the paid Meta Ads flow for reviewers. NEXUS connects ad accounts, prepares paid planning drafts, creates paused platform draft objects only after explicit confirmation, and activates only after separate final launch and spend approval.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#flow" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white">
                Review paid flow <ArrowRight size={16} />
              </a>
              <a href="#permissions" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800">
                Permission usage
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <LockKeyhole className="mb-4 text-blue-700" size={26} />
            <p className="text-sm font-black">Connection is not execution</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              OAuth gives account context and reviewed permissions. It does not create, launch, or spend.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <PauseCircle className="mb-4 text-orange-600" size={26} />
            <p className="text-sm font-black">Platform drafts start paused</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Meta campaign, ad set, ad creative, and ad objects are created in PAUSED state first.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <WalletCards className="mb-4 text-emerald-700" size={26} />
            <p className="text-sm font-black">Spend needs final approval</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Activation has a separate confirmation gate for launch, spend, budget, and platform readiness.
            </p>
          </div>
        </div>
      </section>

      <section id="permissions" className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <div className="mb-6 max-w-3xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[3px] text-blue-700">Requested permissions</p>
          <h2 className="text-2xl font-black">Paid permissions and boundaries</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {permissions.map((permission) => (
            <article key={permission.name} className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="font-mono text-sm font-black text-blue-700">{permission.name}</p>
              <p className="mt-3 text-sm font-semibold text-slate-950">{permission.purpose}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{permission.boundary}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="flow" className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
        <div className="mb-6 max-w-3xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[3px] text-emerald-700">Reviewer walkthrough</p>
          <h2 className="text-2xl font-black">Connect, draft, pause, approve, activate</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This is the paid execution path to record for Meta review. It is intentionally separated from organic Facebook publishing.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {flow.map((item) => (
            <article key={item.step} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{item.step}</span>
                <item.icon size={22} className="text-blue-700" />
              </div>
              <h3 className="text-base font-black leading-tight">{item.title}</h3>
              <p className="mt-3 min-h-[96px] text-sm leading-relaxed text-slate-600">{item.copy}</p>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700">{item.result}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="mb-4 text-xs font-black uppercase tracking-[2px] text-emerald-700">Safety checks</p>
            <ul className="space-y-3">
              {safetyChecks.map((check) => (
                <li key={check} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="mb-4 text-xs font-black uppercase tracking-[2px] text-blue-700">Review links</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/connections" className="font-semibold text-blue-700 underline">Connections</Link></li>
              <li><Link href="/paid-campaigns" className="font-semibold text-blue-700 underline">Paid Ads</Link></li>
              <li><Link href="/privacy" className="font-semibold text-blue-700 underline">Privacy Policy</Link></li>
              <li><Link href="/terms" className="font-semibold text-blue-700 underline">Terms of Service</Link></li>
              <li><Link href="/data-deletion" className="font-semibold text-blue-700 underline">Data Deletion</Link></li>
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-slate-600">
              For organic Facebook Page publishing review, use the separate page at <Link href="/meta-review-demo" className="font-semibold text-blue-700 underline">/meta-review-demo</Link>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
