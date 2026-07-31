/**
 * POST /api/workspace/reset
 *
 * Fresh-start reset (PR-1G): deletes the workspace's product-journey data and
 * Brand-Brain MEMORY (campaigns, content, posts, agent intelligence, learnings)
 * and resets BrandProfile fields to empty — so the user can run the journey
 * again from scratch.
 *
 * PRESERVES account infrastructure and platform connections:
 *   User · Session · Account · Workspace · WorkspaceMember · Project shell ·
 *   Subscription · Usage · CreditTransaction (credits) · Integration + OAuth
 *   tokens (Facebook / TikTok / LinkedIn) · AdAccount · RateLimitRecord ·
 *   DataDeletionRequest.
 * Billing and credits are NOT touched. Platforms stay connected.
 *
 * Confirmation (real reset): send { confirmText: "RESET MY NEXUS WORKSPACE" }.
 * Dry-run: send { dryRun: true } to get the counts that WOULD be deleted/reset
 *   without deleting anything (no confirmation required).
 *
 * Every operation is scoped to the authenticated user's own workspace only.
 * No secrets or tokens are returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { WORKSPACE_RESET_CONFIRMATION } from '@/lib/workspaceReset'
import { getSupabaseAdmin } from '@/lib/supabaseAuth'
import {
  cleanupCloudinaryAssets,
  cloudinaryReferenceFromUrl,
  type CloudinaryAssetReference,
} from '@/lib/externalAssetCleanup.server'

const db = prisma as any

const STRONG_CONFIRM = WORKSPACE_RESET_CONFIRMATION
// Account infrastructure + platform connections that are NEVER touched.
const PRESERVED = [
  'User', 'Session', 'Account', 'Workspace', 'WorkspaceMember', 'Project',
  'Subscription', 'Usage', 'CreditTransaction', 'Integration', 'AdAccount',
  'RateLimitRecord', 'DataDeletionRequest',
] as const

const PROJECT_RESET = {
  name: 'My Project',
  description: null,
  businessType: null,
  businessInfo: Prisma.JsonNull,
  status: 'DRAFT',
} as const

// BrandProfile fields wiped on reset (the row itself is kept).
const BRAND_RESET: Record<string, unknown> = {
  brandName: null, industry: null, description: null,
  toneKeywords: [], avoidKeywords: [], writingStyle: null,
  targetAudience: null, audienceAge: null, audienceLocation: null,
  audiencePainPoints: [], audienceDesires: [],
  primaryOffer: null, secondaryOffers: [], pricePoint: null,
  uniqueAdvantages: [], visualStyle: null, colorPalette: [], logoUrl: null,
  winningHooks: [], winningAngles: [], failedAngles: [], topPlatforms: [],
  competitors: [], competitorNotes: null, strategicNotes: null,
  websiteUrl: null, contentSamples: [], aiInsights: Prisma.JsonNull,
  businessGoal: null, marketingBudget: null, conversionDestination: null,
  leadHandling: null, customerObjections: [], complianceNotes: null,
  averageOrderValue: null, grossMargin: null, customerLifetimeValue: null,
  salesCycleLength: null, seasonality: null, pastAdResults: null,
  languagePreference: null, verifiedProof: [],
  strategyType: null, strategyDuration: null, strategyCustomDays: null,
  campaignObjective: null,
}

function brandFieldIsReset(actual: unknown, expected: unknown): boolean {
  if (expected === Prisma.JsonNull) return actual == null
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === 0
  return actual === expected
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun === true
    const confirmed = body.confirmText === STRONG_CONFIRM

    // A real (non-dry-run) reset requires explicit confirmation.
    if (!dryRun && !confirmed) {
      return NextResponse.json(
        { error: `Missing confirmation. Send { confirmText: "${STRONG_CONFIRM}" }, or { dryRun: true } to preview.` },
        { status: 400 }
      )
    }

    // Resolve the authenticated user's workspace and scope EVERY op to its id.
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    const wid = workspace.id
    const where = { workspaceId: wid }

    // Models reset on a fresh start (journey + brain memory), in FK-safe order:
    // orphan-prone / children first, parents last. SocialPost → PostStatusHistory
    // and Campaign → (AdConcept, Generation, CampaignActivity, Analytics,
    // PaidCampaignPack) cascade via FK, but orphan-prone tables (which do NOT
    // cascade from Campaign) are deleted explicitly here.
    const makeResetModels = (client: any): {
      name: string
      del: () => Promise<{ count: number }>
      count: () => Promise<number>
    }[] => [
      { name: 'marketingLearningEvent', del: () => client.marketingLearningEvent.deleteMany({ where }), count: () => client.marketingLearningEvent.count({ where }) },
      { name: 'conversionEvent',        del: () => client.conversionEvent.deleteMany({ where }),        count: () => client.conversionEvent.count({ where }) },
      { name: 'landingPageExperiment',  del: () => client.landingPageExperiment.deleteMany({ where }),  count: () => client.landingPageExperiment.count({ where }) },
      { name: 'landingPage',            del: () => client.landingPage.deleteMany({ where }),            count: () => client.landingPage.count({ where }) },
      { name: 'lifecycleMessage',        del: () => client.lifecycleMessage.deleteMany({ where }),        count: () => client.lifecycleMessage.count({ where }) },
      { name: 'contactSuppression',      del: () => client.contactSuppression.deleteMany({ where }),      count: () => client.contactSuppression.count({ where }) },
      { name: 'leadCaptureForm',         del: () => client.leadCaptureForm.deleteMany({ where }),         count: () => client.leadCaptureForm.count({ where }) },
      { name: 'lead',                    del: () => client.lead.deleteMany({ where }),                    count: () => client.lead.count({ where }) },
      { name: 'competitorSignal',        del: () => client.competitorSignal.deleteMany({ where }),        count: () => client.competitorSignal.count({ where }) },
      { name: 'competitorSnapshot',      del: () => client.competitorSnapshot.deleteMany({ where }),      count: () => client.competitorSnapshot.count({ where }) },
      { name: 'competitorSource',        del: () => client.competitorSource.deleteMany({ where }),        count: () => client.competitorSource.count({ where }) },
      { name: 'competitor',              del: () => client.competitor.deleteMany({ where }),              count: () => client.competitor.count({ where }) },
      { name: 'competitorResearchRun',   del: () => client.competitorResearchRun.deleteMany({ where }),   count: () => client.competitorResearchRun.count({ where }) },
      { name: 'brandEvidenceDocument', del: () => client.brandEvidenceDocument.deleteMany({ where }), count: () => client.brandEvidenceDocument.count({ where }) },
      { name: 'brainLearning',          del: () => client.brainLearning.deleteMany({ where }),          count: () => client.brainLearning.count({ where }) },
      { name: 'brainScoreSnapshot',     del: () => client.brainScoreSnapshot.deleteMany({ where }),     count: () => client.brainScoreSnapshot.count({ where }) },
      { name: 'campaignMemory',         del: () => client.campaignMemory.deleteMany({ where }),         count: () => client.campaignMemory.count({ where }) },
      { name: 'agentReport',            del: () => client.agentReport.deleteMany({ where }),            count: () => client.agentReport.count({ where }) },
      { name: 'agentSuggestion',        del: () => client.agentSuggestion.deleteMany({ where }),        count: () => client.agentSuggestion.count({ where }) },
      { name: 'agentRun',               del: () => client.agentRun.deleteMany({ where }),               count: () => client.agentRun.count({ where }) },
      { name: 'automationJob',          del: () => client.automationJob.deleteMany({ where }),          count: () => client.automationJob.count({ where }) },
      { name: 'generatedVisual',        del: () => client.generatedVisual.deleteMany({ where }),        count: () => client.generatedVisual.count({ where }) },
      { name: 'socialPost',             del: () => client.socialPost.deleteMany({ where }),             count: () => client.socialPost.count({ where }) },
      { name: 'export',                 del: () => client.export.deleteMany({ where }),                 count: () => client.export.count({ where }) },
      { name: 'paidCampaignPack',       del: () => client.paidCampaignPack.deleteMany({ where }),       count: () => client.paidCampaignPack.count({ where }) },
      { name: 'adCampaign',             del: () => client.adCampaign.deleteMany({ where }),             count: () => client.adCampaign.count({ where }) },
      { name: 'uploadSession',          del: () => client.uploadSession.deleteMany({ where }),          count: () => client.uploadSession.count({ where }) },
      { name: 'uploadAudit',            del: () => client.uploadAudit.deleteMany({ where }),            count: () => client.uploadAudit.count({ where }) },
      { name: 'media',                  del: () => client.media.deleteMany({ where }),                  count: () => client.media.count({ where }) },
      { name: 'campaign',               del: () => client.campaign.deleteMany({ where }),               count: () => client.campaign.count({ where }) },
    ]
    const RESET_MODELS = makeResetModels(db)

    // ── Dry-run: count only, delete NOTHING ─────────────────────────────────
    if (dryRun) {
      const wouldDelete: Record<string, number> = {}
      for (const m of RESET_MODELS) wouldDelete[m.name] = await m.count()
      const brandExists = Boolean(
        await prisma.brandProfile.findUnique({ where: { workspaceId: wid }, select: { id: true } })
      )
      return NextResponse.json({
        ok: true,
        dryRun: true,
        workspaceId: wid,
        timestamp: new Date().toISOString(),
        wouldDelete,
        brandProfileWouldReset: brandExists,
        projectsWouldReset: await prisma.project.count({ where }),
        preserved: PRESERVED,
        creditsUnchanged: true,
        connectionsPreserved: true,
        warning: 'This reset is permanent. Export/back up your data before running the real reset.',
      })
    }

    // ── Real reset: delete in order, collecting per-model counts ────────────
    // NOTE: Integration, AdAccount, Project and WorkspaceMember are intentionally
    // NOT deleted (PR-1G) so platform connections / OAuth tokens, ad accounts,
    // and workspace access survive the reset. The Project shell is sanitized so
    // a new Brand Brain cannot inherit the previous brand's business context.
    // Use a sequential batch transaction instead of a long-running interactive
    // transaction. Supabase/pgBouncer can drop an interactive transaction while
    // the route waits across many round trips; Prisma batch transactions retain
    // all-or-nothing behavior without pinning a callback connection. The reset is
    // idempotent, so a repeated request is safe and does not need a session lock.
    const [
      evidenceStorageObjects,
      mediaStorageObjects,
      generatedVisualStorageObjects,
      brandStorageObject,
    ] = await Promise.all([
      prisma.brandEvidenceDocument.findMany({
        where,
        select: { storageBucket: true, storagePath: true },
      }),
      prisma.media.findMany({
        where,
        select: { cloudinaryId: true, type: true, url: true },
      }),
      prisma.generatedVisual.findMany({
        where,
        select: { imageUrl: true, thumbnailUrl: true },
      }),
      prisma.brandProfile.findUnique({
        where: { workspaceId: wid },
        select: { logoUrl: true },
      }),
    ])
    const cloudinaryAssets: Array<CloudinaryAssetReference | null> = [
      ...mediaStorageObjects.flatMap(item => [
        item.cloudinaryId
          ? {
              publicId: item.cloudinaryId,
              resourceType: item.type === 'VIDEO' ? 'video' as const : 'image' as const,
            }
          : cloudinaryReferenceFromUrl(item.url),
      ]),
      ...generatedVisualStorageObjects.flatMap(item => [
        cloudinaryReferenceFromUrl(item.imageUrl),
        cloudinaryReferenceFromUrl(item.thumbnailUrl),
      ]),
      cloudinaryReferenceFromUrl(brandStorageObject?.logoUrl),
    ]
    const resetModels = makeResetModels(prisma as any)
    const deleteOperations = resetModels.map(model => model.del())
    const brandResetOperation = (prisma.brandProfile as any).updateMany({
      where: { workspaceId: wid },
      data: BRAND_RESET as any,
    })
    const projectResetOperation = prisma.project.updateMany({
      where,
      data: PROJECT_RESET,
    })
    const verificationOperations = resetModels.map(model => model.count())
    const brandVerificationOperation = prisma.brandProfile.findUnique({
      where: { workspaceId: wid },
    })
    const projectVerificationOperation = prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        businessType: true,
        businessInfo: true,
        status: true,
      },
    })

    const results = await (prisma as any).$transaction([
      ...deleteOperations,
      brandResetOperation,
      projectResetOperation,
      ...verificationOperations,
      brandVerificationOperation,
      projectVerificationOperation,
    ], {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }) as Array<any>

    const deleted = Object.fromEntries(
      resetModels.map((model, index) => [model.name, results[index]?.count ?? 0]),
    )
    const brandUpdateIndex = resetModels.length
    const projectUpdateIndex = brandUpdateIndex + 1
    const verificationStartIndex = projectUpdateIndex + 1
    const remaining = Object.fromEntries(
      resetModels.map((model, index) => [model.name, Number(results[verificationStartIndex + index] ?? 0)]),
    )
    const brandAfterReset = results[verificationStartIndex + resetModels.length] as Record<string, unknown> | null
    const projectsAfterReset = results[verificationStartIndex + resetModels.length + 1] as Array<Record<string, unknown>>
    const dirtyBrandFields = brandAfterReset
      ? Object.entries(BRAND_RESET)
          .filter(([key, expected]) => !brandFieldIsReset(brandAfterReset[key], expected))
          .map(([key]) => key)
      : []
    const dirtyProjectIds = projectsAfterReset
      .filter(project => (
        project.name !== PROJECT_RESET.name
        || project.description !== PROJECT_RESET.description
        || project.businessType !== PROJECT_RESET.businessType
        || project.businessInfo != null
        || project.status !== PROJECT_RESET.status
      ))
      .map(project => String(project.id))
    const resetVerified = Object.values(remaining).every(count => count === 0)
      && dirtyBrandFields.length === 0
      && dirtyProjectIds.length === 0

    if (!resetVerified) {
      const verificationError = new Error('WORKSPACE_RESET_VERIFICATION_FAILED') as Error & {
        details?: Record<string, unknown>
      }
      verificationError.details = { remaining, dirtyBrandFields, dirtyProjectIds }
      throw verificationError
    }

    const outcome = {
      deleted,
      brandProfileReset: Number(results[brandUpdateIndex]?.count ?? 0) > 0,
      projectShellsReset: Number(results[projectUpdateIndex]?.count ?? 0),
      remaining,
      dirtyBrandFields,
      dirtyProjectIds,
      resetVerified,
    }

    // Database reset remains atomic. Private source objects are removed only
    // after the committed delete; a transient Storage failure cannot resurrect
    // journey data or make the reset look partially successful.
    const evidenceObjectsByBucket = evidenceStorageObjects.reduce<Record<string, string[]>>((groups, item) => {
      groups[item.storageBucket] = [...(groups[item.storageBucket] ?? []), item.storagePath]
      return groups
    }, {})
    const storageCleanup = await Promise.all(Object.entries(evidenceObjectsByBucket).map(async ([bucket, paths]) => {
      try {
        const { error } = await getSupabaseAdmin().storage.from(bucket).remove(paths)
        if (error) throw error
        return { bucket, removed: paths.length, pending: false }
      } catch (error) {
        console.error('[workspace/reset] evidence storage cleanup deferred', { bucket, error })
        return { bucket, removed: 0, pending: true }
      }
    }))
    const externalAssetCleanup = await cleanupCloudinaryAssets(cloudinaryAssets)

    return NextResponse.json({
      ok: true,
      message: 'Workspace reset to a fresh start. Account, billing, credits and platform connections were preserved.',
      workspaceId: wid,
      timestamp: new Date().toISOString(),
      deleted: outcome.deleted,
      brandProfileReset: outcome.brandProfileReset,
      projectShellsReset: outcome.projectShellsReset,
      preserved: PRESERVED,
      creditsUnchanged: true,
      connectionsPreserved: true,
      resetVerified: outcome.resetVerified,
      evidenceStorageCleanup: storageCleanup,
      externalAssetCleanup,
      externalCleanupComplete: externalAssetCleanup.pending === 0
        && storageCleanup.every(item => !item.pending),
      verification: {
        remaining: outcome.remaining,
        dirtyBrandFields: outcome.dirtyBrandFields,
        dirtyProjectIds: outcome.dirtyProjectIds,
      },
      next: '/onboarding',
    })
  } catch (err: any) {
    const reference = randomUUID().slice(0, 8)
    console.error('[POST /api/workspace/reset]', { reference, code: err?.code, message: err?.message, stack: err?.stack })
    const verificationFailed = err?.message === 'WORKSPACE_RESET_VERIFICATION_FAILED'
    return NextResponse.json({
      error: verificationFailed
        ? 'Reset completed its transaction but the fresh-start verification failed.'
        : 'Reset could not complete. No workspace data was changed.',
      code: verificationFailed ? 'WORKSPACE_RESET_VERIFICATION_FAILED' : 'WORKSPACE_RESET_FAILED',
      reference,
    }, { status: 500 })
  }
}
