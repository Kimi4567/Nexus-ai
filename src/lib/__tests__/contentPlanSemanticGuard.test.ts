import { describe, expect, it } from 'vitest'
import { validateContentPlanSemanticAlignment } from '@/lib/contentPlanSemanticGuard'

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
