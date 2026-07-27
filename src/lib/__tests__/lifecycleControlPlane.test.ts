import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260720132727_customer_lifecycle_controls.sql'), 'utf8')
const lifecyclePage = readFileSync(join(process.cwd(), 'src/app/leads/lifecycle/page.tsx'), 'utf8')
const approvalRoute = readFileSync(join(process.cwd(), 'src/app/api/lifecycle/messages/[id]/approve/route.ts'), 'utf8')

describe('customer lifecycle control-plane contract', () => {
  it('stores keyed suppression evidence and copy-only approvals in locked tables', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "ContactSuppression"')
    expect(migration).toContain('"destinationHash" TEXT NOT NULL')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "LifecycleMessage"')
    expect(migration).toContain('"providerState"         TEXT NOT NULL DEFAULT \'NOT_CONNECTED\'')
    expect(migration).not.toContain("'SENT'")
    for (const table of ['ContactSuppression', 'LifecycleMessage']) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`REVOKE ALL PRIVILEGES ON TABLE "${table}" FROM anon, authenticated`)
    }
  })

  it('never imports or calls an email provider from customer approval', () => {
    expect(approvalRoute).not.toContain("@/lib/email/resend")
    expect(approvalRoute).not.toContain('.emails.send')
    expect(approvalRoute).toContain("approvalScope: 'COPY_ONLY'")
    expect(approvalRoute).toContain("state: 'BLOCKED'")
    expect(approvalRoute).toContain('sendsEnabled: false')
  })

  it('makes pre-permission truth visible in the operator UI', () => {
    expect(lifecyclePage).toContain('Pre-permission mode — sending locked')
    expect(lifecyclePage).not.toContain('sendsEnabled=false')
    expect(lifecyclePage).not.toContain('LIFECYCLE_MESSAGING_ENABLED')
    expect(lifecyclePage).toContain('DELIVERY BLOCKED')
    expect(lifecyclePage).toContain('Approved, not sent')
    expect(lifecyclePage).toContain('DOUBLE_OPT_IN (copy only)')
  })
})
