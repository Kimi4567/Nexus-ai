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

  it('recursively guards generated post fields', () => {
    const guarded = guardContentDraftTruth({
      caption: 'Customer Testimonials: perfect brew every time with quick delivery guaranteed.',
      creative: {
        imagePrompt: 'Show award-winning coffee delivered to your doorstep.',
        videoPrompt: 'Feature the finest coffee and promptly delivery where available.',
      },
    })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('Proof to collect')
    expect(joined).toContain('more consistent brew')
    expect(joined).toContain('supported zones')
    expect(joined).toContain('quality-focused')
    expect(joined).toContain('delivery where available')
    expect(joined).toContain('carefully selected coffee')
    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('quick delivery guaranteed')
    expect(joined).not.toContain('delivered to your doorstep')
    expect(joined).not.toContain('finest coffee')
    expect(joined).not.toContain('promptly delivery')
  })

  it('documents the draft-only content plan policy', () => {
    const prompt = buildContentDraftTruthPolicyPrompt()

    expect(prompt).toContain('draft content for review only')
    expect(prompt).toContain('Nothing is approved, scheduled, published, or active')
    expect(prompt).toContain('where available')
    expect(prompt).toContain('productivity, morale, focus, energy, team performance')
    expect(prompt).toContain('easier planning, more consistent coffee routines')
    expect(prompt).toContain('إنتاجية')
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
