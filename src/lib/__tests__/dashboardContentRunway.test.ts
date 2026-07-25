import { describe, expect, it } from 'vitest'
import {
  deriveDashboardContentRunwayItem,
  sortDashboardContentRunway,
  type DashboardContentPostInput,
} from '@/lib/dashboardContentRunway'

const scheduledPost: DashboardContentPostInput = {
  id: 'post-1',
  campaignId: 'campaign-1',
  campaignName: 'Launch',
  status: 'SCHEDULED',
  approvedAt: '2026-07-20T08:00:00.000Z',
  approvedSnapshotId: 'copy-1',
  imageUrl: 'https://cdn.example.com/final.mp4',
  isVideoPost: true,
  mediaSource: 'GENERATE',
  generationStatus: 'DONE',
  mediaApprovalSnapshotId: 'media-1',
  scheduledAt: '2026-08-01T08:00:00.000Z',
  scheduledSnapshotId: 'schedule-1',
  publishMode: 'MANUAL',
  errorMessage: null,
  updatedAt: '2026-07-24T08:00:00.000Z',
}

describe('dashboard content runway truth', () => {
  it('labels a valid manual schedule as internal, never provider-published', () => {
    const item = deriveDashboardContentRunwayItem(
      scheduledPost,
      new Date('2026-07-25T08:00:00.000Z'),
    )

    expect(item.state).toBe('INTERNAL_SCHEDULE_MANUAL')
    expect(item.scheduleEvidenced).toBe(true)
    expect(item.externalPublishConfirmed).toBe(false)
    expect(item.integrationLinked).toBe(false)
  })

  it('fails closed when a scheduled row has no immutable schedule snapshot', () => {
    const item = deriveDashboardContentRunwayItem({
      ...scheduledPost,
      scheduledSnapshotId: null,
    })

    expect(item.state).toBe('NEEDS_ATTENTION')
    expect(item.scheduleEvidenced).toBe(false)
  })

  it('requires a linked, connected integration and explicit consent for auto delivery', () => {
    const missingConsent = deriveDashboardContentRunwayItem({
      ...scheduledPost,
      publishMode: 'AUTO',
      integrationId: 'integration-1',
      integrationStatus: 'CONNECTED',
    })
    const configured = deriveDashboardContentRunwayItem({
      ...scheduledPost,
      publishMode: 'AUTO',
      integrationId: 'integration-1',
      integrationStatus: 'CONNECTED',
      autoPublishConsentAt: '2026-07-24T12:00:00.000Z',
    })

    expect(missingConsent.state).toBe('NEEDS_ATTENTION')
    expect(configured.state).toBe('AUTO_DELIVERY_CONFIGURED')
  })

  it('does not call a PUBLISHED status externally published without provider evidence', () => {
    const unproven = deriveDashboardContentRunwayItem({
      ...scheduledPost,
      status: 'PUBLISHED',
      publishedAt: '2026-08-01T08:01:00.000Z',
      platformPostId: null,
      platformUrl: null,
    })
    const proven = deriveDashboardContentRunwayItem({
      ...scheduledPost,
      status: 'PUBLISHED',
      publishedAt: '2026-08-01T08:01:00.000Z',
      platformPostId: 'provider-post-1',
    })

    expect(unproven.state).toBe('NEEDS_ATTENTION')
    expect(proven.state).toBe('PUBLISHED_EXTERNAL')
  })

  it('surfaces overdue manual delivery before future scheduled content', () => {
    const now = new Date('2026-07-25T08:00:00.000Z')
    const future = deriveDashboardContentRunwayItem(scheduledPost, now)
    const overdue = deriveDashboardContentRunwayItem({
      ...scheduledPost,
      id: 'post-overdue',
      scheduledAt: '2026-07-24T08:00:00.000Z',
    }, now)

    expect(sortDashboardContentRunway([future, overdue]).map(item => item.id))
      .toEqual(['post-overdue', 'post-1'])
  })
})
