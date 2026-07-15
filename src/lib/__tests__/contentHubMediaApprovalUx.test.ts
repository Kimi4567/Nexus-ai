import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const contentHubSource = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)
const platformPublisherSource = readFileSync(
  resolve(process.cwd(), 'src/components/publishing/PostPlatformPublisher.tsx'),
  'utf8',
)

describe('Content Hub final-media approval UX', () => {
  it('reconciles a lost browser response against the saved approval truth', () => {
    expect(contentHubSource).toContain('const freshPosts = await loadData()')
    expect(contentHubSource).toContain("copyApprovedPosts.every(post => Boolean(post.mediaApprovalSnapshotId))")
    expect(contentHubSource).toContain('ثم تحقّق NEXUS من القرار المحفوظ')
    expect(contentHubSource).toContain('NEXUS verified the saved decision')
  })

  it('does not expose immediate platform publishing before copy and media approval evidence exists', () => {
    expect(contentHubSource).toContain('approvalReady={Boolean(post.approvedSnapshotId && post.mediaApprovalSnapshotId)}')
    expect(platformPublisherSource).toContain("const eligible = status === 'APPROVED' && approvalReady")
  })

  it('keeps automatic scheduling locked until every platform has an exact destination', () => {
    expect(contentHubSource).toContain('autoTargetsMissingDestinations')
    expect(contentHubSource).toContain('autoDestinationReviewIncomplete')
    expect(contentHubSource).toContain('Connect every platform and choose its exact publishing destination')
    expect(contentHubSource).toContain('لن ينشئ NEXUS جدول نشر تلقائي بلا وجهة')
    expect(contentHubSource).toContain('لم تتم جدولة أي منشور')
  })
})
