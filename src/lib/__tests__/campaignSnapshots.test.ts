import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_SNAPSHOT_SCOPE,
  buildContentApprovalSnapshotPayload,
  buildMediaApprovalSnapshotPayload,
  buildScheduleDecisionSnapshotPayload,
  buildStrategyApprovalSnapshotPayload,
  canonicalSnapshotJson,
  hashCampaignSnapshotPayload,
  hashContentDecision,
  hashCopyDecision,
  hashMediaDecision,
  readSnapshotStrategyReference,
  readStrategyApprovalSnapshotPayload,
  sanitizeStrategyApprovalAiOutput,
  reviewPostAgainstApprovalSnapshot,
  reviewPostAgainstMediaApprovalSnapshot,
  reviewPostAgainstScheduleDecisionSnapshot,
} from '@/lib/campaignSnapshots'

const post = {
  id: 'post-1',
  platform: 'META',
  publishTarget: 'INSTAGRAM',
  caption: 'Reviewed launch message',
  imagePrompt: 'Reviewed launch visual',
  videoPrompt: null,
  imageUrl: 'https://cdn.example/reviewed.png',
  uploadedMediaId: 'media-1',
  mediaSource: 'UPLOAD',
  generationStatus: 'DONE',
  isVideoPost: false,
  contentPlanIndex: 1,
  variantGroup: null,
  variantLabel: 'A',
  scheduledAt: new Date('2026-07-20T10:00:00.000Z'),
}

const strategySnapshot = {
  id: 'strategy-snapshot-1',
  version: 1,
  scope: CAMPAIGN_SNAPSHOT_SCOPE.STRATEGY_APPROVAL,
  payloadHash: 'strategy-hash',
}

