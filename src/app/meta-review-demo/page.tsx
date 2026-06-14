import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle,
  ListChecks,
  ShieldCheck,
  Send,
  UserCircle,
  Eye,
} from 'lucide-react'

// Permissions we are submitting for review FIRST (all demonstrable on Facebook).
const scopes = [
  {
    name: 'pages_show_list',
    purpose: 'List the Facebook Pages the user manages.',
    data: 'page id, page name',
    usage: 'After connecting, NEXUS shows the user their Pages so they can pick which Page to publish to.',
    Icon: ListChecks,
    color: '#60A5FA',
  },
  {
    name: 'pages_read_engagement',
    purpose: 'Read engagement (likes/comments/shares) on the user’s own Page posts.',
    data: 'reactions, comment count, share count on the user’s posts',
    usage: 'NEXUS shows basic post engagement back to the user in Post History / analytics. (Reach/impressions require read_insights and are not part of this submission.)',
    Icon: Eye,
    color: '#34D399',
  },
  {
    name: 'pages_manage_posts',
    purpose: 'Publish a post the user has created to their selected Page.',
    data: 'post caption (and optional image URL), returned post id + permalink',
    usage: 'NEXUS publishes to the Page ONLY when the user clicks Publish. No automatic posting; no paid ads.',
    Icon: Send,
    color: '#A78BFA',
  },
]

const walkthrough = [
  {
    label: 'Step 1',
    eyebrow: 'NEXUS Connections',
    title: 'User connects Meta',
    body: 'Signed in to NEXUS, the user opens Connections and clicks Connect account under Meta (Facebook).',
    scope: 'Official Meta OAuth',
    action: 'User action: Connect account',
  },
  {
    label: 'Step 2',
    eyebrow: 'Meta consent screen',
    title: 'User grants permissions',
    body: 'Meta’s OAuth screen shows the requested permissions. The user approves and selects the Page(s) NEXUS may manage.',
    scope: 'pages_show_list + pages_read_engagement + pages_manage_posts',
    action: 'User action: Authorize + select Page',
  },
  {
    label: 'Step 3',
    eyebrow: 'NEXUS Dashboard',
    title: 'Connected Page is shown',
    body: 'NEXUS exchanges the code for a token, stores it encrypted, and displays the connected account + Page so the user can confirm.',
    scope: 'pages_show_list',
    action: 'Data shown: page name (token stored encrypted)',
  },
  {
    label: 'Step 4',
    eyebrow: 'Human approval gate',
    title: 'User reviews the post',
    body: 'On a campaign’s Publish tab, the user writes/reviews the caption and confirms the Page before anything is sent to Facebook.',
    scope: 'No API call yet',
    action: 'User action: review caption + Page',
  },
  {
    label: 'Step 5',
    eyebrow: 'Facebook Graph API',
    title: 'User clicks Publish',
    body: 'Only after the click, NEXUS calls the Graph API to publish the organic post. The returned post id + permalink are shown, and the post appears in Post History.',
    scope: 'pages_manage_posts',
    action: 'Result: post id + permalink (verifiable on Facebook)',
  },
]

const verify = [
  'Open the returned Facebook permalink — the organic post is live on the connected Page.',
  'In NEXUS, the Publish tab → Post History shows the post as Published with a View link.',
  'No post is created until the user clicks Publish (no automatic/scheduled posting in this flow).',
  'No paid ad or ad spend is created — this is organic publishing only.',
]

