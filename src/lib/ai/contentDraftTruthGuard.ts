/**
 * Content draft truth guard
 *
 * Deterministic backstop for draft social posts. Content plans are review-only
 * drafts, so generated copy must not invent proof, guarantees, publishing state,
 * delivery coverage, or paid-performance assumptions.
 */

export interface ContentDraftTruthContext {
  verifiedProof?: string[] | null
  hasConversionDestination?: boolean
  brandFacts?: unknown[] | null
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
    .replace(
      /\b(?:help(?:s|ed|ing)?\s+(?:you|teams?)\s+)?sav(?:e|es|ed|ing)\s+(?:you\s+)?time\b/gi,
      'help organize routine work more clearly',
    )
    .replace(/الحل الأمثل لتنظيم المواعيد/g, 'خيار عملي لتنظيم المواعيد')
    .replace(/الحل الأمثل لإدارة العيادات/g, 'خيار عملي لإدارة العيادات')
    .replace(/الحل الأمثل/g, 'خيار عملي')
    .replace(/إليك الحل/g, 'إليك خيارًا عمليًا')
    .replace(/لم يكن أبداً بهذه السهولة/g, 'يمكن تنظيمه بخطوات أوضح')
    .replace(/لم يكن أبدًا بهذه السهولة/g, 'يمكن تنظيمه بخطوات أوضح')
    .replace(/بشكل يضمن/g, 'بطريقة تساعد على')
    .replace(/يمكنك ضمان مواعيد منظمة ومرضى راضين/g, 'يمكنك تنظيم المواعيد ومراجعة تجربة المرضى الإدارية بوضوح')
    .replace(/ضمان مواعيد منظمة ومرضى راضين/g, 'تنظيم المواعيد ومراجعة تجربة المرضى الإدارية بوضوح')
    .replace(/مرضى راضين/g, 'تجربة إدارية أوضح للمرضى')
    .replace(/(?:^|[\s،.])يضمن\s+(?:كفاءة|فعالية|تحسين|نتائج|تجربة|رعاية)/g, match =>
      match.replace(/يضمن/, 'يساعد على تنظيم'),
    )
    .replace(/مفتاح النجاح/g, 'جزء من تنظيم العمل')
    .replace(/تحقيق النجاح يبدأ بتحسين العمليات/g, 'تحسين العمليات يبدأ بمراجعة خطوات العمل اليومية')
    .replace(/تحقيق النجاح/g, 'متابعة مؤشرات العمل')
    .replace(/يغير منظورك لإدارة العيادات/g, 'يساعدك على مراجعة طريقة إدارة العيادة')
    .replace(/يغير منظورك/g, 'يساعدك على مراجعة طريقة العمل')
    .replace(/حلول ذكية لإدارة العيادات/g, 'أدوات عملية لإدارة العيادات')
    .replace(/الحلول الذكية/g, 'الأدوات العملية')
    .replace(/حلول ذكية/g, 'أدوات عملية')
    .replace(/حلول بسيطة لتنظيم العمل اليومي/g, 'خطوات عملية لتنظيم العمل اليومي')
    .replace(/(?:دمج|جمع)\s+جميع\s+العمليات\s+في\s+(?:منصة|مساحة)\s+واحدة/g, 'جمع العمليات الأساسية في مساحة عمل واحدة')
    .replace(/قل وداعًا للمهام اليدوية مع الأتمتة/g, 'راجع المهام اليدوية التي يمكن تنظيمها')
    .replace(/تقليل العمل اليدوي/g, 'مراجعة المهام اليدوية المتكررة')
    .replace(/أتمتة التذكيرات والمتابعات الخاصة بك/g, 'تنظيم التذكيرات والمتابعات')
    .replace(/كيف يمكننا تبسيط عملك/g, 'كيف ننظّم سير العمل الحالي')
    .replace(/#أتمتة_العيادات/g, '#تنظيم_العيادات')
    .replace(/#كفاءة_العمل/g, '#سير_العمل')
    .replace(/#كفاءة(?=\s|$)/g, '#تنظيم_العمل')
    .replace(/إدارة عيادتك بشكل أكثر احترافية/g, 'إدارة عيادتك بخطوات أكثر تنظيمًا')
    .replace(/بشكل أكثر احترافية/g, 'بخطوات أكثر تنظيمًا')
    .replace(/توفير رعاية صحية متميزة/g, 'تنظيم تجربة إدارية أوضح حول مواعيد المرضى')
    .replace(/رعاية صحية متميزة/g, 'تجربة إدارية أوضح للعيادة')
    .replace(/تحسين تجربتك مع المرضى/g, 'تنظيم متابعة المرضى إداريًا')
    .replace(/تحسين متابعة المرضى/g, 'تنظيم متابعة المرضى إداريًا')
    .replace(/تحسين تجربة مرضاك/g, 'تنظيم تجربة المرضى الإدارية')
    .replace(/تحسين تجربة المرضى/g, 'تنظيم تجربة المرضى الإدارية')
    .replace(/تحسين رضا المرضى/g, 'تنظيم تجربة المرضى الإدارية')
    .replace(/رضا المرضى/g, 'وضوح تجربة المرضى الإدارية')
    .replace(/رضا المريض/g, 'وضوح تجربة المريض الإدارية')
    .replace(/تجربة مرضاك/g, 'تجربة المرضى الإدارية')
    .replace(/تجربة مرضى متميزة/g, 'تجربة إدارية أكثر وضوحًا للمرضى')
    .replace(/تجربة متميزة للمرضى/g, 'تجربة إدارية أكثر وضوحًا للمرضى')
    .replace(/#رعاية_المرضى/g, '#متابعة_المرضى')
    .replace(/كفاءة وفعالية أكبر/g, 'وضوحًا أكبر في العمل اليومي')
    .replace(/(?:تحسين|تعزيز|رفع)\s+كفاءة\s+العمليات\s+اليومية/g, 'زيادة وضوح سير العمل اليومية')
    .replace(/تعزيز كفاءة العيادات/g, 'تنظيم عمل العيادات بوضوح')
    .replace(/تعزيز كفاءة العيادة/g, 'تنظيم عمل العيادة بوضوح')
    .replace(/تعزيز كفاءة/g, 'زيادة وضوح سير العمل')
    .replace(/تحسين كفاءة العيادات/g, 'تنظيم عمل العيادات بوضوح')
    .replace(/تحسين كفاءة العيادة/g, 'تنظيم عمل العيادة بوضوح')
    .replace(/عزز\s+كفاءة\s+عيادتك/g, 'نظّم سير عمل عيادتك بوضوح أكبر')
    .replace(/نزيد\s+كفاءة\s+عمليات\s+العيادة/g, 'ننظّم عمليات العيادة بوضوح أكبر')
    .replace(/(?:تحسين|تعزيز|رفع)\s+كفاءة\s+عمليات\s+العيادة/g, 'تنظيم عمليات العيادة بوضوح أكبر')
    .replace(/(?:تحسين|تعزيز|رفع)\s+كفاءة(?:\s+(?:العيادات|العيادة|العمليات(?:\s+اليومية)?|الفريق))?/g, 'زيادة وضوح سير العمل')
    .replace(/تحسين الكفاءة/g, 'زيادة وضوح سير العمل')
    .replace(/تحسين الكفاءة التشغيلية/g, 'زيادة وضوح سير العمل التشغيلي')
    .replace(/الكفاءة التشغيلية/g, 'وضوح سير العمل التشغيلي')
    .replace(/تحسين عملك الطبي/g, 'تنظيم العمل الإداري للعيادة')
    .replace(/تحسين خدماتك/g, 'مراجعة خطوات الخدمة الإدارية')
    .replace(/تحسين الخدمة/g, 'مراجعة الخدمة الإدارية')
    .replace(/توفير الوقت/g, 'تنظيم الوقت الإداري')
    .replace(/توفير للوقت/g, 'تنظيم الوقت الإداري')
    .replace(/هما في متناول يديك/g, 'يمكن مراجعتها خطوة بخطوة')
    .replace(/حقق نتائج أفضل اليوم/g, 'راجع نتائج العمل لاحقًا')
    .replace(/نتائج أفضل/g, 'نتائج عمل قابلة للمراجعة')
    .replace(/لكفاءة أكبر/g, 'لوضوح أكبر في سير العمل')
    .replace(/كفاءة أكبر/g, 'وضوح أكبر في سير العمل')
    .replace(/تجربة أكثر تنظيماً وكفاءة/g, 'تجربة إدارية أكثر تنظيمًا ووضوحًا')
    .replace(/تجربة أكثر تنظيمًا وكفاءة/g, 'تجربة إدارية أكثر تنظيمًا ووضوحًا')
    .replace(/تواصل فعال وسهل/g, 'تواصل إداري أوضح')
    .replace(/تواصل فعال/g, 'تواصل إداري واضح')
    .replace(/فعال وسهل/g, 'واضح ومنظم')
    .replace(/#تواصل_فعال/g, '#تواصل_إداري')
    .replace(/#فعالية/g, '#تنظيم_العمل')
    .replace(/تحقيق التوازن في عيادتك/g, 'مراجعة توزيع المهام داخل العيادة')
    .replace(/الحلول العملية لتحقيق التوازن في عيادتك/g, 'أدوات عملية لمراجعة توزيع المهام داخل العيادة')
    .replace(/تعزز الكفاءة/g, 'توضح سير العمل')
    .replace(/يعزز\s+(?:#?\w+\s+)?تنظيم عملك الطبي/g, 'يساعد على توضيح العمل الإداري للعيادة')
    .replace(/يعزز\s+(?:#?\w+\s+)?وضوح العمليات في العيادات/g, 'يساعد على عرض العمليات اليومية في العيادات بوضوح')
    .replace(/يعزز\s+(?:#?\w+\s+)?وضوح العمليات/g, 'يساعد على عرض العمليات بوضوح')
    .replace(/يعزز\s+(?:#?\w+\s+)?تنظيم/g, 'يساعد على تنظيم')
    .replace(/يعزز\s+(?:#?\w+\s+)?/g, 'يساعد على ')
    .replace(/زيادة الكفاءة/g, 'زيادة وضوح سير العمل')
    .replace(/يزيد من الكفاءة/g, 'يزيد من وضوح سير العمل')
    .replace(/وزيادة الكفاءة/g, 'وزيادة وضوح سير العمل')
    .replace(/بكفاءة ووضوح/g, 'بوضوح وتنظيم')
    .replace(/بكفاءة/g, 'بوضوح')
    .replace(/بفعالية/g, 'بشكل قابل للمراجعة')
    .replace(/أكثر وضوحاً وفعالية/g, 'أكثر وضوحًا وقابلية للمراجعة')
    .replace(/أكثر وضوحًا وفعالية/g, 'أكثر وضوحًا وقابلية للمراجعة')
    .replace(/أداة حيوية لتحسين إدارة العيادات/g, 'أداة عملية لمراجعة إدارة العيادات')
    .replace(/أداة حيوية/g, 'أداة عملية')
    .replace(/الأداة المناسبة لرفع وضوح العمليات اليومية/g, 'أداة عملية لمراجعة وضوح العمليات اليومية')
    .replace(/لرفع وضوح العمليات اليومية/g, 'لمراجعة وضوح العمليات اليومية')
    .replace(/رحلة التحول الرقمي/g, 'مراجعة خطوات العمل الرقمية')
    .replace(/التحول الرقمي/g, 'تنظيم العمل الرقمي')
    .replace(/الابتكارات التي نقدمها/g, 'الميزات العملية التي نقدمها')
    .replace(/يدعم\s+(?:#?\w+\s+)*(?:AI\s+)?نمو عيادتك العضوي/g, 'يدعم مراجعة خطوات العمل داخل العيادة')
    .replace(/نمو عيادتك العضوي/g, 'مراجعة خطوات العمل داخل العيادة')
    .replace(/النمو العضوي لعيادتك/g, 'مراجعة خطوات العمل داخل العيادة')
    .replace(/استمتع بإدارة أكثر سهولة/g, 'راجع طريقة إدارة المواعيد بوضوح أكبر')
    .replace(/إبدأ اليوم/g, 'ابدأ بالمراجعة')
    .replace(/زيادة كفاءة فريقك/g, 'مساعدة فريقك على متابعة المهام بوضوح')
    .replace(/زيادة كفاءة الفريق/g, 'مساعدة الفريق على متابعة المهام بوضوح')
    .replace(/تزيد كفاءة الفريق/g, 'تساعد الفريق على متابعة المهام بوضوح')
    .replace(/كفاءة أكبر للفريق/g, 'وضوح أكبر في مهام الفريق')
    .replace(/زيادة\s+كفاءة(?:\s+(?:العيادات|العيادة|العمليات|الفريق))?/g, 'زيادة وضوح سير العمل')
    .replace(/زيادة وضوح سير العمل\s+عمليات\s+العيادة/g, 'تنظيم عمليات العيادة بوضوح أكبر')
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
    .replace(/\bOperate seamlessly in both English and Arabic with\b/g, 'Use English and Arabic workflows in')
    .replace(/\bOvercome language barriers and\b/g, 'Review the bilingual workflow and')
    .replace(/\bBreak language barriers with our bilingual platform\b/gi, 'Review your English and Arabic workflows with the bilingual platform')
    .replace(/\bAutomate your clinic(?:'|’)s reminders and follow-ups\b/gi, 'Organize your clinic\'s reminders and follow-ups')
    .replace(/\benhance your clinic(?:'|’)s operations\b/gi, 'review your clinic\'s current operations')
    .replace(/\bEnhance communication and streamline operations\b/g, 'Support bilingual communication and review the current workflow')
    .replace(/\benhance communication and streamline operations\b/g, 'support bilingual communication and review the current workflow')
    .replace(/\bBook a demo to experience the transformation\b/gi, 'Book a demo to review the workflow')
    .replace(/\bexperience the transformation\b/gi, 'review the workflow in a demo')
    .replace(/\bReview the bilingual workflow and review\b/g, 'Review how the bilingual workflow supports')
    .replace(/^review your clinic operations\b/i, 'Review your clinic operations')
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
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])نضمن\s+لك(?![\p{L}\p{M}])/giu, 'نسعى إلى تقديم')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])أضمن\s+لك(?![\p{L}\p{M}])/giu, 'أهدف إلى دعم')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])تضمن\s+لك(?![\p{L}\p{M}])/giu, 'تساعد على')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])يضمن\s+لك(?![\p{L}\p{M}])/giu, 'يساعد على')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])نضمن(?![\p{L}\p{M}])/giu, 'نسعى إلى دعم')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])أضمن(?![\p{L}\p{M}])/giu, 'أهدف إلى دعم')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])تضمن(?![\p{L}\p{M}])/giu, 'تدعم')
    .replace(/(?<!لا\s)(?<!لن\s)(?<!غير\s)(?<!بدون\s)(?<![\p{L}\p{M}])يضمن(?![\p{L}\p{M}])/giu, 'يدعم')
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
    .replace(/\bdelivered (?:right )?to your door\b/gi, 'available through delivery where supported')
    .replace(/\bdelivered (?:right )?to your home\b/gi, 'available through delivery where supported')
    .replace(/\bdelivery to your doorstep\b/gi, 'delivery where available')
    .replace(/\bto your doorstep\b/gi, 'where available')
    .replace(/\bdoorstep delivery\b/gi, 'supported-zone delivery')
    .replace(/\buniversal delivery\b/gi, 'delivery in supported zones')
    .replace(/\bfast delivery\b/gi, 'delivery timing depends on location')
    .replace(/\bquick delivery\b/gi, 'delivery timing depends on location')
    .replace(/\bnext-day delivery\b/gi, 'next-day delivery where available')
    .replace(/\bdelivered in 48 hours\b/gi, 'delivery timing depends on location')
}

