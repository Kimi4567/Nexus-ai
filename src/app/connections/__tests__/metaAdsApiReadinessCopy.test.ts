import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const connectionsSource = readFileSync('src/app/connections/page.tsx', 'utf8')
const i18nSource = readFileSync('src/lib/i18n-context.tsx', 'utf8')

describe('/connections Meta Ads API readiness copy', () => {
  it('separates OAuth connection from reviewed API execution', () => {
    expect(connectionsSource).toContain('Connecting does not publish anything automatically.')
    expect(connectionsSource).toContain('Paid ads require platform permission, approved budget, and explicit launch approval.')
    expect(i18nSource).toContain('OAuth connection does not mean API execution')
    expect(i18nSource).toContain('ربط OAuth لا يعني أن تنفيذ API')
    expect(i18nSource).toContain('Meta App Review must be approved')
    expect(i18nSource).toContain('اعتماد Meta App Review')
  })

  it('keeps API readiness as a read-only operator-reviewed state for users', () => {
    expect(i18nSource).toContain('admin-only path after Meta approval evidence')
    expect(i18nSource).toContain('مسار إداري فقط بعد دليل موافقة Meta')
    expect(connectionsSource).toContain('Read-only until an explicit action')
    expect(connectionsSource).toContain('Connect Meta Ads permissions')
    expect(connectionsSource).toContain('Analytics become learning input only after real performance data arrives.')
    expect(connectionsSource).not.toContain('CONFIRM_META_APP_REVIEW_APPROVED')
    expect(connectionsSource).not.toContain('/api/admin/ad-accounts')
  })

  it('does not imply launch, activation, or spend from the connections page', () => {
    expect(i18nSource).toContain('activation and spend still happen only in Paid Ads after separate final approval')
    expect(i18nSource).toContain('التفعيل والإنفاق يظلان داخل Paid Ads بموافقة نهائية منفصلة')
    expect(i18nSource).not.toContain('Meta Ads is ready to launch')
    expect(i18nSource).not.toContain('Spend now')
    expect(i18nSource).not.toContain('Activate now')
  })
})
