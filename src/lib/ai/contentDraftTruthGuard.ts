/**
 * Content draft truth guard
 *
 * Deterministic backstop for draft social posts. Content plans are review-only
 * drafts, so generated copy must not invent proof, guarantees, publishing state,
 * delivery coverage, or paid-performance assumptions.
 */

export interface ContentDraftTruthContext {
  verifiedProof?: string[] | null
}

interface ProofAvailability {
  hasTestimonials: boolean
  hasCustomerStories: boolean
  hasAwards: boolean
  hasCaseStudies: boolean
  hasReviews: boolean
}

function verifiedProofText(context: ContentDraftTruthContext): string {
  return Array.isArray(context.verifiedProof)
    ? context.verifiedProof.filter((item): item is string => typeof item === 'string').join(' \n ')
    : ''
}

function getProofAvailability(context: ContentDraftTruthContext): ProofAvailability {
  const proof = verifiedProofText(context)
  return {
    hasTestimonials: /\b(testimonial|satisfied customer|client quote|customer quote)\b/i.test(proof),
    hasCustomerStories: /\b(customer story|customer stories)\b/i.test(proof),
    hasAwards: /\b(award|certified|certification|accredited|badge)\b/i.test(proof),
    hasCaseStudies: /\b(case study|case studies|case-study)\b/i.test(proof),
    hasReviews: /\b(review|rating|rated|stars?)\b/i.test(proof),
  }
}

