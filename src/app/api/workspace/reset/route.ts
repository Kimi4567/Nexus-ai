/**
 * POST /api/workspace/reset
 *
 * Fresh-start reset (PR-1G): deletes the workspace's product-journey data and
 * Brand-Brain MEMORY (campaigns, content, posts, agent intelligence, learnings)
 * and resets BrandProfile fields to empty — so the user can run the journey
 * again from scratch.
 *
 * PRESERVES account infrastructure and platform connections:
 *   User · Session · Account · Workspace · WorkspaceMember · Project ·
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

const db = prisma as any

const STRONG_CONFIRM = 'RESET MY NEXUS WORKSPACE'
const RESET_TRANSACTION_TIMEOUT_MS = 60_000

// Account infrastructure + platform connections that are NEVER touched.
const PRESERVED = [
  'User', 'Session', 'Account', 'Workspace', 'WorkspaceMember', 'Project',
  'Subscription', 'Usage', 'CreditTransaction', 'Integration', 'AdAccount',
  'RateLimitRecord', 'DataDeletionRequest',
] as const

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
      { name: 'brainLearning',          del: () => client.brainLearning.deleteMany({ where }),          count: () => client.brainLearning.count({ where }) },
      { name: 'brainScoreSnapshot',     del: () => client.brainScoreSnapshot.deleteMany({ where }),     count: () => client.brainScoreSnapshot.count({ where }) },
      { name: 'campaignMemory',         del: () => client.campaignMemory.deleteMany({ where }),         count: () => client.campaignMemory.count({ where }) },
      { name: 'agentReport',            del: () => client.agentReport.deleteMany({ where }),            count: () => client.agentReport.count({ where }) },
      { name: 'agentSuggestion',        del: () => client.agentSuggestion.deleteMany({ where }),        count: () => client.agentSuggestion.count({ where }) },
      { name: 'agentRun',               del: () => client.agentRun.deleteMany({ where }),               count: () => client.agentRun.count({ where }) },
      { name: 'generatedVisual',        del: () => client.generatedVisual.deleteMany({ where }),        count: () => client.generatedVisual.count({ where }) },
      { name: 'socialPost',             del: () => client.socialPost.deleteMany({ where }),             count: () => client.socialPost.count({ where }) },
      { name: 'export',                 del: () => client.export.deleteMany({ where }),                 count: () => client.export.count({ where }) },
      { name: 'paidCampaignPack',       del: () => client.paidCampaignPack.deleteMany({ where }),       count: () => client.paidCampaignPack.count({ where }) },
      { name: 'adCampaign',             del: () => client.adCampaign.deleteMany({ where }),             count: () => client.adCampaign.count({ where }) },
      { name: 'uploadSession',          del: () => client.uploadSession.deleteMany({ where }),          count: () => client.uploadSession.count({ where }) },
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
        preserved: PRESERVED,
        creditsUnchanged: true,
        connectionsPreserved: true,
        warning: 'This reset is permanent. Export/back up your data before running the real reset.',
      })
    }

    // ── Real reset: delete in order, collecting per-model counts ────────────
    // NOTE: Integration, AdAccount, Project and WorkspaceMember are intentionally
    // NOT deleted (PR-1G) so platform connections / OAuth tokens, ad accounts,
    // and workspace access survive the reset.
    const outcome = await prisma.$transaction(async (tx) => {
      // Advisory locks return Postgres `void`. `$queryRawUnsafe` attempts to
      // deserialize that value and fails with Prisma P2010 on current Supabase
      // Postgres. Execute the statement instead so only the lock side effect is
      // observed and the transaction can continue.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `workspace-reset:${wid}`)
      const deleted: Record<string, number> = {}
      for (const model of makeResetModels(tx)) {
        const result = await model.del()
        deleted[model.name] = result?.count ?? 0
      }
      const existingBrand = await tx.brandProfile.findUnique({ where: { workspaceId: wid }, select: { id: true } })
      if (existingBrand) await tx.brandProfile.update({ where: { workspaceId: wid }, data: BRAND_RESET as any })
      return { deleted, brandProfileReset: Boolean(existingBrand) }
    }, {
      // Supabase is remote and this reset intentionally performs FK-safe,
      // sequential deletes. Prisma's 5s interactive-transaction default can
      // expire before the final BrandProfile reset even though every query is
      // healthy, producing P2028 and a full rollback. Give this explicit admin-
      // style operation enough time while keeping it bounded.
      maxWait: 10_000,
      timeout: RESET_TRANSACTION_TIMEOUT_MS,
    })

    return NextResponse.json({
      ok: true,
      message: 'Workspace reset to a fresh start. Account, billing, credits and platform connections were preserved.',
      workspaceId: wid,
      timestamp: new Date().toISOString(),
      deleted: outcome.deleted,
      brandProfileReset: outcome.brandProfileReset,
      preserved: PRESERVED,
      creditsUnchanged: true,
      connectionsPreserved: true,
    })
  } catch (err: any) {
    const reference = randomUUID().slice(0, 8)
    console.error('[POST /api/workspace/reset]', { reference, code: err?.code, message: err?.message, stack: err?.stack })
    return NextResponse.json({
      error: 'Reset could not complete. No workspace data was changed.',
      code: 'WORKSPACE_RESET_FAILED',
      reference,
    }, { status: 500 })
  }
}
