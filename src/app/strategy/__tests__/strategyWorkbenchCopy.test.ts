import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/strategy/page.tsx', 'utf8')

describe('/strategy workbench source-of-truth copy', () => {
  it('frames the page as a workbench and points to the campaign brief for full strategy review', () => {
    expect(source).toContain('this page is the strategy workbench')
    expect(source).toContain('Open campaign strategy brief')
    expect(source).toContain('The full strategy brief lives inside the campaign')
    expect(source).toContain('Use this page as a strategy workbench, then open the campaign brief for detailed review.')
    expect(source).toContain("const recentStrategyHref = recent?.id ? `/campaigns/${recent.id}?tab=strategy` : '/campaigns'")
  })

  it('separates new-request readiness from the current campaign scope', () => {
    expect(source).toContain('New organic request')
    expect(source).toContain('New full request')
    expect(source).toContain('New paid planning request')
    expect(source).toContain('Strategy linked to campaign:')
    expect(source).toContain('Strategy not created yet')
    expect(source).toContain('Publishing automation')
  })

  it('keeps Content Hub actions scoped to the active campaign when a recent campaign exists', () => {
    expect(source).toContain("const recentContentHubHref = recent?.id ? `/campaigns/${recent.id}/content-hub` : '/content-hub'")
    expect(source).toContain('primaryHref={recentContentHubHref}')
    expect(source).toContain('Open Content Hub')
    expect(source).toContain('Ready to create')
    expect(source).toContain('Move to Content Hub to create reviewable drafts.')
    expect(source).not.toContain('Move to Content Hub to review the draft content.')
  })

  it('keeps strategy update copy tied to cost review before credits are spent', () => {
    expect(source).toContain('Update strategy for current Brand Brain')
    expect(source).toContain('Cost is confirmed before any credits are spent.')
    expect(source).not.toContain('Run updated strategy')
  })

  it('uses planning-safe paid brief copy instead of campaign-launch wording', () => {
    expect(source).toContain('Paid planning brief')
    expect(source).toContain('This is a paid planning brief for review only. It does not create an organic Content Hub plan or launch ads.')
    expect(source).toContain('Open the current paid planning brief. Execution, spend, and publishing remain separate locked steps.')
    expect(source).toContain('بريف تخطيط مدفوع')
    expect(source).not.toContain('Paid Campaign Plan')
    expect(source).not.toContain('خطة الحملات المدفوعة')
  })

  it('does not show a paid planning brief as current scope for organic-only strategies', () => {
    expect(source).toContain('const includesPaidPlanning = strategyScope.includesPaid')
    expect(source).toContain('Paid planning is not included; run Paid or Full later if needed')
    expect(source).toContain('Prepare paid planning only after readiness and approval')
    expect(source).toContain('No organic Content Hub plan was created by this run')
  })

  it('does not describe an existing strategy as broadly ready to continue', () => {
    expect(source).toContain('Draft strategy ready for review')
    expect(source).toContain('Numbers here are operational readiness, not actual performance.')
    expect(source).not.toContain('Your strategy is ready to continue.')
    expect(source).not.toContain('استراتيجيتك جاهزة للمتابعة.')
  })

  it('warns when the existing strategy draft does not match the current Brand Brain', () => {
    expect(source).toContain('Existing draft may not match current Brand Brain')
    expect(source).toContain('Update strategy for current Brand Brain')
    expect(source).toContain('The existing draft appears tied to a previous Brand Brain')
    expect(source).toContain('Do not use the old draft direction for the new brand')
  })
})