function guardDraftCopyQuality(text: string): string {
  return text
    // Observed production failure: generic model filler combined unsupported
    // freshness/expertise claims with malformed grammar. These rewrites keep the
    // draft useful without manufacturing proof or a destination that does not exist.
    .replace(
      /\bMaster the art of brewing at home with our expert tips!\s*Whether you're a novice or a seasoned coffee enthusiast, our brewing tutorials will elevate your coffee game\.\s*Watch our brewing tips and transform your home coffee experience\./gi,
      'Refine your home-brewing routine one variable at a time. Record the grind size, dose, water, and brew time, then change one variable on the next cup. Save this checklist for your next brew.',
    )
    .replace(
      /\bOur weekly roasting process helps that every cup is as fresh as it gets\.?/gi,
      'Review the roast date and available weekly roasting details before choosing your next bag.',
    )
    .replace(
      /\bSay goodbye to stale beans and hello to a vibrant coffee experience with ([^.?!]+)[.!]?/gi,
      "If stale beans are a concern, review the available roasting and product details from $1.",
    )
    .replace(/\bDiscover the secret to freshly roasted coffee in ([^.?!]+)[.!]?/gi, 'Review the available roasting details for this coffee subscription in $1.')
    .replace(/\bNo more time wasted on sourcing quality coffee\.?/gi, 'Compare the available coffee and delivery options.')
    .replace(/\bSee how easy it is to subscribe and have your coffee needs taken care of\.?/gi, 'Review the subscription terms and delivery zones before choosing a plan.')
    .replace(/\bhelps that\b/gi, 'helps make')
    .replace(/\bas fresh as it gets\b/gi, 'more consistent')
    .replace(/\bour expert tips\b/gi, 'these practical tips')
    .replace(/\bexpert tips\b/gi, 'practical tips')
    .replace(/\bwill elevate your coffee game\b/gi, 'can help you refine your brewing routine')
    .replace(/\btransform your home coffee experience\b/gi, 'review your home-brewing routine')
    .replace(/\belevate your\b/gi, 'refine your')
    .replace(/\btransform your\b/gi, 'review your')
    .replace(/\btaste the difference\b/gi, 'review the product details')
    .replace(/\bvibrant coffee experience\b/gi, 'more consistent coffee routine')
    .replace(/\bquality coffee\b/gi, 'coffee options')
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

function guardSaasActivationClaims(text: string, context: ContentDraftTruthContext): string {
  let guarded = text
    .replace(/ابدأ باستخدام النظام في دقائق معدودة[!！.]?/g, 'ابدأ بخطوات إعداد بسيطة وواضحة.')
    .replace(/لن تحتاج لوقت طويل لإعداد الأنظمة الجديدة\.?/g, 'يمكنك مراجعة خطوات الإعداد دون تعقيد تقني.')
    .replace(/لن تواجه صعوبة التعامل مع الأنظمة غير العربية بعد الآن\.?/g, 'يمكن أن تساعد الواجهة العربية على تقليل احتكاك العمل مع الأنظمة غير العربية.')
    .replace(/إعداد سريع وفعال/g, 'إعداد سريع ومنظم')
    .replace(/نظام\s+([^.!؟]+)\s+يقدم لك خيار عملي/g, 'نظام $1 يقدم مسارًا عمليًا')
    .replace(/تابع عملاءك بسهولة وبدون تعقيد تقني/g, 'نظّم متابعة عملائك بخطوات واضحة ودون تعقيد تقني')
    .replace(/إدارة المبيعات أصبحت أسهل وأسرع/g, 'يمكن تنظيم متابعة المبيعات بخطوات أوضح')
    .replace(/(?:تعرّف|تعرف) على كيفية تحسين مبيعاتك الآن[!！.]?/g, 'تعرّف على طريقة تنظيم متابعة المبيعات.')
    .replace(/واجهة عربية مصممة خصيصًا لك/g, 'واجهة عربية تدعم سير عمل واضحًا')
    .replace(/يظهر على الشاشة واجهة[^،.]+/g, 'مع شاشة محايدة غير مقروءة دون واجهة منتج مخترعة')
    .replace(/ساعة جدارية تشير إلى وقت قصير/g, 'عناصر مكتبية محايدة دون إيحاء بزمن إعداد محدد')
    .replace(/setup in (?:just )?(?:a few )?minutes[.!]?/gi, 'a clear, reviewable setup flow.')
    .replace(/you(?:'|’)ll be (?:up and running|ready) in minutes[.!]?/gi, 'you can review the setup steps before activation.')

  if (!context.hasConversionDestination) {
    guarded = guarded
      .replace(/(?:جرّب|جرب)\s+(?:النظام|المنصة|الخدمة)(?:\s+الآن|\s+اليوم)?[!！.]?/g, 'تعرّف على طريقة عمل الحل.')
      .replace(/سجّل\s+الآن[!！.]?/g, 'راجع التفاصيل المتاحة.')
      .replace(/سجل\s+الآن[!！.]?/g, 'راجع التفاصيل المتاحة.')
      .replace(/اطلب\s+(?:عرضًا|عرضاً|عرضا)\s+(?:توضيحيًا|توضيحياً|توضيحيا)(?:\s+الآن)?[!！.]?/g, 'راجع ما تحتاجه قبل تحديد خطوة التواصل.')
      .replace(/ابدأ\s+(?:الآن|اليوم)[!！.]?/g, 'راجع الخطوة التالية.')
      .replace(/\bTry\s+(?:the\s+)?(?:system|platform|service)(?:\s+now|\s+today)?[.!]?/gi, 'Learn how the solution works.')
      .replace(/\bSign\s+up\s+now[.!]?/gi, 'Review the available details.')
      .replace(/\bRequest\s+(?:a\s+)?demo(?:\s+now)?[.!]?/gi, 'Review what you need before choosing a contact step.')
      .replace(/\bStart\s+(?:now|today)[.!]?/gi, 'Review the next step.')
  }

  return guarded
}

function brandFactCorpus(context: ContentDraftTruthContext): string {
  const flatten = (value: unknown): string[] => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(flatten)
    return []
  }
  return [
    ...flatten(context.brandFacts),
    ...flatten(context.verifiedProof),
  ].join(' ').toLocaleLowerCase()
}

function replaceMatchingSentences(text: string, pattern: RegExp, fallback: string): string {
  let inserted = false
  return text
    .split(/(?<=[.!؟])/u)
    .map((sentence) => {
      pattern.lastIndex = 0
      if (!pattern.test(sentence)) return sentence
      if (inserted) return ''
      inserted = true
      return ` ${fallback}`
    })
    .filter(Boolean)
    .join('')
}

/**
 * Feature and outcome claims are a separate risk from testimonials or numeric
 * performance promises. A model can invent integrations, support availability,
 * savings, productivity, or scale without using any word caught by the generic
 * claim detector. Only keep those claims when Brand Brain explicitly contains
 * the corresponding fact; otherwise replace the whole claim sentence with a
 * concrete verification step.
 */
function guardUnverifiedFeatureAndOutcomeClaims(
  text: string,
  context: ContentDraftTruthContext,
): string {
  const facts = brandFactCorpus(context)
  let guarded = text

  // Generic security promises are not proof. Keep them out of draft copy
  // unless the user supplied a concrete security artifact; even then, the
  // save gate still rejects absolute protection promises and requires specific
  // reviewed wording instead.
  const securityProof = verifiedProofText(context)
  if (!/(?:soc\s*2|iso\s*27001|penetration\s+test|security\s+audit|encryption|تدقيق\s+أمني|اختبار\s+اختراق|تشفير)/i.test(securityProof)) {
    const unverifiedSecurityPattern = /(?:protect|secure|safeguard)\s+(?:your|clinic|patient)?\s*data|our\s+security\s+(?:measures|procedures)|secure\s+(?:and\s+)?integrated\s+data|احمِ?\s+بيانات|حماية\s+بيانات|تأمين\s+بيانات|إجراءات\s+الأمان\s+لدينا|إدارة\s+متكاملة\s+وآمنة/i
    const isSecurityStoryboard = /\bScene\s+\d+\s*:/i.test(guarded)
      && /data\s+security|secure(?:ly)?\s+(?:data|managed|transfer)|protected\s+patient|data\s+breach|security\s+measures/i.test(guarded)
    guarded = isSecurityStoryboard
      ? 'Scene 1: A clinic manager lists questions about data access and permissions. Scene 2: Review the currently documented security controls. Scene 3: Show a neutral security-review checklist without certifications or protection claims. Scene 4: Ask the viewer to request the current security documentation before deciding.'
      : replaceMatchingSentences(
          guarded,
          unverifiedSecurityPattern,
          /[\u0600-\u06ff]/u.test(guarded)
            ? 'راجع وثائق الأمان وصلاحيات الوصول قبل اعتماد طريقة التعامل مع بيانات العيادة.'
            : 'Review documented security controls and access permissions before deciding how clinic data should be handled.',
        )
    guarded = guarded
      .replace(/#(?:DataSecurity|SecureData|CyberSecurity)\b/gi, '#SecurityReview')
      .replace(/#أمان_البيانات/g, '#مراجعة_الأمان')
      .replace(/#حماية_البيانات/g, '#مراجعة_الأمان')
      .replace(/#أمان(?=\s|$)/g, '#مراجعة_الأمان')
  }

  if (!/(?:integrat|compatib|تكامل|متكامل|ربط\s+(?:مع|ب))/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:seamless\s+integration|integrat(?:e|es|ed|ion|ions|ing)\s+with|system\s+integration|تكامل\s+سلس|يتكامل\s+مع|ربط\s+سلس)/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'احصر الأدوات الحالية وتحقق من التوافق الموثق قبل اعتماد سير العمل.'
        : 'List the tools in use today and verify documented compatibility before adopting the workflow.',
    )
    guarded = guarded.replace(/#(?:SystemIntegration|BusinessEfficiency|TechSolutions)\b/gi, '#WorkflowReview')
  }

  if (!/(?:customer\s+support|technical\s+support|support\s+hours|دعم\s+(?:فني|عملاء)|ساعات\s+الدعم)/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:instant\s+support|support\s+(?:anytime|at\s+any\s+time|24\s*\/\s*7)|technical\s+support|دعم\s+فوري|الدعم\s+الفني|مساعدتك\s+في\s+أي\s+وقت)/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'راجع قنوات الدعم وساعات الاستجابة الموثقة قبل اختيار النظام.'
        : 'Review the documented support channels and response hours before choosing the system.',
    )
  }

  if (!/(?:cost\s+sav|reduce\s+cost|خفض\s+التكلفة|توفير\s+التكلفة|خفض\s+التكاليف|توفير\s+التكاليف)/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:reduce\s+(?:your\s+)?costs?|save\s+on|business\s+savings|cost\s+efficiency|خفض\s+(?:التكلفة|التكاليف)|وفّر\s+(?:التكلفة|التكاليف)|توفير\s+(?:التكلفة|التكاليف))/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'قارن تكلفة الأدوات الحالية بالنطاق والسعر الموثقين قبل قرار التوحيد.'
        : 'Compare current tool costs with the documented scope and price before deciding whether consolidation fits.',
    )
    guarded = guarded.replace(/#(?:CostEfficiency|BusinessSavings)\b/gi, '#WorkflowReview')
  }

  if (!/(?:productiv|efficien|إنتاجي|كفاءة)/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:productiv(?:e|ity)|efficien(?:t|cy)|business\s+efficiency|ارفع\s+إنتاجيتك|إنتاجيتك|زد\s+من\s+كفاءة|زيادة\s+الكفاءة|تحسين\s+الكفاءة)/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'ارسم خطوات المتابعة الحالية وراجع هل يجعل النظام الموحد انتقال العمل أوضح.'
        : 'Map the current handoffs and review whether the unified workflow makes ownership clearer.',
    )
    guarded = guarded
      .replace(/#(?:Productivity|Efficiency)\b/gi, '#WorkflowReview')
      .replace(/#(?:تحسين_الإنتاجية|رفع_الإنتاجية|كفاءة_العمل)\b/g, '#سير_العمل')
  }

  if (!/(?:business\s+growth|market\s+growth|scal(?:e|ing)|expand|نمو\s+الأعمال|توسع)/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:expand\s+your\s+business|scale\s+your\s+operations?|business\s+growth|market\s+growth|grow\s+your\s+business|وسّع\s+أعمالك|وسع\s+أعمالك|نمّ\s+أعمالك|توسيع\s+الأعمال)/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'راجع حدود سير العمل الحالي ونطاق المنتج الموثق قبل التخطيط للتوسع.'
        : 'Review current workflow limits and the documented product scope before planning expansion.',
    )
    guarded = guarded.replace(/#(?:BusinessGrowth|MarketGrowth|BusinessExpansion)\b/gi, '#WorkflowReview')
  }

  if (!/(?:user\s+experience|customer\s+experience|تجربة\s+(?:المستخدم|العميل))/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:improved|enhanced|better)\s+(?:user|customer)\s+experience|exceed\s+(?:your\s+)?expectations|تجربة\s+مستخدم\s+محسنة|تجربة\s+عميل\s+محسنة|تجاوز\s+توقعاتك/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'راجع تجربة الاستخدام الفعلية وحدد مدى ملاءمتها لاحتياجات فريقك.'
        : 'Review the actual product flow and confirm whether it fits the team\'s needs.',
    )
  }

  if (!/(?:sales\s+result|sales\s+growth|conversion\s+lift|زيادة\s+المبيعات|تحويل\s+.*مبيعات)/.test(facts)) {
    guarded = replaceMatchingSentences(
      guarded,
      /(?:turn\s+leads\s+into\s+sales|enhance\s+(?:your\s+)?sales\s+strategy|increase\s+sales|تحويل\s+العملاء\s+المحتملين\s+إلى\s+مبيعات|تحسين\s+استراتيجية\s+المبيعات)/i,
      /[\u0600-\u06ff]/u.test(guarded)
        ? 'راجع مراحل متابعة العملاء المحتملين قبل قياس أي أثر على المبيعات.'
        : 'Review the documented lead stages and follow-up steps before measuring any sales outcome.',
    )
    guarded = guarded.replace(/#(?:BusinessGrowth|SalesGrowth)\b/gi, '#LeadManagement')
  }

  // A caption must not point to a tutorial or demonstration that is not part of
  // the post or linked through a verified destination.
  guarded = replaceMatchingSentences(
    guarded,
    /(?:watch\s+how\s+you\s+can\s+enhance\s+(?:your\s+)?sales\s+strategy|شاهد\s+كيف\s+يمكنك\s+تحسين\s+استراتيجية\s+المبيعات)/i,
    /[\u0600-\u06ff]/u.test(guarded)
      ? 'راجع خطوات سير العمل الموثقة قبل اختيار الإجراء التالي.'
      : 'Review the documented workflow before choosing the next step.',
  )

  return guarded
}

