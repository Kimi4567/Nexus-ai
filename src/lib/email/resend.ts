/**
 * Nexus AI — Email System via Resend
 * Handles all transactional + retention emails
 */
import { Resend } from 'resend'
import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

const [GROWTH_EMAIL_PLAN, AUTOPILOT_EMAIL_PLAN] = PUBLIC_PAID_PLANS

let resendClient: Resend | null = null

function getResend(): Resend {
  if (resendClient) return resendClient
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Email provider configuration is unavailable')
  resendClient = new Resend(apiKey)
  return resendClient
}

const FROM = 'Nexus AI <hello@nexus-grow.com>'
const REPLY_TO = 'support@nexus-grow.com'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.nexus-grow.com'

// ── Shared styles ──────────────────────────────────────────────────────
const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #080807;
  color: #F5F0E8;
  margin: 0;
  padding: 0;
`

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { ${BASE_STYLE} }
    a { color: #FF9500; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div style="max-width:580px;margin:0 auto;padding:0 20px 40px;">

    <!-- Header -->
    <div style="padding:32px 0 24px;display:flex;align-items:center;gap:10px;border-bottom:2px solid #FF9500;">
      <div style="width:28px;height:28px;background:#FF9500;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#080807;">N</div>
      <span style="font-size:14px;font-weight:700;color:#F5F0E8;letter-spacing:-0.3px;">NEXUS</span>
    </div>

    <!-- Content -->
    <div style="padding-top:32px;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #1a1a18;font-size:11px;color:#5C5448;line-height:1.6;">
      <p>Nexus AI — Your marketing operating workspace.</p>
      <p style="margin-top:4px;">
        <a href="${APP_URL}/settings" style="color:#5C5448;">Manage preferences</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}/privacy" style="color:#5C5448;">Privacy</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#FF9500;color:#080807;font-size:13px;font-weight:700;border-radius:10px;text-decoration:none;">${text}</a>`
}

function h1(text: string): string {
  return `<h1 style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.3;margin-bottom:12px;">${text}</h1>`
}

function p(text: string, muted = false): string {
  return `<p style="font-size:14px;color:${muted ? '#5C5448' : '#9A9080'};line-height:1.7;margin-bottom:12px;">${text}</p>`
}

function card(content: string): string {
  return `<div style="background:#101010;border:1px solid #1a1a18;border-radius:12px;padding:20px 24px;margin:20px 0;">${content}</div>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeHeaderText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

// ── 1. WELCOME EMAIL ──────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1(`Welcome to Nexus, ${firstName}.`)}
    ${p('Your marketing brain is ready. Here\'s what you can do right now:')}

    ${card(`
      <div style="font-size:13px;color:#8888aa;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">Get started in 3 steps</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:22px;height:22px;background:#FF9500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#080807;flex-shrink:0;">1</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#e8e8f5;">Set up your brand memory</div>
            <div style="font-size:12px;color:#6a6a8a;margin-top:2px;">Save confirmed business context, then update or remove it whenever your brand changes.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:22px;height:22px;background:#FF9500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#080807;flex-shrink:0;">2</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#e8e8f5;">Generate your first campaign</div>
            <div style="font-size:12px;color:#6a6a8a;margin-top:2px;">Choose a scope and generate a grounded strategy draft. Content drafts are created separately after review.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:22px;height:22px;background:#FF9500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#080807;flex-shrink:0;">3</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#e8e8f5;">Review publishing readiness</div>
            <div style="font-size:12px;color:#6a6a8a;margin-top:2px;">Connect a supported provider account. Available actions still depend on approved permissions and your explicit confirmation.</div>
          </div>
        </div>
      </div>
    `)}

    <div style="background:#101010;border:1px solid #2a2a4a;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <div style="font-size:12px;color:#FF9500;font-weight:700;margin-bottom:4px;">⚡ Your trial includes 15 one-time AI credits</div>
      <div style="font-size:13px;color:#b8b8d8;">Credit costs are shown before each action. No credit card is required to start.</div>
    </div>

    ${btn('Open your dashboard →', `${APP_URL}/dashboard`)}

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1a1a18;">
      ${p('If you have a question, reply to this email and the support inbox will receive it.', true)}
      ${p('— Raouf, founder of Nexus', true)}
    </div>
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Welcome to Nexus, ${firstName} — your marketing brain is ready`,
    html: emailShell(content),
  })
}

