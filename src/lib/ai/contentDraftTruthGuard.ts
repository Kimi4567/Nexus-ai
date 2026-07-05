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
  hasProductivityProof: boolean
  hasMoraleProof: boolean
  hasFocusProof: boolean
  hasEnergyProof: boolean
  hasTeamPerformanceProof: boolean
  hasBusinessResultProof: boolean
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
    hasProductivityProof: /\b(productivity|productive)\b/i.test(proof) || /الإنتاجية/i.test(proof),
    hasMoraleProof: /\b(morale)\b/i.test(proof) || /المعنويات/i.test(proof),
    hasFocusProof: /\b(focus|focused|concentration)\b/i.test(proof) || /(?:التركيز|تركيز)/i.test(proof),
    hasEnergyProof: /\b(energy|energizing|energized|energise|energize)\b/i.test(proof) || /(?:طاقة|نشاط)/i.test(proof),
    hasTeamPerformanceProof: /\b(team performance|workplace performance|team output|staff performance)\b/i.test(proof) ||
      /(?:أداء الفريق|يحسن الأداء|تحسين الأداء)/i.test(proof),
    hasBusinessResultProof: /\b(business result|business outcome|conversion lift|sales lift|revenue lift|performance proof)\b/i.test(proof) ||
      /(?:نتائج الأعمال|نتائج تجارية|زيادة المبيعات|تحسن المبيعات)/i.test(proof),
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

function guardFitClaims(text: string): string {
  return text
    .replace(/\bperfect for the hustle and bustle of urban life\b/gi, 'A practical option for busy urban routines')
    .replace(/\bperfect for those needing a reliable coffee experience\b/gi, 'A practical option for people looking for a more consistent coffee routine')
    .replace(/\bperfect for\b/gi, 'well-suited for')
    .replace(/\bthe perfect choice for\b/gi, 'a practical choice for')
    .replace(/\bperfect choice for\b/gi, 'practical choice for')
    .replace(/\bthe perfect fit for\b/gi, 'a well-suited option for')
    .replace(/\bperfect fit for\b/gi, 'well-suited for')
    .replace(/\bthe perfect way to\b/gi, 'a practical way to')
    .replace(/\bperfect way to\b/gi, 'practical way to')
    .replace(/\bperfectly suited for\b/gi, 'well-suited for')
    .replace(/\bperfectly roasted\b/gi, 'carefully roasted')
    .replace(/\bperfectly crafted\b/gi, 'carefully crafted')
    .replace(/\bperfectly balanced\b/gi, 'balanced')
    .replace(/مثالية لمن يحتاج قهوة موثوقة/g, 'مناسبة لمن يبحث عن تجربة قهوة أكثر اتساقًا')
    .replace(/الخيار المثالي للمكتب/g, 'خيار عملي للمكتب')
    .replace(/الخيار المثالي ل/g, 'خيار عملي ل')
    .replace(/الخيار المثالي/g, 'خيار عملي')
    .replace(/مثالية لل/g, 'مناسبة لل')
    .replace(/مثالي لل/g, 'مناسب لل')
    .replace(/مثالية ل/g, 'مناسبة ل')
    .replace(/مثالي ل/g, 'مناسب ل')
    .replace(/مثالية لمن/g, 'مناسبة لمن')
    .replace(/مثالي لمن/g, 'مناسب لمن')
    .replace(/مثالية لكل/g, 'مناسبة لكل')
    .replace(/مثالي لكل/g, 'مناسب لكل')
    .replace(/مثالية لـ/g, 'مناسبة لـ')
    .replace(/مثالي لـ/g, 'مناسب لـ')
}

