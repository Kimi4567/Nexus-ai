import { describe, expect, it } from 'vitest'
import {
  formatBrandBrainGenerationSafetyNote,
  getBrandBrainGenerationFieldLabel,
  getBrandBrainGenerationSafety,
} from '@/lib/brandBrainGenerationSafety'

const clinicProfile = {
  brandName: 'ClinicFlow AI',
  industry: 'تقنية وتطبيقات',
  description: 'B2B SaaS for clinics that organizes appointments, reminders, patient follow-up tasks, and bilingual communication.',
  primaryOffer: 'Clinic operations SaaS for front-desk workflows.',
  targetAudience: 'Clinic owners and practice managers.',
  audiencePainPoints: ['Missed appointments', 'Manual front-desk handoffs'],
  uniqueAdvantages: ['Arabic-English workflow support'],
  businessGoal: 'Generate qualified demo requests from clinic owners.',
}

describe('getBrandBrainGenerationSafety', () => {
  it('excludes stale home-cleaning fields from a clinic SaaS Brand Brain generation context', () => {
    const safety = getBrandBrainGenerationSafety({
      ...clinicProfile,
      leadHandling: 'Reply within business hours, confirm area, apartment/villa size, service type, preferred date/time, pets/access notes, eco-product preference, and recurring-plan interest before sending a quote.',
      customerObjections: [
        'Can I trust the team in my home?',
        'Can you handle my preferred Dubai neighborhood and timing?',
        'Will recurring cleaning be consistent?',
      ],
      salesCycleLength: 'Same day to 3 days for standard bookings; move-in/move-out may require more coordination.',
      seasonality: 'Higher demand before holidays, before guests arrive, lease move-in/move-out windows, and after travel periods.',
    })

    expect(safety.anchorCategory).toBe('clinicOperationsSaas')
    expect(safety.excludedFields).toEqual([
      'leadHandling',
      'customerObjections',
      'salesCycleLength',
      'seasonality',
    ])
    expect(safety.safeProfile.leadHandling).toBeNull()
    expect(safety.safeProfile.customerObjections).toEqual([])
    expect(safety.safeProfile.businessGoal).toBe('Generate qualified demo requests from clinic owners.')
  })

  it('keeps clinic-relevant paid and funnel fields when they match the anchor category', () => {
    const safety = getBrandBrainGenerationSafety({
      ...clinicProfile,
      marketingBudget: 'AED 12,000/month planning assumption only; not approved spend.',
      conversionDestination: 'WhatsApp booking link plus website booking form.',
      leadHandling: 'Operations specialist qualifies demo requests, confirms clinic size, appointment volume, and follow-up workflow before booking a demo.',
      customerObjections: [
        'Will this disrupt the front-desk team?',
        'Does it support Arabic and English patient communication?',
      ],
      complianceNotes: 'Do not claim diagnosis, treatment advice, clinical outcomes, or guaranteed no-show reduction.',
    })

    expect(safety.excludedFields).toEqual([])
    expect(safety.safeProfile.leadHandling).toContain('demo requests')
    expect(safety.safeProfile.customerObjections).toHaveLength(2)
  })

  it('does not over-filter when the anchor category is unknown', () => {
    const safety = getBrandBrainGenerationSafety({
      brandName: 'New Brand',
      industry: 'Services',
      leadHandling: 'Reply within business hours and qualify the request.',
    })

    expect(safety.anchorCategory).toBe('unknown')
    expect(safety.excludedFields).toEqual([])
    expect(safety.safeProfile.leadHandling).toBe('Reply within business hours and qualify the request.')
  })

  it('does not classify interior design as home cleaning from generic property words', () => {
    const safety = getBrandBrainGenerationSafety({
      brandName: 'Dar Sukna Interior Design',
      industry: 'Home & Furniture',
      description: 'Interior design and renovation for apartments and villas.',
      primaryOffer: 'Space planning, 3D visualization, materials schedule, and execution supervision.',
      targetAudience: 'Apartment and villa owners in Dubai.',
      leadHandling: 'A business-development owner reviews the property, scope, and expected appointment before a discovery call.',
    })

    expect(safety.anchorCategory).toBe('unknown')
    expect(safety.excludedFields).toEqual([])
    expect(safety.safeProfile.leadHandling).toContain('business-development')
  })

  it('formats a prompt-safe note without leaking excluded field values', () => {
    const safety = getBrandBrainGenerationSafety({
      ...clinicProfile,
      leadHandling: 'Confirm apartment/villa size before sending a quote.',
    })

    const note = formatBrandBrainGenerationSafetyNote(safety)
    expect(note).toContain('leadHandling')
    expect(note).not.toContain('apartment/villa')
    expect(note).toContain('needing user review')
  })

  it('returns safe user-facing field labels without exposing stale values', () => {
    expect(getBrandBrainGenerationFieldLabel('leadHandling', 'en')).toBe('Lead handling')
    expect(getBrandBrainGenerationFieldLabel('leadHandling', 'ar')).toBe('إدارة العملاء المحتملين')
    expect(getBrandBrainGenerationFieldLabel('seasonality', 'ar')).toBe('الموسمية')
  })
})
