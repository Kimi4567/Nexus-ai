import { describe, expect, it } from 'vitest'
import {
  ensureContentPlanConversionHandoff,
  validateContentPlanSemanticAlignment,
} from '@/lib/contentPlanSemanticGuard'

const dentalStrategy = {
  keyMessage: 'Make the first dental consultation easier to understand',
  primaryOffer: 'Book a dental consultation',
  contentPillars: ['dental education', 'consultation preparation', 'treatment options'],
  contentAnglesDetailed: [
    { title: 'Questions to ask at a dental consultation', hook: 'Not sure what to ask your dentist?', cta: 'Save the questions' },
    { title: 'Understanding treatment options', hook: 'Compare the next steps', cta: 'Book a consultation' },
  ],
}

describe('contentPlanSemanticGuard', () => {
  it('blocks clinic-software operations drift for a dental provider and keeps the batch unsaved', () => {
    const result = validateContentPlanSemanticAlignment([
      { caption: 'The front desk feels the handoff problem before leadership sees it. Map the workflow and bring the checklist to the next team meeting.' },
      { caption: 'Use one shared format: request, owner, last update, and next admin step for every appointment.' },
    ], dentalStrategy, {
      brandFacts: ['Noura Dental Studio', 'A local dental clinic offering consultations'],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unexpected_operational_saas_drift')
  })

  it('accepts drafts that remain grounded in the reviewed dental angles', () => {
    const result = validateContentPlanSemanticAlignment([
      { caption: 'Not sure what to ask your dentist? Save three questions for your first dental consultation.' },
      { caption: 'Understanding treatment options starts with comparing the next steps. Book a dental consultation to discuss your options.' },
    ], dentalStrategy, {
      brandFacts: ['Noura Dental Studio', 'Dental consultations and treatment planning'],
    })

    expect(result.ok).toBe(true)
    expect(result.alignedPosts).toBe(2)
  })

  it('requires a real conversion handoff when Brand Brain defines one', () => {
    const conversionDestination = 'صفحة هبوط مع نموذج حجز Demo ثم واتساب أو تقويم المبيعات'
    const missing = validateContentPlanSemanticAlignment([
      { caption: 'تعبت من تأخر الفواتير؟ تعرّف على طريقة تنظيم متابعة الفواتير.' },
      { caption: 'راجع مؤشرات التدفق النقدي بوضوح أكبر.' },
    ], {
      keyMessage: 'وضوح التدفق النقدي وإدارة الفواتير',
      contentAnglesDetailed: [
        { title: 'متابعة الفواتير' },
        { title: 'التدفق النقدي' },
      ],
    }, {
      brandFacts: ['منصة لإدارة الفواتير والتدفق النقدي'],
      conversionDestination,
    })

    expect(missing.ok).toBe(false)
    expect(missing.issues.map(issue => issue.reason)).toContain('missing_conversion_handoff')

    const grounded = validateContentPlanSemanticAlignment([
      { caption: 'تعبت من تأخر الفواتير؟ تعرّف على طريقة تنظيم متابعة الفواتير.' },
      { caption: 'راجع التدفق النقدي، ثم احجز Demo عبر نموذج صفحة الهبوط واختر واتساب أو تقويم المبيعات للمتابعة.' },
    ], {
      keyMessage: 'وضوح التدفق النقدي وإدارة الفواتير',
      contentAnglesDetailed: [
        { title: 'متابعة الفواتير' },
        { title: 'التدفق النقدي' },
      ],
    }, {
      brandFacts: ['منصة لإدارة الفواتير والتدفق النقدي'],
      conversionDestination,
    })

    expect(grounded.ok).toBe(true)
  })

  it('deterministically adds the verified Brand Brain handoff to the conversion-stage draft', () => {
    const conversionDestination = 'صفحة هبوط ثنائية اللغة مع نموذج حجز Demo، ثم تحويل العميل المؤهل إلى واتساب أو تقويم المبيعات'
    const strategy = {
      contentAnglesDetailed: [
        { title: 'وعي بالمشكلة', funnelStage: 'awareness' },
        { title: 'مراجعة الفواتير', funnelStage: 'consideration' },
        { title: 'قرار التجربة', funnelStage: 'conversion' },
      ],
    }
    const posts = ensureContentPlanConversionHandoff([
      { contentPlanIndex: 1, caption: 'راجع رؤية التدفق النقدي.' },
      { contentPlanIndex: 2, caption: 'راجع أيام تحصيل الفواتير.' },
      { contentPlanIndex: 3, caption: 'واجهة عربية لمراجعة التدفق النقدي.' },
    ], strategy, conversionDestination)

    expect(posts[0].caption).toBe('راجع رؤية التدفق النقدي.')
    expect(posts[2].caption).toContain('احجز Demo عبر نموذج صفحة الهبوط')
    expect(posts[2].caption).toContain('واتساب أو تقويم المبيعات')
    expect(validateContentPlanSemanticAlignment(posts, strategy, {
      brandFacts: ['منصة لإدارة الفواتير والتدفق النقدي'],
      conversionDestination,
    }).issues.map(issue => issue.reason)).not.toContain('missing_conversion_handoff')
  })

  it('does not classify a normal delivery handoff as operational SaaS drift', () => {
    const coffeeStrategy = {
      keyMessage: 'Monthly coffee subscription delivery in Dubai',
      contentAnglesDetailed: [{
        title: 'Review the monthly delivery details',
        cta: 'Compare the subscription terms',
      }],
    }
    const result = validateContentPlanSemanticAlignment([
      {
        caption: 'Review the delivery handoff details for the monthly coffee subscription in Dubai, then compare the subscription terms.',
      },
    ], coffeeStrategy, {
      brandFacts: ['Monthly coffee subscription with delivery limited to Dubai'],
    })

    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('blocks workflow ownership drift in a coffee video prompt', () => {
    const coffeeStrategy = {
      keyMessage: 'Monthly coffee subscription delivery in Dubai',
      contentAnglesDetailed: [{
        title: 'Review the monthly delivery details',
        cta: 'Compare the subscription terms',
      }],
    }
    const result = validateContentPlanSemanticAlignment([
      {
        caption: 'Review the monthly coffee delivery details in Dubai.',
        videoPrompt: 'Map the current handoffs and review whether the unified workflow makes ownership clearer.',
      },
    ], coffeeStrategy, {
      brandFacts: ['Monthly coffee subscription with delivery limited to Dubai'],
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      reason: 'unexpected_operational_saas_drift',
      evidence: expect.arrayContaining(['workflow ownership handoff']),
    }))
  })

  it('blocks coffee copy introduced into a cash-flow SaaS image direction', () => {
    const result = validateContentPlanSemanticAlignment([
      {
        caption: 'راجع إدارة الفواتير والتدفق النقدي.',
        imagePrompt: 'Review the documented coffee and subscription details.',
      },
    ], {
      keyMessage: 'إدارة الفواتير والتدفق النقدي',
      contentAnglesDetailed: [{ title: 'إدارة الفواتير' }],
    }, {
      brandFacts: ['B2B SaaS subscription for cash-flow forecasting and invoice management'],
    })

    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      reason: 'unexpected_domain_drift',
      evidence: expect.arrayContaining(['coffee-domain copy in a non-coffee campaign']),
    }))
  })

  it('allows operational language when the saved brand explicitly sells clinic software', () => {
    const strategy = {
      keyMessage: 'Clinic workflow visibility',
      contentAnglesDetailed: [{ title: 'Front desk handoff checklist', cta: 'Request a software demo' }],
    }
    const result = validateContentPlanSemanticAlignment([
      { caption: 'Give the front desk a shared handoff checklist, then request a software demo.' },
    ], strategy, {
      brandFacts: ['ClinicFlow is a clinic management SaaS platform'],
    })

    expect(result.ok).toBe(true)
  })

  it('allows operational language for an explicitly described non-clinic SaaS product', () => {
    const strategy = {
      keyMessage: 'Clear lead ownership and follow-up',
      contentAnglesDetailed: [{ title: 'Review the lead handoff', cta: 'Review the workflow' }],
    }
    const result = validateContentPlanSemanticAlignment([
      { caption: 'Map the current lead handoff and review whether one shared workflow makes ownership clearer.' },
    ], strategy, {
      brandFacts: ['A bilingual lead-management software system for service-business sales teams'],
    })

    expect(result.ok).toBe(true)
  })
})