function guardArabicGeneralPerfectionClaims(text: string): string {
  return text
    .replace(/القهوة الصباحية المثالية/g, 'القهوة الصباحية الأكثر اتساقًا')
    .replace(/قهوة صباحية مثالية/g, 'قهوة صباحية أكثر اتساقًا')
    .replace(/القهوة اليومية المثالية/g, 'القهوة اليومية الأكثر اتساقًا')
    .replace(/قهوة يومية مثالية/g, 'قهوة يومية أكثر اتساقًا')
    .replace(/القهوة المنزلية المثالية/g, 'القهوة المنزلية الأكثر اتساقًا')
    .replace(/قهوة منزلية مثالية/g, 'قهوة منزلية أكثر اتساقًا')
    .replace(/القهوة المكتبية المثالية/g, 'القهوة المكتبية الأكثر اتساقًا')
    .replace(/قهوة مكتبية مثالية/g, 'قهوة مكتبية أكثر اتساقًا')
    .replace(/كوب قهوة مثالي/g, 'كوب قهوة متوازن')
    .replace(/فنجان قهوة مثالي/g, 'فنجان قهوة متوازن')
    .replace(/تجربة قهوة مثالية/g, 'تجربة قهوة أكثر اتساقًا')
    .replace(/التجربة المثالية/g, 'تجربة أكثر اتساقًا')
    .replace(/تجربة مثالية/g, 'تجربة أكثر اتساقًا')
    .replace(/القهوة المثالية/g, 'القهوة المتوازنة')
    .replace(/قهوة مثالية/g, 'قهوة متوازنة')
    .replace(/النتائج المثالية/g, 'نتائج أكثر اتساقًا')
    .replace(/نتائج مثالية/g, 'نتائج أكثر اتساقًا')
    .replace(/النتيجة المثالية/g, 'نتيجة أكثر اتساقًا')
    .replace(/نتيجة مثالية/g, 'نتيجة أكثر اتساقًا')
    .replace(/التحضير المثالي/g, 'التحضير العملي')
    .replace(/لتحضير مثالي/g, 'لتحضير عملي')
    .replace(/تحضير مثالي/g, 'تحضير عملي')
    .replace(/خلطة مثالية/g, 'خلطة متوازنة')
    .replace(/النكهة المثالية/g, 'النكهة المتوازنة')
    .replace(/نكهة مثالية/g, 'نكهة متوازنة')
    .replace(/الوصفة المثالية/g, 'الوصفة العملية')
    .replace(/وصفة مثالية/g, 'وصفة عملية')
    .replace(/الكوب المثالي/g, 'الكوب المتوازن')
    .replace(/كوب مثالي/g, 'كوب متوازن')
    .replace(/الفنجان المثالي/g, 'الفنجان المتوازن')
    .replace(/فنجان مثالي/g, 'فنجان متوازن')
}

