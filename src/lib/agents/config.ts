/**
 * Nexus AI — Agent Identity Config
 *
 * Canonical source of truth for agent names, titles, and visual identity.
 * Keys match the Prisma AgentType enum (STRATEGIST, CONTENT_DIRECTOR, etc.)
 * so this can be used directly with DB records.
 */

export const AGENTS = {
  STRATEGIST: {
    id: 'STRATEGIST',
    name: 'SAGE',
    title: 'Lead Marketing Strategist',
    icon: '🧠',
    color: '#6366F1',       // Indigo
    textClass: 'text-indigo-400',
    tagline: 'Every market has a pattern. I find it.',
  },
  CONTENT_DIRECTOR: {
    id: 'CONTENT_DIRECTOR',
    name: 'MUSE',
    title: 'Creative Director',
    icon: '🎨',
    color: '#EC4899',       // Pink
    textClass: 'text-pink-400',
    tagline: 'Content that feels like an ad dies. I make it breathe.',
  },
  CAMPAIGN_MANAGER: {
    id: 'CAMPAIGN_MANAGER',
    name: 'PULSE',
    title: 'Campaign Operations',
    icon: '⚡',
    color: '#F59E0B',       // Amber
    textClass: 'text-amber-400',
    tagline: 'A plan on paper is worth zero. Execution is everything.',
  },
  REPORTING: {
    id: 'REPORTING',
    name: 'PRISM',
    title: 'Performance Analyst',
    icon: '📊',
    color: '#10B981',       // Emerald
    textClass: 'text-emerald-400',
    tagline: 'Every dirham tells a story. I read it.',
  },
} as const

export type AgentKey = keyof typeof AGENTS
export type AgentConfig = (typeof AGENTS)[AgentKey]

/** Convenience — get agent by DB key, with fallback */
export function getAgent(key: string): AgentConfig {
  return (AGENTS as Record<string, AgentConfig>)[key] ?? AGENTS.STRATEGIST
}

/** "🧠 SAGE · Lead Marketing Strategist" */
export function agentLabel(key: string): string {
  const a = getAgent(key)
  return `${a.icon} ${a.name} · ${a.title}`
}

/** Short label: "🧠 SAGE" */
export function agentShort(key: string): string {
  const a = getAgent(key)
  return `${a.icon} ${a.name}`
}