// ── 2. CREDITS LOW WARNING ─────────────────────────────────────────────

export async function sendCreditsLowEmail(to: string, name: string, creditsRemaining: number) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1('Your AI credits are running low.')}
    ${p(`${firstName}, you have <strong style="color:#f59e0b;">${creditsRemaining} credits left</strong>. Action costs vary by scope and are shown before confirmation.`)}
    ${p(`Upgrade to Growth for ${GROWTH_EMAIL_PLAN.monthlyCredits} credits/month, up to ${GROWTH_EMAIL_PLAN.campaignLimit} campaign creations per billing month, and your weekly planning brief.`)}

    ${card(`
      <div style="font-size:13px;font-weight:700;color:#e8e8f5;margin-bottom:12px;">What you get with Growth:</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[`${GROWTH_EMAIL_PLAN.monthlyCredits} AI credits every month`, `Up to ${GROWTH_EMAIL_PLAN.campaignLimit} campaign creations per billing month`, 'Weekly planning brief in your inbox', 'Supported-provider publishing after permission checks and explicit approval', 'Printable HTML and JSON campaign exports'].map(f =>
          `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#b8b8d8;">
            <span style="color:#FF9500;font-weight:700;">✓</span> ${f}
          </div>`
        ).join('')}
      </div>
    `)}

    ${btn('Upgrade to Growth — $49/month →', `${APP_URL}/billing`)}
    ${p('Cancel anytime. Access continues through the end of the paid billing period.', true)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `${creditsRemaining} credits left on Nexus — keep your campaigns running`,
    html: emailShell(content),
  })
}

// ── 3. WEEKLY INTELLIGENCE BRIEF ──────────────────────────────────────

interface WeeklyBriefData {
  name: string
  brandName: string
  campaignsThisMonth: number
  topPlatform: string
  contentIdeas: string[]
  strategyFocus: string
}

