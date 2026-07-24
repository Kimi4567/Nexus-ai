import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isValidFreshMetaSignedRequest,
  readMetaSignedRequest,
  verifyMetaSignedRequest,
} from '@/lib/metaSignedRequest'
import { captureOperationalError } from '@/lib/observability/operationalError'
import { createSocialDisconnectTombstone } from '@/lib/socialIntegrationDisconnect'

export async function POST(req: NextRequest) {
  const appSecret = process.env.THREADS_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const signedRequest = await readMetaSignedRequest(req)
    if (!signedRequest) {
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
    }

    const payload = verifyMetaSignedRequest(signedRequest, appSecret)
    if (!payload || !isValidFreshMetaSignedRequest(payload)) {
      return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })
    }

    const tombstone = createSocialDisconnectTombstone()
    const integrations = await prisma.integration.findMany({
      where: { type: 'THREADS', accountId: payload.userId },
      select: { id: true, workspaceId: true },
    })

    if (integrations.length > 0) {
      const workspaceIds = [...new Set(integrations.map(integration => integration.workspaceId))]
      await prisma.$transaction(async tx => {
        await tx.integration.updateMany({
          where: { id: { in: integrations.map(integration => integration.id) } },
          data: {
            status: 'DISCONNECTED',
            accessToken: null,
            refreshToken: null,
            config: tombstone,
            lastSyncedAt: null,
          },
        })
        await tx.marketingLearningEvent.createMany({
          data: workspaceIds.map(workspaceId => ({
            workspaceId,
            eventType: 'PLATFORM_DISCONNECTED',
            source: 'INTEGRATION_WORKFLOW',
            actor: 'SYSTEM',
            metadata: {
              platform: 'THREADS',
              callbackSource: 'THREADS_UNINSTALL',
              localCredentialsErased: true,
              providerRevocationConfirmed: true,
            },
          })),
        })
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'oauth.threads-uninstall',
      route: '/api/social/callback/threads-uninstall',
      component: 'oauth',
      method: 'POST',
      requestId: req.headers.get('x-vercel-id'),
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Threads Uninstall Callback',
  })
}
