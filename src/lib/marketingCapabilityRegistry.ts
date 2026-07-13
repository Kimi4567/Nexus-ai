export type MarketingCapabilityStatus = 'operational' | 'conditional' | 'planned'

export interface MarketingCapability {
  id: string
  status: MarketingCapabilityStatus
  title: { ar: string; en: string }
  detail: { ar: string; en: string }
}

/**
 * Product-wide capability truth. UI surfaces must describe capabilities from
 * this registry instead of turning an implemented screen into a promise that
 * an external provider or an unbuilt marketing discipline is already live.
 */
export const MARKETING_CAPABILITIES: readonly MarketingCapability[] = [
  {
    id: 'brand_brain',
    status: 'operational',
    title: { ar: 'سياق Brand Brain', en: 'Brand Brain context' },
    detail: {
      ar: 'يحفظ حقائق العلامة وتفضيلات الاستراتيجية والإثباتات التي يراجعها المستخدم.',
      en: 'Stores user-reviewed brand facts, strategy preferences, and verified proof.',
    },
  },
  {
    id: 'strategy_campaigns',
    status: 'operational',
    title: { ar: 'الاستراتيجية والحملات', en: 'Strategy and campaigns' },
    detail: {
      ar: 'ينتج مسودات منظمة تخضع لعقد جودة ومراجعة قبل الاعتماد.',
      en: 'Produces structured drafts that pass a quality contract before approval.',
    },
  },
  {
    id: 'content_system',
    status: 'operational',
    title: { ar: 'نظام المحتوى', en: 'Content system' },
    detail: {
      ar: 'يجهز تقويمًا ونصوصًا ونسخ A/B وطابور مرئيات، وكلها قابلة للتحرير.',
      en: 'Prepares an editable calendar, copy, A/B drafts, and a visual-generation queue.',
    },
  },
  {
    id: 'approval_control',
    status: 'operational',
    title: { ar: 'الموافقات وسجل القرار', en: 'Approvals and decision history' },
    detail: {
      ar: 'يفصل المسودة عن الاعتماد والجدولة والتنفيذ بحالات ظاهرة.',
      en: 'Separates draft, approval, scheduling, and execution with visible states.',
    },
  },
  {
    id: 'organic_distribution',
    status: 'conditional',
    title: { ar: 'النشر العضوي', en: 'Organic publishing' },
    detail: {
      ar: 'يعمل فقط للموفر والحساب والصلاحية التي تجتاز فحص الجاهزية؛ ليس كل اتصال مؤهلاً.',
      en: 'Runs only for a provider, account, and permission set that pass readiness checks; a saved connection alone is not enough.',
    },
  },
  {
    id: 'paid_media',
    status: 'conditional',
    title: { ar: 'الإعلانات المدفوعة', en: 'Paid media' },
    detail: {
      ar: 'التخطيط والمسودات متاحة؛ الإطلاق الفعلي يتطلب صلاحية API مثبتة وموافقة المستخدم.',
      en: 'Planning and drafts are available; live launch requires proven API access and user approval.',
    },
  },
  {
    id: 'measurement_learning',
    status: 'conditional',
    title: { ar: 'القياس والتعلم', en: 'Measurement and learning' },
    detail: {
      ar: 'القياسات اليدوية تبقى سياقًا فقط. بيانات الموفر الموثقة يمكنها إنشاء اقتراح تعلم للمراجعة.',
      en: 'Manual metrics remain context only. Verified provider data can create a reviewable learning proposal.',
    },
  },
  {
    id: 'crm_leads',
    status: 'planned',
    title: { ar: 'CRM والعملاء المحتملون', en: 'CRM and lead pipeline' },
    detail: {
      ar: 'غير متاح حاليًا؛ لا يدّعي NEXUS التقاط العملاء أو إدارتهم تلقائيًا.',
      en: 'Not available yet; NEXUS does not claim to capture or manage leads automatically.',
    },
  },
  {
    id: 'customer_lifecycle',
    status: 'planned',
    title: { ar: 'رحلات البريد وSMS للعملاء', en: 'Customer email and SMS journeys' },
    detail: {
      ar: 'غير متاحة حاليًا. رسائل حساب NEXUS ليست أداة حملات لعملاء المستخدم.',
      en: 'Not available yet. Nexus account emails are not a customer-campaign tool.',
    },
  },
  {
    id: 'seo_cro',
    status: 'planned',
    title: { ar: 'SEO وتحسين التحويل', en: 'SEO and conversion optimization' },
    detail: {
      ar: 'ليست وحدة تشغيلية حالياً ولا تظهر كتوصية منفذة.',
      en: 'Not an operational module yet and never shown as executed work.',
    },
  },
] as const

export function capabilitiesByStatus(status: MarketingCapabilityStatus): MarketingCapability[] {
  return MARKETING_CAPABILITIES.filter((capability) => capability.status === status)
}
