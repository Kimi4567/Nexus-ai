/**
 * planContext.ts — Commercial capacity context injected into agent prompts.
 *
 * Why this exists:
 *   Agents must not generate a 40-post calendar for a legacy Starter user who only gets
 *   10 posts/month. Every agent must be aware of the user's plan so that output
 *   volume, depth, and calendar scope match what the user can actually execute.
 *
 * Quotas are product limits, not performance claims. Cadence must be selected
 * from the brand's capacity, platform fit, and observed results.
 */

import { FREE_TRIAL_POSTS, PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

const GROWTH_PLAN = PUBLIC_PAID_PLANS[0]
const AUTOPILOT_PLAN = PUBLIC_PAID_PLANS[1]

// ── Platform cadence guidance (injectable into prompts) ──────────────────────

export const PLATFORM_FREQUENCY_SCIENCE = `
PLATFORM CADENCE GUIDANCE — hypotheses to validate, not universal performance rules:
• Select only platforms supported by the saved brand context and execution capacity.
• Prefer a sustainable review-and-publish cadence over volume the team cannot maintain.
• Reuse an approved idea across suitable formats only when the platform and audience context still fit.
• Change cadence from real reach, engagement, conversion, and workload evidence — never from an invented benchmark.
• Do not promise leads, reach, algorithmic amplification, or ROI from posting frequency alone.
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
    postsPerMonth: FREE_TRIAL_POSTS,
    calendarWeeks: 1,
    platformCount: 1,
    audienceSegments: 1,
    contentAngles: 3,
    depth: 'basic',
    upgradeNote:
      'Growth unlocks a larger execution allowance. Mention it only when the requested deliverables exceed the current quota; never imply that upgrading guarantees performance.',
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
      'This is a legacy plan. Mention Growth only when the requested deliverables exceed the current quota; never claim that more volume guarantees results.',
  },
  pro: {
    label: 'Growth ($49/month)',
    postsPerMonth: GROWTH_PLAN.postsPerMonth,
    calendarWeeks: 4,
    platformCount: 4,
    audienceSegments: 3,
    contentAngles: 12,
    depth: 'advanced',
    upgradeNote: null,
  },
  growth: {
    label: 'Growth ($49/month)',
    postsPerMonth: GROWTH_PLAN.postsPerMonth,
    calendarWeeks: 4,
    platformCount: 4,
    audienceSegments: 3,
    contentAngles: 12,
    depth: 'advanced',
    upgradeNote: null,
  },
  business: {
    label: 'Autopilot ($99/month)',
    postsPerMonth: AUTOPILOT_PLAN.postsPerMonth,
    calendarWeeks: 4,
    platformCount: 6,
    audienceSegments: 4,
    contentAngles: 15,
    depth: 'agency',
    upgradeNote: null,
  },
  agency: {
    label: 'Autopilot ($99/month)',
    postsPerMonth: AUTOPILOT_PLAN.postsPerMonth,
    calendarWeeks: 4,
    platformCount: 6,
    audienceSegments: 4,
    contentAngles: 15,
    depth: 'agency',
    upgradeNote: null,
  },
}

function normalizeTier(planTier?: string): string {
  const raw = planTier?.toLowerCase()?.trim() || 'free'
  // Handle 'ACTIVE' — treat as Growth-level
  if (raw === 'active') return 'pro'
  if (raw === 'admin') return 'agency'
  return TIER_CONFIGS[raw] ? raw : 'free'
}

// ── Main export: getPlanContext ───────────────────────────────────────────────

/**
 * Returns a formatted plan context block ready to inject into any agent prompt.
 * Includes: plan tier, content quota, calendar depth, platform count, and
 * evidence-aware cadence guidance.
 *
 * @param planTier  User's subscription tier: 'free' | 'starter' | 'pro' | 'growth' | 'business' | 'agency'
 */
export function getPlanContext(
  planTier?: string,
  strategyType?: 'organic' | 'paid' | 'full' | 'content',
): string {
  const key = normalizeTier(planTier)
  const cfg = TIER_CONFIGS[key]
  const paidOnly = strategyType === 'paid'

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
    paidOnly
      ? 'Organic content directions in this run: 0 (the reviewed paid-planning package controls its own exact counts)'
      : `Content-direction capacity: up to ${cfg.contentAngles}; a reviewed order may set a lower exact count`,
    ``,
    `SCOPE INSTRUCTION: ${paidOnly
      ? 'Paid-only planning: create audience, message, copy, creative, tracking, budget-framework, and approval hypotheses only. Do not create an organic publishing calendar.'
      : depthGuide[cfg.depth]}`,
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
