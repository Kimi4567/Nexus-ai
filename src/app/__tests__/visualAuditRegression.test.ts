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

  it('keeps the assistant away from RTL heading starts on mobile and the desktop sidebar', () => {
    const widget = source('src/components/ui/ChatWidget.tsx')

    expect(widget).toContain('end-4')
    expect(widget).toContain('sm:end-auto sm:right-6')
    expect(widget).not.toContain('bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4')
  })

  it('hides the assistant while the mobile navigation drawer is open', () => {
    const shell = source('src/components/AppShell.tsx')
    const styles = source('src/app/globals.css')

    expect(shell).toContain("data-nexus-mobile-navigation-open")
    expect(styles).toContain("html[data-nexus-mobile-navigation-open] .chat-btn")
    expect(styles).toContain("html[data-nexus-mobile-navigation-open] .chat-panel")
  })

  it('keeps internal evidence keys and English flow copy out of the Arabic presentation', () => {
    const analytics = source('src/app/analytics/page.tsx')
    const learning = source('src/app/learning/page.tsx')
    const landingPages = source('src/app/landing-pages/page.tsx')
    const connections = source('src/app/connections/page.tsx')

    expect(analytics).toContain("measurementEvidenceLabel(helper, ar ? 'ar' : 'en')")
    expect(learning).toContain("measurementEvidenceLabel(String(evidence), ar ? 'ar' : 'en')")
    expect(learning).not.toContain('causalClaim=false</p>')
    expect(learning).toContain("BRAND_PROFILE_UPDATED: ['تم تحديث ملف العلامة', 'Brand profile updated']")
    expect(learning).toContain('workflowActorLabel(event.actor, ar)')
    expect(learning).not.toContain('{event.actor}</p>')
    expect(landingPages).toContain('حملة · صفحة هبوط · زر أو نموذج · عميل محتمل · إرسال يؤكده الخادم')
    expect(connections).toContain('PROVIDER_TEST_BOUNDARY_AR')
    expect(connections).toContain('providerTestBoundary(provider, ar)')
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
    expect(paid.match(/\{hasApprovedPaidSource \? \(/g)).toHaveLength(2)
  })

  it('distinguishes runtime heartbeat from workflow incidents', () => {
    const operations = source('src/components/operations/OperationsCenterPage.tsx')

    expect(operations).toContain('Heartbeat running')
    expect(operations).toContain('workflow incidents are tracked separately')
  })

  it('uses branded recovery states without emoji placeholders', () => {
    const campaign = source('src/app/campaigns/[id]/page.tsx')
    const publicFormNotFound = source('src/app/lead-form/[publicId]/not-found.tsx')

    expect(campaign).not.toContain('<div className="text-5xl mb-4">😕</div>')
    expect(campaign).toContain('This campaign may have been removed')
    expect(publicFormNotFound).toContain('This form is unavailable')
    expect(publicFormNotFound).toContain('Back to NEXUS')
  })

  it('keeps the public lead-form honeypot visually hidden without creating page overflow', () => {
    const publicForm = source('src/app/lead-form/[publicId]/PublicLeadFormClient.tsx')

    expect(publicForm).toContain('<label aria-hidden="true" className="sr-only">Website')
    expect(publicForm).not.toContain('-start-[9999px]')
  })

  it('localizes the Arabic CRM journey instead of exposing internal English states', () => {
    const nav = source('src/components/leads/LeadsNav.tsx')
    const leads = source('src/app/leads/page.tsx')
    const forms = source('src/app/leads/forms/page.tsx')
    const lifecycle = source('src/app/leads/lifecycle/page.tsx')

    expect(nav).toContain("ar: 'دورة المتابعة'")
    expect(nav).not.toContain("ar: 'Lifecycle'")
    expect(leads).toContain('موافقة موثقة وليست مفترضة')
    expect(forms).toContain('داخل مساحة العمل فقط')
    expect(lifecycle).toContain("pageTitle={ar ? 'رسائل دورة المتابعة'")
    expect(lifecycle).toContain('messageStatusLabel(message.status, ar)')
    expect(lifecycle).toContain('localizedLabel(DELIVERY_BLOCKER_LABELS, blocker, ar)')
    expect(lifecycle).not.toContain('APPROVED COPY')
    expect(lifecycle).not.toContain('>DELIVERY BLOCKED<')
  })

  it('keeps internal analytics keys out of explanatory product copy', () => {
    const analytics = source('src/app/analytics/page.tsx')
    const scoreHistory = source('src/app/brand/score-history/page.tsx')
    const campaigns = source('src/app/campaigns/page.tsx')

    expect(analytics).not.toContain('until analyticsData')
    expect(scoreHistory).not.toContain('توفر analyticsData')
    expect(scoreHistory).toContain('changeCountLabel(milestones.length, ar)')
    expect(campaigns).not.toContain('requires real analyticsData')
  })

  it('keeps an existing unreviewed strategy behind the portfolio quality gate', () => {
    const campaigns = source('src/app/campaigns/page.tsx')

    expect(campaigns).toContain(
      "campaign.strategySummary?.hasStrategy && campaign.strategySummary.qualityState !== 'passed'",
    )
    expect(campaigns).toContain("'Quality review required'")
  })

  it('provides a truthful recovery action when a content workspace is missing', () => {
    const contentHub = source('src/app/campaigns/[id]/content-hub/page.tsx')

    expect(contentHub).toContain('مساحة إنتاج الحملة غير متاحة')
    expect(contentHub).toContain('No content was created and no credits were charged.')
    expect(contentHub).toContain("router.push('/campaigns')")
  })

  it('uses the shared icon system for the media library summary', () => {
    const media = source('src/app/media/page.tsx')

    expect(media).toContain("import { Images } from 'lucide-react'")
    expect(media).toContain('<Images className="h-5 w-5" />')
    expect(media).not.toContain('aria-hidden="true">🖼️')
  })
})