export async function sendWeeklyBrief(to: string, data: WeeklyBriefData) {
  const firstName = data.name?.split(' ')[0] || 'there'
  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const ideasHtml = data.contentIdeas.map((idea, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #1a1a18;">
      <div style="width:20px;height:20px;background:#1a1a18;border:1px solid #2a2a4a;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#FF9500;flex-shrink:0;">${i + 1}</div>
      <div style="font-size:13px;color:#b8b8d8;line-height:1.5;">${idea}</div>
    </div>
  `).join('')

  const content = `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#FF9500;margin-bottom:8px;">Weekly Brief · ${weekOf}</div>
    ${h1(`This week's marketing plan for ${data.brandName}.`)}
    ${p(`Good morning ${firstName}. Here's what Nexus recommends for your marketing this week.`)}

    ${card(`
      <div style="font-size:12px;color:#FF9500;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🎯 This week's focus</div>
      <div style="font-size:14px;color:#e8e8f5;font-weight:600;line-height:1.5;">${data.strategyFocus}</div>
    `)}

    <div style="margin-top:24px;">
      <div style="font-size:12px;color:#8888aa;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">📋 Content ideas for this week</div>
      <div style="border:1px solid #1a1a18;border-radius:10px;overflow:hidden;margin-top:12px;">
        ${ideasHtml}
        <div style="padding:12px 0;"></div>
      </div>
    </div>

    <div style="margin-top:20px;background:#101010;border:1px solid #1a1a18;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:12px;color:#6a6a8a;margin-bottom:2px;">Campaigns this month</div>
        <div style="font-size:18px;font-weight:800;color:#e8e8f5;">${data.campaignsThisMonth}</div>
      </div>
      <div>
        <div style="font-size:12px;color:#6a6a8a;margin-bottom:2px;">Top platform</div>
        <div style="font-size:18px;font-weight:800;color:#e8e8f5;">${data.topPlatform}</div>
      </div>
      <div>
        <div style="font-size:12px;color:#6a6a8a;margin-bottom:2px;">Credits used</div>
        <div style="font-size:18px;font-weight:800;color:#FF9500;">Active</div>
      </div>
    </div>

    ${btn('Generate this week\'s content →', `${APP_URL}/campaigns/new`)}

    <div style="margin-top:20px;">
      ${p('Your weekly brief is prepared every Monday from your saved brand profile and campaign activity. Recommendations remain reviewable hypotheses until platform evidence supports them.', true)}
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1a1a18;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:#6366F1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;">🧠</div>
          <div>
            <div style="font-size:12px;font-weight:700;color:#e8e8f5;letter-spacing:0.5px;">SAGE</div>
            <div style="font-size:11px;color:#5C5448;">Lead Marketing Strategist · Nexus AI</div>
          </div>
        </div>
      </div>
    </div>
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Your weekly marketing brief — ${weekOf}`,
    html: emailShell(content),
  })
}

// ── 4b. DAILY DIGEST — what to post today ─────────────────────────────

interface DailyDigestData {
  name: string
  campaignName: string
  day: string
  platform: string
  type: string
  topic: string
  caption: string
  campaignId: string
  postIndex: number
  totalPosts: number
}

const PLATFORM_EMOJI: Record<string, string> = {
  TIKTOK: '🎵', INSTAGRAM: '📸', FACEBOOK: '👥',
  LINKEDIN: '💼', YOUTUBE_SHORTS: '▶️',
}

export async function sendDailyDigest(to: string, data: DailyDigestData) {
  const firstName = escapeHtml(data.name?.split(' ')[0] || 'there')
  const campaignName = escapeHtml(data.campaignName)
  const day = escapeHtml(data.day)
  const type = escapeHtml(data.type)
  const topic = escapeHtml(data.topic || data.campaignName)
  const caption = escapeHtml(data.caption || '')
  const platformEmoji = PLATFORM_EMOJI[data.platform] || '📱'
  const platformName = escapeHtml(data.platform.charAt(0) + data.platform.slice(1).toLowerCase().replace('_', ' '))

  const content = `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#FF9500;margin-bottom:8px;">
      Today · ${day}
    </div>
    ${h1(`${firstName}, here's what to post today.`)}
    ${p(`From your <strong style="color:#e8e8f5;">${campaignName}</strong> campaign — post ${data.postIndex} of ${data.totalPosts}.`)}

    ${card(`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:18px;">${platformEmoji}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#e8e8f5;">${type}</div>
          <div style="font-size:11px;color:#6a6a8a;">${platformName} · ${topic}</div>
        </div>
      </div>
      ${caption ? `
        <div style="background:#0a0a0c;border:1px solid #1a1a18;border-radius:10px;padding:16px;font-size:13px;color:#b8b8d8;line-height:1.7;white-space:pre-wrap;">${caption}</div>
      ` : ''}
    `)}

    ${btn(`Open dashboard & copy caption →`, `${APP_URL}/dashboard`)}

    <div style="margin-top:20px;padding:14px 18px;background:#101010;border:1px solid #1a1a18;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:12px;color:#6a6a8a;">Campaign progress</div>
      <div style="font-size:12px;font-weight:700;color:#e8e8f5;">Post ${data.postIndex} / ${data.totalPosts}</div>
    </div>

    <div style="margin-top:16px;">${p('Open the dashboard to copy the caption and mark it as posted.', true)}</div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1a1a18;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;background:#EC4899;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;">🎨</div>
        <div>
          <div style="font-size:12px;font-weight:700;color:#e8e8f5;letter-spacing:0.5px;">MUSE</div>
          <div style="font-size:11px;color:#5C5448;">Creative Director · Nexus AI</div>
        </div>
      </div>
    </div>
  `

  return getResend().emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: safeHeaderText(`Today on ${platformName}: ${data.type} — ${data.campaignName}`),
    html: emailShell(content),
  })
}

// ── NURTURE SEQUENCE ───────────────────────────────────────────────────

// Day 1 — Brand profile nudge
export async function sendNurtureDay1(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1(`${firstName}, your AI is missing something.`)}
    ${p('You created your account yesterday. But before the AI can write content that actually sounds like <em>you</em>, it needs to know your brand.')}
    ${p('Without a saved brand profile, Nexus has less context for its drafts. Add your tone, audience, offer, and constraints so future outputs can use that information as their starting point.')}

    ${card(`
      <div style="font-size:12px;color:#FF9500;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🧠 What Brand Memory stores</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${['Your brand tone and writing style', 'Your target audience', 'Reviewed hook and content-direction signals', 'What to avoid in your content', 'Your primary offer and positioning'].map(f =>
          `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#b8b8d8;">
            <span style="color:#FF9500;">→</span> ${f}
          </div>`
        ).join('')}
      </div>
    `)}

    ${p('Once saved, Nexus uses this profile as context for campaign drafts. You remain responsible for reviewing tone, accuracy, and claims before approval.')}
    ${btn('Set up Brand Memory — 3 minutes →', `${APP_URL}/brand`)}
    <div style="margin-top:20px;">${p('— Raouf', true)}</div>
  `

  return getResend().emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `${firstName}, your AI doesn't know your brand yet`,
    html: emailShell(content),
  })
}

