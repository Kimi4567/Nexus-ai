export type BusinessGoalCode =
  | 'increase_sales'
  | 'generate_leads'
  | 'build_awareness'
  | 'launch_product'
  | 'grow_followers'
  | 'retain_customers'

const GOAL_LABELS: Record<BusinessGoalCode, { en: string; ar: string }> = {
  increase_sales: { en: 'Increase sales', ar: 'زيادة المبيعات' },
  generate_leads: { en: 'Generate qualified leads', ar: 'توليد عملاء محتملين مؤهلين' },
  build_awareness: { en: 'Build brand awareness', ar: 'بناء الوعي بالعلامة التجارية' },
  launch_product: { en: 'Launch a new product', ar: 'إطلاق منتج جديد' },
  grow_followers: { en: 'Grow a relevant audience', ar: 'تنمية جمهور مهتم' },
  retain_customers: { en: 'Improve customer retention', ar: 'تحسين الاحتفاظ بالعملاء' },
}

export function isBusinessGoalCode(value: unknown): value is BusinessGoalCode {
  return typeof value === 'string' && value in GOAL_LABELS
}

/** Convert legacy/internal onboarding values into language-neutral Brand Brain text. */
export function normalizeBusinessGoal(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const clean = value.trim()
  return isBusinessGoalCode(clean) ? GOAL_LABELS[clean].en : clean
}

export function businessGoalLabel(value: unknown, locale: 'ar' | 'en' = 'en'): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const clean = value.trim()
  return isBusinessGoalCode(clean) ? GOAL_LABELS[clean][locale] : clean
}

export function campaignObjectiveForGoal(value: unknown): 'leads' | 'sales' | 'awareness' | null {
  if (value === 'increase_sales') return 'sales'
  if (value === 'generate_leads') return 'leads'
  if (value === 'build_awareness' || value === 'launch_product' || value === 'grow_followers') return 'awareness'
  return null
}
