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
 * Confirmation (real reset): send { confirmText: "RESET MY NEXUS WORKSPACE" }
 *   (legacy { confirm: "RESET" } is still accepted so existing UI keeps working).
 * Dry-run: send { dryRun: true } to get the counts that WOULD be deleted/reset
 *   without deleting anything (no confirmation required).
 *
 * Every operation is scoped to the authenticated user's own workspace only.
 * No secrets or tokens are returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const db = prisma as any

const STRONG_CONFIRM = 'RESET MY NEXUS WORKSPACE'

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
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun === true
    const confirmed = body.confirmText === STRONG_CONFIRM || body.confirm === 'RESET'

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
    const RESET_MODELS: {
      name: string
      del: () => Promise<{ count: number }>
      count: () => Promise<number>
    }[] = [
      { name: 'marketingLearningEvent', del: () => db.marketingLearningEvent.deleteMany({ where }), count: () => db.marketingLearningEvent.count({ where }) },
      { name: 'brainLearning',          del: () => db.brainLearning.deleteMany({ where }),          count: () => db.brainLearning.count({ where }) },
      { name: 'brainScoreSnapshot',     del: () => db.brainScoreSnapshot.deleteMany({ where }),     count: () => db.brainScoreSnapshot.count({ where }) },
      { name: 'campaignMemory',         del: () => db.campaignMemory.deleteMany({ where }),         count: () => db.campaignMemory.count({ where }) },
      { name: 'agentReport',            del: () => db.agentReport.deleteMany({ where }),            count: () => db.agentReport.count({ where }) },
      { name: 'agentSuggestion',        del: () => db.agentSuggestion.deleteMany({ where }),        count: () => db.agentSuggestion.count({ where }) },
      { name: 'agentRun',               del: () => db.agentRun.deleteMany({ where }),               count: () => db.agentRun.count({ where }) },
      { name: 'generatedVisual',        del: () => db.generatedVisual.deleteMany({ where }),        count: () => db.generatedVisual.count({ where }) },
      { name: 'socialPost',             del: () => db.socialPost.deleteMany({ where }),             count: () => db.socialPost.count({ where }) },
      { name: 'export',                 del: () => db.export.deleteMany({ where }),                 count: () => db.export.count({ where }) },
      { name: 'paidCampaignPack',       del: () => db.paidCampaignPack.deleteMany({ where }),       count: () => db.paidCampaignPack.count({ where }) },
      { name: 'adCampaign',             del: () => db.adCampaign.deleteMany({ where }),             count: () => db.adCampaign.count({ where }) },
      { name: 'uploadSession',          del: () => db.uploadSession.deleteMany({ where }),          count: () => db.uploadSession.count({ where }) },
      { name: 'media',                  del: () => db.media.deleteMany({ where }),                  count: () => db.media.count({ where }) },
      { name: 'campaign',               del: () => db.campaign.deleteMany({ where }),               count: () => db.campaign.count({ where }) },
    ]

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
    const deleted: Record<string, number> = {}
    for (const m of RESET_MODELS) {
      const res = await m.del()
      deleted[m.name] = res?.count ?? 0
    }

    // Reset Brand Brain fields (keep the row so the workspace stays valid).
    let brandProfileReset = false
    const existingBrand = await prisma.brandProfile.findUnique({
      where: { workspaceId: wid },
      select: { id: true },
    })
    if (existingBrand) {
      await prisma.brandProfile.update({ where: { workspaceId: wid }, data: BRAND_RESET as any })
      brandProfileReset = true
    }

    return NextResponse.json({
      ok: true,
      message: 'Workspace reset to a fresh start. Account, billing, credits and platform connections were preserved.',
      workspaceId: wid,
      timestamp: new Date().toISOString(),
      deleted,
      brandProfileReset,
      preserved: PRESERVED,
      creditsUnchanged: true,
      connectionsPreserved: true,
    })
  } catch (err: any) {
    console.error('[POST /api/workspace/reset]', err)
    return NextResponse.json({ error: 'Reset failed', detail: err.message }, { status: 500 })
  }
}