function guardBroadQualityClaims(text: string): string {
  return text
    .replace(/تجربة قهوة فريدة/g, 'تجربة قهوة أكثر اتساقًا')
    .replace(/تجربة لا تقاوم/g, 'تجربة أكثر اتساقًا')
    .replace(/تجربة فريدة/g, 'تجربة أكثر اتساقًا')
    .replace(/أفضل حبوب القهوة/g, 'حبوب قهوة مختارة بعناية')
    .replace(/أفضل الحبوب/g, 'حبوب مختارة بعناية')
    .replace(/أفضل حبوب/g, 'حبوب مختارة بعناية')
    .replace(/أفضل مذاق/g, 'مذاق متوازن')
    .replace(/أفضل رائحة/g, 'رائحة متوازنة')
    .replace(/أفضل اختيار للقهوة/g, 'اختيار مناسب للقهوة')
    .replace(/أفضل خيار للقهوة/g, 'خيار مناسب للقهوة')
    .replace(/أفضل نكهة/g, 'نكهة متوازنة')
    .replace(/أفضل طعم/g, 'طعم متوازن')
    .replace(/أفضل تجربة/g, 'تجربة أكثر اتساقًا')
    .replace(/أفضل جودة/g, 'جودة مختارة بعناية')
    .replace(/بجودة لا تقاوم/g, 'بجودة مختارة بعناية')
    .replace(/جودة لا تقاوم/g, 'جودة مختارة بعناية')
    .replace(/جودة فريدة/g, 'جودة مختارة بعناية')
    .replace(/نكهة لا تقاوم/g, 'نكهة متوازنة')
    .replace(/طعم لا يقاوم/g, 'طعم متوازن')
    .replace(/نكهة فريدة/g, 'نكهة مميزة ومتوازنة')
    .replace(/لا تقاوم/g, 'مناسبة للمراجعة')
    .replace(/\bpremium coffee experience\b/gi, 'more considered coffee experience')
    .replace(/\bpremium experience\b/gi, 'more considered experience')
    .replace(/\bpremium taste\b/gi, 'balanced taste')
    .replace(/\bpremium flavor\b/gi, 'balanced flavor')
    .replace(/\bpremium quality\b/gi, 'carefully selected quality')
    .replace(/\bbest coffee beans\b/gi, 'carefully selected coffee beans')
    .replace(/\bbest beans\b/gi, 'carefully selected beans')
    .replace(/\bbest coffee experience\b/gi, 'more consistent coffee experience')
    .replace(/\bbest flavor\b/gi, 'balanced flavor')
    .replace(/\bbest taste\b/gi, 'balanced taste')
    .replace(/\birresistible quality\b/gi, 'carefully selected quality')
    .replace(/\birresistible taste\b/gi, 'balanced taste')
    .replace(/\birresistible flavor\b/gi, 'balanced flavor')
    .replace(/\bextraordinary coffee experience\b/gi, 'more consistent coffee experience')
    .replace(/\bunique coffee experience\b/gi, 'more consistent coffee experience')
    .replace(/\bextraordinary experience\b/gi, 'more considered experience')
    .replace(/\bunmatched quality\b/gi, 'carefully selected quality')
    .replace(/\bunmatched flavor\b/gi, 'balanced flavor')
}

