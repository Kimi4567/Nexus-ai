import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle,
  Film,
  Lock,
  ShieldCheck,
  UploadCloud,
  UserCircle,
} from 'lucide-react'

const scopes = [
  {
    name: 'user.info.basic',
    purpose: 'Identify the connected TikTok account in the NEXUS dashboard.',
    data: 'open_id, display_name, avatar_url',
    usage: 'NEXUS shows the connected account name and avatar so the user can confirm which TikTok account is connected.',
    Icon: UserCircle,
    color: '#38BDF8',
  },
  {
    name: 'video.publish',
    purpose: 'Create a TikTok post from a user-approved video asset.',
    data: 'approved video URL, caption/title, privacy settings, publish_id',
    usage: 'NEXUS sends only approved videos to TikTok using the Content Posting API PULL_FROM_URL flow.',
    Icon: UploadCloud,
    color: '#FB7185',
  },
  {
    name: 'video.upload',
    purpose: 'Support TikTok draft/inbox upload review for creator-controlled posting.',
    data: 'approved video asset, draft upload status, creator-facing upload context',
    usage: 'TikTok includes Upload to TikTok with Content Posting API. NEXUS demonstrates this review flow as a user-approved draft upload option; no upload happens without explicit user action.',
    Icon: Film,
    color: '#A78BFA',
  },
]

const flow = [
  {
    title: '1. User signs in to NEXUS',
    body: 'The user opens NEXUS AI, authenticates, and goes to the Connections page.',
  },
  {
    title: '2. User connects TikTok',
    body: 'The user clicks Connect TikTok and is redirected to TikTok OAuth in sandbox mode.',
  },
  {
    title: '3. TikTok consent screen',
    body: 'The OAuth screen clearly shows user.info.basic and video.publish. The user approves access.',
  },
  {
    title: '4. NEXUS stores the connection',
    body: 'NEXUS exchanges the code for tokens, fetches basic profile data, encrypts tokens, and shows the connected TikTok account.',
  },
  {
    title: '5. User reviews a campaign video',
    body: 'The user selects a generated short-form video, reviews the caption, and confirms that the asset is ready.',
  },
  {
    title: '6. User approves TikTok publishing',
    body: 'NEXUS does not publish automatically. The user clicks Upload/Publish to TikTok, then NEXUS calls the Content Posting API.',
  },
]

const walkthrough = [
  {
    label: 'Step 1',
    title: 'Connect TikTok from NEXUS',
    eyebrow: 'NEXUS Connections',
    body: 'The user starts inside the NEXUS web app and clicks Connect TikTok.',
    scope: 'Login Kit',
    action: 'User action: Connect TikTok',
  },
  {
    label: 'Step 2',
    title: 'Sandbox OAuth consent',
    eyebrow: 'TikTok Sandbox',
    body: 'TikTok shows the requested scopes before the user grants access.',
    scope: 'user.info.basic + video.publish + video.upload',
    action: 'User action: Authorize sandbox account',
  },
  {
    label: 'Step 3',
    title: 'Connected account visible',
    eyebrow: 'NEXUS Dashboard',
    body: 'NEXUS displays the connected TikTok display name and avatar so the user can confirm the account.',
    scope: 'user.info.basic',
    action: 'Data shown: display_name, avatar_url',
  },
  {
    label: 'Step 4',
    title: 'Review video before sending',
    eyebrow: 'Campaign Approval',
    body: 'The user reviews the video, caption, and privacy settings before any TikTok API call happens.',
    scope: 'Human approval gate',
    action: 'User action: Approve for TikTok',
  },
  {
    label: 'Step 5',
    title: 'Publish or upload to draft',
    eyebrow: 'TikTok Content Posting API',
    body: 'After approval, NEXUS can either directly publish with PULL_FROM_URL or demonstrate the upload-to-draft flow.',
    scope: 'video.publish + video.upload',
    action: 'Result: publish_id / upload status',
  },
]