describe('campaign snapshots', () => {
  it('hashes equivalent objects deterministically regardless of key order', () => {
    expect(canonicalSnapshotJson({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(canonicalSnapshotJson({ a: { c: 3, d: 4 }, b: 2 }))
    expect(hashCampaignSnapshotPayload({ b: 2, a: 1 }))
      .toBe(hashCampaignSnapshotPayload({ a: 1, b: 2 }))
  })

  it('captures the exact strategy order, reviewed strategy, campaign scope, and Brand Brain', () => {
    const payload = buildStrategyApprovalSnapshotPayload({
      campaign: {
        id: 'campaign-1',
        name: 'Launch',
        goal: 'LEADS',
        audience: 'Operators',
        tone: 'PROFESSIONAL',
        platforms: ['INSTAGRAM'],
        aiOutput: {
          strategyType: 'full',
          organicPostCount: 12,
          strategy: { positioning: 'Evidence-backed automation' },
          qualityGate: { status: 'passed' },
        },
      },
      brandProfile: { brandName: 'NEXUS', conversionDestination: 'https://example.com/demo' },
    })

    expect(payload).toMatchObject({
      scope: 'STRATEGY_APPROVAL',
      campaign: { id: 'campaign-1', goal: 'LEADS', platforms: ['INSTAGRAM'] },
      strategyOrder: { strategyType: 'full', organicPostCount: 12 },
      strategy: { positioning: 'Evidence-backed automation' },
      brandProfile: { brandName: 'NEXUS' },
    })
    expect(readStrategyApprovalSnapshotPayload(payload)).toMatchObject({
      campaign: {
        id: 'campaign-1',
        goal: 'LEADS',
        platforms: ['INSTAGRAM'],
        aiOutput: {
          strategyType: 'full',
          strategy: { positioning: 'Evidence-backed automation' },
          qualityGate: { status: 'passed' },
        },
      },
    })
  })

  it('does not reinterpret a persisted approved strategy with newer guards', () => {
    const approvedAiOutput = {
      language: 'ar',
      strategyType: 'organic',
      organicPostCount: 1,
      strategy: {
        contentAnglesDetailed: [{
          title: 'تحديثات أسبوعية',
          platform: 'Instagram',
          desiredOutcome: 'راحة البال من خلال تحديثات منتظمة',
        }],
      },
      qualityGate: { status: 'passed', blockers: [] },
    }
    const input = {
      campaign: {
        id: 'campaign-approved',
        name: 'Approved strategy',
        goal: 'LEADS',
        platforms: ['INSTAGRAM', 'PINTEREST'],
        aiOutput: approvedAiOutput,
      },
      brandProfile: { brandName: 'Approved brand' },
      persistedApprovedAiOutput: true,
    }
    const payload = buildStrategyApprovalSnapshotPayload(input)

    expect((payload.strategy as any).contentAnglesDetailed[0]).toMatchObject({
      platform: 'Instagram',
      desiredOutcome: 'راحة البال من خلال تحديثات منتظمة',
    })
    expect(hashCampaignSnapshotPayload(payload)).toBe(hashCampaignSnapshotPayload(
      buildStrategyApprovalSnapshotPayload(input),
    ))
  })

  it('sanitizes unsupported thresholds and direct-learning language before approval', () => {
    const safe = sanitizeStrategyApprovalAiOutput({
      campaign: {
        platforms: ['INSTAGRAM'],
        aiOutput: {
          language: 'ar',
          strategyType: 'full',
          strategy: {
            decisionRules: [{ signal: 'التفاعل', continueWhen: 'تحقق الزيادة بنسبة 10%' }],
            roadmap30_60_90: [{ exitGate: 'تحقق زيادة بنسبة 10% في التفاعل' }],
            experimentBacklog: [{ minimumEvidence: 'زيادة بنسبة 10% في المشاهدات' }],
            operatingCadence: { monthly: ['تقييم الاستراتيجية وتعلم من Brand Brain'] },
          },
          qualityGate: { status: 'passed' },
        },
      },
      brandProfile: { brandName: 'NEXUS', verifiedProof: [] },
    })

    const serialized = JSON.stringify(safe)
    expect(serialized).not.toMatch(/10\s*%/)
    expect(serialized).not.toContain('تعلم من Brand Brain')
    expect(serialized).toContain('خط الأساس')
    expect(serialized).toContain('مراجعتها قبل الاعتماد')
  })

  it('rejects malformed or wrong-scope strategy handoffs', () => {
    expect(readStrategyApprovalSnapshotPayload({ scope: 'CONTENT_APPROVAL' })).toBeNull()
    expect(readStrategyApprovalSnapshotPayload({
      scope: 'STRATEGY_APPROVAL',
      campaign: { id: 'campaign-1', name: 'Launch', goal: 'LEADS' },
      strategy: null,
    })).toBeNull()
  })

  it('keeps copy approval stable when media changes, but rejects copy drift', () => {
    const payload = buildContentApprovalSnapshotPayload({
      campaignId: 'campaign-1',
      strategySnapshot,
      posts: [post],
    })
    const snapshot = { scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_APPROVAL, payload }

    expect(reviewPostAgainstApprovalSnapshot(post, snapshot)).toEqual({ ok: true })
    expect(readSnapshotStrategyReference(payload)).toEqual(strategySnapshot)
    expect(reviewPostAgainstApprovalSnapshot({ ...post, caption: 'Changed after review' }, snapshot))
      .toEqual({ ok: false, code: 'CONTENT_CHANGED_AFTER_APPROVAL' })
    expect(reviewPostAgainstApprovalSnapshot({ ...post, imageUrl: 'https://cdn.example/other.png' }, snapshot))
      .toEqual({ ok: true })
    expect((payload.posts as any[])[0]).toMatchObject({ copyHash: hashCopyDecision(post) })
  })

  it('records final media separately and rejects media drift without invalidating copy', () => {
    const payload = buildMediaApprovalSnapshotPayload({
      campaignId: 'campaign-1',
      strategySnapshot,
      copyApprovalSnapshotIds: ['content-snapshot-2'],
      posts: [post],
    })
    const snapshot = { scope: CAMPAIGN_SNAPSHOT_SCOPE.CONTENT_MEDIA_APPROVAL, payload }

    expect(reviewPostAgainstMediaApprovalSnapshot(post, snapshot)).toEqual({ ok: true })
    expect((payload.posts as any[])[0]).toMatchObject({ mediaHash: hashMediaDecision(post) })
    expect(reviewPostAgainstMediaApprovalSnapshot({ ...post, imageUrl: 'https://cdn.example/other.png' }, snapshot))
      .toEqual({ ok: false, code: 'MEDIA_CHANGED_AFTER_APPROVAL' })
    expect(reviewPostAgainstMediaApprovalSnapshot(post, null))
      .toEqual({ ok: false, code: 'MEDIA_APPROVAL_SNAPSHOT_REQUIRED' })
  })

  it('fails closed when approval evidence is missing or has the wrong scope', () => {
    expect(reviewPostAgainstApprovalSnapshot(post, null))
      .toEqual({ ok: false, code: 'CONTENT_APPROVAL_SNAPSHOT_REQUIRED' })
    expect(reviewPostAgainstApprovalSnapshot(post, { scope: 'STRATEGY_APPROVAL', payload: {} }))
      .toEqual({ ok: false, code: 'CONTENT_APPROVAL_SNAPSHOT_INVALID' })
  })

  it('links a schedule decision to both the strategy and exact content revision', () => {
    const scheduledPost = {
      ...post,
      approvedSnapshotId: 'content-snapshot-2',
      mediaApprovalSnapshotId: 'media-snapshot-3',
      integrationId: 'integration-1',
      pageId: 'page-1',
      pageName: 'NEXUS',
      platformOptions: { explicitConsent: true },
      autoPublishConsentAt: new Date('2026-07-15T08:00:00.000Z'),
      publishMode: 'AUTO',
    }
    const payload = buildScheduleDecisionSnapshotPayload({
      campaignId: 'campaign-1',
      strategySnapshot,
      publishMode: 'AUTO',
      posts: [scheduledPost],
    })

    expect(payload).toMatchObject({
      scope: 'SCHEDULE_DECISION',
      strategySnapshot,
      publishMode: 'AUTO',
      posts: [{
        postId: 'post-1',
        approvedSnapshotId: 'content-snapshot-2',
        mediaApprovalSnapshotId: 'media-snapshot-3',
        contentHash: hashContentDecision(post),
        destination: { integrationId: 'integration-1', pageId: 'page-1', publishTarget: 'INSTAGRAM' },
      }],
    })
    const snapshot = { scope: CAMPAIGN_SNAPSHOT_SCOPE.SCHEDULE_DECISION, payload }
    expect(reviewPostAgainstScheduleDecisionSnapshot(scheduledPost, snapshot)).toEqual({ ok: true })
    expect(reviewPostAgainstScheduleDecisionSnapshot(
      { ...scheduledPost, scheduledAt: new Date('2026-07-20T12:00:00.000Z') },
      snapshot,
    )).toEqual({ ok: false, code: 'SCHEDULE_CHANGED_AFTER_APPROVAL' })
    expect(reviewPostAgainstScheduleDecisionSnapshot(
      { ...scheduledPost, pageId: 'different-page' },
      snapshot,
    )).toEqual({ ok: false, code: 'SCHEDULE_CHANGED_AFTER_APPROVAL' })
  })
})
