/**
 * POST /api/social/callback/meta-data-deletion
 *
 * Meta Platform Policy — Data Deletion Callback (Required for App Review)
 *
 * When a user deauthorizes our app or deletes their Facebook account, Meta
 * sends a signed_request to this endpoint. We must:
 *   1. Verify the signature using HMAC-SHA256 + META_APP_SECRET
 *   2. Delete or queue deletion of the user's data
 *   3. Return a JSON response with confirmation URL + code
 *
 * Meta verifies this endpoint works correctly during App Review.
 *
 * Reference:
 *   https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * Response format (REQUIRED):
 *   { "url": "https://nexus-grow.com/data-deletion?id=<code>", "confirmation_code": "<code>" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { captureOperationalError } from '@/lib/observability/operationalError'
import {
  isValidFreshMetaSignedRequest,
  readMetaSignedRequest,
  verifyMetaSignedRequest,
} from '@/lib/metaSignedRequest'

/**
 * Generate a unique confirmation code for tracking
 */
function generateConfirmationCode(): string {
  return `del_${randomBytes(24).toString('base64url')}`
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[Meta Data Deletion] META_APP_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const signedRequest = await readMetaSignedRequest(req)
    if (!signedRequest) {
      console.error('[Meta Data Deletion] Missing signed_request in body')
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
    }

    const payload = verifyMetaSignedRequest(signedRequest, appSecret)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })
    }

    const { userId: fbUserId, issuedAt } = payload
    if (!isValidFreshMetaSignedRequest(payload)) {
      const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt
      console.warn('[Meta Data Deletion] Invalid or stale request rejected, age:', ageSeconds, 's')
      return NextResponse.json({ error: 'Request too old' }, { status: 400 })
    }

    console.log(`[Meta Data Deletion] Request for FB user: ${fbUserId}`)

    // Check for duplicate request (idempotent)
    const existing = await (prisma as any).dataDeletionRequest.findFirst({
      where: { fbUserId, status: { in: ['pending', 'completed'] } },
      orderBy: { requestedAt: 'desc' },
    }).catch(() => null)

    if (existing && ['completed', 'not_found'].includes(existing.status)) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.nexus-grow.com'
      return NextResponse.json({
        url: `${baseUrl}/data-deletion?id=${existing.confirmationCode}`,
        confirmation_code: existing.confirmationCode,
      })
    }

    // Generate confirmation code
    const confirmationCode = existing?.confirmationCode || generateConfirmationCode()

    // Meta callback accountId is stored during OAuth, so the request can be
    // mapped without inspecting or guessing from unrelated ad accounts.
    const integrations = await prisma.integration.findMany({
      where: { type: 'META', accountId: fbUserId },
      select: {
        id: true,
        workspaceId: true,
        workspace: { select: { ownerId: true } },
      },
    })
    const workspaceIds = [...new Set(integrations.map((integration) => integration.workspaceId))]
    const internalUserId = integrations[0]?.workspace.ownerId || null
    const finalStatus = integrations.length > 0 ? 'completed' : 'not_found'
    const completedAt = new Date()

    await prisma.$transaction(async (tx) => {
      if (workspaceIds.length > 0) {
        await tx.integration.deleteMany({ where: { id: { in: integrations.map((integration) => integration.id) } } })
        await (tx as any).adAccount.deleteMany({ where: { workspaceId: { in: workspaceIds }, platform: 'META' } })
      }
      if (existing) {
        await (tx as any).dataDeletionRequest.update({
          where: { id: existing.id },
          data: { userId: internalUserId, status: finalStatus, completedAt },
        })
      } else {
        await (tx as any).dataDeletionRequest.create({
          data: {
            fbUserId,
            userId: internalUserId,
            status: finalStatus,
            confirmationCode,
            requestedAt: new Date(),
            completedAt,
          },
        })
      }
    })

    console.log(`[Meta Data Deletion] ${finalStatus} request ${confirmationCode} for FB user ${fbUserId}`)

    // Return the required response format
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.nexus-grow.com'
    return NextResponse.json({
      url: `${baseUrl}/data-deletion?id=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    await captureOperationalError(err, {
      operation: 'oauth.meta-data-deletion',
      route: '/api/social/callback/meta-data-deletion',
      component: 'oauth',
      method: 'POST',
      requestId: req.headers?.get?.('x-vercel-id') ?? null,
      statusCode: 500,
      retryable: true,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET handler — Meta may ping this during App Review verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const suppliedToken = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode || suppliedToken || challenge) {
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN
    if (!expectedToken) {
      console.error('[Meta Data Deletion] META_WEBHOOK_VERIFY_TOKEN not configured')
      return NextResponse.json({ error: 'Webhook verification is not configured' }, { status: 503 })
    }
    const supplied = Buffer.from(suppliedToken || '')
    const expected = Buffer.from(expectedToken)
    const tokenMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected)
    if (mode !== 'subscribe' || !challenge || !tokenMatches) {
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 })
    }
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({
    status: 'ok',
    endpoint: 'Meta Data Deletion Callback',
    docs: 'https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback',
  })
}
