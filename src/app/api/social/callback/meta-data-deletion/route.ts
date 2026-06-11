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
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'

// Meta signs requests using base64url (replaces + with -, / with _)
function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

/**
 * Verify Meta's signed_request parameter.
 * Format: <base64url_signature>.<base64url_payload>
 */
function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): { userId: string; algorithm: string; issuedAt: number } | null {
  try {
    const parts = signedRequest.split('.')
    if (parts.length !== 2) return null

    const [encodedSig, encodedPayload] = parts
    const sig = base64UrlDecode(encodedSig)
    const payload = base64UrlDecode(encodedPayload)

    // Verify HMAC-SHA256 signature
    const expectedSig = createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest()

    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expectedSig.length) return null
    let mismatch = 0
    for (let i = 0; i < sig.length; i++) {
      mismatch |= sig[i] ^ expectedSig[i]
    }
    if (mismatch !== 0) {
      console.error('[Meta Data Deletion] Signature mismatch — possible forgery')
      return null
    }

    const data = JSON.parse(payload.toString('utf8'))
    return {
      userId: String(data.user_id || ''),
      algorithm: String(data.algorithm || ''),
      issuedAt: Number(data.issued_at || 0),
    }
  } catch (err) {
    console.error('[Meta Data Deletion] Failed to parse signed_request:', err)
    return null
  }
}

/**
 * Generate a unique confirmation code for tracking
 */
function generateConfirmationCode(fbUserId: string): string {
  const ts = Date.now().toString(36)
  const hash = createHmac('sha256', fbUserId)
    .update(ts)
    .digest('hex')
    .slice(0, 12)
  return `del_${hash}_${ts}`
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[Meta Data Deletion] META_APP_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    // Meta sends the signed_request as form-encoded body
    let signedRequest: string | null = null

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const body = await req.text()
      const params = new URLSearchParams(body)
      signedRequest = params.get('signed_request')
    } else if (contentType.includes('application/json')) {
      // Some implementations send JSON
      const body = await req.json()
      signedRequest = body.signed_request
    } else {
      // Try form data as fallback
      const formData = await req.formData().catch(() => null)
      if (formData) signedRequest = formData.get('signed_request') as string | null
    }

    if (!signedRequest) {
      console.error('[Meta Data Deletion] Missing signed_request in body')
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
    }

    // Verify and parse
    const payload = parseSignedRequest(signedRequest, appSecret)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })
    }

    const { userId: fbUserId, issuedAt } = payload

    // Reject stale requests (> 1 hour old)
    const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt
    if (ageSeconds > 3600) {
      console.warn('[Meta Data Deletion] Stale request rejected, age:', ageSeconds, 's')
      return NextResponse.json({ error: 'Request too old' }, { status: 400 })
    }

    console.log(`[Meta Data Deletion] Request for FB user: ${fbUserId}`)

    // Check for duplicate request (idempotent)
    const existing = await (prisma as any).dataDeletionRequest.findFirst({
      where: { fbUserId, status: { in: ['pending', 'completed'] } },
      orderBy: { requestedAt: 'desc' },
    }).catch(() => null)

    if (existing?.status === 'completed') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-grow.com'
      return NextResponse.json({
        url: `${baseUrl}/data-deletion?id=${existing.confirmationCode}`,
        confirmation_code: existing.confirmationCode,
      })
    }

    // Generate confirmation code
    const confirmationCode = generateConfirmationCode(fbUserId)

    // --- Data Deletion ---
    // Try to find internal user by matching Meta FB user ID stored in Integration table
    let internalUserId: string | undefined

    // Look for the user via their Meta Integration token
    // We match by checking which workspace has a META integration
    // (we don't store fbUserId directly, but can try to find via adAccount)
    const adAccount = await (prisma as any).adAccount.findFirst({
      where: {
        platform: 'META',
        // We can't directly match fbUserId here since we don't store it in AdAccount
        // Best effort: log + create the deletion request, admin must process
      },
    }).catch(() => null)

    // Create deletion request record
    await (prisma as any).dataDeletionRequest.create({
      data: {
        fbUserId,
        userId: internalUserId || null,
        status: 'pending',
        confirmationCode,
        requestedAt: new Date(),
      },
    })

    // Attempt automatic data deletion:
    // Remove Meta Ads ad accounts linked to this FB user ID
    // (Since we can't 100% match fbUserId → our userId without storing it,
    //  we mark as pending and handle via admin or background job)
    //
    // What we CAN clean up immediately: any Integration records for META platform
    // where we'd need to cross-reference. This is a best-effort immediate deletion.
    // Full deletion is tracked via the DataDeletionRequest and confirmed at /data-deletion
    console.log(`[Meta Data Deletion] Created deletion request ${confirmationCode} for FB user ${fbUserId}`)

    // Return the required response format
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-grow.com'
    return NextResponse.json({
      url: `${baseUrl}/data-deletion?id=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    console.error('[Meta Data Deletion] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET handler — Meta may ping this during App Review verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')

  if (challenge) {
    // Webhook verification challenge
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({
    status: 'ok',
    endpoint: 'Meta Data Deletion Callback',
    docs: 'https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback',
  })
}
