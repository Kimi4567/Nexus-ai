/**
 * planContext.ts — Research-backed plan context injected into every agent prompt.
 *
 * Why this exists:
 *   Agents must not generate a 60-post calendar for a Starter user who only gets
 *   10 posts/month. Every agent must be aware of the user's plan so that output
 *   volume, depth, and calendar scope match what the user can actually execute.
 *
 * Research basis (Nexus AI Pricing Study, June 2025):
 *   - HubSpot State of Marketing: 16+ posts/month = 4.5× more leads
 *   - SproutSocial: Instagram 12-20/mo, LinkedIn 8-12/mo, TikTok 8-20/mo optimal
 *   - Hootsuite: Facebook 3-7×/week, Twitter/X 5×/week, YouTube Shorts 2-3×/week
 *   - Starter plan is intentionally below 16/mo threshold — natural upgrade pressure
 *   - Growth plan crosses the 16/mo threshold — this is the pitch to Starter users
 */

// ── Platform frequency science (injectable into prompts) ─────────────────────

export const PLATFORM_FREQUENCY_SCIENCE = `
PLATFORM POSTING FREQUENCY — Research-Backed (HubSpot / SproutSocial / Hootsuite 2024):
• Instagram:      12-20 posts/month | Reels 8-12/mo | Stories daily | 3-5×/week optimal
• LinkedIn:       8-12 posts/month  | 3×/week sweet spot | Quality > quantity here
• TikTok:         8-20 posts/month  | 3-5×/week | Algorithm rewards consistency
• Facebook:       12-15 posts/month | 3-4×/week | Engagement drops above 2×/day
• Twitter/X:      15-20 posts/month | 5×/week | High-frequency, high-noise
• YouTube Shorts: 8-12 videos/month | 2-3×/week for algorithmic amplification
• Pinterest:      15-25 posts/month | Daily posting ideal

KEY FINDING: 16+ posts/month = 4.5× more leads (HubSpot State of Marketing).
Brands below this threshold plateau regardless of content quality.
Optimal: 20 posts/month across 2 active platforms = max ROI for solopreneurs.
`

// ── Per-tier strategy depth config ───────────────────────────────────────────

export type StrategyDepth = 'basic' | 'standard' | 'advanced' | 'agency'

interface TierConfig {
  label: string
  postsPerMonth: number
  calendarWeeks: number
  platformCount: number
  audienceSegments: number
  contentAngles: number
  depth: StrategyDepth
  upgradeNote: string | null
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  free: {
    label: 'Free (Trial)',
    postsPerMonth: 3,
    calendarWeeks: 1,
    platformCount: 1,
    audienceSegments: 1,
    contentAngles: 3,
    depth: 'basic',
    upgradeNote:
      'Note: upgrading to Starter unlocks 10 posts/month and 2 campaigns. ' +
      'Mention this if the strategy would benefit from higher volume.',
  },
  starter: {
    label: 'Starter ($19/month)',
    postsPerMonth: 10,
    calendarWeeks: 2,
    platformCount: 2,
    audienceSegments: 2,
    contentAngles: 8,
    depth: 'standard',
    upgradeNote:
      'UPGRADE TRIGGER: This user is below the 16-posts/month lead-gen threshold. ' +
      'If 16+ posts would meaningfully accelerate results, note it in estimatedResults or nextBestAction.',
  },
  pro: {
    label: 'Growth ($49/month)',
    postsPerMonth: 25,
    calendarWeeks: 4,
    platformCount: 4,
    audienceSegments: 3,
    contentAngles: 12,
    depth: 'advanced',
    upgradeNote: null,
  },
  growth: {
    label: 'Growth ($49/month)',
    postsPerMonth: 25,
    calendarWeeks: 4,
    platformCount: 4,
    audienceSegments: 3,
    contentAngles: 12,
    depth: 'advanced',
    upgradeNote: null,
  },
  business: {
    label: 'Agency ($99/month)',
    postsPerMonth: 60,
    calendarWeeks: 4,
    platformCount: 6,
    audienceSegments: 4,
    contentAngles: 15,
    depth: 'agency',
    upgradeNote: null,
  },
  agency: {
    label: 'Agency ($99/month)',
    postsPerMonth: 60,
    calendarWeeks: 4,
    platformCount: 6,
    audienceSegments: 4,
    contentAngles: 15,
    depth: 'agency',
    upgradeNote: null,
  },
}

function normalizeTier(planTier?: string): string {
  const raw = planTier?.toLowerCase()?.trim() || 'starter'
  // Handle 'ACTIVE' — treat as Growth-level
  if (raw === 'active') return 'pro'
  if (raw === 'admin') return 'agency'
  return TIER_CONFIGS[raw] ? raw : 'starter'
}

// ── Main export: getPlanContext ───────────────────────────────────────────────

/**
 * Returns a formatted plan context block ready to inject into any agent prompt.
 * Includes: plan tier, content quota, calendar depth, platform count, and
 * research-backed frequency guidance.
 *
 * @param planTier  User's subscription tier: 'free' | 'starter' | 'pro' | 'growth' | 'business' | 'agency'
 */
export function getPlanContext(planTier?: string): string {
  const key = normalizeTier(planTier)
  const cfg = TIER_CONFIGS[key]

  const depthGuide: Record<StrategyDepth, string> = {
    basic:
      'Basic scope: focus on 1 platform, 1 audience segment, 3-5 content angles, 1-week starter calendar.',
    standard:
      'Standard scope: cover 1-2 platforms, 2 audience segments, 8 content angles, 2-week calendar.',
    advanced:
      'Advanced scope: full 4-week calendar, 3 audience segments, 12+ content angles, multi-platform strategy.',
    agency:
      'Autopilot scope: full 4-week calendar, 4 audience segments, 15 content angles, and supported connected platforms.',
  }

  const lines = [
    `━━━ NEXUS AI PLAN CONTEXT ━━━`,
    `Plan: ${cfg.label}`,
    `Monthly post quota: ${cfg.postsPerMonth} posts/month`,
    `Max platforms: ${cfg.platformCount}`,
    `Calendar depth: ${cfg.calendarWeeks}-week calendar`,
    `Audience segments to generate: ${cfg.audienceSegments}`,
    `Content angles to generate: ${cfg.contentAngles}`,
    ``,
    `SCOPE INSTRUCTION: ${depthGuide[cfg.depth]}`,
    `Do NOT generate more posts or weeks than the quota above allows.`,
    `Every deliverable in the weekly plan must be achievable within this user's quota.`,
    cfg.upgradeNote ? `\n${cfg.upgradeNote}` : null,
    ``,
    PLATFORM_FREQUENCY_SCIENCE.trim(),
    `━━━ END PLAN CONTEXT ━━━`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  return `\n${lines}\n`
}

/**
 * Returns just the numeric config for a tier — useful for programmatic checks.
 * Example: canRunFullCalendar = getPlanLimits('starter').calendarWeeks >= 4
 */
export function getPlanLimits(planTier?: string): TierConfig {
  const key = normalizeTier(planTier)
  return TIER_CONFIGS[key]
}
