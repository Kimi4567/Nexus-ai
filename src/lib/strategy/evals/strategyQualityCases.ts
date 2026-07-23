import type { BusinessBrief } from '@/lib/agents/strategist'
import type { StrategyBrandProfile } from '@/lib/strategy/strategyQualityPipeline'
import { getStrategyBriefReadiness } from '@/lib/strategyBriefReadiness'
import { getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'
import type {
  StrategyLanguage,
  StrategyOrder,
  StrategyType,
} from '@/lib/strategy/strategyOrder'

export interface StrategyQualityEvalCase {
  id: string
  sector: string
  brand: StrategyBrandProfile
  order: StrategyOrder
}

type ProfileOverrides = StrategyBrandProfile & {
  brandName: string
  industry: string
  description: string
  primaryOffer: string
  targetAudience: string
  audiencePainPoints: string[]
  businessGoal: string
  topPlatforms: string[]
}

function organicProfile(language: 'en' | 'ar', overrides: ProfileOverrides): StrategyBrandProfile {
  return {
    audienceLocation: language === 'ar' ? 'دبي والإمارات الشمالية' : 'Dubai and the Northern Emirates',
    audienceDesires: language === 'ar'
      ? ['اختيار أوضح', 'خطوة تالية بسيطة']
      : ['a clearer choice', 'a simple next step'],
    uniqueAdvantages: language === 'ar'
      ? ['شرح واضح لما يشمله العرض', 'تواصل مباشر قبل الالتزام']
      : ['clear explanation of what the offer includes', 'direct contact before commitment'],
    pricePoint: language === 'ar' ? 'السعر يحدد بعد فهم الاحتياج' : 'Price confirmed after understanding the need',
    toneKeywords: language === 'ar' ? ['واضح', 'عملي', 'هادئ'] : ['clear', 'practical', 'calm'],
    writingStyle: language === 'ar' ? 'عربية فصحى بسيطة بجمل قصيرة' : 'Plain English with short, direct sentences',
    avoidKeywords: language === 'ar' ? ['مضمون', 'الأفضل'] : ['guaranteed', 'the best'],
    languagePreference: language,
    verifiedProof: [],
    competitors: [],
    customerObjections: language === 'ar'
      ? ['هل العرض مناسب لاحتياجي؟', 'ما الخطوة التالية؟']
      : ['Is this right for my situation?', 'What happens next?'],
    ...overrides,
  }
}

function paidProfile(language: 'en' | 'ar', overrides: ProfileOverrides): StrategyBrandProfile {
  const base = organicProfile(language, overrides)
  return {
    ...base,
    marketingBudget: language === 'ar' ? 'من 8,000 إلى 12,000 درهم شهرياً' : 'AED 8,000-12,000 per month',
    conversionDestination: 'https://example.com/consultation',
    leadHandling: language === 'ar'
      ? 'يراجع فريق المبيعات النموذج خلال يوم عمل ثم يتواصل لتأكيد الملاءمة'
      : 'Sales reviews the form within one business day and contacts the lead to confirm fit',
    customerObjections: language === 'ar'
      ? ['هل يناسب العرض حالتنا؟', 'ما الذي يشمله السعر؟', 'كم يحتاج التنفيذ من وقت؟']
      : ['Will this fit our situation?', 'What is included in the price?', 'How much implementation time is required?'],
    verifiedProof: language === 'ar'
      ? ['راجع المؤسس وصف الخدمة الحالي وخطوات التسليم بتاريخ 2026-06-30']
      : ['Founder reviewed the current service scope and delivery steps on 2026-06-30'],
  }
}

function order(
  strategyType: StrategyType,
  language: StrategyLanguage,
  goal: string,
  durationPreset: '30' | '90' | '180' = '90',
): StrategyOrder {
  return {
    strategyType,
    durationPreset,
    durationDays: Number(durationPreset),
    contentIntensity: 'light',
    customOrganicPostCount: strategyType === 'paid' ? null : 4,
    goal,
    language,
  }
}

function evalCase(
  id: string,
  sector: string,
  strategyType: StrategyType,
  language: 'en' | 'ar',
  goal: string,
  profile: ProfileOverrides,
): StrategyQualityEvalCase {
  return {
    id,
    sector,
    brand: strategyType === 'organic' ? organicProfile(language, profile) : paidProfile(language, profile),
    order: order(strategyType, language, goal),
  }
}

export const STRATEGY_QUALITY_CASES: StrategyQualityEvalCase[] = [
  evalCase('en-fashion-organic', 'fashion ecommerce', 'organic', 'en', 'qualified product enquiries', {
    brandName: 'Form & Fold', industry: 'Modest fashion ecommerce',
    description: 'An online store selling documented capsule wardrobe pieces for women in the UAE.',
    primaryOffer: 'A reviewed capsule collection available through the online catalog.',
    targetAudience: 'UAE women aged 25-44 comparing versatile modest wardrobe pieces.',
    audiencePainPoints: ['difficulty judging fit online', 'unclear ways to combine pieces'],
    audienceAge: '25-44',
    businessGoal: 'Generate qualified product enquiries before purchase.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
  }),
  evalCase('en-dental-organic', 'dental clinic', 'organic', 'en', 'consultation enquiries', {
    brandName: 'Harbor Dental', industry: 'General dental clinic',
    description: 'A Dubai dental clinic offering consultations and routine dental services listed in its current service catalog.',
    primaryOffer: 'A dental consultation to assess needs and explain available options; no treatment outcome is promised.',
    targetAudience: 'Dubai adults aged 28-54 who have delayed arranging a dental consultation.',
    audiencePainPoints: ['uncertainty about the first appointment', 'concern about unclear treatment steps'],
    businessGoal: 'Generate appropriate consultation enquiries without medical outcome claims.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
    complianceNotes: 'Do not promise clinical outcomes, painless treatment, or suitability before a dentist assessment.',
  }),
  evalCase('en-real-estate-full', 'real estate brokerage', 'full', 'en', 'qualified buyer leads', {
    brandName: 'Northline Property', industry: 'Residential real estate brokerage',
    description: 'A brokerage helping UAE residents compare listed apartments based on budget, location, and move timeline.',
    primaryOffer: 'A buyer requirements call followed by a shortlist from currently available listings.',
    targetAudience: 'UAE residents planning an apartment purchase within six months.',
    audiencePainPoints: ['too many unqualified listings', 'unclear total buying process'],
    businessGoal: 'Generate qualified buyer requirement forms.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
    competitors: ['Betterhomes', 'haus & haus'],
    verifiedProof: ['Brokerage trade license and current listing workflow reviewed by the founder on 2026-06-30'],
  }),
  evalCase('en-clinic-saas-paid', 'clinic operations SaaS', 'paid', 'en', 'demo requests', {
    brandName: 'ClinicRelay', industry: 'SaaS for clinic operations',
    description: 'Software that gives clinic managers one reviewed workspace for appointment follow-up tasks and ownership.',
    primaryOffer: 'A product demonstration of the appointment follow-up workspace.',
    targetAudience: 'Clinic owners and practice managers in the UAE evaluating follow-up workflow software.',
    audiencePainPoints: ['unclear ownership of follow-up tasks', 'manual tracking across separate tools'],
    businessGoal: 'Generate qualified product demo requests.',
    topPlatforms: ['LINKEDIN', 'FACEBOOK'],
    verifiedProof: ['Founder reviewed the live demo workflow and current feature list on 2026-06-30'],
    complianceNotes: 'Do not claim medical, patient outcome, integration, or time-saving results that are not documented.',
  }),
  evalCase('en-coffee-organic', 'specialty coffee', 'organic', 'en', 'store visits', {
    brandName: 'Common Ground Roastery', industry: 'Coffee roastery and cafe',
    description: 'A neighborhood roastery serving the coffee menu currently listed in its Dubai cafe.',
    primaryOffer: 'In-cafe coffee tasting guidance based on the current menu.',
    targetAudience: 'Dubai residents aged 24-45 who want help choosing coffee by taste preference.',
    audiencePainPoints: ['coffee descriptions feel technical', 'uncertainty about which drink to choose'],
    businessGoal: 'Encourage considered cafe visits and menu enquiries.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
  }),
  evalCase('en-accounting-organic', 'accounting services', 'organic', 'en', 'discovery calls', {
    brandName: 'ClearLedger Advisory', industry: 'SME accounting advisory',
    description: 'An accounting firm explaining bookkeeping and monthly reporting scope to UAE small businesses.',
    primaryOffer: 'A discovery call to review the business reporting need and explain the service scope.',
    targetAudience: 'UAE small-business owners who lack a consistent monthly reporting process.',
    audiencePainPoints: ['unclear monthly financial picture', 'difficulty knowing which records are needed'],
    businessGoal: 'Generate suitable discovery-call enquiries.',
    topPlatforms: ['LINKEDIN', 'INSTAGRAM'],
    complianceNotes: 'Do not give tax, audit, or legal conclusions in marketing content.',
  }),
  evalCase('en-logistics-paid', 'B2B logistics', 'paid', 'en', 'quote requests', {
    brandName: 'RouteSpan Logistics', industry: 'B2B regional logistics',
    description: 'A logistics provider that scopes recurring UAE road-freight requirements before issuing a quote.',
    primaryOffer: 'A route and shipment-requirements review followed by a scoped quotation.',
    targetAudience: 'Operations and procurement managers with recurring UAE road-freight requirements.',
    audiencePainPoints: ['quotes omit operational constraints', 'slow qualification of recurring routes'],
    businessGoal: 'Generate qualified quotation requests.',
    topPlatforms: ['LINKEDIN', 'FACEBOOK'],
    verifiedProof: ['Founder reviewed the current route-scoping checklist and quotation process on 2026-06-30'],
  }),
  evalCase('en-restaurant-organic', 'restaurant', 'organic', 'en', 'reservation interest', {
    brandName: 'Juniper Table', industry: 'Neighborhood restaurant',
    description: 'A Dubai restaurant sharing its current menu, atmosphere, and reservation process.',
    primaryOffer: 'Table reservations for the currently published menu and service times.',
    targetAudience: 'Dubai residents aged 25-50 comparing relaxed dinner options for small groups.',
    audiencePainPoints: ['hard to judge the setting before booking', 'unclear menu fit for the group'],
    businessGoal: 'Generate relevant reservation interest.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
  }),
  evalCase('en-education-full', 'professional education', 'full', 'en', 'course enquiries', {
    brandName: 'Applied Finance Lab', industry: 'Professional finance education',
    description: 'A training provider offering a reviewed live course on practical financial modelling for early-career analysts.',
    primaryOffer: 'An information session explaining the syllabus, schedule, and enrolment criteria.',
    targetAudience: 'UAE early-career finance analysts comparing structured practical training.',
    audiencePainPoints: ['unclear course depth', 'difficulty judging whether the syllabus fits their role'],
    businessGoal: 'Generate qualified information-session registrations.',
    topPlatforms: ['LINKEDIN', 'INSTAGRAM'],
    verifiedProof: ['Founder reviewed the published syllabus and instructor profile on 2026-06-30'],
    complianceNotes: 'Do not promise jobs, promotions, salaries, certifications, or exam outcomes.',
  }),
  evalCase('en-auto-organic', 'automotive service', 'organic', 'en', 'inspection bookings', {
    brandName: 'Plainview Auto Care', industry: 'Automotive inspection and maintenance',
    description: 'A workshop that inspects a vehicle before recommending maintenance from its current service list.',
    primaryOffer: 'A vehicle inspection appointment with findings explained before additional work is approved.',
    targetAudience: 'Dubai vehicle owners who want clarity before approving maintenance work.',
    audiencePainPoints: ['unclear reason for recommended work', 'fear of approving unnecessary services'],
    businessGoal: 'Generate suitable vehicle-inspection bookings.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
  }),
  evalCase('en-home-cleaning-organic', 'home cleaning', 'organic', 'en', 'booking enquiries', {
    brandName: 'TidyHarbor Home Care', industry: 'Home cleaning services',
    description: 'A home-cleaning provider serving apartments and villas after confirming home size and requested scope.',
    primaryOffer: 'A scoped home-cleaning booking after confirming property details.',
    targetAudience: 'Dubai apartment and villa residents comparing recurring or one-time home cleaning.',
    audiencePainPoints: ['unclear scope before booking', 'difficulty matching service type to the home'],
    businessGoal: 'Generate qualified home-cleaning enquiries.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
  }),
  evalCase('en-events-full', 'corporate events', 'full', 'en', 'brief submissions', {
    brandName: 'GatherWorks', industry: 'Corporate event production',
    description: 'An events team that scopes company event objectives, audience, venue constraints, and required production.',
    primaryOffer: 'An event brief review followed by a scoped production proposal.',
    targetAudience: 'UAE marketing and people teams planning a company event within six months.',
    audiencePainPoints: ['vendors propose before understanding constraints', 'unclear ownership across production tasks'],
    businessGoal: 'Generate qualified corporate event briefs.',
    topPlatforms: ['LINKEDIN', 'INSTAGRAM'],
    verifiedProof: ['Founder reviewed the current discovery brief and production workflow on 2026-06-30'],
  }),
  evalCase('en-fitness-organic', 'fitness coaching', 'organic', 'en', 'assessment enquiries', {
    brandName: 'Measured Movement', industry: 'Non-medical fitness coaching',
    description: 'A coaching studio offering exercise-program assessments based on stated goals and training experience.',
    primaryOffer: 'A fitness-goal and training-experience assessment before programme recommendations.',
    targetAudience: 'Dubai adults aged 30-50 returning to structured exercise after a long break.',
    audiencePainPoints: ['uncertainty about where to restart', 'generic plans feel disconnected from experience level'],
    businessGoal: 'Generate suitable fitness assessment enquiries.',
    topPlatforms: ['INSTAGRAM', 'YOUTUBE'],
    complianceNotes: 'Do not make medical, injury, weight-loss, or guaranteed fitness outcome claims.',
  }),
  evalCase('en-beauty-paid', 'beauty salon', 'paid', 'en', 'consultation bookings', {
    brandName: 'Line & Light Studio', industry: 'Hair and beauty salon',
    description: 'A salon that confirms service suitability, timing, and price before the appointment is finalized.',
    primaryOffer: 'A short service consultation before confirming a salon appointment.',
    targetAudience: 'Dubai women aged 24-45 comparing salon services for a planned occasion.',
    audiencePainPoints: ['uncertain service suitability', 'price and appointment duration are unclear'],
    businessGoal: 'Generate suitable consultation bookings.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
    verifiedProof: ['Owner reviewed the current service menu, consultation step, and booking workflow on 2026-06-30'],
    complianceNotes: 'Do not promise appearance, skin, hair, or treatment outcomes.',
  }),
  evalCase('en-cybersecurity-organic', 'B2B cybersecurity SaaS', 'organic', 'en', 'security review enquiries', {
    brandName: 'ScopeLock', industry: 'B2B cybersecurity software',
    description: 'Software that helps small IT teams document vendor access reviews in one workspace.',
    primaryOffer: 'A product walkthrough focused on the documented vendor-access review workflow.',
    targetAudience: 'IT managers at UAE SMEs evaluating a clearer vendor-access review process.',
    audiencePainPoints: ['reviews are spread across files', 'unclear follow-up ownership'],
    businessGoal: 'Generate qualified product-walkthrough enquiries.',
    topPlatforms: ['LINKEDIN', 'YOUTUBE'],
    complianceNotes: 'Do not claim breach prevention, compliance certification, integration, or risk reduction without evidence.',
  }),

  evalCase('ar-fragrance-organic', 'home fragrance ecommerce', 'organic', 'ar', 'استفسارات عن المنتجات', {
    brandName: 'سكون', industry: 'عطور منزلية',
    description: 'متجر إلكتروني يعرض مجموعته الحالية من العطور المنزلية مع وصف واضح لكل رائحة.',
    primaryOffer: 'مساعدة العميل على اختيار عطر منزلي من المنتجات المعروضة حالياً.',
    targetAudience: 'سكان الإمارات من عمر 25 إلى 50 عاماً ممن يقارنون روائح منزلية قبل الشراء.',
    audiencePainPoints: ['صعوبة تخيل الرائحة عبر الإنترنت', 'عدم وضوح الفرق بين الخيارات'],
    businessGoal: 'توليد استفسارات مناسبة عن المنتجات قبل الشراء.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
  }),
  evalCase('ar-kids-store-organic', 'children products ecommerce', 'organic', 'ar', 'استفسارات شراء مؤهلة', {
    brandName: 'خطوة صغيرة', industry: 'متجر إلكتروني لمنتجات الأطفال',
    description: 'متجر يعرض منتجات أطفال موضحة العمر والاستخدام وفق بيانات المورد المتاحة.',
    primaryOffer: 'مساعدة الوالدين على مقارنة المنتجات المدرجة حسب العمر والاستخدام الموضح.',
    targetAudience: 'آباء وأمهات في الإمارات لأطفال من عمر 3 إلى 8 سنوات يقارنون المنتجات قبل الشراء.',
    audiencePainPoints: ['عدم وضوح ملاءمة المنتج للعمر', 'صعوبة المقارنة بين الاستخدامات'],
    businessGoal: 'توليد استفسارات شراء مؤهلة.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
    complianceNotes: 'لا تدّعِ فوائد صحية أو تعليمية أو سلامة غير موثقة، ولا تضف أعماراً غير مدرجة.',
  }),
  evalCase('ar-real-estate-full', 'real estate brokerage', 'full', 'ar', 'طلبات شراء مؤهلة', {
    brandName: 'مدار العقارية', industry: 'وساطة عقارية سكنية',
    description: 'شركة وساطة تساعد المقيمين في الإمارات على مقارنة الشقق المدرجة حسب الميزانية والموقع وموعد الانتقال.',
    primaryOffer: 'مكالمة لفهم متطلبات المشتري ثم إعداد قائمة من العقارات المتاحة حالياً.',
    targetAudience: 'مقيمون في الإمارات يخططون لشراء شقة خلال ستة أشهر.',
    audiencePainPoints: ['كثرة القوائم غير المناسبة', 'عدم وضوح خطوات الشراء'],
    businessGoal: 'توليد نماذج متطلبات من مشترين مؤهلين.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
    competitors: ['بيترهومز', 'هاوس آند هاوس'],
    verifiedProof: ['راجع المؤسس رخصة الوساطة وآلية التعامل مع القوائم الحالية بتاريخ 2026-06-30'],
  }),
  evalCase('ar-clinic-saas-paid', 'clinic operations SaaS', 'paid', 'ar', 'طلبات عرض توضيحي', {
    brandName: 'مسار العيادة', industry: 'برمجيات لإدارة عمليات العيادات',
    description: 'منصة تمنح مدير العيادة مساحة واحدة لمتابعة مهام المواعيد وتحديد المسؤول عنها.',
    primaryOffer: 'عرض توضيحي لمساحة متابعة المواعيد والمهام الحالية.',
    targetAudience: 'مالكو ومديرو العيادات في الإمارات ممن يقيّمون برمجيات تنظيم المتابعة.',
    audiencePainPoints: ['عدم وضوح مسؤولية المتابعة', 'توزع المهام بين أدوات منفصلة'],
    businessGoal: 'توليد طلبات مؤهلة لعرض المنتج.',
    topPlatforms: ['LINKEDIN', 'FACEBOOK'],
    verifiedProof: ['راجع المؤسس تدفق العرض التوضيحي وقائمة الخصائص الحالية بتاريخ 2026-06-30'],
    complianceNotes: 'لا تدّعِ نتائج طبية أو نتائج مرضى أو تكاملات أو توفير وقت غير موثق.',
  }),
  evalCase('ar-coffee-organic', 'specialty coffee', 'organic', 'ar', 'زيارات للفرع', {
    brandName: 'محمصة المجلس', industry: 'محمصة قهوة ومقهى',
    description: 'محمصة محلية تقدم قائمة القهوة الحالية في فرعها بدبي.',
    primaryOffer: 'مساعدة الزائر على اختيار القهوة حسب تفضيله من القائمة الحالية.',
    targetAudience: 'سكان دبي من عمر 24 إلى 45 عاماً ممن يريدون فهماً أبسط لاختيارات القهوة.',
    audiencePainPoints: ['وصف القهوة يبدو تقنياً', 'صعوبة اختيار المشروب المناسب'],
    businessGoal: 'تشجيع زيارات مدروسة واستفسارات عن القائمة.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
  }),
  evalCase('ar-legal-organic', 'legal advisory', 'organic', 'ar', 'طلبات تواصل أولي', {
    brandName: 'بيان للاستشارات', industry: 'خدمات استشارية قانونية للشركات',
    description: 'مكتب يوضح نطاق الاستشارة الأولية للشركات الصغيرة قبل قبول التكليف.',
    primaryOffer: 'مكالمة أولية لفهم موضوع الاستفسار وتوضيح نطاق الاستشارة الممكن.',
    targetAudience: 'مؤسسو شركات صغيرة في الإمارات يحتاجون إلى فهم أولي لنطاق استشارة تجارية.',
    audiencePainPoints: ['عدم معرفة نوع المستندات المطلوبة', 'عدم وضوح نطاق الاستشارة'],
    businessGoal: 'توليد طلبات تواصل أولي مناسبة.',
    topPlatforms: ['LINKEDIN', 'INSTAGRAM'],
    complianceNotes: 'لا تقدم رأياً قانونياً أو ضماناً لنتيجة عبر المحتوى التسويقي، واطلب مراجعة الحالة منفردة.',
  }),
  evalCase('ar-logistics-paid', 'B2B logistics', 'paid', 'ar', 'طلبات عروض أسعار', {
    brandName: 'خط الإمداد', industry: 'خدمات لوجستية للشركات',
    description: 'مزود خدمات يراجع متطلبات الشحن البري المتكرر داخل الإمارات قبل إصدار عرض السعر.',
    primaryOffer: 'مراجعة المسار ومتطلبات الشحن ثم إعداد عرض سعر محدد النطاق.',
    targetAudience: 'مديرو العمليات والمشتريات الذين لديهم متطلبات شحن بري متكرر داخل الإمارات.',
    audiencePainPoints: ['عروض السعر تتجاهل قيود التشغيل', 'بطء تأهيل المسارات المتكررة'],
    businessGoal: 'توليد طلبات عروض أسعار مؤهلة.',
    topPlatforms: ['LINKEDIN', 'FACEBOOK'],
    verifiedProof: ['راجع المؤسس قائمة جمع متطلبات المسار وآلية التسعير الحالية بتاريخ 2026-06-30'],
  }),
  evalCase('ar-restaurant-organic', 'restaurant', 'organic', 'ar', 'اهتمام بالحجز', {
    brandName: 'مائدة الليمون', industry: 'مطعم محلي',
    description: 'مطعم في دبي يعرض قائمته الحالية وأجواء المكان وخطوات الحجز.',
    primaryOffer: 'حجز طاولة وفق القائمة وأوقات الخدمة المنشورة حالياً.',
    targetAudience: 'سكان دبي من عمر 25 إلى 50 عاماً يقارنون خيارات عشاء هادئ لمجموعة صغيرة.',
    audiencePainPoints: ['صعوبة تقييم أجواء المكان قبل الحجز', 'عدم وضوح ملاءمة القائمة للمجموعة'],
    businessGoal: 'توليد اهتمام مناسب بالحجز.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
  }),
  evalCase('ar-education-full', 'professional education', 'full', 'ar', 'تسجيلات لجلسة تعريفية', {
    brandName: 'مختبر التحليل', industry: 'تدريب مهني في تحليل البيانات',
    description: 'جهة تدريب تقدم دورة مباشرة موثقة المنهج في التحليل العملي للبيانات للمبتدئين مهنياً.',
    primaryOffer: 'جلسة تعريفية تشرح المنهج والجدول ومعايير التسجيل.',
    targetAudience: 'مهنيون في بداية مسيرتهم بالإمارات يقارنون تدريباً عملياً منظماً في تحليل البيانات.',
    audiencePainPoints: ['عدم وضوح عمق المنهج', 'صعوبة معرفة ملاءمة الدورة للدور المهني'],
    businessGoal: 'توليد تسجيلات مؤهلة للجلسة التعريفية.',
    topPlatforms: ['LINKEDIN', 'INSTAGRAM'],
    verifiedProof: ['راجع المؤسس المنهج المنشور وملف المدرب بتاريخ 2026-06-30'],
    complianceNotes: 'لا تعد بوظيفة أو ترقية أو راتب أو شهادة أو نتيجة اختبار.',
  }),
  evalCase('ar-auto-organic', 'automotive service', 'organic', 'ar', 'حجوزات فحص', {
    brandName: 'ميزان أوتو', industry: 'فحص وصيانة السيارات',
    description: 'ورشة تفحص السيارة قبل اقتراح أعمال الصيانة من قائمة الخدمات الحالية.',
    primaryOffer: 'موعد فحص للسيارة مع شرح النتائج قبل اعتماد أي أعمال إضافية.',
    targetAudience: 'مالكو سيارات في دبي يريدون وضوحاً قبل اعتماد أعمال الصيانة.',
    audiencePainPoints: ['عدم وضوح سبب العمل المقترح', 'القلق من اعتماد خدمات غير لازمة'],
    businessGoal: 'توليد حجوزات مناسبة لفحص السيارات.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
  }),
  evalCase('ar-cleaning-organic', 'home cleaning', 'organic', 'ar', 'استفسارات حجز', {
    brandName: 'بيت مرتب', industry: 'خدمات تنظيف المنازل',
    description: 'مزود تنظيف يخدم الشقق والفلل بعد تأكيد حجم المنزل ونطاق الخدمة المطلوبة.',
    primaryOffer: 'حجز تنظيف منزلي محدد النطاق بعد تأكيد تفاصيل العقار.',
    targetAudience: 'سكان الشقق والفلل في دبي ممن يقارنون تنظيفاً دورياً أو لمرة واحدة.',
    audiencePainPoints: ['عدم وضوح نطاق الخدمة قبل الحجز', 'صعوبة اختيار نوع الخدمة للمنزل'],
    businessGoal: 'توليد استفسارات مؤهلة عن تنظيف المنازل.',
    topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
  }),
  evalCase('ar-events-full', 'corporate events', 'full', 'ar', 'بريفات فعاليات مؤهلة', {
    brandName: 'مشهد للفعاليات', industry: 'إنتاج فعاليات الشركات',
    description: 'فريق يراجع هدف الفعالية والجمهور وقيود المكان ومتطلبات الإنتاج قبل إعداد المقترح.',
    primaryOffer: 'مراجعة بريف الفعالية ثم إعداد مقترح إنتاج محدد النطاق.',
    targetAudience: 'فرق التسويق والموارد البشرية في الإمارات التي تخطط لفعالية شركة خلال ستة أشهر.',
    audiencePainPoints: ['الموردون يقترحون قبل فهم القيود', 'عدم وضوح المسؤوليات بين مهام الإنتاج'],
    businessGoal: 'توليد بريفات مؤهلة لفعاليات الشركات.',
    topPlatforms: ['LINKEDIN', 'INSTAGRAM'],
    verifiedProof: ['راجع المؤسس نموذج جمع المتطلبات ومسار الإنتاج الحالي بتاريخ 2026-06-30'],
  }),
  evalCase('ar-fitness-organic', 'fitness coaching', 'organic', 'ar', 'استفسارات تقييم', {
    brandName: 'حركة محسوبة', industry: 'تدريب لياقة غير طبي',
    description: 'استوديو يقدم تقييماً لأهداف التمرين والخبرة السابقة قبل اقتراح البرنامج.',
    primaryOffer: 'تقييم هدف اللياقة والخبرة التدريبية قبل توصية البرنامج.',
    targetAudience: 'بالغون في دبي من عمر 30 إلى 50 عاماً يعودون للتمرين المنظم بعد انقطاع طويل.',
    audiencePainPoints: ['عدم معرفة نقطة البداية', 'الخطط العامة لا تراعي مستوى الخبرة'],
    businessGoal: 'توليد استفسارات مناسبة لتقييم اللياقة.',
    topPlatforms: ['INSTAGRAM', 'YOUTUBE'],
    complianceNotes: 'لا تقدم ادعاءات طبية أو علاج إصابات أو خسارة وزن أو نتائج لياقة مضمونة.',
  }),
  evalCase('ar-salon-paid', 'beauty salon', 'paid', 'ar', 'حجوزات استشارة', {
    brandName: 'خط ونور', industry: 'صالون شعر وتجميل',
    description: 'صالون يؤكد ملاءمة الخدمة ومدتها وسعرها قبل تثبيت الموعد.',
    primaryOffer: 'استشارة قصيرة عن الخدمة قبل تأكيد موعد الصالون.',
    targetAudience: 'نساء في دبي من عمر 24 إلى 45 عاماً يقارنّ خدمات صالون لمناسبة مخطط لها.',
    audiencePainPoints: ['عدم وضوح ملاءمة الخدمة', 'السعر ومدة الموعد غير واضحين'],
    businessGoal: 'توليد حجوزات استشارة مناسبة.',
    topPlatforms: ['INSTAGRAM', 'TIKTOK'],
    verifiedProof: ['راجعت المالكة قائمة الخدمات وخطوة الاستشارة ومسار الحجز بتاريخ 2026-06-30'],
    complianceNotes: 'لا تعد بنتائج تخص المظهر أو البشرة أو الشعر أو العلاج.',
  }),
  evalCase('ar-inventory-saas-organic', 'inventory SaaS', 'organic', 'ar', 'طلبات عرض للمنتج', {
    brandName: 'رفوف', industry: 'برمجيات إدارة مخزون للشركات الصغيرة',
    description: 'منصة تساعد فرق المتاجر الصغيرة على تسجيل مراجعات المخزون والمهام المرتبطة بها في مساحة واحدة.',
    primaryOffer: 'عرض توضيحي لمسار مراجعة المخزون والمهام الحالي.',
    targetAudience: 'مديرو متاجر صغيرة في الإمارات يقارنون طريقة أوضح لمراجعة المخزون.',
    audiencePainPoints: ['المراجعات موزعة بين ملفات', 'عدم وضوح مسؤولية المتابعة'],
    businessGoal: 'توليد طلبات مؤهلة لعرض المنتج.',
    topPlatforms: ['LINKEDIN', 'YOUTUBE'],
    complianceNotes: 'لا تدّعِ تكاملات أو دقة مخزون أو توفير وقت أو خفض تكلفة دون إثبات.',
  }),
  {
    id: 'ar-luma-coffee-paid-no-proof',
    sector: 'specialty coffee subscription',
    brand: {
      ...paidProfile('ar', {
        brandName: 'Luma Roast Lab', industry: 'اشتراك قهوة مختصة',
        description: 'اشتراك شهري في قهوة محمصة حديثًا ومخصصة للتوصيل داخل دبي.',
        primaryOffer: 'اشتراك 1 كجم شهريًا مقابل 149 درهمًا مع التوصيل خلال 48 ساعة.',
        targetAudience: 'سكان دبي الذين يشترون القهوة المختصة للاستخدام المنزلي.',
        audiencePainPoints: ['صعوبة اختيار نوع القهوة المناسب للذوق'],
        audienceAge: '25-50',
        businessGoal: 'توليد طلبات اشتراك مؤهلة داخل دبي.',
        topPlatforms: ['INSTAGRAM', 'TIKTOK', 'LINKEDIN'],
        audienceLocation: 'دبي فقط',
        avoidKeywords: ['خصم', 'نتائج مضمونة', 'قصص نجاح', 'تجارب عملاء'],
        complianceNotes: 'لا تخترع شهادات أو قصص نجاح، ولا تعد بنتائج، ولا تذكر خصومات أو شحنًا خارج دبي.',
      }),
      verifiedProof: [],
      conversionDestination: 'https://example.com/luma-subscription',
    },
    order: order('paid', 'ar', 'طلبات اشتراك مؤهلة', '30'),
  },
  {
    id: 'ar-luma-coffee-full-no-proof',
    sector: 'specialty coffee subscription',
    brand: {
      ...paidProfile('ar', {
        brandName: 'Luma Roast Lab', industry: 'اشتراك قهوة مختصة',
        description: 'اشتراك شهري في قهوة محمصة حديثًا ومخصصة للتوصيل داخل دبي.',
        primaryOffer: 'اشتراك 1 كجم شهريًا مقابل 149 درهمًا مع التوصيل خلال 48 ساعة.',
        targetAudience: 'سكان دبي الذين يشترون القهوة المختصة للاستخدام المنزلي.',
        audiencePainPoints: ['صعوبة اختيار نوع القهوة المناسب للذوق'],
        audienceAge: '25-50',
        businessGoal: 'توليد طلبات اشتراك مؤهلة داخل دبي.',
        topPlatforms: ['INSTAGRAM', 'TIKTOK', 'LINKEDIN'],
        audienceLocation: 'دبي فقط',
        avoidKeywords: ['خصم', 'نتائج مضمونة', 'قصص نجاح', 'تجارب عملاء'],
        complianceNotes: 'لا تخترع شهادات أو قصص نجاح، ولا تعد بنتائج، ولا تذكر خصومات أو شحنًا خارج دبي.',
      }),
      verifiedProof: [],
      conversionDestination: 'https://example.com/luma-subscription',
    },
    order: {
      ...order('full', 'ar', 'طلبات اشتراك مؤهلة', '90'),
      contentIntensity: 'standard',
      customOrganicPostCount: 16,
    },
  },
]

/** Build the exact contract/readiness-enriched brief used by the strategy route. */
export function buildStrategyEvalBrief(testCase: StrategyQualityEvalCase): BusinessBrief {
  const profile = testCase.brand as Record<string, any>
  const deliverables = getStrategyDeliverables(testCase.order, {
    postsPerMonth: 30,
    platformCount: Array.isArray(profile.topPlatforms) ? profile.topPlatforms.length : undefined,
  })
  if (!deliverables.supported) {
    throw new Error(`Unsupported eval order: ${testCase.id}`)
  }

  const readiness = getStrategyBriefReadiness({
    mode: testCase.order.strategyType,
    brandProfile: profile,
    platform: {
      trackingReady: false,
      paidPlatformReady: false,
      budgetApproved: false,
      launchApproved: false,
    },
  })
  if (!readiness.canGenerate) {
    throw new Error(
      `Eval brief is not generation-ready (${testCase.id}): ${readiness.missingRequiredFields.join(',')}`,
    )
  }

  return {
    companyName: profile.brandName,
    businessType: profile.industry,
    targetAudience: profile.targetAudience,
    monthlyBudget: 0,
    primaryGoal: profile.businessGoal || testCase.order.goal,
    competitors: profile.competitorNotes || undefined,
    region: profile.audienceLocation || undefined,
    uniqueValue: profile.uniqueAdvantages?.join(', ') || undefined,
    avoidWords: profile.avoidKeywords?.join(', ') || undefined,
    writingStyle: profile.writingStyle || undefined,
    pricePoint: profile.pricePoint || undefined,
    painPoints: profile.audiencePainPoints?.join(', ') || undefined,
    desires: profile.audienceDesires?.join(', ') || undefined,
    primaryOffer: profile.primaryOffer || undefined,
    currentPlatforms: profile.topPlatforms,
    winningHooks: profile.winningHooks?.slice(0, 3).join(' | ') || undefined,
    language: testCase.order.language,
    strategyType: testCase.order.strategyType,
    strategyDuration: testCase.order.durationPreset,
    strategyOrder: testCase.order,
    strategyDeliverables: deliverables,
    generationInstructions: [
      deliverables.generationInstructions,
      `Strategy Brief Readiness Scope: ${readiness.safeScope}`,
      readiness.paidPlanningOnly
        ? 'Paid scope is planning-only. Do not describe ad launch, spend, platform activation, connected-account readiness, or publishing as included in this run.'
        : '',
      readiness.warnings.includes('verified_proof_missing')
        ? 'Verified proof is missing. Avoid proof-based claims and recommend collecting proof instead.'
        : '',
    ].filter(Boolean).join('\n'),
    organicPostCount: deliverables.organicPostCount,
    detailedCalendarDays: deliverables.detailedCalendarDays,
    roadmapMonths: deliverables.roadmapMonths,
    planCapApplied: deliverables.planCapApplied,
    planTier: 'pro',
  }
}