export default function TikTokReviewDemoPage() {
  return (
    <main className="min-h-screen bg-[#05050A] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(251,113,133,0.16),transparent_34%),linear-gradient(180deg,#080816,#05050A)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg font-black">N</span>
              <span className="text-lg font-black tracking-wide">NEXUS AI</span>
            </Link>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[2px] text-cyan-200">
              TikTok Sandbox Review Demo
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[3px] text-pink-300">App review demonstration</p>
              <h1 className="text-4xl font-black leading-tight sm:text-6xl">
                End-to-end TikTok integration flow
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                This page is provided for TikTok app reviewers and demo recording. It explains what NEXUS AI does, which TikTok scopes are requested, and how each scope is used inside the product.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#flow" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-black">
                  View review flow <ArrowRight size={16} />
                </a>
                <a href="#scopes" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white">
                  Scope usage
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">NEXUS TikTok Connection</p>
                  <p className="text-xs text-slate-500">Sandbox account connected</p>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">CONNECTED</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <UserCircle className="mb-4 text-cyan-200" size={28} />
                  <p className="text-xs uppercase tracking-[2px] text-cyan-200">user.info.basic</p>
                  <p className="mt-2 text-xl font-black">@sandbox_brand</p>
                  <p className="mt-1 text-xs text-slate-400">Display name and avatar shown to user</p>
                </div>
                <div className="rounded-xl border border-pink-300/20 bg-pink-300/10 p-4">
                  <Film className="mb-4 text-pink-200" size={28} />
                  <p className="text-xs uppercase tracking-[2px] text-pink-200">video.publish / video.upload</p>
                  <p className="mt-2 text-xl font-black">publish_id ready</p>
                  <p className="mt-1 text-xs text-slate-400">Approved short-form video sent to TikTok</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <ShieldCheck size={17} className="text-emerald-300" />
                  Human approval gate
                </div>
                <p className="text-sm leading-relaxed text-slate-300">
                  NEXUS never publishes automatically. The user must review the video, caption, privacy settings, and click the TikTok publishing action.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-emerald-300">Sandbox walkthrough</p>
          <h2 className="text-3xl font-black">Reviewer-visible user interactions</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            This walkthrough is the exact flow demonstrated in the review video. It starts on the NEXUS website, uses a TikTok sandbox account, shows the selected scopes, and ends with user-approved Content Posting actions.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {walkthrough.map((scene, index) => (
            <article key={scene.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[2px] text-slate-300">{scene.label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-300/10 text-sm font-black text-emerald-200">{index + 1}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[2px] text-cyan-300">{scene.eyebrow}</p>
              <h3 className="mt-2 min-h-[52px] text-lg font-black leading-tight text-white">{scene.title}</h3>
              <p className="mt-3 min-h-[78px] text-sm leading-relaxed text-slate-400">{scene.body}</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="font-mono text-[11px] font-black text-pink-200">{scene.scope}</p>
                <p className="mt-2 text-xs text-slate-400">{scene.action}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0B1020] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[2px] text-cyan-300">Campaign content review</p>
                <h3 className="mt-1 text-xl font-black">Summer launch TikTok video</h3>
              </div>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-300">Ready for approval</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="aspect-[9/16] rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(168,85,247,0.45),transparent_36%),linear-gradient(160deg,#111827,#020617)] p-4">
                <div className="h-full rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-3 h-24 rounded-lg bg-gradient-to-br from-cyan-400/30 via-violet-400/30 to-pink-400/30" />
                  <p className="text-sm font-black">Future is now</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">Short-form creative generated and approved inside NEXUS.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-1 text-xs font-black uppercase tracking-[2px] text-slate-500">Caption</p>
                  <p className="text-sm text-slate-300">Launch your next campaign with an AI marketing team that plans, writes, and prepares every post.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Privacy</p>
                    <p className="mt-1 font-black">Public</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Asset source</p>
                    <p className="mt-1 font-black">Approved URL</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="mt-1 font-black text-emerald-300">User approved</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-lg bg-white px-4 py-3 text-sm font-black text-black">Publish to TikTok</span>
                  <span className="rounded-lg border border-white/15 px-4 py-3 text-sm font-black text-white">Upload as draft</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="mb-4 text-xs font-black uppercase tracking-[2px] text-pink-300">API result shown to user</p>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-pink-300/20 bg-pink-300/10 p-4">
                <p className="font-mono text-pink-200">video.publish</p>
                <p className="mt-2 text-slate-300">PULL_FROM_URL request sent only after approval.</p>
                <p className="mt-2 font-mono text-xs text-slate-500">publish_id: sandbox_publish_123</p>
              </div>
              <div className="rounded-xl border border-violet-300/20 bg-violet-300/10 p-4">
                <p className="font-mono text-violet-200">video.upload</p>
                <p className="mt-2 text-slate-300">Draft/upload path demonstrated for creator-controlled posting.</p>
                <p className="mt-2 font-mono text-xs text-slate-500">upload_status: ready_for_creator_review</p>
              </div>
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                <p className="font-mono text-cyan-200">user.info.basic</p>
                <p className="mt-2 text-slate-300">Connected account remains visible in NEXUS settings.</p>
                <p className="mt-2 font-mono text-xs text-slate-500">open_id stored with encrypted OAuth tokens</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="scopes" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-cyan-300">Requested scopes</p>
            <h2 className="text-3xl font-black">All selected TikTok scopes are demonstrated below</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            TikTok Content Posting API may include both direct publish and upload-to-draft capabilities. This page explains both flows so reviewers can map each selected scope to a user action.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {scopes.map((scope) => {
            const Icon = scope.Icon
            return (
              <article key={scope.name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${scope.color}22`, color: scope.color }}>
                    <Icon size={24} />
                  </span>
                  <div>
                    <p className="font-mono text-sm font-black" style={{ color: scope.color }}>{scope.name}</p>
                    <p className="text-xs text-slate-500">{scope.purpose}</p>
                  </div>
                </div>
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="mb-1 font-bold text-white">Data accessed</dt>
                    <dd className="text-slate-400">{scope.data}</dd>
                  </div>
                  <div>
                    <dt className="mb-1 font-bold text-white">How NEXUS uses it</dt>
                    <dd className="text-slate-400">{scope.usage}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </section>

      <section id="flow" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-pink-300">Demo video checklist</p>
          <h2 className="text-3xl font-black">Complete end-to-end review flow</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {flow.map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <CheckCircle className="mb-4 text-emerald-300" size={22} />
              <h3 className="text-base font-black text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6">
          <div className="mb-3 flex items-center gap-2 text-base font-black text-amber-200">
            <Lock size={19} />
            Security and privacy notes for reviewers
          </div>
          <ul className="grid gap-2 text-sm leading-relaxed text-slate-300 sm:grid-cols-2">
            <li>NEXUS stores OAuth tokens encrypted at rest.</li>
            <li>Users can disconnect TikTok from the Connections page.</li>
            <li>No TikTok data is sold or shared with third parties.</li>
            <li>Publishing requires explicit user approval every time.</li>
          </ul>
        </div>
      </section>
    </main>
  )
}
