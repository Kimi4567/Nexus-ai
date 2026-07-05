import { describe, expect, it } from 'vitest'
import {
  isClinicOperationalSaasContent,
  renderContentPlanDraftCaption,
  validateContentPlanDraftForSave,
  type ContentPlanRenderContext,
} from '@/lib/contentPlanStructuredRenderer'

const clinicCtx: ContentPlanRenderContext = {
  isArabic: true,
  brand: 'ClinicFlow AI',
  campaignName: 'ClinicFlow Arabic launch',
  keyMessage: 'تنظيم المواعيد والمتابعة والتواصل ثنائي اللغة للعيادات',
  targetAudience: 'عيادات صغيرة ومتوسطة',
  contentPillars: ['تنظيم المواعيد', 'متابعة المرضى', 'وضوح العمليات'],
  offer: 'Demo',
  platform: 'META',
  postIndex: 0,
  verifiedProof: [],
}

describe('contentPlanStructuredRenderer', () => {
  it('detects healthcare / clinic SaaS content from strategy context', () => {
    expect(isClinicOperationalSaasContent(clinicCtx, {})).toBe(true)
    expect(isClinicOperationalSaasContent({
      ...clinicCtx,
      brand: 'Roastly',
      campaignName: 'Office coffee routine',
      keyMessage: 'office coffee planning',
      targetAudience: 'office managers',
      contentPillars: ['coffee planning'],
    }, {})).toBe(false)
  })

  it('renders Arabic clinic drafts from a conservative operational template instead of risky model copy', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'ClinicFlow AI يساعدك في تنظيم المواعيد وتحسين كفاءة العمليات. تواصل فعال وسهل مع مرضاك لتحسين الخدمة وزيادة رضاهم وثقتهم.',
    }, clinicCtx)

    expect(caption).toContain('تنظيم المواعيد')
    expect(caption).toContain('المهام الإدارية')
    expect(caption).toContain('مراجعة')
    expect(caption).not.toContain('تحسين كفاءة')
    expect(caption).not.toContain('تواصل فعال')
    expect(caption).not.toContain('تحسين الخدمة')
    expect(caption).not.toContain('رضاهم')
    expect(caption).not.toContain('ثقتهم')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
  })

  it('renders follow-up and bilingual clinic topics without patient-outcome promises', () => {
    const followUp = renderContentPlanDraftCaption({
      caption: 'تعرف على كيفية تحسين متابعة المرضى وتوفير وقتك.',
    }, { ...clinicCtx, postIndex: 1 })
    expect(followUp).toContain('متابعة المرضى إداريًا')
    expect(followUp).not.toContain('تحسين متابعة المرضى')
    expect(followUp).not.toContain('توفير وقتك')

    const bilingual = renderContentPlanDraftCaption({
      caption: 'اكتشف كيف يعزز التواصل ثنائي اللغة رضا المرضى.',
    }, { ...clinicCtx, postIndex: 2 })
    expect(bilingual).toContain('التواصل الإداري ثنائي اللغة')
    expect(bilingual).not.toContain('رضا المرضى')
    expect(validateContentPlanDraftForSave({ caption: followUp }).ok).toBe(true)
    expect(validateContentPlanDraftForSave({ caption: bilingual }).ok).toBe(true)
  })

  it('save gate blocks observed unsafe regenerated clinic claims before SocialPost persistence', () => {
    const result = validateContentPlanDraftForSave({
      caption: 'وضوح العمليات في العيادة يساعد على من كفاءة العمل. اكتشف كيف يسهل ClinicFlow AI التواصل مع المرضى بلغتهم المفضلة، مما يساعد على من رضاهم وثقتهم.',
      imagePrompt: 'Clinic team celebrating guaranteed better patient satisfaction',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_clinic_outcome_claim')
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_absolute_claim')
  })

  it('preserves non-clinic guarded copy instead of forcing the clinic template', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'Choose the right grind size for your brewing method.',
    }, {
      isArabic: false,
      brand: 'Roastly',
      keyMessage: 'coffee education',
      targetAudience: 'home brewers',
      contentPillars: ['education'],
      platform: 'META',
      postIndex: 0,
      verifiedProof: [],
    })

    expect(caption).toBe('Choose the right grind size for your brewing method.')
  })
})
