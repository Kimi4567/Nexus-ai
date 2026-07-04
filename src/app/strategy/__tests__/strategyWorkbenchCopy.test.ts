import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/app/strategy/page.tsx', 'utf8')

describe('/strategy workbench source-of-truth copy', () => {
  it('frames the page as a workbench and points to the campaign brief for full strategy review', () => {
    expect(source).toContain('Strategy Workbench')
    expect(source).toContain('Campaign strategy brief')
    expect(source).toContain('Review Brand Brain readiness for new requests')
    expect(source).toContain('The full strategy brief lives inside the campaign')
    expect(source).toContain('The full strategy brief, assumptions, limits, and execution decisions live inside the campaign page.')
    expect(source).toContain('Open full brief')
  })

  it('separates new-request readiness from the current campaign scope', () => {
    expect(source).toContain('Brand Brain readiness for new requests')
    expect(source).toContain('This is input readiness for a new strategy request. It does not change the current campaign scope')
    expect(source).toContain('New organic request')
    expect(source).toContain('New full request')
    expect(source).toContain('New paid planning request')
    expect(source).toContain('Current campaign strategy')
    expect(source).toContain('Workstation hierarchy')
  })

  it('keeps Content Hub actions scoped to the active campaign when a recent campaign exists', () => {
    expect(source).toContain("const recentContentHubHref = recent?.id ? `/campaigns/${recent.id}/content-hub` : '/content-hub'")
    expect(source).toContain('href={recentContentHubHref}')
    expect(source).toContain('Open campaign Content Hub')
  })

  it('keeps strategy update copy tied to cost review before credits are spent', () => {
    expect(source).toContain('Update strategy after cost review')
    expect(source).not.toContain('Run updated strategy')
  })

  it('uses planning-safe paid brief copy instead of campaign-launch wording', () => {
    expect(source).toContain('Paid Planning Brief')
    expect(source).toContain('Paid planning stays review-only until budget, conversion path, tracking, account readiness, and explicit approval are confirmed.')
    expect(source).toContain('بريف التخطيط المدفوع')
    expect(source).toContain('يبقى التخطيط المدفوع للمراجعة فقط')
    expect(source).not.toContain('Paid Campaign Plan')
    expect(source).not.toContain('خطة الحملات المدفوعة')
  })

  it('does not describe an existing strategy as broadly ready to continue', () => {
    expect(source).toContain('Strategy direction is available for review.')
    expect(source).toContain('اتجاه الاستراتيجية متاح للمراجعة.')
    expect(source).not.toContain('Your strategy is ready to continue.')
    expect(source).not.toContain('استراتيجيتك جاهزة للمتابعة.')
  })

  it('warns when the existing strategy draft does not match the current Brand Brain', () => {
    expect(source).toContain('Existing draft may not match current Brand Brain')
    expect(source).toContain('Update strategy for current Brand Brain')
    expect(source).toContain('this draft does not appear to match')
    expect(source).toContain('Do not use the old draft direction for the new brand')
  })
})
