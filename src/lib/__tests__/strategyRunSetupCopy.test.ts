import { describe, expect, it } from 'vitest'
import { translations } from '@/lib/i18n-context'

describe('strategy run setup copy', () => {
  it('frames the first modal step as strategy setup, not only language selection', () => {
    const ar = translations.ar.runStrategy as Record<string, string>
    const en = translations.en.runStrategy as Record<string, string>

    expect(ar.langSelectTitle).toBe('إعداد طلب الاستراتيجية')
    expect(en.langSelectTitle).toBe('Set up strategy request')

    expect(ar.langSelectDesc).toMatch(/نوع الاستراتيجية/)
    expect(ar.langSelectDesc).toMatch(/المدة/)
    expect(ar.langSelectDesc).toMatch(/كثافة المحتوى/)
    expect(ar.langSelectDesc).toMatch(/لغة المخرجات/)
    expect(ar.langSelectDesc).toMatch(/التكلفة/)

    expect(en.langSelectDesc).toMatch(/strategy type/i)
    expect(en.langSelectDesc).toMatch(/duration/i)
    expect(en.langSelectDesc).toMatch(/content intensity/i)
    expect(en.langSelectDesc).toMatch(/output language/i)
    expect(en.langSelectDesc).toMatch(/cost/i)
  })

  it('does not describe language choices as a full-strategy order', () => {
    const ar = translations.ar.runStrategy as Record<string, string>
    const en = translations.en.runStrategy as Record<string, string>

    expect(ar.langOptArDesc).not.toMatch(/استراتيجية كاملة/)
    expect(ar.langOptEnDesc).not.toMatch(/Full strategy/i)
    expect(ar.langOptMixDesc).not.toMatch(/كل اتجاه منشور/)

    expect(en.langOptArDesc).not.toMatch(/Full strategy/i)
    expect(en.langOptEnDesc).not.toMatch(/Full strategy/i)
    expect(en.langOptMixDesc).not.toMatch(/AI picks the best language/i)

    expect(ar.langStartBtn).toBe('متابعة لمراجعة التكلفة')
    expect(en.langStartBtn).toBe('Continue to cost review')
  })
})