export default function MetaReviewDemoPage() {
  return (
    <main className="min-h-screen bg-[#05050A] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(96,165,250,0.18),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(167,139,250,0.16),transparent_34%),linear-gradient(180deg,#080816,#05050A)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-16">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg font-black">N</span>
              <span className="text-lg font-black tracking-wide">NEXUS AI</span>
            </Link>
            <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[2px] text-blue-200">
              Meta App Review Demo
            </span>
          </div>

          <p className="mb-4 text-xs font-bold uppercase tracking-[3px] text-violet-300">App review demonstration</p>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Facebook Page publishing — end-to-end review flow
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            This page is for Meta app reviewers and demo recording. It explains what NEXUS AI does, which Facebook permissions it requests, how each is used, and how a user connects a Page and publishes one organic post — always with explicit human action.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#flow" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-black">
              View review flow <ArrowRight size={16} />
            </a>
            <a href="#scopes" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white">
              Permission usage
            </a>
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <ShieldCheck size={17} className="text-emerald-300" />
              Human approval gate
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              NEXUS never publishes automatically. A post is sent to Facebook only after the user reviews the caption and clicks Publish. NEXUS does not run paid ads or ad spend without explicit user action.
            </p>
          </div>
        </div>
      </section>

      {/* Permissions */}
      <section id="scopes" className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-blue-300">Requested permissions</p>
          <h2 className="text-3xl font-black">What each permission is used for</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            We are submitting the three Facebook permissions below first, because each is fully demonstrable in this flow. Instagram permissions (instagram_basic, instagram_content_publish) are requested in OAuth but are <strong className="text-white">not demonstrated</strong> in this review — Instagram publishing is deferred to a later submission when we can demonstrate it. Reach/impressions (read_insights) are also out of scope here.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scopes.map((s) => (
            <article key={s.name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <s.Icon className="mb-4" size={28} style={{ color: s.color }} />
              <p className="font-mono text-sm font-black" style={{ color: s.color }}>{s.name}</p>
              <p className="mt-3 text-sm font-bold text-white">{s.purpose}</p>
              <p className="mt-3 text-xs uppercase tracking-[2px] text-slate-500">Data accessed</p>
              <p className="text-sm text-slate-300">{s.data}</p>
              <p className="mt-3 text-xs uppercase tracking-[2px] text-slate-500">How NEXUS uses it</p>
              <p className="text-sm text-slate-300">{s.usage}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section id="flow" className="mx-auto max-w-6xl px-5 pb-14 sm:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-emerald-300">Reviewer walkthrough</p>
          <h2 className="text-3xl font-black">Connect a Page → publish one organic post</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            This is the exact flow shown in the review video. It starts in the NEXUS web app, uses Meta&apos;s official OAuth, and ends with a user-approved organic Facebook post.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {walkthrough.map((scene, index) => (
            <article key={scene.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[2px] text-slate-300">{scene.label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-300/10 text-sm font-black text-emerald-200">{index + 1}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[2px] text-blue-300">{scene.eyebrow}</p>
              <h3 className="mt-2 min-h-[52px] text-lg font-black leading-tight text-white">{scene.title}</h3>
              <p className="mt-3 min-h-[96px] text-sm leading-relaxed text-slate-400">{scene.body}</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="font-mono text-[11px] font-black text-violet-200">{scene.scope}</p>
                <p className="mt-2 text-xs text-slate-400">{scene.action}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Verify */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <p className="mb-4 text-xs font-black uppercase tracking-[2px] text-emerald-300">How to verify</p>
          <ul className="space-y-3">
            {verify.map((v) => (
              <li key={v} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Data & links */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <UserCircle className="mb-3 text-blue-200" size={26} />
            <p className="text-sm font-bold text-white">Data handling</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Connection uses Meta&apos;s official OAuth — NEXUS never sees or stores the user&apos;s Facebook password. Access tokens are stored encrypted (AES-256 at rest, TLS 1.3 in transit) and deleted immediately when the user disconnects.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <ShieldCheck className="mb-3 text-emerald-300" size={26} />
            <p className="text-sm font-bold text-white">Policy & deletion links</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              <li><Link href="/privacy" className="text-blue-300 underline">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-blue-300 underline">Terms of Service</Link></li>
              <li><Link href="/data-deletion" className="text-blue-300 underline">Data Deletion</Link> (Meta data-deletion callback + status)</li>
              <li><Link href="/connections" className="text-blue-300 underline">Connections</Link> (connect / disconnect)</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
