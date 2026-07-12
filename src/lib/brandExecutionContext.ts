/**
 * Canonical Brand Brain → AI execution context formatter.
 *
 * User-confirmed facts, historical signals, and AI inference must not be mixed.
 * This formatter deliberately excludes `aiInsights`; inferred content may be
 * shown as a proposal, but it is never injected as verified brand truth.
 */

export type BrandExecutionProfile = Record<string, unknown>

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function list(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && !!item.trim())
    .map((item) => item.trim())
    .slice(0, limit)
}

function line(label: string, value: unknown): string | null {
  const valueText = text(value)
  return valueText ? `- ${label}: ${valueText}` : null
}

function listLine(label: string, value: unknown, limit?: number): string | null {
  const values = list(value, limit)
  return values.length ? `- ${label}: ${values.join(' | ')}` : null
}

function section(title: string, lines: Array<string | null>): string | null {
  const present = lines.filter((item): item is string => Boolean(item))
  return present.length ? `## ${title}\n${present.join('\n')}` : null
}

export function buildBrandExecutionContext(profile: BrandExecutionProfile | null | undefined): string {
  if (!profile) return ''

  const confirmed = section('CONFIRMED BRAND AND BUSINESS INPUTS', [
    line('Brand name', profile.brandName),
    line('Industry / category', profile.industry),
    line('Business description', profile.description),
    line('Primary offer', profile.primaryOffer),
    listLine('Secondary offers', profile.secondaryOffers),
    line('Price positioning', profile.pricePoint),
    listLine('Unique advantages', profile.uniqueAdvantages),
    line('Target audience', profile.targetAudience),
    line('Audience age', profile.audienceAge),
    line('Market / region', profile.audienceLocation),
    listLine('Audience pain points', profile.audiencePainPoints),
    listLine('Audience desires', profile.audienceDesires),
    listLine('Customer objections', profile.customerObjections),
    listLine('Verified proof points', profile.verifiedProof),
    line('Business goal', profile.businessGoal),
    line('Marketing budget band', profile.marketingBudget),
    line('Conversion destination', profile.conversionDestination),
    line('Lead handling / sales process', profile.leadHandling),
    line('Average order value', profile.averageOrderValue),
    line('Gross margin', profile.grossMargin),
    line('Customer lifetime value', profile.customerLifetimeValue),
    line('Sales cycle length', profile.salesCycleLength),
    line('Seasonality', profile.seasonality),
    line('Compliance constraints', profile.complianceNotes),
    line('Language preference', profile.languagePreference),
  ])

  const brandSystem = section('CONFIRMED BRAND EXPRESSION RULES', [
    listLine('Tone keywords', profile.toneKeywords),
    line('Writing style', profile.writingStyle),
    listLine('Words and styles to avoid', profile.avoidKeywords),
    line('Visual style', profile.visualStyle),
    listLine('Color palette', profile.colorPalette),
    listLine('Preferred platforms', profile.topPlatforms),
  ])

  const market = section('CONFIRMED MARKET CONTEXT', [
    listLine('Named competitors — never invent additional competitors', profile.competitors),
    line('Competitor notes', profile.competitorNotes),
    line('Strategic notes', profile.strategicNotes),
    line('User-provided past advertising results', profile.pastAdResults),
  ])

  // Legacy arrays currently combine approval and performance sources. Until
  // per-item provenance lands, they are explicitly labelled as candidates.
  const memory = section('STORED LEARNING CANDIDATES — USE AS HINTS, NOT VERIFIED FACTS', [
    listLine('Candidate hooks', profile.winningHooks, 5),
    listLine('Candidate angles', profile.winningAngles, 5),
    listLine('Angles to avoid', profile.failedAngles, 5),
  ])

  const sections = [confirmed, brandSystem, market, memory].filter((item): item is string => Boolean(item))
  return sections.join('\n\n')
}