function guardOperationalSaasAndHealthcareClaims(text: string): string {
  return text
    .replace(/الحل الأمثل لتنظيم المواعيد/g, 'خيار عملي لتنظيم المواعيد')
    .replace(/الحل الأمثل لإدارة العيادات/g, 'خيار عملي لإدارة العيادات')
    .replace(/الحل الأمثل/g, 'خيار عملي')
    .replace(/بشكل يضمن/g, 'بطريقة تساعد على')
    .replace(/(?:^|[\s،.])يضمن\s+(?:كفاءة|فعالية|تحسين|نتائج|تجربة|رعاية)/g, match =>
      match.replace(/يضمن/, 'يساعد على تنظيم'),
    )
    .replace(/مفتاح النجاح/g, 'جزء من تنظيم العمل')
    .replace(/تحقيق النجاح يبدأ بتحسين العمليات/g, 'تحسين العمليات يبدأ بمراجعة خطوات العمل اليومية')
    .replace(/تحقيق النجاح/g, 'متابعة مؤشرات العمل')
    .replace(/يغير منظورك لإدارة العيادات/g, 'يساعدك على مراجعة طريقة إدارة العيادة')
    .replace(/يغير منظورك/g, 'يساعدك على مراجعة طريقة العمل')
    .replace(/حلول ذكية لإدارة العيادات/g, 'أدوات عملية لإدارة العيادات')
    .replace(/حلول ذكية/g, 'أدوات عملية')
    .replace(/حلول بسيطة لتنظيم العمل اليومي/g, 'خطوات عملية لتنظيم العمل اليومي')
    .replace(/إدارة عيادتك بشكل أكثر احترافية/g, 'إدارة عيادتك بخطوات أكثر تنظيمًا')
    .replace(/بشكل أكثر احترافية/g, 'بخطوات أكثر تنظيمًا')
    .replace(/توفير رعاية صحية متميزة/g, 'تنظيم تجربة إدارية أوضح حول مواعيد المرضى')
    .replace(/رعاية صحية متميزة/g, 'تجربة إدارية أوضح للعيادة')
    .replace(/تحسين تجربتك مع المرضى/g, 'تنظيم متابعة المرضى إداريًا')
    .replace(/تحسين تجربة المرضى/g, 'تنظيم تجربة المرضى الإدارية')
    .replace(/تجربة مرضى متميزة/g, 'تجربة إدارية أكثر وضوحًا للمرضى')
    .replace(/تجربة متميزة للمرضى/g, 'تجربة إدارية أكثر وضوحًا للمرضى')
    .replace(/كفاءة وفعالية أكبر/g, 'وضوحًا أكبر في العمل اليومي')
    .replace(/زيادة كفاءة فريقك/g, 'مساعدة فريقك على متابعة المهام بوضوح')
    .replace(/زيادة كفاءة الفريق/g, 'مساعدة الفريق على متابعة المهام بوضوح')
    .replace(/تزيد كفاءة الفريق/g, 'تساعد الفريق على متابعة المهام بوضوح')
    .replace(/كفاءة أكبر للفريق/g, 'وضوح أكبر في مهام الفريق')
    .replace(/تُحسن من متابعة المرضى/g, 'تساعد على تنظيم متابعة المرضى إداريًا')
    .replace(/تحسن من متابعة المرضى/g, 'تساعد على تنظيم متابعة المرضى إداريًا')
    .replace(/\bthe ultimate solution for appointment management\b/gi, 'a practical option for appointment management')
    .replace(/\bthe ultimate solution\b/gi, 'a practical option')
    .replace(/\bguarantees? greater efficiency and effectiveness\b/gi, 'can support clearer daily workflows')
    .replace(/\bsuccess starts with improving operations\b/gi, 'operations improve when daily workflows are reviewed')
    .replace(/\bkey to success\b/gi, 'part of a clearer operating workflow')
    .replace(/\bgame[-\s]?changer for clinic management\b/gi, 'practical workflow support for clinic management')
    .replace(/\btransform(?:s)? your clinic management\b/gi, 'helps review clinic management workflows')
    .replace(/\bsmart solutions for clinic management\b/gi, 'practical tools for clinic management')
    .replace(/\bmore professional clinic management\b/gi, 'more organized clinic management workflows')
    .replace(/\bimprove patient experience\b/gi, 'organize the administrative patient experience')
    .replace(/\bimproves patient follow[-\s]?up\b/gi, 'helps organize patient follow-up workflows')
    .replace(/\bpremium patient care\b/gi, 'clearer administrative patient workflows')
    .replace(/\bexcellent healthcare\b/gi, 'clearer clinic workflows')
}

