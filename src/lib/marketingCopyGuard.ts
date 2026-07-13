/**
 * Detects low-specificity hook formulas that sound polished but do not carry
 * a documented audience need, proof point, or operational detail.
 */
export function hasGenericMarketingHook(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false

  return [
    /(?:هل\s+تعلم|هل\s+فكرت|تخي[ّ]?ل\s+(?:لو|أن)|did\s+you\s+know|have\s+you\s+ever\s+wondered|imagine\s+if|what\s+if)/i,
    /(?:التسويق\s+الذكي|التحليلات|الأرقام).{0,28}(?:يغي[ّ]?ر|تغي[ّ]?ر).{0,24}(?:مسار|عملك|شركتك)/i,
    /(?:analytics|numbers|smart\s+marketing).{0,32}(?:change|transform).{0,24}(?:business|company)/i,
    /(?:التحليلات|الأرقام)\s+ليست?\s+مجرد\s+(?:أرقام|بيانات).{0,48}(?:مفتاح|سر|جزء).{0,28}(?:النجاح|النمو|العمل|التنظيم)/i,
    /(?:analytics|numbers)\s+(?:are|is)\s+(?:not|more\s+than)\s+just\s+(?:numbers|data).{0,48}(?:key|secret|part).{0,28}(?:success|growth|work)/i,
    /الجودة\s+تبدأ\s+من\s+هنا/i,
    /quality\s+starts?\s+(?:from\s+)?here/i,
    /التسويق\s+الذكي\s+ليس\s+مجرد\s+(?:خيار|أداة).{0,36}(?:ضرورة|نجاح)/i,
    /smart\s+marketing\s+is(?:n't|\s+not)\s+just\s+(?:an?\s+)?(?:option|tool).{0,36}(?:necessity|essential|success)/i,
    /اكتشف\s+كيف\s+يمكننا\s+مساعدتك/i,
    /discover\s+how\s+we\s+can\s+help\s+you/i,
    /كيف\s+يمكن\s+ل.{0,36}(?:أن\s+)?(?:يعزز|يطور|يغي[ّ]?ر).{0,24}(?:نمو|شركتك|عملك)/i,
    /how\s+can\s+.{0,36}(?:grow|transform|change|boost).{0,24}(?:your\s+)?(?:business|company|growth)/i,
  ].some(pattern => pattern.test(text))
}
