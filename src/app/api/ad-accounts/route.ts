/**
 * GET /api/ad-accounts
 * Returns all connected ad accounts for the user's workspace.
 *
 * DELETE /api/ad-accounts?id=xxx
 * Disconnects an ad account (soft-delete: sets status to DISCONNECTED).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ accounts: [] })

    const accounts = await db.adAccount.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        status: true,
        platformAccountId: true,
        platformAccountName: true,
        businessName: true,
        currency: true,
        timeZone: true,
        isVerified: true,
        hasApiAccess: true,
        spendLimit: true,
        totalSpent: true,
        lastSyncAt: true,
        tokenExpiresAt: true,
        pageId: true,
        pageName: true,
        pixelId: true,
        createdAt: true,
        // Never expose accessToken / refreshToken to the client
      },
    })

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error('[ad-accounts GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Verify ownership before deleting
    const account = await db.adAccount.findFirst({
      where: { id, workspaceId: workspace.id },
    })
    if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Soft-disconnect: clear tokens + set status to DISCONNECTED
    await db.adAccount.update({
      where: { id },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ad-accounts DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