// Day 3 — First campaign share nudge
export async function sendNurtureDay3(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1('Have you run your first campaign yet?')}
    ${p(`${firstName}, you've been on Nexus for 3 days. If you've already generated your first campaign — nice work. If not, here's what you're missing.`)}

    ${card(`
      <div style="font-size:13px;color:#e8e8f5;font-weight:700;margin-bottom:14px;">What a Nexus campaign gives you:</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">Scope-based strategy draft</strong> — positioning, audience context, and a platform playbook for review
        </div>
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">Reviewable hook directions</strong> — the exact count follows the scope you confirm
        </div>
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">Content directions</strong> — draft copy is created separately in Content Hub for review
        </div>
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">Execution outline</strong> — its duration and depth follow the scope you review
        </div>
      </div>
    `)}

    ${p('The draft is generated for your review. Your current balance and the action cost are shown inside Nexus before generation.')}
    ${btn('Generate a campaign now →', `${APP_URL}/campaigns/new`)}
    <div style="margin-top:20px;">${p('— Raouf', true)}</div>
  `

  return getResend().emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `Create a focused campaign with your Nexus trial credits`,
    html: emailShell(content),
  })
}

// Day 5 — Trial activation reminder
export async function sendNurtureDay5(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1('Use your trial credits on a focused campaign.')}
    ${p(`${firstName} — your live credit balance is available in Nexus. Choose one important product, launch, or audience and review the action cost before generating.`)}
    ${p('Nexus prepares a draft for approval. Nothing is published outside the permissions and approvals shown in the product.')}

    <div style="background:#1a1000;border:1px solid #3a2800;border-radius:12px;padding:20px 24px;margin:20px 0;">
      <div style="font-size:13px;color:#f59e0b;font-weight:700;margin-bottom:8px;">⚡ Use trial credits on something measurable</div>
      <div style="font-size:13px;color:#c8a060;line-height:1.6;">
        Pick your highest-value product or service. Set your goal to Sales or Leads. Let Nexus build the full strategy — then take the hooks and start posting today.
      </div>
    </div>

    ${btn('Review credits and create a campaign →', `${APP_URL}/campaigns/new`)}

    <div style="margin-top:24px;padding:16px 20px;background:#101010;border:1px solid #1a1a18;border-radius:10px;">
      <div style="font-size:12px;color:#5C5448;margin-bottom:6px;">When you need more capacity:</div>
      <div style="font-size:13px;color:#9A9080;">Upgrade to Growth for $${GROWTH_EMAIL_PLAN.priceUsd}/month — ${GROWTH_EMAIL_PLAN.monthlyCredits} credits, up to ${GROWTH_EMAIL_PLAN.campaignLimit} monthly campaign creations, and a weekly planning brief. <a href="${APP_URL}/billing" style="color:#FF9500;">See plans →</a></div>
    </div>

    <div style="margin-top:20px;">${p('— Raouf', true)}</div>
  `

  return getResend().emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `${firstName}, choose one focused campaign for your Nexus trial`,
    html: emailShell(content),
  })
}

