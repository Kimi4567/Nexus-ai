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
        status: 'CONNECTED',
        type: { in: ['META', 'LINKEDIN', 'TIKTOK'] as any[] },
      },
      select: {
        id: true,
        type: true,
        status: true,
        accountId: true,
        accountName: true,
        config: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    })

    // Strip raw tokens from response — only return safe fields
    const accounts = integrations.map(i => ({
      id: i.id,
      platform: i.type,
      status: i.status,
      accountId: i.accountId,
      accountName: i.accountName,
      pages: (i.config as any)?.pages || [],
      pictureUrl: (i.config as any)?.pictureUrl || null,
      connectedAt: (i.config as any)?.connectedAt || i.createdAt,
      lastSyncedAt: i.lastSyncedAt,
    }))

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
