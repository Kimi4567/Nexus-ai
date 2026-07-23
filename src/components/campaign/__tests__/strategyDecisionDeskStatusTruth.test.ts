import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('strategy decision desk channel truth', () => {
  it('checks not_connected before the connected substring', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )
    const functionSource = source.slice(
      source.indexOf('function statusCopy'),
      source.indexOf('function readField'),
    )

    expect(functionSource.indexOf("normalized.includes('not_connected')"))
      .toBeLessThan(functionSource.indexOf("normalized.includes('ready') || normalized.includes('connected')"))
    expect(functionSource).toContain("'Not connected'")
    expect(functionSource).toContain("'Execution ready'")
  })

  it('does not call a partial paid package complete', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )

    expect(source).toContain('paidPlanning.audienceHypotheses.length === 3')
    expect(source).toContain('paidPlanning.adAngles.length === 4')
    expect(source).toContain('paidPlanning.adCopyVariations.length === 9')
    expect(source).toContain('paidPlanning.creativeBriefs.length === 4')
    expect(source).toContain("'Incomplete — not approvable'")
    expect(source).toContain('3 + 4 + 9 + 4 complete.')
  })

  it('renders every paid deliverable family instead of count-only cards', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
      'utf8',
    )

    expect(source).toContain('Show ${paidPlanning.audienceHypotheses?.length || 0} audience hypotheses')
    expect(source).toContain('Show ${paidPlanning.adAngles?.length || 0} ad angles')
    expect(source).toContain('Show ${paidPlanning.creativeBriefs?.length || 0} creative briefs')
    expect(source).toContain('Show ${paidPlanning.adCopyVariations.length} ad-copy variations')
  })

  it('makes the promised planning horizon and exit gates visible on the decision desk', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )

    expect(source).toContain('Planning-horizon roadmap')
    expect(source).toContain('Exit gate:')
    expect(source).toContain('do not treat the horizon promise as fulfilled')
  })

  it('uses field and media-type counts instead of misleading percentages or image-only totals', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )

    expect(source).toContain('Identity fields ${identityFieldCount}/${identityFieldTotal}')
    expect(source).toContain('images · ${creativeSummary.videoNeeded || 0} videos need media')
    expect(source).not.toContain('Identity coverage ${brandScore}%')
  })

  it('keeps a blocked next decision visible in summary mode with a recovery action', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )

    expect(source).toContain('nextActionError')
    expect(source).toContain('role="alert"')
    expect(source).toContain('onNextActionRecovery')
  })

  it('does not call a passed quality review an approval before the decision is recorded', () => {
    const deskSource = readFileSync(
      path.join(process.cwd(), 'src/components/campaign/StrategyDecisionDesk.tsx'),
      'utf8',
    )
    const pageSource = readFileSync(
      path.join(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
      'utf8',
    )

    expect(deskSource).toContain("snapshot.approvalState === 'approved'")
    expect(deskSource).toContain('Quality review passed; the strategy approval decision is still required.')
    expect(pageSource).toContain("stage: 'paid_plan_review'")
    expect(pageSource).toContain('No organic content plan belongs to this run.')
    expect(pageSource).toContain('operatingState={decisionDeskOperatingState}')
  })
})