// Day 7 — Upgrade push
export async function sendNurtureDay7(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1('Is Nexus worth $49/month?')}
    ${p(`${firstName}, you've been on the free plan for a week. I want to be direct with you.`)}
    ${p('Here\'s the honest math:')}

    ${card(`
      <div style="font-size:12px;color:#FF9500;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">The real cost of NOT having a marketing system</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding-bottom:10px;border-bottom:1px solid #1a1a18;">
          <span style="color:#9A9080;">Hiring a freelance strategist</span>
          <span style="color:#e8e8f5;font-weight:700;">$500–$2,000/month</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding-bottom:10px;border-bottom:1px solid #1a1a18;">
          <span style="color:#9A9080;">Content writer + campaign planner</span>
          <span style="color:#e8e8f5;font-weight:700;">$800–$3,000/month</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding-bottom:10px;border-bottom:1px solid #1a1a18;">
          <span style="color:#9A9080;">Marketing agency retainer</span>
          <span style="color:#e8e8f5;font-weight:700;">$2,000–$10,000/month</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
          <span style="color:#FF9500;font-weight:700;">Nexus Growth</span>
          <span style="color:#FF9500;font-weight:800;">$49/month</span>
        </div>
      </div>
    `)}

    ${p(`Nexus Growth gives you up to ${GROWTH_EMAIL_PLAN.campaignLimit} campaign creations per billing month, a weekly planning brief, supported-platform publishing after connection, and reviewable Brand Brain learning proposals.`)}
    ${p('If your campaigns perform well, the workflow may pay for itself — results vary by market, offer, and execution.')}

    ${btn('Upgrade to Growth — $49/month →', `${APP_URL}/billing`)}

    <div style="margin-top:16px;text-align:center;">
      ${p('Cancel anytime; access continues through the end of the paid period. <a href="${APP_URL}/billing">See all plans →</a>', true)}
    </div>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1a1a18;">
      ${p('If the free plan is working fine for you, that\'s genuinely okay — you can keep using it. But if marketing is holding your business back, Pro is the answer.', true)}
      ${p('— Raouf', true)}
    </div>
  `

  return getResend().emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `Is Nexus worth $49/month? Here's the honest answer`,
    html: emailShell(content),
  })
}

// ── 4. UPGRADE CONFIRMATION ────────────────────────────────────────────

export async function sendUpgradeConfirmationEmail(to: string, name: string, plan: string) {
  const firstName = name?.split(' ')[0] || 'there'
  const isAutopilot = /autopilot|business|agency/i.test(plan)
  const activatedFeatures = isAutopilot
    ? [`${AUTOPILOT_EMAIL_PLAN.monthlyCredits} AI credits per billing month`, `Up to ${AUTOPILOT_EMAIL_PLAN.campaignLimit} campaign creations per billing month`, 'Scheduled monitoring', 'Supported-platform publishing after connection and approval', 'Printable HTML and JSON exports', 'Evidence-backed action queue']
    : [`${GROWTH_EMAIL_PLAN.monthlyCredits} AI credits per billing month`, `Up to ${GROWTH_EMAIL_PLAN.campaignLimit} campaign creations per billing month`, 'Weekly planning brief', 'Supported-platform publishing after connection and approval', 'Printable HTML and JSON exports', 'Reviewable Brand Brain learning proposals']

  const content = `
    ${h1(`You're on ${plan}. Let's build.`)}
    ${p(`${firstName}, your upgrade to Nexus ${plan} is confirmed. Your plan features are now available, subject to provider access and approval requirements.`)}

    ${card(`
      <div style="font-size:13px;font-weight:700;color:#e8e8f5;margin-bottom:12px;">What's now available to you:</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${activatedFeatures.map(f =>
          `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#b8b8d8;">
            <span style="color:#FF9500;font-weight:700;">✓</span> ${f}
          </div>`
        ).join('')}
      </div>
    `)}

    <div style="background:#0d1a0d;border:1px solid #1a3a1a;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <div style="font-size:12px;color:#4ade80;font-weight:700;margin-bottom:4px;">✓ Payment confirmed</div>
      <div style="font-size:13px;color:#b8d8b8;">Your first weekly brief arrives next Monday morning.</div>
    </div>

    ${btn('Go to your dashboard →', `${APP_URL}/dashboard`)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Your Nexus ${plan} plan is active`,
    html: emailShell(content),
  })
}

