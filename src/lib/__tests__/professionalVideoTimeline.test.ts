import { describe, expect, it } from 'vitest'
import {
  buildProfessionalVideoTimeline,
  PROFESSIONAL_VIDEO_TIMELINE_VERSION,
  validateProfessionalVideoTimeline,
} from '@/lib/professionalVideoTimeline'
import { buildMotionDesignCopy } from '@/lib/motionDesignAd'

describe('professional video timeline', () => {
  it('turns an approved subscription offer into separate readable layers without paraphrasing', () => {
    const caption = 'كيلوغرام واحد شهريًا مقابل 149 درهمًا. القهوة محمصة حديثًا. التوصيل داخل دبي فقط خلال 48 ساعة. راجع تفاصيل الاشتراك قبل الطلب.'
    const timeline = buildProfessionalVideoTimeline({
      copy: {
        brandLabel: 'Luma Roast Lab',
        hook: 'كيلوغرام واحد شهريًا مقابل 149 درهمًا',
        cta: 'عرض التفاصيل',
        language: 'ar',
      },
      caption,
      colorPalette: ['#20130D', '#FFF8EF', '#D9923B'],
      sourceMatchesTarget: false,
    })

    expect(timeline).toMatchObject({
      version: PROFESSIONAL_VIDEO_TIMELINE_VERSION,
      template: 'OFFER_REVEAL',
      durationSeconds: 6,
      frameRate: 24,
      safeSourceSeconds: 3,
      sourceLayout: 'BLURRED_CANVAS',
      soundDesign: {
        source: 'PROCEDURAL_ORIGINAL',
        targetLufs: -18,
        truePeakDb: -2,
      },
      copy: {
        brand: 'Luma Roast Lab',
        eyebrow: 'كيلوغرام واحد شهريًا',
        headline: '149 درهمًا',
        supporting: 'القهوة محمصة حديثًا',
        cta: 'عرض التفاصيل',
        language: 'ar',
      },
      scenes: [
        expect.objectContaining({ id: 'HOOK', sourceOffsetSeconds: 0, transitionOut: expect.objectContaining({ type: 'SMOOTH_LEFT' }) }),
        expect.objectContaining({ id: 'PROOF', sourceOffsetSeconds: 0.5, transitionOut: expect.objectContaining({ type: 'FADE_FAST' }) }),
        expect.objectContaining({ id: 'CTA', sourceOffsetSeconds: 0.8, transitionOut: null }),
      ],
    })
    expect(validateProfessionalVideoTimeline(timeline, caption)).toEqual({ ok: true, issues: [] })
  })

  it('uses only the approved Dubai scope and timing for a service-promise ad', () => {
    const caption = 'داخل دبي فقط خلال 48 ساعة. راجع عنوان التوصيل وتفاصيل الاشتراك قبل الطلب.'
    const timeline = buildProfessionalVideoTimeline({
      copy: {
        brandLabel: 'Luma Roast Lab',
        hook: 'داخل دبي فقط خلال 48 ساعة',
        cta: 'عرض التفاصيل',
        language: 'ar',
      },
      caption,
      sourceMatchesTarget: true,
    })

    expect(timeline).toMatchObject({
      template: 'SERVICE_PROMISE',
      sourceLayout: 'FULL_BLEED',
      copy: {
        eyebrow: 'داخل دبي فقط',
        headline: '48 ساعة',
        supporting: 'راجع عنوان التوصيل وتفاصيل الاشتراك قبل الطلب',
      },
    })
    expect(validateProfessionalVideoTimeline(timeline, caption)).toEqual({ ok: true, issues: [] })
  })

  it('builds a grounded service-business brand story from the approved production caption', () => {
    const caption = 'وسطاء العقارات، هل تواجهون تحديات في تنظيم حملاتكم التسويقية؟ 📊 دعونا نحوّل صور عقاراتكم إلى مسودات محتوى قابلة للمراجعة! استراتيجيات مدروسة تبنيها على بياناتكم. #تسويق_عقاري #دبي #حملات_تسويقية'
    const timeline = buildProfessionalVideoTimeline({
      copy: buildMotionDesignCopy({
        brandName: 'Aster Property Marketing',
        caption,
      }),
      caption,
      sourceMatchesTarget: true,
    })

    expect(timeline).toMatchObject({
      template: 'BRAND_STORY',
      copy: {
        brand: 'Aster Property Marketing',
        eyebrow: 'وسطاء العقارات',
        headline: 'دعونا نحوّل صور عقاراتكم إلى',
        supporting: 'استراتيجيات مدروسة تبنيها على بياناتكم',
        cta: 'عرض التفاصيل',
      },
    })
    expect(validateProfessionalVideoTimeline(timeline, caption)).toEqual({ ok: true, issues: [] })
  })

  it('fails closed when a layer introduces an unsupported claim or number', () => {
    const caption = 'داخل دبي فقط خلال 48 ساعة.'
    const timeline = buildProfessionalVideoTimeline({
      copy: {
        brandLabel: 'Luma Roast Lab',
        hook: 'داخل دبي فقط خلال 48 ساعة',
        cta: 'عرض التفاصيل',
        language: 'ar',
      },
      caption,
    })
    timeline.copy.supporting = 'توصيل مجاني خلال 24 ساعة'

    const result = validateProfessionalVideoTimeline(timeline, caption)
    expect(result.ok).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNGROUNDED_COPY' }),
      expect.objectContaining({ code: 'UNAPPROVED_NUMBER' }),
    ]))
  })
})