function softenAbsoluteClaims(text: string): string {
  return text
    .replace(/\bSupport more reliable team planning has access to great coffee\b/gi, 'Help teams plan better office coffee routines')
    .replace(/أفضل حبوب القهوة/g, 'حبوب قهوة مختارة بعناية')
    .replace(/أفضل قهوة كل يوم/g, 'روتين قهوة أفضل وأكثر وضوحًا')
    .replace(/أفضل قهوة/g, 'قهوة مختارة بعناية')
    .replace(/أجود قهوة/g, 'قهوة مختارة بعناية')
    .replace(/أجود الحبوب/g, 'حبوب قهوة مختارة بعناية')
    .replace(/الخلطة المثالية/g, 'توليفة متوازنة')
    .replace(/التوليفة المثالية/g, 'توليفة متوازنة')
    .replace(/القهوة المثالية كل مرة/g, 'قهوة أكثر اتساقًا مع إرشادات أوضح')
    .replace(/المشروب المثالي كل مرة/g, 'قهوة أكثر اتساقًا مع إرشادات أوضح')
    .replace(/القهوة المثالية/g, 'قهوة أكثر اتساقًا')
    .replace(/المشروب المثالي/g, 'تجربة قهوة أوضح')
    .replace(/قهوة مثالية كل مرة/g, 'قهوة أكثر اتساقًا مع إرشادات أوضح')
    .replace(/المكتب مليان قهوة دائمًا/g, 'تخطيط أفضل لمخزون القهوة')
    .replace(/القهوة متوفرة دائمًا/g, 'تخطيط أفضل لمخزون القهوة')
    .replace(/دائمًا متوفر/g, 'تخطيط أفضل لمخزون القهوة')
    .replace(/متوفر دائمًا/g, 'تخطيط أفضل لمخزون القهوة')
    .replace(/لا ينفد دائمًا/g, 'يساعد على تقليل نفاد القهوة')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)تضمن لك/g, 'تساعد على')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)يضمن لك/g, 'يساعد على')
    .replace(/(?<!لا\s)تضمن\s+(?:نتائج فورية|طاقة مضمونة|إنتاجية مضمونة|توصيل سريع|توصيل مضمون)/g, 'تدعم نتائج قابلة للمراجعة')
    .replace(/(?<!لا\s)يضمن\s+(?:نتائج فورية|طاقة مضمونة|إنتاجية مضمونة|توصيل سريع|توصيل مضمون)/g, 'يدعم نتائج قابلة للمراجعة')
    .replace(/لا ينفد/g, 'يساعد على تقليل نفاد القهوة')
    .replace(/مضمونة كل مرة/g, 'أكثر اتساقًا مع إرشادات أوضح')
    .replace(/مضمون كل مرة/g, 'أكثر اتساقًا مع إرشادات أوضح')
    .replace(/\bensuring every coffee break is a moment of luxury\b/gi, 'helping make coffee breaks feel more considered and enjoyable')
    .replace(/\bensuring every\b[^.?!]*/gi, 'helping make each moment more considered')
    .replace(/\bensure every\b[^.?!]*/gi, 'help make each moment more consistent')
    .replace(/\bdelivery service ensures you plan stock more reliably\b/gi, 'delivery service can support more reliable stock planning where available')
    .replace(/\bdelivery service ensures\b/gi, 'delivery service can support')
    .replace(/\bensures you plan stock more reliably\b/gi, 'can support more reliable stock planning')
    .replace(/\bensures\s+([^.,;!?]+)/gi, 'helps $1')
    .replace(/\bensuring\s+([^.,;!?]+)/gi, 'helping $1')
    .replace(/\bguarantees\s+([^.,;!?]+)/gi, 'supports $1')
    .replace(/\bmakes sure\s+([^.,;!?]+)/gi, 'helps $1')
    .replace(/\balways helps\b/gi, 'can help')
    .replace(/\bEnsure your office is always stocked with premium coffee\b/gi, 'Help keep your office better stocked with planning support')
    .replace(/\bEnsure your office is always stocked\b/gi, 'Help keep your office better stocked with planning support')
    .replace(/\bEnsure your office has the best coffee every day\b/gi, 'Help your office plan a better coffee routine')
    .replace(/\bEnsure your team always\b[^.?!]*/gi, 'Help teams plan better office coffee routines')
    .replace(/\bEnsure\b/gi, 'Help')
    .replace(/\bpremium coffee every time\b/gi, 'quality-focused coffee more consistently')
    .replace(/\bluxury every time\b/gi, 'a more considered experience')
    .replace(/\bperfect brew every time\b/gi, 'a more consistent brew with clearer guidance')
    .replace(/\bperfect brew\b/gi, 'more consistent brew')
    .replace(/\bperfect coffee every time\b/gi, 'a more consistent coffee routine with clearer guidance')
    .replace(/\bperfect coffee\b/gi, 'more consistent coffee')
    .replace(/\bperfect cup\b/gi, 'more consistent cup')
    .replace(/\bperfect blend\b/gi, 'balanced blend')
    .replace(/\bfinest coffee\b/gi, 'carefully selected coffee')
    .replace(/\bfinest beans\b/gi, 'quality-focused beans')
    .replace(/\bbest coffee every day\b/gi, 'better coffee routines more consistently')
    .replace(/\bbest coffee beans\b/gi, 'carefully selected coffee beans')
    .replace(/\bbest coffee experience\b/gi, 'more consistent coffee experience')
    .replace(/\bbest coffee\b/gi, 'better coffee routine')
    .replace(/\bbest beans\b/gi, 'carefully selected beans')
    .replace(/\bbest cup\b/gi, 'more consistent cup')
    .replace(/\balways stocked\b/gi, 'better stocked with planning support')
    .replace(/\bnever run out\b/gi, 'plan stock more reliably')
    .replace(/\bguaranteed freshness\b/gi, 'freshness standards to verify')
    .replace(/\bimmediate results\b/gi, 'early signals to review')
}