// ── 5. CONTENT PLAN READY ─────────────────────────────────────────────

export async function sendContentPlanReadyEmail(
  to: string,
  name: string,
  campaignName: string,
  postCount: number,
  campaignId: string,
) {
  const firstName = name?.split(' ')[0] || 'there'
  const hubUrl = `${APP_URL}/campaigns/${campaignId}/content-hub`

  const platformNote = postCount >= 20
    ? 'A full month of content — ready to review and schedule.'
    : `${postCount} posts crafted and ready for your review.`

  const content = `
    ${h1(`Your content plan is ready, ${firstName}.`)}
    ${p(`<strong style="color:#e8e8f5;">${postCount} posts</strong> for <strong style="color:#e8e8f5;">${campaignName}</strong> have been generated and are waiting in your Content Hub.`)}
    ${p(platformNote, true)}

    ${card(`
      <div style="font-size:13px;font-weight:700;color:#e8e8f5;margin-bottom:14px;">What to do next:</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[
          ['Review captions', 'Read each post — edit or AI-rewrite any you want to improve'],
          ['Approve & Schedule', 'Approve posts, then review the proposed schedule before publishing'],
          ['Generate images', 'Click "Generate Images" to create AI visuals for each post'],
          ['Monitor publishing', 'Approved posts publish only when the selected provider connection is verified and the schedule is active'],
        ].map(([step, desc], i) =>
          `<div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:22px;height:22px;min-width:22px;background:#FF9500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#080807;margin-top:1px;">${i + 1}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#e8e8f5;">${step}</div>
              <div style="font-size:12px;color:#9A9080;margin-top:2px;">${desc}</div>
            </div>
          </div>`
        ).join('')}
      </div>
    `)}

    ${btn(`Review ${postCount} posts →`, hubUrl)}

    ${p('Posts are saved as drafts until you approve them — nothing goes live without your sign-off.', true)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `✅ ${postCount} posts ready for "${campaignName}" — review now`,
    html: emailShell(content),
  })
}

// ── 8. INTEGRATION TOKEN EXPIRY WARNING ──────────────────────────────────────

export async function sendIntegrationExpiryEmail(
  to: string,
  name: string,
  platforms: string[],   // e.g. ['LinkedIn', 'Meta']
  daysLeft: number,      // 0 = already expired
) {
  const firstName = name?.split(' ')[0] || 'there'
  const isExpired = daysLeft <= 0
  const platformList = platforms.join(', ')

  const content = `
    ${h1(isExpired ? `⚠️ Your ${platformList} connection expired` : `⏰ Action needed: reconnect ${platformList}`)}
    ${p(`Hi ${firstName} — your ${platformList} ${platforms.length > 1 ? 'connections' : 'connection'} ${isExpired ? 'has expired' : `will expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}.`)}
    ${p('Without a valid connection, scheduled automatic posts cannot be published. Manual publishing and drafts remain available.')}
    ${card(`
      <div style="font-size:13px;color:#9A9080;margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Affected platforms</div>
      ${platforms.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a1a18;">
          <div style="width:8px;height:8px;border-radius:50%;background:${isExpired ? '#ef4444' : '#f59e0b'};"></div>
          <span style="color:#F5F0E8;font-size:14px;font-weight:600;">${p}</span>
          <span style="margin-left:auto;font-size:12px;color:${isExpired ? '#ef4444' : '#f59e0b'};">${isExpired ? 'Expired' : `Expires in ${daysLeft}d`}</span>
        </div>
      `).join('')}
    `)}
    ${p('It takes less than 30 seconds to reconnect. Click below to go to your Connections page.')}
    ${btn('Reconnect now →', `${APP_URL}/connections`)}
    ${p('If you need help, reply to this email and we\'ll sort it out.', true)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: isExpired
      ? `⚠️ ${platformList} connection expired — posts won't publish`
      : `⏰ ${platformList} connection expires in ${daysLeft} days — reconnect now`,
    html: emailShell(content),
  })
}

// ── 9. LIFECYCLE: BRAND BRAIN INCOMPLETE ─────────────────────────────────────

