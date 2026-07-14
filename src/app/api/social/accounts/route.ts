import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'

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
        type: { in: ['META', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X'] as any[] },
      },
      select: {
        id: true,
        type: true,
        status: true,
        accountId: true,
        accountName: true,
        config: true,
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
      const scopes = Array.isArray(config.scopes) ? config.scopes.filter((scope: unknown) => typeof scope === 'string') : []
      const scopesVerified = config.scopeEvidence === 'provider_response'
      const capabilities = {
        facebookPublishing: i.type === 'META' && scopesVerified && scopes.includes('pages_manage_posts') && rawPages.some((page: any) => page?.id && page?.accessToken),
        instagramPublishing: i.type === 'META' && scopesVerified && scopes.includes('instagram_content_publish') && rawPages.some((page: any) => page?.igAccountId && page?.accessToken),
        linkedInMemberPublishing: i.type === 'LINKEDIN' && scopesVerified && scopes.includes('w_member_social') && Boolean(i.accountId),
        linkedInOrganizationPublishing: i.type === 'LINKEDIN' && scopesVerified && scopes.includes('w_organization_social') && organizations.length > 0,
        tikTokDirectPosting: i.type === 'TIKTOK' && scopesVerified && scopes.includes('video.publish'),
        tikTokCreatorInfoVerified: i.type === 'TIKTOK' && Boolean(config.creatorInfoVerifiedAt),
        youtubeVideoPublishing: i.type === 'YOUTUBE' && scopesVerified && scopes.includes('https://www.googleapis.com/auth/youtube.upload') && Boolean(i.accountId),
        youtubeReadback: i.type === 'YOUTUBE' && scopesVerified && scopes.includes('https://www.googleapis.com/auth/youtube.readonly') && Boolean(i.accountId),
        xPublishing: i.type === 'X' && scopesVerified && scopes.includes('tweet.write') && Boolean(i.accountId),
        xMediaPublishing: i.type === 'X' && scopesVerified && scopes.includes('media.write') && Boolean(i.accountId),
        xReadback: i.type === 'X' && scopesVerified && scopes.includes('tweet.read') && scopes.includes('users.read') && Boolean(i.accountId),
        tokenRefresh: Boolean(i.refreshToken),
      }
      return {
        id: i.id,
        platform: i.type,
        status: i.status,
        accountId: i.accountId,
        accountName: i.accountName,
        pages,
        organizations,
        selectedOrganizationId: config.organizationId || null,
        pictureUrl: config.pictureUrl || null,
        channelUrl: config.channelUrl || null,
        profileUrl: config.profileUrl || null,
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

    const { integrationId } = await req.json()
    if (!integrationId) return NextResponse.json({ error: 'integrationId required' }, { status: 400 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Verify ownership before disconnecting
    const integration = await prisma.integration.findFirst({
      where: { id: integrationId, workspaceId: workspace.id },
    })
    if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Social Accounts DELETE] Error:', err?.message || err)
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 })
  }
}
