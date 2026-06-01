import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

// GET /api/social/accounts — list all connected integrations
export async function GET(req: NextRequest) {
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
}

// DELETE /api/social/accounts — disconnect an integration
export async function DELETE(req: NextRequest) {
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
}
