/**
 * GET /api/social/data-deletion-status?id=<confirmation_code>
 *
 * Public endpoint. Returns the status of a Meta data deletion request.
 * Called by the /data-deletion status page.
 *
 * No auth required — confirmation code is the access token.
 * The confirmation code is opaque and not guessable (HMAC-based).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id || id.length < 8) {
    return NextResponse.json({ error: 'Invalid confirmation code' }, { status: 400 })
  }

  try {
    const record = await (prisma as any).dataDeletionRequest.findUnique({
      where: { confirmationCode: id },
      select: {
        status: true,
        confirmationCode: true,
        requestedAt: true,
        completedAt: true,
      },
    })

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      status: record.status,
      confirmationCode: record.confirmationCode,
      requestedAt: record.requestedAt,
      completedAt: record.completedAt,
    })
  } catch (err) {
    console.error('[data-deletion-status]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
