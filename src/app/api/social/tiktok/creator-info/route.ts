import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/tokenCrypto'
import { queryTikTokCreatorInfo } from '@/lib/tiktokPublishing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const integrationId = new URL(req.url).searchParams.get('integrationId')?.slice(0, 100)
  if (!integrationId) return NextResponse.json({ error: 'integrationId is required' }, { status: 400 })

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: 'TIKTOK',
      status: 'CONNECTED',
      workspace: { ownerId: userId },
    },
    select: { accessToken: true, config: true },
  })
  if (!integration?.accessToken) {
    return NextResponse.json({ error: 'TikTok is not connected' }, { status: 404 })
  }
  const accessToken = decryptToken(integration.accessToken)
  if (!accessToken) return NextResponse.json({ error: 'TikTok token could not be decrypted' }, { status: 503 })

  try {
    const creator = await queryTikTokCreatorInfo(accessToken)
    const config = integration.config && typeof integration.config === 'object' && !Array.isArray(integration.config)
      ? integration.config as Record<string, unknown>
      : {}
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        config: {
          ...config,
          creatorInfoVerifiedAt: new Date().toISOString(),
          privacyLevelOptions: creator.privacyLevelOptions,
          creatorUsername: creator.creatorUsername,
        },
        lastSyncedAt: new Date(),
      },
    })
    return NextResponse.json({ creator })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TikTok creator information failed'
    const expired = /expired|invalid.*token|access_token_invalid/i.test(message)
    if (expired) {
      await prisma.integration.update({ where: { id: integrationId }, data: { status: 'EXPIRED' } }).catch(() => {})
    }
    return NextResponse.json({ error: message, reconnectRequired: expired }, { status: expired ? 409 : 502 })
  }
}
