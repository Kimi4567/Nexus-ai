import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { PINTEREST_PUBLISH_SCOPES, PINTEREST_USER_READ_SCOPE, pinterestBoardsFromConfig } from '@/lib/pinterestPublishing'
import { THREADS_BASIC_SCOPE, THREADS_INSIGHTS_SCOPE, THREADS_PUBLISH_SCOPE } from '@/lib/threadsPublishing'
import { createSocialDisconnectTombstone, isSanitizedSocialDisconnectConfig } from '@/lib/socialIntegrationDisconnect'

class IntegrationDisconnectConcurrentChangeError extends Error {
  constructor() {
    super('INTEGRATION_DISCONNECT_CONCURRENT_CHANGE')
    this.name = 'IntegrationDisconnectConcurrentChangeError'
  }
}

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await adminClient.auth.getUser(token)
  return user
}

// GET /api/social/accounts — list all connected integrations
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ accounts: [] })

    const integrations = await prisma.integration.findMany({
      where: {
        workspaceId: workspace.id,
        status: { in: ['CONNECTED', 'EXPIRED', 'ERROR'] },
        type: { in: ['META', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X', 'PINTEREST', 'THREADS'] as any[] },
      },
      select: {
        id: true,
        type: true,
        status: true,
        accountId: true,
        accountName: true,
        config: true,
        accessToken: true,
        refreshToken: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    })

    // Strip raw tokens from response — only return safe fields
    const accounts = integrations.map(i => {
      const config = i.config && typeof i.config === 'object' && !Array.isArray(i.config)
        ? i.config as Record<string, any>
        : {}
      const configuredExpiry = typeof config.expiresAt === 'string' ? new Date(config.expiresAt) : null
      const accessTokenExpired = configuredExpiry
        ? Number.isFinite(configuredExpiry.getTime()) && configuredExpiry.getTime() <= Date.now()
        : false
      const effectiveStatus = i.status === 'CONNECTED' && accessTokenExpired ? 'EXPIRED' : i.status
      const connected = effectiveStatus === 'CONNECTED'
      const rawPages = Array.isArray(config.pages) ? config.pages : []
      const pages = rawPages.map((page: any) => ({
        id: typeof page?.id === 'string' ? page.id : '',
        name: typeof page?.name === 'string' ? page.name : '',
        igAccountId: typeof page?.igAccountId === 'string' ? page.igAccountId : null,
      })).filter((page: { id: string }) => page.id)
      const organizations = (Array.isArray(config.organizations) ? config.organizations : [])
        .map((organization: any) => ({
          id: typeof organization?.id === 'string' ? organization.id : '',
          name: typeof organization?.name === 'string' ? organization.name : '',
          urn: typeof organization?.urn === 'string' ? organization.urn : undefined,
        }))
        .filter((organization: { id: string }) => organization.id)
      const boards = i.type === 'PINTEREST' ? pinterestBoardsFromConfig(config) : []
      const scopes = Array.isArray(config.scopes) ? config.scopes.filter((scope: unknown) => typeof scope === 'string') : []
      const scopesVerified = config.scopeEvidence === 'provider_response'
      const pinterestScopeReady = i.type === 'PINTEREST'
        && scopesVerified
        && [...PINTEREST_PUBLISH_SCOPES, PINTEREST_USER_READ_SCOPE].every(scope => scopes.includes(scope))
      const threadsPublishReady = i.type === 'THREADS'
        && scopesVerified
        && [THREADS_BASIC_SCOPE, THREADS_PUBLISH_SCOPE].every(scope => scopes.includes(scope))
      const threadsReadbackReady = i.type === 'THREADS'
        && scopesVerified
        && [THREADS_BASIC_SCOPE, THREADS_INSIGHTS_SCOPE].every(scope => scopes.includes(scope))
      const capabilities = {
        facebookPublishing: connected && i.type === 'META' && scopesVerified && scopes.includes('pages_manage_posts') && rawPages.some((page: any) => page?.id && page?.accessToken),
        instagramPublishing: connected && i.type === 'META' && scopesVerified && scopes.includes('instagram_content_publish') && rawPages.some((page: any) => page?.igAccountId && page?.accessToken),
        linkedInMemberPublishing: connected && i.type === 'LINKEDIN' && scopesVerified && scopes.includes('w_member_social') && Boolean(i.accountId),
        linkedInOrganizationPublishing: connected && i.type === 'LINKEDIN' && scopesVerified && scopes.includes('w_organization_social') && organizations.length > 0,
        tikTokDirectPosting: connected && i.type === 'TIKTOK' && scopesVerified && scopes.includes('video.publish'),
        tikTokCreatorInfoVerified: connected && i.type === 'TIKTOK' && Boolean(config.creatorInfoVerifiedAt),
        youtubeVideoPublishing: connected && i.type === 'YOUTUBE' && scopesVerified && scopes.includes('https://www.googleapis.com/auth/youtube.upload') && Boolean(i.accountId),
        youtubeReadback: connected && i.type === 'YOUTUBE' && scopesVerified && scopes.includes('https://www.googleapis.com/auth/youtube.readonly') && Boolean(i.accountId),
        xPublishing: connected && i.type === 'X' && scopesVerified && scopes.includes('tweet.write') && Boolean(i.accountId),
        xMediaPublishing: connected && i.type === 'X' && scopesVerified && scopes.includes('media.write') && Boolean(i.accountId),
        xReadback: connected && i.type === 'X' && scopesVerified && scopes.includes('tweet.read') && scopes.includes('users.read') && Boolean(i.accountId),
        pinterestPinPublishing: connected && pinterestScopeReady && boards.length > 0 && Boolean(i.accountId),
        pinterestReadback: connected && pinterestScopeReady && Boolean(i.accountId),
        pinterestBoardSelection: connected && i.type === 'PINTEREST' && boards.length > 0,
        pinterestPublicPublishing: connected && pinterestScopeReady && boards.length > 0 && config.accessTier === 'STANDARD',
        threadsPostPublishing: connected && threadsPublishReady && Boolean(i.accountId),
        threadsReadback: connected && threadsReadbackReady && Boolean(i.accountId),
        threadsPublicPublishing: connected && threadsPublishReady && Boolean(i.accountId) && config.accessTier === 'LIVE',
        tokenRefresh: connected && (i.type === 'THREADS' || i.type === 'META' ? Boolean(i.accessToken) : Boolean(i.refreshToken)),
      }
      return {
        id: i.id,
        platform: i.type,
        status: effectiveStatus,
        accountId: i.accountId,
        accountName: i.accountName,
        pages,
        organizations,
        boards,
        selectedOrganizationId: config.organizationId || null,
        pictureUrl: config.pictureUrl || null,
        channelUrl: config.channelUrl || null,
        profileUrl: config.profileUrl || null,
        accessTier: i.type === 'PINTEREST'
          ? config.accessTier || 'TRIAL'
          : i.type === 'THREADS'
            ? config.accessTier || 'DEVELOPMENT'
            : null,
        scopes,
        expiresAt: config.expiresAt || null,
        refreshExpiresAt: config.refreshExpiresAt || null,
        capabilities,
        connectedAt: config.connectedAt || i.createdAt,
        lastSyncedAt: i.lastSyncedAt,
      }
    })

    return NextResponse.json({ accounts })
  } catch (err: any) {
    console.error('[Social Accounts GET] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

// DELETE /api/social/accounts — disconnect an integration
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let integrationId: unknown
    try {
      ({ integrationId } = await req.json())
    } catch {
      return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
    }
    if (typeof integrationId !== 'string' || !integrationId.trim()) {
      return NextResponse.json({ error: 'integrationId required' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Verify ownership before disconnecting
    const integration = await prisma.integration.findFirst({
      where: { id: integrationId, workspaceId: workspace.id },
      select: {
        id: true,
        type: true,
        status: true,
        accessToken: true,
        refreshToken: true,
        config: true,
        updatedAt: true,
      },
    })
    if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const alreadySanitized = integration.status === 'DISCONNECTED'
      && integration.accessToken === null
      && integration.refreshToken === null
      && isSanitizedSocialDisconnectConfig(integration.config)

    if (alreadySanitized) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        credentialsErased: true,
        providerRevocationConfirmed: false,
      })
    }

    const tombstone = createSocialDisconnectTombstone()

    await prisma.$transaction(async tx => {
      const updated = await tx.integration.updateMany({
        where: {
          id: integration.id,
          workspaceId: workspace.id,
          updatedAt: integration.updatedAt,
        },
        data: {
          status: 'DISCONNECTED',
          accessToken: null,
          refreshToken: null,
          config: tombstone,
          lastSyncedAt: null,
        },
      })

      if (updated.count !== 1) throw new IntegrationDisconnectConcurrentChangeError()

      await tx.marketingLearningEvent.create({
        data: {
          workspaceId: workspace.id,
          eventType: 'PLATFORM_DISCONNECTED',
          source: 'INTEGRATION_WORKFLOW',
          actor: 'USER',
          metadata: {
            integrationId: integration.id,
            platform: integration.type,
            localCredentialsErased: true,
            providerRevocationConfirmed: false,
          },
        },
      })
    })

    return NextResponse.json({
      ok: true,
      credentialsErased: true,
      providerRevocationConfirmed: false,
    })
  } catch (err: any) {
    if (err instanceof IntegrationDisconnectConcurrentChangeError) {
      return NextResponse.json({
        error: 'Connection changed while disconnecting. Refresh and try again.',
        code: err.message,
      }, { status: 409 })
    }
    console.error('[Social Accounts DELETE] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 })
  }
}
