/**
 * Deterministic fixture for explicit demos and truth-contract tests.
 *
 * Production generation routes must never fall back to this module when the
 * provider is unavailable. They return AI_PROVIDER_UNAVAILABLE before charging
 * credits. These helpers remain useful for clearly labelled demo surfaces.
 */

function text(value: unknown, fallback: string, max = 180): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

function platformsFor(campaign: any): string[] {
  return Array.isArray(campaign?.platforms) && campaign.platforms.length
    ? campaign.platforms.filter((item: unknown): item is string => typeof item === 'string').slice(0, 8)
    : ['INSTAGRAM']
}

function platformGuidance(platform: string): string {
  const guidance: Record<string, string> = {
    INSTAGRAM: 'Test a native visual post and a short-form variant; compare only after verified platform metrics are available.',
    FACEBOOK: 'Test one clear message with a single CTA; do not claim lift until Meta returns an eligible sample.',
    LINKEDIN: 'Lead with a useful operator insight and keep the CTA specific to the intended professional audience.',
    TIKTOK: 'Prepare a concise creator-native draft. Direct publishing remains subject to creator settings and explicit consent.',
    YOUTUBE_SHORTS: 'Prepare a vertical storyboard with an immediate problem statement and a single next action.',
    SNAPCHAT: 'Prepare a short vertical concept and verify provider publishing availability before scheduling.',
    TWITTER: 'Prepare a concise thesis and one follow-up variation for user review.',
    WEBSITE: 'Use a focused landing-page message that matches the approved campaign goal.',
  }
  return guidance[platform] || 'Prepare a platform-native draft and validate it with verified first-party metrics after publishing.'
}

export async function callOpenAI(_prompt: string): Promise<any> {
  return {
    mock: true,
    providerConfigured: false,
    content: 'No AI provider is configured. Nexus returned a deterministic planning draft with no performance claims.',
  }
}

export async function generateScript(briefing: string): Promise<string> {
  const subject = text(briefing, 'the approved campaign brief', 240)
  return `[PLANNING DRAFT — NO PERFORMANCE EVIDENCE]\n\nHOOK (0–3s): State the audience problem in plain language.\n\nCONTEXT (3–10s): Explain why ${subject} matters without using unverified numbers or customer claims.\n\nVALUE (10–22s): Demonstrate the approved value proposition with a concrete product or service detail.\n\nPROOF (22–26s): Insert only proof supplied and approved in Brand Brain; otherwise omit this section.\n\nCTA (26–30s): Use one explicit next action from the campaign brief.\n\nReview the wording, proof, and CTA before scheduling.`
}

export async function generateCaptions(_script: string, platform: string): Promise<string[]> {
  const channel = text(platform, 'the selected platform', 40)
  return [
    `[DRAFT — ${channel}] Name the audience problem, explain one approved benefit, and end with one clear CTA. Add only verified proof from Brand Brain.`,
    `[ALTERNATE DRAFT — ${channel}] Open with a direct question, show the approved product or service detail, and invite the audience to take the campaign's chosen next step.`,
  ]
}

export async function generateMarketingStrategy(campaign: any, project: any) {
  const brand = text(campaign?.name, 'This brand')
  const audience = text(campaign?.audience, 'Audience details are missing; complete Brand Brain before execution.', 500)
  const industry = text(project?.businessType || campaign?.description, 'the selected market')
  const goal = text(campaign?.goal, 'AWARENESS', 40)
  const platforms = platformsFor(campaign)

  return {
    evidenceStatus: 'planning_hypothesis',
    providerConfigured: false,
    overview: `Planning hypothesis for ${brand}: organize an approved ${goal.toLowerCase()} message for ${audience}. No reach, conversion, or revenue outcome is predicted.`,
    positioning: `Hypothesis to review: position ${brand} around one specific, supportable benefit for ${industry}; replace this with the approved Brand Brain positioning before execution.`,
    audience,
    valueProps: [
      'Use only product or service benefits recorded in Brand Brain.',
      'Pair every numerical or customer claim with approved first-party proof.',
      'Keep one primary CTA per content item.',
    ],
    contentPillars: [
      'Education: explain the audience problem and decision criteria.',
      'Product or service clarity: demonstrate an approved capability.',
      'Proof: use only verified evidence supplied by the brand.',
      'Action: connect the message to one explicit next step.',
    ],
    angles: [
      'Problem → approved solution detail',
      'Common objection → evidence-backed response',
      'How it works → next action',
    ],
    platformRecommendations: Object.fromEntries(platforms.map((platform) => [platform, platformGuidance(platform)])),
    contentCalendar: buildCalendar(brand, platforms),
    metrics: {
      evidenceStatus: 'not_available',
      message: 'No performance target or benchmark is generated without verified historical evidence and a user-approved objective.',
    },
    ctaStrategies: [
      'Choose one CTA that matches the approved campaign goal.',
      'Do not add urgency, scarcity, pricing, or guarantees unless Brand Brain explicitly confirms them.',
    ],
    risks: [
      'Missing brand proof can make claims unsafe; omit unsupported claims.',
      'Provider access may limit publishing or analytics availability.',
      'Treat every recommendation as a hypothesis until eligible platform evidence exists.',
    ],
  }
}

function buildCalendar(brand: string, platforms: string[]): any[] {
  return Array.from({ length: 4 }, (_, weekIndex) => ({
    week: `Week ${weekIndex + 1}`,
    posts: [0, 1, 2].map((postIndex) => {
      const platform = platforms[(weekIndex + postIndex) % platforms.length]
      const types = ['Educational draft', 'Approved benefit draft', 'Objection-handling draft']
      return {
        day: `Week ${weekIndex + 1}, item ${postIndex + 1}`,
        platform,
        type: types[postIndex],
        topic: `${brand}: ${types[postIndex].toLowerCase()}`,
        format: 'Select during review based on available brand assets',
        status: 'DRAFT',
      }
    }),
  }))
}

export async function generateAdConcepts(campaign: any, _project: any) {
  const brand = text(campaign?.name, 'the brand')
  const audience = text(campaign?.audience, 'the approved audience', 500)
  const platforms = platformsFor(campaign)
  const concepts = [
    { name: 'Problem clarity', angle: 'Problem → approved solution detail' },
    { name: 'How it works', angle: 'Process → approved benefit → CTA' },
    { name: 'Objection response', angle: 'Objection → supportable answer → CTA' },
  ]

  return concepts.map((concept, index) => ({
    ...concept,
    evidenceStatus: 'planning_hypothesis',
    description: `Draft concept for ${audience}. Review against Brand Brain before use.`,
    hook: `State one specific reason ${audience} should examine ${brand}, without an unverified outcome claim.`,
    script: `HOOK: State the approved audience problem.\nBODY: Show one approved ${brand} capability.\nPROOF: Insert verified proof from Brand Brain or omit.\nCTA: Use the campaign's approved next action.`,
    cta: 'Select the approved campaign CTA during review.',
    headlines: [
      `${brand}: one clear way to address the approved audience problem`,
      `How ${brand} works — reviewable planning draft`,
    ],
    captions: [`[DRAFT] Explain the approved value proposition for ${audience}; add no unsupported proof or scarcity.`],
    platform: platforms[index % platforms.length],
    format: 'Choose after reviewing available assets and provider requirements',
    estimatedReach: null,
  }))
}
