import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { getServerUserId } from '@/lib/apiAuth'
import { publishSocialPost } from '@/lib/socialPublishers'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'

type RequestedPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK'

interface PublishRequest {
  socialPostId?: unknown
  integrationId?: unknown
  pageId?: unknown
  pageName?: unknown
  caption?: unknown
  imageUrl?: unknown
  link?: unknown
  platform?: unknown
  campaignId?: unknown
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function dbPlatform(platform: RequestedPlatform): 'META' | 'LINKEDIN' | 'TIKTOK' {
  return platform === 'LINKEDIN' ? 'LINKEDIN' : platform === 'TIKTOK' ? 'TIKTOK' : 'META'
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as PublishRequest
  const integrationId = text(body.integrationId, 100)
  const pageId = text(body.pageId, 200)
  const pageName = text(body.pageName, 200)
  const socialPostId = text(body.socialPostId, 100)
  let caption = text(body.caption, 5_000)
  let imageUrl = text(body.imageUrl, 2_000) || null
  const link = text(body.link, 2_000) || null
  let campaignId = text(body.campaignId, 100) || null
  const platform = text(body.platform, 30) as RequestedPlatform

  if (!integrationId || !['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK'].includes(platform)) {
    return NextResponse.json({ error: 'Valid integrationId and platform are required' }, { status: 400 })
  }
  if (['FACEBOOK', 'INSTAGRAM'].includes(platform) && !pageId) {
    return NextResponse.json({ error: 'A connected Meta page/account is required' }, { status: 400 })
  }
  if (!socialPostId) {
    return NextResponse.json({
      error: 'Platform publishing must reference an approved, media-ready Content Hub post.',
      code: 'CONTENT_HUB_POST_REQUIRED',
    }, { status: 400 })
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const existingPost = await prisma.socialPost.findFirst({
        where: { id: socialPostId, workspaceId: workspace.id },
        select: {
          id: true,
          campaignId: true,
          platform: true,
          status: true,
          caption: true,
          imageUrl: true,
          uploadedMediaId: true,
          mediaSource: true,
          generationStatus: true,
          approvedAt: true,
        },
      })

  if (!existingPost) {
    return NextResponse.json({ error: 'Content Hub post not found' }, { status: 404 })
  }
  if (!['APPROVED', 'SCHEDULED'].includes(existingPost.status)) {
    return NextResponse.json({ error: 'The Content Hub post must be approved before platform publishing' }, { status: 409 })
  }
  if (!isContentPostMediaReadyForScheduling(existingPost)) {
    return NextResponse.json({
      error: 'Complete and confirm this post media before platform publishing.',
      code: 'MEDIA_REVIEW_REQUIRED',
    }, { status: 409 })
  }
  if (dbPlatform(platform) !== existingPost.platform) {
    return NextResponse.json({ error: 'Selected platform does not match the approved post platform' }, { status: 409 })
  }
  if (campaignId && existingPost.campaignId && campaignId !== existingPost.campaignId) {
    return NextResponse.json({ error: 'Campaign does not match the approved post' }, { status: 409 })
  }
  caption = existingPost.caption
  imageUrl = existingPost.imageUrl
  campaignId = existingPost.campaignId
  if (!caption) {
    return NextResponse.json({ error: 'Approved post caption is required' }, { status: 400 })
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      workspaceId: workspace.id,
      status: 'CONNECTED',
      type: dbPlatform(platform),
    },
  })
  if (!integration?.accessToken) {
    return NextResponse.json({ error: 'Matching integration is not connected' }, { status: 400 })
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const config = integration.config && typeof integration.config === 'object' && !Array.isArray(integration.config)
    ? integration.config as Record<string, unknown>
    : {}
  const pages = Array.isArray(config.pages) ? config.pages as Array<Record<string, any>> : []
  const page = pages.find((entry) => entry.id === pageId || entry.igAccountId === pageId)
  if (['FACEBOOK', 'INSTAGRAM'].includes(platform) && !page) {
    return NextResponse.json({ error: 'Selected page is not part of this connection' }, { status: 400 })
  }

  const rawToken = page?.accessToken || integration.accessToken
  const accessToken = decryptToken(rawToken) ?? ''
  if (!accessToken) return NextResponse.json({ error: 'Stored platform token could not be decrypted' }, { status: 503 })

  const captionWithLink = link && platform === 'LINKEDIN' ? `${caption}\n\n${link}` : caption
  let published: Awaited<ReturnType<typeof publishSocialPost>> | null = null
  let publishError: string | null = null
  try {
    published = await publishSocialPost({
      platform,
      caption: captionWithLink,
      imageUrl,
      pageId,
      accountId: integration.accountId,
      accessToken,
      integrationConfig: config,
      link,
    })
  } catch (error) {
    publishError = error instanceof Error ? error.message : 'Publish failed'
    console.error('[Social Publish] Provider error:', publishError)
  }

  try {
    const nextStatus = published ? 'PUBLISHED' : 'FAILED'
      const now = new Date()
      const updated = await prisma.$transaction(async (tx) => {
        const socialPost = await tx.socialPost.update({
          where: { id: existingPost.id },
          data: {
            integrationId,
            platform: dbPlatform(platform),
            pageId: pageId || null,
            pageName: pageName || page?.name || integration.accountName || null,
            platformPostId: published?.platformPostId ?? null,
            platformUrl: published?.platformUrl ?? null,
            status: nextStatus,
            errorMessage: publishError,
            publishMode: 'MANUAL',
            approvedAt: existingPost.approvedAt ?? now,
            publishedAt: published ? now : null,
          },
        })
        await tx.postStatusHistory.create({
          data: {
            socialPostId: existingPost.id,
            workspaceId: workspace.id,
            fromStatus: existingPost.status,
            toStatus: nextStatus,
            actor: 'USER',
            note: published ? 'Published by explicit Content Hub API action' : publishError?.slice(0, 500),
          },
        })
        await tx.marketingLearningEvent.create({
          data: {
            workspaceId: workspace.id,
            campaignId,
            socialPostId: existingPost.id,
            eventType: published ? 'POST_API_PUBLISHED' : 'POST_FAILED',
            source: 'CONTENT_HUB',
            actor: 'USER',
            metadata: {
              integrationId,
              platform,
              pageId,
              platformPostId: published?.platformPostId ?? null,
              error: publishError,
            },
          },
        })
        return socialPost
      })

      if (!published) return NextResponse.json({ error: publishError, socialPost: updated }, { status: 502 })
      return NextResponse.json({ ok: true, socialPost: updated, platformUrl: published.platformUrl ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Persistence failed'
    if (published) {
      console.error(`[Social Publish] RECONCILIATION_REQUIRED provider=${published.platformPostId}:`, message)
      return NextResponse.json({
        error: 'Platform confirmed publication, but local persistence failed. Manual reconciliation is required.',
        platformPostId: published.platformPostId,
        reconciliationRequired: true,
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to record publishing attempt' }, { status: 500 })
  }
}