function guardOutcomeClaims(text: string, context: ContentDraftTruthContext): string {
  const proof = getProofAvailability(context)
  let guarded = text

  if (!(proof.hasProductivityProof && proof.hasMoraleProof)) {
    guarded = guarded
      .replace(/\bpremium blends can boost productivity and morale\b/gi, 'carefully selected blends can support more enjoyable office coffee breaks')
      .replace(/\bboost productivity and morale\b/gi, 'support a better coffee break routine')
  }

  if (!(proof.hasEnergyProof && proof.hasFocusProof)) {
    guarded = guarded.replace(/\bboost energy and focus\b/gi, 'support a more consistent coffee routine')
  }

  if (!proof.hasProductivityProof) {
    guarded = guarded
      .replace(/\b(?:boost|increase|improve|drive|unlock)\s+productivity\b/gi, 'support a better coffee break routine')
      .replace(/\bproductive team\b/gi, 'team with clearer coffee planning')
      .replace(/\bproductive workplace\b/gi, 'workplace with clearer coffee planning')
      .replace(/زيادة الإنتاجية/g, 'دعم روتين قهوة أوضح')
      .replace(/تحسين الإنتاجية/g, 'دعم روتين قهوة أوضح')
      .replace(/رفع الإنتاجية/g, 'دعم روتين قهوة أوضح')
      .replace(/يعزز الإنتاجية/g, 'يدعم روتين قهوة أوضح')
  }

  if (!proof.hasMoraleProof) {
    guarded = guarded
      .replace(/\b(?:boost|increase|improve)\s+morale\b/gi, 'support more enjoyable coffee breaks')
      .replace(/يعزز المعنويات/g, 'يساعد على تخطيط استراحات القهوة')
      .replace(/رفع المعنويات/g, 'يساعد على تخطيط استراحات القهوة')
      .replace(/يرفع المعنويات/g, 'يساعد على تخطيط استراحات القهوة')
  }

  if (!proof.hasFocusProof) {
    guarded = guarded
      .replace(/\bboost focus\b/gi, 'support a more consistent coffee routine')
      .replace(/\bbetter focus\b/gi, 'a clearer coffee routine')
      .replace(/تركيز أفضل/g, 'روتين قهوة أوضح')
      .replace(/يزيد التركيز/g, 'يدعم روتين قهوة أوضح')
      .replace(/يحسن التركيز/g, 'يدعم روتين قهوة أوضح')
  }

  if (!proof.hasEnergyProof) {
    guarded = guarded
      .replace(/\bboost energy\b/gi, 'support a more consistent coffee routine')
      .replace(/\bguaranteed energy\b/gi, 'support for a more enjoyable coffee routine')
      .replace(/\benergize your team\b/gi, 'support a more consistent coffee routine')
      .replace(/\bkeeps your team energized\b/gi, 'supports everyday coffee routines')
      .replace(/طاقة مضمونة/g, 'يدعم تجربة قهوة أكثر انتظامًا')
      .replace(/نشاط مضمون/g, 'يدعم تجربة قهوة أكثر انتظامًا')
      .replace(/ينشّط الفريق/g, 'يساعد الفريق على تنظيم استراحات القهوة')
  }

  if (!(proof.hasTeamPerformanceProof || proof.hasBusinessResultProof)) {
    guarded = guarded
      .replace(/\bimprove team performance\b/gi, 'support team coffee planning')
      .replace(/\bteam performance\b/gi, 'team coffee planning')
      .replace(/\bincrease team output\b/gi, 'support team coffee planning')
      .replace(/\bimprove workplace performance\b/gi, 'support office coffee planning')
      .replace(/\bworkplace performance\b/gi, 'office coffee planning')
      .replace(/يحسن الأداء/g, 'يساعد على تخطيط استراحات القهوة')
      .replace(/أداء الفريق/g, 'تخطيط استراحات القهوة للفريق')
  }

  return guarded
}