function guardProofClaims(text: string, context: ContentDraftTruthContext): string {
  const proof = getProofAvailability(context)
  let guarded = text

  if (!proof.hasTestimonials) {
    guarded = guarded
      .replace(/\bCustomer Testimonials\b/gi, 'Proof to collect')
      .replace(/\bHear from our satisfied customers\b/gi, 'Ask customers for feedback')
      .replace(/\bHear from satisfied customers\b/gi, 'Ask customers for feedback')
      .replace(/\bcustomer testimonial video\b/gi, 'customer feedback request video')
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

  return guarded
}

function softenAbsoluteClaims(text: string): string {
  return text
    .replace(/\bSupport more reliable team planning has access to great coffee\b/gi, 'Help teams plan better office coffee routines')
    .replace(/المشروب المثالي كل مرة/g, 'قهوة أكثر اتساقًا مع إرشادات أوضح')
    .replace(/القهوة المثالية كل مرة/g, 'قهوة أكثر اتساقًا مع إرشادات أوضح')
    .replace(/قهوة مثالية كل مرة/g, 'قهوة أكثر اتساقًا مع إرشادات أوضح')
    .replace(/أفضل قهوة كل يوم/g, 'روتين قهوة أفضل وأكثر وضوحًا')
    .replace(/المكتب مليان قهوة دائمًا/g, 'تخطيط أفضل لمخزون القهوة')
    .replace(/دائمًا متوفر/g, 'تخطيط أفضل لمخزون القهوة')
    .replace(/لا ينفد/g, 'يساعد على تقليل نفاد القهوة')
    .replace(/\bensuring every coffee break is a moment of luxury\b/gi, 'helping make coffee breaks feel more considered and enjoyable')
    .replace(/\bensuring every\b[^.?!]*/gi, 'helping make each moment more considered')
    .replace(/\bensure every\b[^.?!]*/gi, 'help make each moment more consistent')
    .replace(/\bEnsure your office is always stocked with premium coffee\b/gi, 'Help keep your office better stocked with planning support')
    .replace(/\bEnsure your office is always stocked\b/gi, 'Help keep your office better stocked with planning support')
    .replace(/\bEnsure your office has the best coffee every day\b/gi, 'Help your office plan a better coffee routine')
    .replace(/\bEnsure your team always\b[^.?!]*/gi, 'Help teams plan better office coffee routines')
    .replace(/\bEnsure\b/gi, 'Help')
    .replace(/\bperfect brew every time\b/gi, 'a more consistent brew with clearer guidance')
    .replace(/\bperfect coffee every time\b/gi, 'a more consistent coffee routine with clearer guidance')
    .replace(/\bbest coffee every day\b/gi, 'better coffee routines more consistently')
    .replace(/\balways stocked\b/gi, 'better stocked with planning support')
    .replace(/\bnever run out\b/gi, 'plan stock more reliably')
    .replace(/\bguaranteed freshness\b/gi, 'freshness standards to verify')
    .replace(/\bimmediate results\b/gi, 'early signals to review')
}

function guardDeliveryClaims(text: string): string {
  return text
    .replace(/توصيل مضمون/g, 'التوصيل حسب المناطق المتاحة')
    .replace(/توصيل سريع/g, 'توقيت التوصيل يعتمد على الموقع')
    .replace(/توصيل لباب البيت/g, 'التوصيل حسب المناطق المتاحة')
    .replace(/توصيل في اليوم التالي/g, 'التوصيل في اليوم التالي حيثما توفر')
    .replace(/\bquick delivery guaranteed\b/gi, 'delivery timing depends on supported zones')
    .replace(/\bfast delivery guaranteed\b/gi, 'delivery timing depends on supported zones')
    .replace(/\bdelivery guaranteed\b/gi, 'delivery where available')
    .replace(/\bguaranteed delivery\b/gi, 'delivery where available')
    .replace(/\bdelivered to your doorstep\b/gi, 'delivery where available')
    .replace(/\bfast delivery\b/gi, 'delivery timing depends on location')
    .replace(/\bquick delivery\b/gi, 'delivery timing depends on location')
    .replace(/\bnext-day delivery\b/gi, 'next-day delivery where available')
    .replace(/\bdelivered in 48 hours\b/gi, 'delivery timing depends on location')
}

function guardCoffeeComplianceClaims(text: string): string {
  return text
    .replace(/طاقة مضمونة/g, 'تجربة قهوة أكثر انتظامًا')
    .replace(/نتائج فورية/g, 'دعم روتين عمل أفضل للمراجعة')
    .replace(/إنتاجية مضمونة/g, 'دعم روتين عمل أفضل للمراجعة')
    .replace(/\bguaranteed energy\b/gi, 'support for a more enjoyable coffee routine')
    .replace(/\bproductivity guaranteed\b/gi, 'productivity support to review')
    .replace(/\bboost productivity guaranteed\b/gi, 'support productive routines')
    .replace(/\b(?:cure|treat|prevent)s?\s+[^.?!]*/gi, 'support general coffee enjoyment')
}

function guardPaidAndStatusClaims(text: string): string {
  return text
    .replace(/\bcampaign active\b/gi, 'campaign draft ready for review')
    .replace(/\bthe campaign is active\b/gi, 'the campaign is in review')
    .replace(/\bactive stage\b/gi, 'planning/review stage')
    .replace(/\bAutopilot active\b/gi, 'Autopilot not active')
    .replace(/\bCampaign active\b/gi, 'Campaign draft ready for review')
    .replace(/\bScheduled Queue\b/gi, 'Planned content queue')
    .replace(/\b(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+(?:ad\s+)?budget\b/gi, 'paid budget needs confirmation')
    .replace(/\b(?:ad\s+budget|paid\s+budget|budget)\s+is\s+available\b/gi, 'paid budget needs user confirmation')
    .replace(/\ballocate\s+(?:\$|USD\s*)[\d,]+(?:\s*USD)?\b/gi, 'confirm paid budget before allocation')
    .replace(/\bROAS\b/gi, 'paid performance metric to define')
    .replace(/\bCAC\b/gi, 'paid performance metric to define')
    .replace(/\bpaid campaign running\b/gi, 'paid campaign planning only')
    .replace(/\blaunch ads\b/gi, 'plan ads for later review')
    .replace(/\ballocate spend\b/gi, 'confirm paid budget before allocation')
}

export function guardContentDraftText(
  text: unknown,
  context: ContentDraftTruthContext = {},
): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''

  return guardPaidAndStatusClaims(
    guardCoffeeComplianceClaims(
      guardDeliveryClaims(
        softenAbsoluteClaims(
          guardProofClaims(text, context),
        ),
      ),
    ),
  )
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function guardContentDraftTruth<T>(
  input: T,
  context: ContentDraftTruthContext = {},
): T {
  return guardContentDraftValue(input, context) as T
}

function guardContentDraftValue(input: unknown, context: ContentDraftTruthContext): unknown {
  if (typeof input === 'string') return guardContentDraftText(input, context)
  if (Array.isArray(input)) return input.map(item => guardContentDraftValue(item, context))
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      output[key] = guardContentDraftValue(value, context)
    }
    return output
  }
  return input
}

export function buildContentDraftTruthPolicyPrompt(): string {
  return [
    'CONTENT DRAFT TRUTH POLICY (strict):',
    '- Generated posts are draft content for review only. Nothing is approved, scheduled, published, or active.',
    '- Do not claim perfect results, guaranteed outcomes, always-stocked offices, immediate results, or guaranteed delivery.',
    '- Use delivery language only with bounds such as "where available", "in supported zones", or "timing depends on location".',
    '- Do not invent testimonials, customer stories, reviews, awards, case studies, guarantees, or performance proof.',
    '- If proof is missing, ask for feedback, collect proof, or mention proof gaps as future work.',
    '- Do not invent ad spend, ROAS, CAC, paid launch, or budget allocation assumptions.',
  ].join('\n')
}
