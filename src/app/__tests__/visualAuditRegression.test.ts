import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('visual audit regressions', () => {
  it('uses actual post-media readiness on the campaign surface', () => {
    const campaign = source('src/app/campaigns/[id]/page.tsx')

    expect(campaign).toContain('${readyPostMediaSlots}/${totalPostMediaSlots} media ready')
    expect(campaign).toContain('mediaReady: readyPostMediaSlots')
    expect(campaign).toContain('mediaPending: pendingPostMediaSlots')
  })

  it('uses correct approval grammar for one decision', () => {
    const approvals = source('src/app/approvals/page.tsx')

    expect(approvals).toContain("'1 decision needs review'")
    expect(approvals).toContain('pendingTotal === 1')
  })

  it('keeps the assistant off public and print surfaces', () => {
    const widget = source('src/components/ui/ChatWidget.tsx')

    expect(widget).toContain("pathname.startsWith('/lead-form/')")
    expect(widget).toContain("pathname.startsWith('/share/')")
    expect(widget).toContain("/^\\/campaigns\\/[^/]+\\/print\\/?$/.test(pathname)")
  })

  it('does not expose implementation flags in CRM copy', () => {
    const alerts = source('src/app/leads/alerts/page.tsx')
    const lifecycle = source('src/app/leads/lifecycle/page.tsx')

    expect(alerts).not.toContain('outreachTriggered=false')
    expect(lifecycle).not.toContain('sendsEnabled=false')
    expect(lifecycle).not.toContain('LIFECYCLE_MESSAGING_ENABLED')
    expect(lifecycle).toContain('Provider connection, sender verification, and audited consent')
  })

  it('requires an eligible paid strategy before offering execution', () => {
    const paid = source('src/app/paid-campaigns/page.tsx')

    expect(paid).toContain("primaryHref={hasApprovedPaidSource ? '/paid-campaigns/new' : null}")
    expect(paid).toContain('Create and approve a Paid strategy first')
    expect(paid).toContain('{hasApprovedPaidSource ? (')
  })

  it('distinguishes runtime heartbeat from workflow incidents', () => {
    const operations = source('src/components/operations/OperationsCenterPage.tsx')

    expect(operations).toContain('Heartbeat running')
    expect(operations).toContain('workflow incidents are tracked separately')
  })

  it('uses branded recovery states without emoji placeholders', () => {
    const campaign = source('src/app/campaigns/[id]/page.tsx')
    const publicForm = source('src/app/lead-form/[publicId]/page.tsx')

    expect(campaign).not.toContain('<div className="text-5xl mb-4">😕</div>')
    expect(campaign).toContain('This campaign may have been removed')
    expect(publicForm).toContain('This form is unavailable')
    expect(publicForm).toContain('Back to NEXUS')
  })
})
