/**
 * Strategy proof guard
 *
 * Deterministic backstop for strategy/content-planning outputs. Prompt rules are
 * the first line of defense; this guard keeps unsupported proof assets from
 * being saved as strategy truth when Brand Brain has no verified proof.
 */

export interface StrategyProofContext {
  verifiedProof?: string[] | null
}

interface ProofAvailability {
  hasTestimonials: boolean
  hasCustomerStories: boolean
  hasAwards: boolean
  hasCaseStudies: boolean
  hasReviews: boolean
}

function verifiedProofText(context: StrategyProofContext): string {
  return Array.isArray(context.verifiedProof)
    ? context.verifiedProof.filter((item): item is string => typeof item === 'string').join(' \n ')
    : ''
}

function softenUnsupportedGuarantees(text: string): string {
  return text
    .replace(/\bguaranteed\s+delivery\b/gi, 'delivery goal')
    .replace(/\bguaranteed\s+growth\b/gi, 'planned growth goal')
    .split(/(\bguaranteed\s+results?\b|\bguaranteed\b)/gi)
    .map((part, index, parts) => {
      if (!/^guaranteed(?:\s+results?)?$/i.test(part)) return part
      const before = (parts[index - 1] || '').toLowerCase().slice(-80)
      if (/(?:^|\s)(?:no|not|avoid|without|cannot be|can not be|can't be|do not|do not promise|do not guarantee)\s*$/.test(before)) {
        return part
      }
      return /\s+results?$/i.test(part) ? 'aimed-for results' : 'aimed-for'
    })
    .join('')
}

function guardUnsafeStatusLanguage(text: string): string {
  return text
    .replace(/مرحلة العمل\s*:\s*active\b/gi, 'مرحلة العمل: مرحلة التخطيط/المراجعة')
    .replace(/\bbusiness stage\s*:\s*active\b/gi, 'business stage: business already operating')
    .replace(/\bactive stage\b/gi, 'planning/review stage')
    .replace(/\bcampaign active\b/gi, 'campaign in planning/review')
    .replace(/\bthe campaign is active\b/gi, 'the campaign is in planning/review')
}

function softenAbsoluteOutcomeClaims(text: string): string {
  return text
    .replace(/\bEnsure your office has the best coffee every day\b/gi, 'Help keep your office stocked with better coffee')
    .replace(/\bEnsure results\b/gi, 'Support the planned outcome')
    .replace(/\bEnsure delivery\b/gi, 'Support delivery planning')
    .replace(/\bEnsure customers\b/gi, 'Help customers')
    .replace(/\bmake sure your team always\b/gi, 'help your team more consistently')
}

export function getProofAvailability(context: StrategyProofContext): ProofAvailability {
  const proof = verifiedProofText(context).toLowerCase()
  return {
    hasTestimonials: /\b(testimonial|satisfied customer|client quote|customer quote)\b/i.test(proof),
    hasCustomerStories: /\b(customer story|customer stories)\b/i.test(proof),
    hasAwards: /\b(award|certified|certification|accredited|badge)\b/i.test(proof),
    hasCaseStudies: /\b(case study|case studies|case-study)\b/i.test(proof),
    hasReviews: /\b(review|rating|rated|stars?)\b/i.test(proof),
  }
}

export function buildProofPolicyPrompt(context: StrategyProofContext): string {
  const proof = Array.isArray(context.verifiedProof)
    ? context.verifiedProof.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  const proofLine = proof.length
    ? `Verified proof provided by the user: ${proof.map(item => `"${item}"`).join('; ')}.`
    : 'No testimonial, customer-story, review, award, case-study, guarantee, or performance proof has been provided.'

  return [
    'PROOF POLICY (strict):',
    proofLine,
    '- Use only the verified proof above as factual proof.',
    '- Do not invent testimonials, customer stories, awards, reviews, satisfaction claims, case studies, guarantees, or performance claims.',
    '- Do not phrase proof gaps as if they already exist.',
    '- Do not create "Customer Testimonials" as a content pillar unless verified proof includes real testimonials.',
    '- Do not write "Hear from satisfied customers" or "Read their stories" unless those customer stories were provided.',
    '- If proof is missing, recommend collecting proof, asking customers for feedback, or using available factual proof only.',
  ].join('\n')
}

export function guardStrategyProofText(text: unknown, context: StrategyProofContext = {}): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''

  const proof = getProofAvailability(context)
  let guarded = text

  if (!proof.hasTestimonials) {
    guarded = guarded
      .replace(/\bCustomer Testimonials\b/gi, 'Proof to collect')
      .replace(/\bHear from our satisfied customers\b/gi, 'Ask customers for feedback and stories')
      .replace(/\bHear from satisfied customers\b/gi, 'Ask customers for feedback and stories')
      .replace(/\bcustomer testimonial video\b/gi, 'customer feedback request or proof-collection video')
      .replace(/\bcustomer testimonials?\b/gi, 'customer proof to collect')
      .replace(/\btestimonials?\b/gi, 'proof to collect')
      .replace(/\bsatisfied customers\b/gi, 'customers to ask for feedback')
  }

  if (!proof.hasCustomerStories) {
    guarded = guarded
      .replace(/\bcustomer stories\b/gi, 'customer stories to collect')
      .replace(/\bcustomer story\b/gi, 'customer story to collect')
      .replace(/\bRead their stories\b/gi, 'Collect customer stories for future use')
  }

  if (!proof.hasReviews) {
    guarded = guarded
      .replace(/\bcustomer reviews?\b/gi, 'customer reviews to collect')
      .replace(/\bratings?\b/gi, 'ratings to collect')
      .replace(/\bstar ratings?\b/gi, 'star ratings to collect')
  }

  if (!proof.hasCaseStudies) {
    guarded = guarded.replace(/\bcase stud(?:y|ies)\b/gi, 'proof examples to collect')
  }

  if (!proof.hasAwards) {
    guarded = guarded
      .replace(/\baward[-\s]?winning\b/gi, 'quality-focused')
      .replace(/\bcertified\b/gi, 'to be verified')
  }

  guarded = softenAbsoluteOutcomeClaims(guardUnsafeStatusLanguage(guarded))
    .replace(/\s{2,}/g, ' ')
    .trim()

  return softenUnsupportedGuarantees(guarded)
}

export function guardStrategyProof<T>(input: T, context: StrategyProofContext = {}): T {
  if (typeof input === 'string') return guardStrategyProofText(input, context) as T
  if (Array.isArray(input)) {
    return input.map(item => guardStrategyProof(item, context)) as T
  }
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      output[key] = guardStrategyProof(value, context)
    }
    return output as T
  }
  return input
}