export async function sendBrandBrainIncompleteEmail(to: string, name: string, completionPct: number) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1(`${firstName}, your Brand Brain is ${completionPct}% complete`)}
    ${p('The more you teach Nexus about your brand, the better every AI output gets — from campaign strategy to post captions to image prompts.')}
    ${card(`
      <div style="font-size:13px;color:#9A9080;margin-bottom:16px;">A complete Brand Brain unlocks:</div>
      ${[
        ['🎯', 'Captions guided by your saved tone'],
        ['🧠', 'Strategy drafts informed by your stated audience'],
        ['✨', 'Images aligned to your brand aesthetic'],
        ['📈', 'A consistent baseline you can measure and improve'],
      ].map(([icon, text]) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:16px;">${icon}</span>
          <span style="font-size:13px;color:#F5F0E8;">${text}</span>
        </div>
      `).join('')}
    `)}
    ${btn('Complete Brand Brain →', `${APP_URL}/brand`)}
    ${p('You can update the profile whenever the brand, offer, or evidence changes.', true)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `Your Brand Brain needs 3 minutes — unlock better AI outputs`,
    html: emailShell(content),
  })
}

// ── 10. LIFECYCLE: CAMPAIGN AWAITING APPROVAL ─────────────────────────────────

export async function sendContentAwaitingApprovalEmail(
  to: string,
  name: string,
  campaignName: string,
  postCount: number,
  draftDays: number,
  campaignId: string,
) {
  const firstName = name?.split(' ')[0] || 'there'
  const hubUrl = `${APP_URL}/campaigns/${campaignId}/content-hub`

  const content = `
    ${h1(`${firstName}, your content plan has been waiting ${draftDays} days`)}
    ${p(`You have <strong style="color:#FF9500">${postCount} post drafts waiting for review</strong> for "${campaignName}". They have not been approved, so nothing has been scheduled or published.`)}
    ${card(`
      <div style="font-size:13px;color:#9A9080;margin-bottom:8px;">Review before scheduling:</div>
      ${[
        'Review the AI-generated captions',
        'Approve drafts → choose scheduling separately',
        'Generate images → visuals enter the configured generation queue',
        'Monitor the queue → approved posts publish only through verified connected providers',
      ].map((step, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
          <div style="width:22px;height:22px;border-radius:50%;background:rgba(255,149,0,0.15);border:1px solid rgba(255,149,0,0.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#FF9500;flex-shrink:0;">${i + 1}</div>
          <span style="font-size:13px;color:#F5F0E8;">${step}</span>
        </div>
      `).join('')}
    `)}
    ${btn(`Review ${postCount} posts →`, hubUrl)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `${postCount} posts are waiting for your approval in "${campaignName}"`,
    html: emailShell(content),
  })
}

// ── 11. LIFECYCLE: RE-ENGAGEMENT (7-DAY INACTIVE) ────────────────────────────

export async function sendReEngagementEmail(to: string, name: string, daysSinceActive: number) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1(`Your marketing is on pause, ${firstName}`)}
    ${p(`It's been ${daysSinceActive} days since you last used Nexus. While you were away, your competitors kept posting.`)}
    ${card(`
      <div style="font-size:13px;color:#9A9080;margin-bottom:12px;">Here's what you can do in the next 10 minutes:</div>
      ${[
        ['🚀', 'Create a new campaign', `${APP_URL}/campaigns/new`],
        ['✅', 'Approve a pending content plan', `${APP_URL}/campaigns`],
        ['🧠', 'Update your Brand Brain', `${APP_URL}/brand`],
      ].map(([icon, text, url]) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #1a1a18;">
          <span style="font-size:18px;">${icon}</span>
          <a href="${url}" style="color:#FF9500;font-size:13px;font-weight:600;">${text}</a>
        </div>
      `).join('')}
    `)}
    ${btn('Back to Nexus →', APP_URL)}
    ${p('Consistency is the biggest factor in social media growth. Let Nexus handle the heavy lifting.', true)}
  `

  return getResend().emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `${firstName}, your content pipeline needs you (${daysSinceActive} days idle)`,
    html: emailShell(content),
  })
}
