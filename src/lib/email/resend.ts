/**
 * Nexus AI — Email System via Resend
 * Handles all transactional + retention emails
 */
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Nexus AI <hello@nexus-grow.com>'
const REPLY_TO = 'support@nexus-grow.com'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-grow.com'

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
      <p>Nexus AI — Your AI marketing department.</p>
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
            <div style="font-size:12px;color:#6a6a8a;margin-top:2px;">Tell Nexus about your business once — it remembers forever.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:22px;height:22px;background:#FF9500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#080807;flex-shrink:0;">2</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#e8e8f5;">Generate your first campaign</div>
            <div style="font-size:12px;color:#6a6a8a;margin-top:2px;">Full strategy, hooks, scripts, and content calendar in 60 seconds.</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:22px;height:22px;background:#FF9500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#080807;flex-shrink:0;">3</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#e8e8f5;">Publish to Instagram or Facebook</div>
            <div style="font-size:12px;color:#6a6a8a;margin-top:2px;">Connect your accounts and go live directly from Nexus.</div>
          </div>
        </div>
      </div>
    `)}

    <div style="background:#101010;border:1px solid #2a2a4a;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <div style="font-size:12px;color:#FF9500;font-weight:700;margin-bottom:4px;">⚡ You have 30 free AI credits</div>
      <div style="font-size:13px;color:#b8b8d8;">That's 3 full campaign generations to get started. No credit card needed.</div>
    </div>

    ${btn('Open your dashboard →', `${APP_URL}/dashboard`)}

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1a1a18;">
      ${p('If you have any questions, just reply to this email — I read every one.', true)}
      ${p('— Raouf, founder of Nexus', true)}
    </div>
  `

  return resend.emails.send({
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
    ${p(`${firstName}, you have <strong style="color:#f59e0b;">${creditsRemaining} credits left</strong> — that's ${Math.floor(creditsRemaining / 10)} more campaign generation${Math.floor(creditsRemaining / 10) !== 1 ? 's' : ''}.`)}
    ${p('Upgrade to Pro to keep your momentum going — unlimited credits, unlimited campaigns, and your weekly marketing brief every Monday.')}

    ${card(`
      <div style="font-size:13px;font-weight:700;color:#e8e8f5;margin-bottom:12px;">What you get with Pro:</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${['200 AI credits every month', 'Unlimited campaigns', 'Weekly strategy brief in your inbox', 'Social publishing to Instagram & Facebook', 'PDF campaign reports'].map(f =>
          `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#b8b8d8;">
            <span style="color:#FF9500;font-weight:700;">✓</span> ${f}
          </div>`
        ).join('')}
      </div>
    `)}

    ${btn('Upgrade to Pro — $79/month →', `${APP_URL}/billing`)}
    ${p('7-day money-back guarantee. Cancel anytime.', true)}
  `

  return resend.emails.send({
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

    ${btn('Generate this week\'s content →', `${APP_URL}/campaign/new`)}

    <div style="margin-top:20px;">
      ${p('Your weekly brief is generated every Monday based on your brand memory and past campaigns. The more you use Nexus, the smarter it gets.', true)}
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

  return resend.emails.send({
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
  const firstName = data.name?.split(' ')[0] || 'there'
  const platformEmoji = PLATFORM_EMOJI[data.platform] || '📱'
  const platformName = data.platform.charAt(0) + data.platform.slice(1).toLowerCase().replace('_', ' ')

  const content = `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#FF9500;margin-bottom:8px;">
      Today · ${data.day}
    </div>
    ${h1(`${firstName}, here's what to post today.`)}
    ${p(`From your <strong style="color:#e8e8f5;">${data.campaignName}</strong> campaign — post ${data.postIndex} of ${data.totalPosts}.`)}

    ${card(`
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:18px;">${platformEmoji}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#e8e8f5;">${data.type}</div>
          <div style="font-size:11px;color:#6a6a8a;">${platformName} · ${data.topic || data.campaignName}</div>
        </div>
      </div>
      ${data.caption ? `
        <div style="background:#0a0a0c;border:1px solid #1a1a18;border-radius:10px;padding:16px;font-size:13px;color:#b8b8d8;line-height:1.7;white-space:pre-wrap;">${data.caption}</div>
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

  return resend.emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `Today on ${platformName}: ${data.type} — ${data.campaignName}`,
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
    ${p('Right now Nexus is generating generic output. Take 3 minutes to set up your Brand Memory — after that, every campaign, every hook, every caption will be written in your voice, for your audience.')}

    ${card(`
      <div style="font-size:12px;color:#FF9500;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">🧠 What Brand Memory stores</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${['Your brand tone and writing style', 'Your target audience (once — never again)', 'Your winning hooks and angles', 'What to avoid in your content', 'Your primary offer and positioning'].map(f =>
          `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#b8b8d8;">
            <span style="color:#FF9500;">→</span> ${f}
          </div>`
        ).join('')}
      </div>
    `)}

    ${p('Once it\'s set, every campaign you generate will be on-brand automatically. No more re-explaining who you are.')}
    ${btn('Set up Brand Memory — 3 minutes →', `${APP_URL}/brand`)}
    <div style="margin-top:20px;">${p('— Raouf', true)}</div>
  `

  return resend.emails.send({
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
          <strong style="color:#e8e8f5;">Full marketing strategy</strong> — positioning, audience breakdown, platform playbook
        </div>
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">5 ready-to-record ad hooks</strong> — different angles, different tones, all specific to your product
        </div>
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">Complete captions</strong> — with hashtags, ready to copy and post
        </div>
        <div style="font-size:13px;color:#b8b8d8;padding-left:12px;border-left:2px solid #FF9500;">
          <strong style="color:#e8e8f5;">30-day content calendar</strong> — what to post, when, and why
        </div>
      </div>
    `)}

    ${p('Takes 60 seconds. You have 2 free campaigns left.')}
    ${btn('Generate a campaign now →', `${APP_URL}/campaign/new`)}
    <div style="margin-top:20px;">${p('— Raouf', true)}</div>
  `

  return resend.emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `You have 2 free campaigns left on Nexus`,
    html: emailShell(content),
  })
}

// Day 5 — Urgency: 1 campaign left
export async function sendNurtureDay5(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1('1 free campaign left.')}
    ${p(`${firstName} — your free plan includes 3 complete campaigns. You have <strong style="color:#f59e0b;">1 left</strong>.`)}
    ${p('Use it today. Generate a campaign for your best product, your most important launch, or the audience you\'ve been meaning to target.')}

    <div style="background:#1a1000;border:1px solid #3a2800;border-radius:12px;padding:20px 24px;margin:20px 0;">
      <div style="font-size:13px;color:#f59e0b;font-weight:700;margin-bottom:8px;">⚡ Use your last free campaign on something that matters</div>
      <div style="font-size:13px;color:#c8a060;line-height:1.6;">
        Pick your highest-value product or service. Set your goal to Sales or Leads. Let Nexus build the full strategy — then take the hooks and start posting today.
      </div>
    </div>

    ${btn('Use my last free campaign →', `${APP_URL}/campaign/new`)}

    <div style="margin-top:24px;padding:16px 20px;background:#101010;border:1px solid #1a1a18;border-radius:10px;">
      <div style="font-size:12px;color:#5C5448;margin-bottom:6px;">After your free campaigns are used:</div>
      <div style="font-size:13px;color:#9A9080;">Upgrade to Pro for $79/month — unlimited campaigns, your weekly strategy brief, and social publishing. <a href="${APP_URL}/billing" style="color:#FF9500;">See plans →</a></div>
    </div>

    <div style="margin-top:20px;">${p('— Raouf', true)}</div>
  `

  return resend.emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `${firstName}, you have 1 free Nexus campaign left`,
    html: emailShell(content),
  })
}

