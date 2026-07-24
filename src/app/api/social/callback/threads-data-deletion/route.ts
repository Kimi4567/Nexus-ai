import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isValidFreshMetaSignedRequest,
  readMetaSignedRequest,
  verifyMetaSignedRequest,
} from '@/lib/metaSignedRequest'
import { captureOperationalError } from '@/lib/observability/operationalError'

function confirmationUrl(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.nexus-grow.com'
  return `${baseUrl}/data-deletion?id=${code}`
}

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

    const providerUserKey = `threads:${payload.userId}`
    const existing = await prisma.dataDeletionRequest.findFirst({
      where: {
        fbUserId: providerUserKey,
        status: { in: ['pending', 'completed', 'not_found'] },
      },
      orderBy: { requestedAt: 'desc' },
    })

    if (existing && ['completed', 'not_found'].includes(existing.status)) {
      return NextResponse.json({
        url: confirmationUrl(existing.confirmationCode),
        confirmation_code: existing.confirmationCode,
      })
    }

    const confirmationCode = existing?.confirmationCode
      || `del_${randomBytes(24).toString('base64url')}`
    const integrations = await prisma.integration.findMany({
      where: { type: 'THREADS', accountId: payload.userId },
      select: {
        id: true,
        workspace: { select: { ownerId: true } },
      },
    })
    const finalStatus = integrations.length > 0 ? 'completed' : 'not_found'
    const completedAt = new Date()

    await prisma.$transaction(async tx => {
      if (integrations.length > 0) {
        await tx.integration.deleteMany({
          where: { id: { in: integrations.map(integration => integration.id) } },
        })
      }

      if (existing) {
        await tx.dataDeletionRequest.update({
          where: { id: existing.id },
          data: {
            userId: integrations[0]?.workspace.ownerId || null,
            status: finalStatus,
            completedAt,
          },
        })
      } else {
        await tx.dataDeletionRequest.create({
          data: {
            fbUserId: providerUserKey,
            userId: integrations[0]?.workspace.ownerId || null,
            status: finalStatus,
            confirmationCode,
            requestedAt: new Date(),
            completedAt,
          },
        })
      }
    })

    return NextResponse.json({
      url: confirmationUrl(confirmationCode),
      confirmation_code: confirmationCode,
    })
  } catch (error) {
    await captureOperationalError(error, {
      operation: 'oauth.threads-data-deletion',
      route: '/api/social/callback/threads-data-deletion',
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
    endpoint: 'Threads Data Deletion Callback',
  })
}