function guardDeliveryClaims(text: string): string {
  return text
    .replace(/توصيل مضمون/g, 'التوصيل حسب المناطق المتاحة')
    .replace(/توصيل سريع/g, 'توقيت التوصيل يعتمد على الموقع')
    .replace(/توصيل لباب البيت/g, 'التوصيل حسب المناطق المتاحة')
    .replace(/لباب البيت/g, 'حسب المناطق المتاحة')
    .replace(/لتصلك إلى باب منزلك/g, 'مع التوصيل حسب المناطق المتاحة')
    .replace(/إلى باب منزلك/g, 'حسب المناطق المتاحة')
    .replace(/توصيل في اليوم التالي/g, 'التوصيل في اليوم التالي حيثما توفر')
    .replace(/\bpromptly delivery where available\b/gi, 'delivery where available')
    .replace(/\bpromptly delivery\b/gi, 'delivery where available')
    .replace(/\bquick delivery guaranteed\b/gi, 'delivery timing depends on supported zones')
    .replace(/\bfast delivery guaranteed\b/gi, 'delivery timing depends on supported zones')
    .replace(/\bdelivery guaranteed\b/gi, 'delivery where available')
    .replace(/\bguaranteed delivery\b/gi, 'delivery where available')
    .replace(/\bdelivered to your doorstep\b/gi, 'delivery where available')
    .replace(/\bdelivery to your doorstep\b/gi, 'delivery where available')
    .replace(/\bto your doorstep\b/gi, 'where available')
    .replace(/\bdoorstep delivery\b/gi, 'supported-zone delivery')
    .replace(/\buniversal delivery\b/gi, 'delivery in supported zones')
    .replace(/\bfast delivery\b/gi, 'delivery timing depends on location')
    .replace(/\bquick delivery\b/gi, 'delivery timing depends on location')
    .replace(/\bnext-day delivery\b/gi, 'next-day delivery where available')
    .replace(/\bdelivered in 48 hours\b/gi, 'delivery timing depends on location')
}

