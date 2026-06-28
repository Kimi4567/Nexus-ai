import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  buildContentDraftTruthPolicyPrompt,
  guardContentDraftText,
  guardContentDraftTruth,
} from '../contentDraftTruthGuard'

describe('contentDraftTruthGuard', () => {
  it('softens luxury and perfection claims in draft captions', () => {
    const luxury = guardContentDraftText('ensuring every coffee break is a moment of luxury')
    expect(luxury).toContain('helping make coffee breaks feel more considered and enjoyable')
    expect(luxury).not.toContain('ensuring every')

    const brew = guardContentDraftText('perfect brew every time')
    expect(brew).toContain('more consistent brew')
    expect(brew).not.toContain('perfect brew every time')
  })

  it('softens English perfection and superlative coffee claims', () => {
    const blend = guardContentDraftText('Discover the perfect blend for your morning routine.')
    expect(blend).toContain('balanced blend')
    expect(blend).not.toContain('perfect blend')

    const finest = guardContentDraftText('Try the finest coffee for small office teams.')
    expect(finest).toContain('carefully selected coffee')
    expect(finest).not.toContain('finest')

    const best = guardContentDraftText('Enjoy the best beans and premium coffee every time.')
    expect(best).toContain('quality-focused beans')
    expect(best).toContain('quality-focused coffee more consistently')
    expect(best).not.toContain('best beans')
    expect(best).not.toContain('premium coffee every time')
  })

  it('softens Perfect for urban life fit claims', () => {
    const out = guardContentDraftText('Perfect for the hustle and bustle of urban life.')

    expect(out).toContain('practical option')
    expect(out).toContain('busy urban routines')
    expect(out).not.toContain('Perfect for')
  })

  it('softens Perfect for those needing reliable coffee claims', () => {
    const out = guardContentDraftText('Perfect for those needing a reliable coffee experience.')

    expect(out).toContain('practical option')
    expect(out).toContain('consistent coffee routine')
    expect(out).not.toContain('Perfect for')
  })

  it('softens perfect choice fit claims', () => {
    const out = guardContentDraftText('The perfect choice for office coffee planning.')

    expect(out).toContain('practical choice for office coffee planning')
    expect(out.toLowerCase()).not.toContain('perfect choice')
  })

  it('softens perfectly roasted claims', () => {
    const out = guardContentDraftText('perfectly roasted beans')

    expect(out).toContain('carefully roasted beans')
    expect(out).not.toContain('perfectly roasted')
  })

  it('softens ensure and stock-planning absolute claims', () => {
    const out = guardContentDraftText(
      'Our convenient delivery service ensures you plan stock more reliably.',
    )

    expect(out).toContain('delivery service can support more reliable stock planning where available')
    expect(out).not.toContain('ensures')
  })

  it('bounds delivery wording to supported availability', () => {
    const doorstep = guardContentDraftText('Fresh coffee delivered to your doorstep.')
    expect(doorstep).toContain('delivery where available')
    expect(doorstep).not.toContain('delivered to your doorstep')

    const quick = guardContentDraftText('quick delivery guaranteed for your office')
    expect(quick).toContain('supported zones')
    expect(quick).not.toContain('guaranteed')
  })

  it('fixes awkward and unbounded delivery claims', () => {
    const awkward = guardContentDraftText('Freshly roasted and promptly delivery where available.')
    expect(awkward).toContain('delivery where available')
    expect(awkward).not.toContain('promptly delivery')

    const doorstep = guardContentDraftText('Coffee delivery to your doorstep.')
    expect(doorstep).toContain('delivery where available')
    expect(doorstep).not.toContain('to your doorstep')
  })

  it('softens always-stocked office claims', () => {
    const out = guardContentDraftText('Ensure your office is always stocked with premium coffee.')

    expect(out).toContain('Help keep your office better stocked with planning support')
    expect(out).not.toContain('Ensure')
    expect(out).not.toContain('always stocked')
  })

  it('softens English productivity and morale outcome claims', () => {
    const out = guardContentDraftText('premium blends can boost productivity and morale')

    expect(out).toContain('office coffee breaks')
    expect(out).not.toContain('boost productivity')
    expect(out).not.toContain('morale')
  })

  it('softens team performance outcome claims', () => {
    const out = guardContentDraftText('Improve team performance with better coffee')

    expect(out).toContain('team coffee planning')
    expect(out).not.toContain('team performance')
  })

  it('softens energy and focus outcome claims', () => {
    const out = guardContentDraftText('Boost energy and focus every morning')

    expect(out).toContain('coffee routine')
    expect(out).not.toContain('Boost energy')
    expect(out).not.toContain('focus')
  })

  it('softens Arabic productivity and morale outcome claims', () => {
    const out = guardContentDraftText('قهوة تساعد على زيادة الإنتاجية ورفع المعنويات')

    expect(out).toContain('روتين قهوة')
    expect(out).toContain('استراحات القهوة')
    expect(out).not.toContain('زيادة الإنتاجية')
    expect(out).not.toContain('رفع المعنويات')
  })

  it('softens Arabic focus and energy outcome claims', () => {
    const out = guardContentDraftText('طاقة مضمونة وتركيز أفضل للفريق')

    expect(out).toContain('تجربة قهوة أكثر انتظامًا')
    expect(out).toContain('روتين قهوة أوضح')
    expect(out).not.toContain('طاقة مضمونة')
    expect(out).not.toContain('تركيز أفضل')
  })

  it('preserves safe coffee planning copy', () => {
    const safe = 'Plan office coffee breaks more easily'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('preserves safe Arabic coffee planning copy', () => {
    const safe = 'خطط لاستراحات القهوة في المكتب بسهولة'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('does not let focus proof unlock productivity or morale claims', () => {
    const out = guardContentDraftText(
      'premium blends can boost productivity and morale',
      { verifiedProof: ['Customer feedback says the coffee helped with focus during morning routines.'] },
    )

    expect(out).toContain('coffee breaks')
    expect(out).not.toContain('boost productivity')
    expect(out).not.toContain('morale')
  })

  it('does not let morale proof unlock team performance claims', () => {
    const out = guardContentDraftText(
      'Improve team performance with better coffee',
      { verifiedProof: ['Employee survey mentioned better morale around coffee breaks.'] },
    )

    expect(out).toContain('team coffee planning')
    expect(out).not.toContain('team performance')
  })

  it('does not let energy proof unlock productivity claims', () => {
    const out = guardContentDraftText(
      'Boost productivity with premium coffee',
      { verifiedProof: ['Customer said the coffee felt energizing.'] },
    )

    expect(out).toContain('coffee break routine')
    expect(out).not.toContain('Boost productivity')
  })

  it('preserves supported productivity wording when exact productivity proof exists', () => {
    const out = guardContentDraftText(
      'Coffee routine may support improved productivity.',
      { verifiedProof: ['User-provided survey: 62% of office staff reported improved productivity after changing coffee routine.'] },
    )

    expect(out).toBe('Coffee routine may support improved productivity.')
    expect(out).not.toContain('guaranteed')
  })

  it('does not let Arabic focus proof unlock productivity or morale claims', () => {
    const out = guardContentDraftText(
      'قهوة تساعد على زيادة الإنتاجية ورفع المعنويات',
      { verifiedProof: ['تعليق عميل: ساعدت القهوة على التركيز في الصباح.'] },
    )

    expect(out).not.toContain('زيادة الإنتاجية')
    expect(out).not.toContain('رفع المعنويات')
    expect(out).toContain('روتين قهوة')
    expect(out).toContain('استراحات القهوة')
  })

  it('softens high-risk Arabic perfection, delivery, stock, and productivity claims', () => {
    const out = guardContentDraftText(
      'المشروب المثالي كل مرة مع توصيل مضمون وتوصيل سريع. المكتب مليان قهوة دائمًا ولا ينفد. طاقة مضمونة ونتائج فورية وإنتاجية مضمونة.',
    )

    expect(out).toContain('قهوة أكثر اتساقًا مع إرشادات أوضح')
    expect(out).toContain('التوصيل حسب المناطق المتاحة')
    expect(out).toContain('توقيت التوصيل يعتمد على الموقع')
    expect(out).toContain('تخطيط أفضل لمخزون القهوة')
    expect(out).toContain('يساعد على تقليل نفاد القهوة')
    expect(out).toContain('تجربة قهوة أكثر انتظامًا')
    expect(out).toContain('دعم روتين عمل أفضل للمراجعة')
    expect(out).not.toContain('المشروب المثالي كل مرة')
    expect(out).not.toContain('توصيل مضمون')
    expect(out).not.toContain('توصيل سريع')
    expect(out).not.toContain('المكتب مليان قهوة دائمًا')
    expect(out).not.toContain('طاقة مضمونة')
    expect(out).not.toContain('نتائج فورية')
    expect(out).not.toContain('إنتاجية مضمونة')
  })

  it('softens Arabic superlatives and doorstep delivery', () => {
    const beans = guardContentDraftText('أفضل حبوب القهوة لتجربة يومية.')
    expect(beans).toContain('حبوب قهوة مختارة بعناية')
    expect(beans).not.toContain('أفضل')

    const doorstep = guardContentDraftText('حبوب طازجة ومحمصة بعناية لتصلك إلى باب منزلك بكل سهولة.')
    expect(doorstep).toContain('التوصيل حسب المناطق المتاحة')
    expect(doorstep).not.toContain('باب منزلك')
  })

  it('softens observed Arabic قهوة مثالية blocker wording', () => {
    const out = guardContentDraftText('اكتشف أسرار صنع قهوة مثالية في المنزل...')

    expect(out).toContain('قهوة متوازنة')
    expect(out).not.toContain('قهوة مثالية')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic تجربة قهوة مثالية wording', () => {
    const out = guardContentDraftText('استمتع بتجربة قهوة مثالية كل صباح')

    expect(out).toContain('تجربة قهوة أكثر اتساقًا')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic نتائج مثالية wording', () => {
    const out = guardContentDraftText('اتبع هذه الخطوات للحصول على نتائج مثالية')

    expect(out).toContain('نتائج أكثر اتساقًا')
    expect(out).not.toContain('نتائج مثالية')
  })

  it('softens Arabic تحضير مثالي wording', () => {
    const out = guardContentDraftText('دليلك لتحضير مثالي للقهوة')

    expect(out).toContain('لتحضير عملي للقهوة')
    expect(out).not.toContain('تحضير مثالي')
  })

  it('softens Arabic خلطة مثالية wording', () => {
    const out = guardContentDraftText('خلطة مثالية لعشاق القهوة')

    expect(out).toContain('خلطة متوازنة لعشاق القهوة')
    expect(out).not.toContain('خلطة مثالية')
  })

  it('softens Arabic التجربة المثالية wording', () => {
    const out = guardContentDraftText('التجربة المثالية تبدأ بخطوات واضحة')

    expect(out).toContain('تجربة أكثر اتساقًا')
    expect(out).not.toContain('المثالية')
  })

  it('softens Arabic النتائج المثالية wording', () => {
    const out = guardContentDraftText('النتائج المثالية تحتاج إلى متابعة')

    expect(out).toContain('نتائج أكثر اتساقًا')
    expect(out).not.toContain('النتائج المثالية')
  })

  it('softens Arabic التحضير المثالي wording', () => {
    const out = guardContentDraftText('التحضير المثالي للقهوة يبدأ بخطوات بسيطة')

    expect(out).toContain('التحضير العملي للقهوة')
    expect(out).not.toContain('التحضير المثالي')
  })

  it('softens Arabic النكهة المثالية wording', () => {
    const out = guardContentDraftText('النكهة المثالية تحتاج إلى حبوب مختارة')

    expect(out).toContain('النكهة المتوازنة')
    expect(out).not.toContain('النكهة المثالية')
  })

  it('softens Arabic الكوب المثالي wording', () => {
    const out = guardContentDraftText('الكوب المثالي يبدأ باختيار القهوة المناسبة')

    expect(out).toContain('الكوب المتوازن')
    expect(out).not.toContain('الكوب المثالي')
  })

  it('softens observed Arabic أفضل نكهة blocker wording', () => {
    const out = guardContentDraftText('لتوفير أفضل نكهة لمحبي القهوة')

    expect(out).toContain('نكهة متوازنة')
    expect(out).not.toContain('أفضل نكهة')
    expect(out).not.toContain('أفضل')
  })

  it('softens observed Arabic بجودة لا تقاوم blocker wording', () => {
    const out = guardContentDraftText('بجودة لا تقاوم')

    expect(out).toContain('بجودة مختارة بعناية')
    expect(out).not.toContain('لا تقاوم')
  })

  it('softens Arabic تجربة لا تقاوم wording', () => {
    const out = guardContentDraftText('استمتع بتجربة لا تقاوم')

    expect(out).toContain('تجربة أكثر اتساقًا')
    expect(out).not.toContain('لا تقاوم')
  })

  it('softens Arabic تجربة قهوة فريدة wording', () => {
    const out = guardContentDraftText('تجربة قهوة فريدة لمحبي القهوة')

    expect(out).toContain('تجربة قهوة أكثر اتساقًا')
    expect(out).not.toContain('فريدة')
  })

  it('softens English irresistible quality wording', () => {
    const out = guardContentDraftText('irresistible quality for coffee lovers')

    expect(out).toContain('carefully selected quality')
    expect(out).not.toContain('irresistible')
  })

  it('softens English extraordinary coffee experience wording', () => {
    const out = guardContentDraftText('an extraordinary coffee experience')

    expect(out).toContain('more consistent coffee experience')
    expect(out).not.toContain('extraordinary')
  })

  it('softens Arabic مثالية لمن fit claims', () => {
    const out = guardContentDraftText('مثالية لمن يحتاج قهوة موثوقة')

    expect(out).toContain('مناسبة')
    expect(out).toContain('تجربة قهوة أكثر اتساقًا')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic الخيار المثالي fit claims', () => {
    const out = guardContentDraftText('الخيار المثالي للمكتب')

    expect(out).toContain('خيار عملي للمكتب')
    expect(out).not.toContain('الخيار المثالي')
  })

  it('softens Arabic no-tatweel مثالي للمكتب fit claims', () => {
    const out = guardContentDraftText('مثالي للمكتب')

    expect(out).toContain('مناسب للمكتب')
    expect(out).not.toContain('مثالي')
  })

  it('softens Arabic no-tatweel مثالية للعائلات fit claims', () => {
    const out = guardContentDraftText('مثالية للعائلات')

    expect(out).toContain('مناسبة للعائلات')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic no-tatweel مثالي لروتين fit claims', () => {
    const out = guardContentDraftText('مثالي لروتين القهوة اليومي')

    expect(out).toContain('مناسب لروتين القهوة اليومي')
    expect(out).not.toContain('مثالي')
  })

  it('softens standalone Arabic الخيار المثالي claims', () => {
    const out = guardContentDraftText('الخيار المثالي')

    expect(out).toContain('خيار عملي')
    expect(out).not.toContain('الخيار المثالي')
  })

  it('softens Arabic guarantee and every-time perfection claims', () => {
    const out = guardContentDraftText('تضمن لك القهوة المثالية كل مرة.')

    expect(out).toContain('تساعد على')
    expect(out).toContain('قهوة أكثر اتساقًا')
    expect(out).not.toContain('تضمن')
    expect(out).not.toContain('المثالية كل مرة')
  })

  it('preserves safe Arabic كل مرة usage', () => {
    const safe = 'اسأل عن درجة الطحن كل مرة تطلب فيها'

    expect(guardContentDraftText(safe)).toBe(safe)
    expect(guardContentDraftText(safe)).not.toContain('بشكل أكثر اتساقًا تطلب فيها')
  })

  it('preserves safe Arabic دائمًا usage', () => {
    const safe = 'راجع درجة الطحن دائمًا قبل الطلب'

    expect(guardContentDraftText(safe)).toBe(safe)
    expect(guardContentDraftText(safe)).not.toContain('بشكل منتظم قبل الطلب')
  })

  it('preserves negative Arabic guarantee disclaimers', () => {
    const out = guardContentDraftText('لا تضمن هذه الخطة نتائج فورية')

    expect(out).toContain('لا تضمن')
    expect(out).not.toContain('لا تساعد على')
  })

  it('preserves negative Arabic تضمن لك disclaimers', () => {
    const out = guardContentDraftText('لا تضمن لك هذه الخطة نتائج فورية')

    expect(out).toContain('لا تضمن لك')
    expect(out).not.toContain('لا تساعد على')
  })

  it('preserves negative Arabic يضمن لك disclaimers', () => {
    const out = guardContentDraftText('لا يضمن لك هذا المحتوى نتائج فورية')

    expect(out).toContain('لا يضمن لك')
    expect(out).not.toContain('لا يساعد على')
  })

  it('still softens positive Arabic تضمن لك guarantee claims', () => {
    const out = guardContentDraftText('تضمن لك القهوة المثالية كل مرة')

    expect(out).toContain('تساعد على')
    expect(out).toContain('قهوة أكثر اتساقًا')
    expect(out).not.toContain('تضمن لك')
    expect(out).not.toContain('المثالية كل مرة')
  })

  it('still softens risky Arabic stock absolutes', () => {
    const out = guardContentDraftText('المكتب مليان قهوة دائمًا')

    expect(out).toContain('تخطيط أفضل لمخزون القهوة')
    expect(out).not.toContain('مليان قهوة دائمًا')
  })

  it('bounds Arabic doorstep and next-day delivery wording', () => {
    const out = guardContentDraftText('توصيل لباب البيت وتوصيل في اليوم التالي.')

    expect(out).toContain('التوصيل حسب المناطق المتاحة')
    expect(out).toContain('التوصيل في اليوم التالي حيثما توفر')
    expect(out).not.toContain('توصيل لباب البيت')
    expect(out).not.toContain('توصيل في اليوم التالي.')
  })

  it('rewrites the observed awkward team-planning phrase', () => {
    const out = guardContentDraftText('Support more reliable team planning has access to great coffee.')

    expect(out).toBe('Help teams plan better office coffee routines.')
    expect(out).not.toContain('Support more reliable team planning has access')
  })

  it('preserves safe educational coffee guidance', () => {
    const safe = 'Choose the right grind size for your brewing method.'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('preserves safe Arabic educational coffee guidance', () => {
    const safe = 'اختر درجة الطحن المناسبة لطريقة التحضير'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('preserves safe Arabic educational fit wording', () => {
    const safe = 'اختر درجة الطحن المناسبة لطريقة التحضير'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('recursively guards generated post fields', () => {
    const guarded = guardContentDraftTruth({
      caption: 'Customer Testimonials: perfect brew every time and Perfect for busy teams with quick delivery guaranteed.',
      creative: {
        imagePrompt: 'Show award-winning coffee delivered to your doorstep with perfectly roasted beans.',
        videoPrompt: 'Feature the finest coffee, perfect choice for office coffee planning, and promptly delivery where available.',
      },
    })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('Proof to collect')
    expect(joined).toContain('more consistent brew')
    expect(joined).toContain('supported zones')
    expect(joined).toContain('quality-focused')
    expect(joined).toContain('delivery where available')
    expect(joined).toContain('carefully selected coffee')
    expect(joined).toContain('carefully roasted beans')
    expect(joined).toContain('practical choice for office coffee planning')
    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('Perfect for')
    expect(joined).not.toContain('quick delivery guaranteed')
    expect(joined).not.toContain('delivered to your doorstep')
    expect(joined).not.toContain('finest coffee')
    expect(joined).not.toContain('perfect choice')
    expect(joined).not.toContain('perfectly roasted')
    expect(joined).not.toContain('promptly delivery')
  })

  it('documents the draft-only content plan policy', () => {
    const prompt = buildContentDraftTruthPolicyPrompt()

    expect(prompt).toContain('draft content for review only')
    expect(prompt).toContain('Nothing is approved, scheduled, published, or active')
    expect(prompt).toContain('where available')
    expect(prompt).toContain('productivity, morale, focus, energy, team performance')
    expect(prompt).toContain('easier planning, more consistent coffee routines')
    expect(prompt).toContain('Perfect for...')
    expect(prompt).toContain('مثالي/مثالية')
    expect(prompt).toContain('إنتاجية')
    expect(prompt).toContain('أفضل نكهة')
    expect(prompt).toContain('irresistible')
  })

  it('analytics insight copy no longer says ready to activate for draft campaigns', () => {
    const insightsRoute = readFileSync(
      path.join(process.cwd(), 'src/app/api/analytics/insights/route.ts'),
      'utf8',
    )

    expect(insightsRoute).not.toContain('ready to activate')
    expect(insightsRoute).toContain('review before scheduling')
  })
})