// Day 7 — Upgrade push
export async function sendNurtureDay7(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1('Is Nexus worth $79/month?')}
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
          <span style="color:#FF9500;font-weight:700;">Nexus Pro</span>
          <span style="color:#FF9500;font-weight:800;">$79/month</span>
        </div>
      </div>
    `)}

    ${p('Nexus Pro gives you unlimited campaigns, your weekly strategy brief every Monday, social publishing, and a brand memory that gets smarter every time you use it.')}
    ${p('If you run even one campaign a week that converts — the tool pays for itself in the first sale.')}

    ${btn('Upgrade to Pro — $79/month →', `${APP_URL}/billing`)}

    <div style="margin-top:16px;text-align:center;">
      ${p('7-day money-back guarantee. No questions asked. <a href="${APP_URL}/billing">See all plans →</a>', true)}
    </div>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1a1a18;">
      ${p('If the free plan is working fine for you, that\'s genuinely okay — you can keep using it. But if marketing is holding your business back, Pro is the answer.', true)}
      ${p('— Raouf', true)}
    </div>
  `

  return resend.emails.send({
    from: FROM, replyTo: REPLY_TO, to,
    subject: `Is Nexus worth $79/month? Here's the honest answer`,
    html: emailShell(content),
  })
}

// ── 4. UPGRADE CONFIRMATION ────────────────────────────────────────────

export async function sendUpgradeConfirmationEmail(to: string, name: string, plan: string) {
  const firstName = name?.split(' ')[0] || 'there'

  const content = `
    ${h1(`You're on ${plan}. Let's build.`)}
    ${p(`${firstName}, your upgrade to Nexus ${plan} is confirmed. Everything is unlocked.`)}

    ${card(`
      <div style="font-size:13px;font-weight:700;color:#e8e8f5;margin-bottom:12px;">What's now available to you:</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${['Unlimited AI credits', 'Unlimited campaign generation', 'Social publishing to all platforms', 'Weekly intelligence brief every Monday', 'PDF campaign reports', 'Priority support'].map(f =>
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

  return resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject: `You're now on Nexus ${plan} — everything is unlocked`,
    html: emailShell(content),
  })
}