export function guardContentDraftText(
  text: unknown,
  context: ContentDraftTruthContext = {},
): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''

  const guarded = guardSaasActivationClaims(guardPaidAndStatusClaims(
    guardDraftCopyQuality(guardCoffeeComplianceClaims(
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
    )),
  ), context)

  return guardUnverifiedFeatureAndOutcomeClaims(guarded, context)
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
    '- Do not invent setup-time precision such as "in minutes" from a general "fast setup" claim.',
    '- If no verified conversion destination is provided, do not use direct-response CTAs such as try now, sign up, request a demo, WhatsApp, or start now. Use review-safe awareness actions instead.',
    '- Do not turn workflow software into sales-growth promises. Describe organization, follow-up, and clarity rather than improved sales, easier/faster sales, or business growth.',
    '- Image prompts must not invent a product screen, dashboard, setup interface, readable UI, or a clock that implies a specific setup time. Keep device screens neutral, turned away, or unreadable.',
    '- Do not claim perfect, finest, best, premium-every-time, luxury-every-time, guaranteed, ensured, always-stocked, never-run-out, or immediate outcomes unless the user provided exact proof.',
    '- Prefer grounded phrasing such as balanced blend, more consistent brew, carefully selected coffee, quality-focused beans, or a better coffee routine.',
    '- Avoid "Perfect for...", "perfect choice", "perfect fit", and "perfect way to" style fit claims. Use practical, well-suited, helpful, or designed-for language instead.',
    '- Use delivery language only with bounds such as "where available", "in supported zones", or "timing depends on location".',
    '- Avoid unbounded delivery claims such as doorstep delivery, fast delivery, quick delivery, next-day delivery, or guaranteed delivery unless bounded by availability.',
    '- Do not invent testimonials, customer stories, reviews, awards, case studies, guarantees, or performance proof.',
    '- If proof is missing, ask for feedback, collect proof, or mention proof gaps as future work.',
    '- Do not invent ad spend, ROAS, CAC, paid launch, or budget allocation assumptions.',
    '- Do not invent integrations, compatibility, support availability, response times, cost savings, productivity, efficiency, business growth, scale, or improved user experience. Keep each only when Brand Brain explicitly supplies that fact.',
    '- Do not point users to a tutorial, demonstration, or video that is not present in the post or linked through a verified destination.',
    '- For a brand that explicitly sells healthcare or clinic operations software, avoid patient outcome, care-quality, guarantee, or broad transformation claims such as ultimate solution, key to success, game-changer, premium care, excellent healthcare, الحل الأمثل, مفتاح النجاح, يغير منظورك, رعاية صحية متميزة, or تجربة مرضى متميزة unless exact verified proof exists.',
    '- Only use clinic-operations language such as appointment organization, administrative follow-up, team tasks, and reviewable workflows when the brand context explicitly says the product is software, an app, a platform, or a clinic-management system.',
    '- A clinic, dental practice, hospital, doctor, or healthcare provider is not automatically a SaaS product. Never rewrite provider marketing into front-desk, handoff, dashboard, leadership, or internal-workflow content unless the saved brand facts explicitly describe that product.',
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
    '- Do not use generic filler such as "as fresh as it gets", "taste the difference", "elevate your", or "transform your experience". Replace it with a concrete fact, checklist, or bounded next step.',
    '- Also avoid "richer taste", "keep our coffee fresh", "unlock the full potential", "hassle-free", "better cup", and unbounded "delivered straight to your door" wording unless exact evidence and delivery scope exist.',
    '- Do not claim "expert tips" or expert guidance unless Brand Brain contains verified expertise. Use practical guidance instead.',
    '- Educational posts must teach something inside the current post. Do not tell users to watch a tutorial, read a guide, or visit content that is not present in the post or linked through a verified destination.',
    '- Hashtags must be meaningful and correctly formed. A brand hashtag must be the exact brand name with spaces and punctuation removed; never append invented suffixes.',
  ].join('\n')
}