function guardCoffeeComplianceClaims(text: string): string {
  return text
    .replace(/طاقة مضمونة/g, 'يدعم تجربة قهوة أكثر انتظامًا')
    .replace(/نتائج فورية/g, 'دعم روتين عمل أفضل للمراجعة')
    .replace(/إنتاجية مضمونة/g, 'دعم روتين عمل أفضل للمراجعة')
    .replace(/\bguaranteed energy\b/gi, 'support for a more enjoyable coffee routine')
    .replace(/\bproductivity guaranteed\b/gi, 'office coffee planning to review')
    .replace(/\bboost productivity guaranteed\b/gi, 'support a better coffee routine')
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
        guardOutcomeClaims(
          guardFitClaims(
            guardArabicGeneralPerfectionClaims(
              guardBroadQualityClaims(
                guardOperationalSaasAndHealthcareClaims(
                  softenAbsoluteClaims(
                    guardProofClaims(text, context),
                  ),
                ),
              ),
            ),
          ),
          context,
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
    '- Do not claim perfect, finest, best, premium-every-time, luxury-every-time, guaranteed, ensured, always-stocked, never-run-out, or immediate outcomes unless the user provided exact proof.',
    '- Prefer grounded phrasing such as balanced blend, more consistent brew, carefully selected coffee, quality-focused beans, or a better coffee routine.',
    '- Avoid "Perfect for...", "perfect choice", "perfect fit", and "perfect way to" style fit claims. Use practical, well-suited, helpful, or designed-for language instead.',
    '- Use delivery language only with bounds such as "where available", "in supported zones", or "timing depends on location".',
    '- Avoid unbounded delivery claims such as doorstep delivery, fast delivery, quick delivery, next-day delivery, or guaranteed delivery unless bounded by availability.',
    '- Do not invent testimonials, customer stories, reviews, awards, case studies, guarantees, or performance proof.',
    '- If proof is missing, ask for feedback, collect proof, or mention proof gaps as future work.',
    '- Do not invent ad spend, ROAS, CAC, paid launch, or budget allocation assumptions.',
    '- For healthcare, clinic, medical, patient, or appointment-management SaaS content, avoid patient outcome, care-quality, guarantee, or broad transformation claims such as ultimate solution, key to success, game-changer, premium care, excellent healthcare, الحل الأمثل, مفتاح النجاح, يغير منظورك, رعاية صحية متميزة, or تجربة مرضى متميزة unless exact verified proof exists.',
    '- For healthcare/clinic SaaS, use operational language instead: appointment organization, administrative follow-up, clearer team tasks, reviewable workflows, and proof gaps to collect. Do not imply medical results or improved care quality from the software.',
    '- Do not claim coffee improves productivity, morale, focus, energy, team performance, workplace output, or business results unless the user provided verified proof.',
    '- For office coffee content, frame benefits as easier planning, more consistent coffee routines, and more enjoyable breaks, not productivity or performance outcomes.',
    '- Arabic output must avoid إنتاجية, معنويات, طاقة, تركيز, and أداء as performance promises unless user-provided proof exists.',
    '- For Arabic output, avoid أفضل, أجود, مثالي, مضمون, دائمًا, and كل مرة as absolute claims unless directly supported by user-provided proof.',
    '- Arabic output must avoid مثالي/مثالية as broad fit claims unless exact proof exists; prefer مناسب/مناسبة, خيار عملي, or خيار مناسب.',
    '- Arabic output must avoid broad perfection wording such as قهوة مثالية, تجربة مثالية, نتائج مثالية, and تحضير مثالي. Prefer قهوة متوازنة, تجربة أكثر اتساقًا, تحضير عملي, or خطوات عملية.',
    '- Arabic output must avoid contextual coffee perfection phrases such as قهوة صباحية مثالية, القهوة الصباحية المثالية, كوب قهوة مثالي, and فنجان قهوة مثالي unless exact user-provided proof exists. Prefer قهوة صباحية أكثر اتساقًا, كوب قهوة متوازن, or فنجان قهوة متوازن.',
    '- Arabic output must avoid broad quality/superlative wording such as أفضل نكهة, أفضل تجربة, بجودة لا تقاوم, and نكهة فريدة unless exact user-provided proof exists. Prefer نكهة متوازنة, جودة مختارة بعناية, تجربة أكثر اتساقًا, or خطوات عملية.',
    '- Avoid residual broad best/premium quality wording such as أفضل الحبوب, أفضل حبوب القهوة, premium experience, premium quality, best beans, and best flavor unless exact user-provided proof exists. Prefer حبوب مختارة بعناية, مذاق متوازن, more considered experience, carefully selected beans, or balanced flavor.',
    '- Avoid English hype such as irresistible, extraordinary, unmatched, and unique coffee experience unless exact user-provided proof exists.',
  ].join('\n')
}
