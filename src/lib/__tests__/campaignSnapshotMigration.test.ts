import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migration = readFileSync('supabase/migrations/20260715075204_add_campaign_snapshots.sql', 'utf8')
const paidPinMigration = readFileSync('supabase/migrations/20260715081627_pin_paid_campaign_to_strategy_snapshot.sql', 'utf8')
const paidApprovalMigration = readFileSync('supabase/migrations/20260715083044_add_paid_budget_launch_approvals.sql', 'utf8')
const mediaApprovalMigration = readFileSync('supabase/migrations/20260715083904_add_content_media_approvals.sql', 'utf8')
const paidCampaignRoute = readFileSync('src/app/api/ad-campaigns/route.ts', 'utf8')

describe('campaign snapshot database contract', () => {
  it('defines one monotonic campaign version and immutable decision records', () => {
    expect(schema).toMatch(/snapshotVersion\s+Int\s+@default\(0\)/)
    expect(schema).toContain('model CampaignSnapshot')
    expect(schema).toContain('@@unique([campaignId, version])')
    expect(schema).toMatch(/approvedSnapshotId\s+String\?/)
    expect(schema).toMatch(/mediaApprovalSnapshotId\s+String\?/)
    expect(schema).toMatch(/scheduledSnapshotId\s+String\?/)
  })

  it('locks the new public table away from the Data API', () => {
    expect(migration).toContain('ALTER TABLE "CampaignSnapshot" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE "CampaignSnapshot" FROM anon, authenticated')
  })

  it('enforces append-only decision evidence while preserving cascade cleanup', () => {
    expect(migration).toContain('BEFORE UPDATE ON "CampaignSnapshot"')
    expect(migration).toContain("RAISE EXCEPTION 'CampaignSnapshot rows are immutable'")
    expect(migration).toContain('ON DELETE CASCADE ON UPDATE CASCADE')
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE')
  })

  it('pins paid campaigns to one immutable approved strategy revision', () => {
    expect(schema).toMatch(/strategySnapshotId\s+String\?/)
    expect(schema).toContain('@relation("PaidCampaignStrategySnapshot"')
    expect(paidPinMigration).toContain('ADD COLUMN IF NOT EXISTS "strategySnapshotId" TEXT')
    expect(paidPinMigration).toContain('FOREIGN KEY ("strategySnapshotId") REFERENCES "CampaignSnapshot"("id")')
    expect(paidPinMigration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE')
    expect(paidPinMigration).not.toContain('UPDATE "AdCampaign"')
    expect(paidCampaignRoute).toContain('strategySnapshotId: paidSource.snapshot.id')
  })

  it('keeps budget and launch approvals as separate immutable decisions', () => {
    expect(schema).toMatch(/budgetApprovalSnapshotId\s+String\?/)
    expect(schema).toMatch(/launchApprovalSnapshotId\s+String\?/)
    expect(paidApprovalMigration).toContain('ADD COLUMN IF NOT EXISTS "budgetApprovalSnapshotId" TEXT')
    expect(paidApprovalMigration).toContain('ADD COLUMN IF NOT EXISTS "launchApprovalSnapshotId" TEXT')
    expect(paidApprovalMigration).toContain('AdCampaign_budgetApprovalSnapshotId_fkey')
    expect(paidApprovalMigration).toContain('AdCampaign_launchApprovalSnapshotId_fkey')
    expect(paidApprovalMigration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE')
  })

  it('pins final media approval separately from copy and scheduling decisions', () => {
    expect(schema).toContain('@relation("ContentMediaApprovalSnapshot"')
    expect(mediaApprovalMigration).toContain('ADD COLUMN IF NOT EXISTS "mediaApprovalSnapshotId" TEXT')
    expect(mediaApprovalMigration).toContain('SocialPost_mediaApprovalSnapshotId_fkey')
    expect(mediaApprovalMigration).toContain('REFERENCES "CampaignSnapshot"("id")')
    expect(mediaApprovalMigration).toContain('ON DELETE SET NULL')
  })
})
