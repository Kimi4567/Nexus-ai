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
import { googleAdsAccessTier } from '@/lib/adPlatforms/googleAdsApi'

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
        businessId: true,
        currency: true,
        timeZone: true,
        isVerified: true,
        hasApiAccess: true,
        permissionScopes: true,
        spendLimit: true,
        totalSpent: true,
        lastSyncAt: true,
        tokenExpiresAt: true,
        pageId: true,
        pageName: true,
        pixelId: true,
        loginCustomerId: true,
        lastError: true,
        lastErrorAt: true,
        createdAt: true,
        // Never expose accessToken / refreshToken to the client
      },
    })

    const googleIntegration = await db.integration.findUnique({
      where: {
        workspaceId_type: {
          workspaceId: workspace.id,
          type: 'GOOGLE',
        },
      },
      select: {
        id: true,
        status: true,
        accountId: true,
        accountName: true,
        config: true,
        refreshToken: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    })
    const googleConfig = googleIntegration?.config
      && typeof googleIntegration.config === 'object'
      && !Array.isArray(googleIntegration.config)
      ? googleIntegration.config as Record<string, unknown>
      : {}
    const rawManagers = Array.isArray(googleConfig.managerAccounts)
      ? googleConfig.managerAccounts
      : []
    const managerAccounts = rawManagers.map((value: unknown) => {
      const manager = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
      return {
        customerId: typeof manager.customerId === 'string' ? manager.customerId : '',
        descriptiveName: typeof manager.descriptiveName === 'string' ? manager.descriptiveName : '',
        status: typeof manager.status === 'string' ? manager.status : 'UNKNOWN',
        testAccount: manager.testAccount === true,
      }
    }).filter((manager: { customerId: string }) => manager.customerId)

    return NextResponse.json({
      accounts: accounts.map((account: Record<string, unknown>) => ({
        ...account,
        apiAccessTier: account.platform === 'GOOGLE' ? googleAdsAccessTier() : null,
      })),
      googleAdsConnection: googleIntegration && googleIntegration.status !== 'DISCONNECTED'
        ? {
            id: googleIntegration.id,
            platform: 'GOOGLE',
            status: googleIntegration.status,
            accountId: googleIntegration.accountId,
            accountName: googleIntegration.accountName,
            connectionRole: typeof googleConfig.connectionRole === 'string'
              ? googleConfig.connectionRole
              : 'UNKNOWN',
            advertiserAccountCount: typeof googleConfig.advertiserAccountCount === 'number'
              ? googleConfig.advertiserAccountCount
              : 0,
            advertiserReadiness: typeof googleConfig.advertiserReadiness === 'string'
              ? googleConfig.advertiserReadiness
              : 'UNKNOWN',
            accessTier: typeof googleConfig.accessTier === 'string'
              ? googleConfig.accessTier
              : googleAdsAccessTier(),
            managerAccounts,
            hasRefreshToken: Boolean(googleIntegration.refreshToken),
            lastSyncedAt: googleIntegration.lastSyncedAt,
            connectedAt: typeof googleConfig.connectedAt === 'string'
              ? googleConfig.connectedAt
              : googleIntegration.createdAt,
          }
        : null,
    })
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
    const integrationId = searchParams.get('integrationId')
    if (!id && !integrationId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    if (integrationId) {
      const integration = await db.integration.findFirst({
        where: {
          id: integrationId,
          workspaceId: workspace.id,
          type: 'GOOGLE',
        },
      })
      if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      await db.$transaction([
        db.integration.update({
          where: { id: integration.id },
          data: {
            status: 'DISCONNECTED',
            accessToken: null,
            refreshToken: null,
          },
        }),
        db.adAccount.updateMany({
          where: { workspaceId: workspace.id, platform: 'GOOGLE' },
          data: {
            status: 'DISCONNECTED',
            accessToken: null,
            refreshToken: null,
            tokenExpiresAt: null,
            hasApiAccess: false,
          },
        }),
      ])

      return NextResponse.json({ success: true })
    }

    // Verify ownership before deleting
    const account = await db.adAccount.findFirst({
      where: { id: id!, workspaceId: workspace.id },
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
        hasApiAccess: false,
        lastError: null,
        lastErrorAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ad-accounts DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
