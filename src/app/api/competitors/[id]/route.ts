import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { brandContextFingerprint } from '@/lib/brandContextLifecycle'
import { prisma } from '@/lib/prisma'

const db = prisma as any

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as { status?: unknown; confirmCurrentBrandContext?: unknown }
  const status = body.status === 'ACTIVE' || body.status === 'PAUSED' ? body.status : null
  if (!status) return NextResponse.json({ error: 'Status must be ACTIVE or PAUSED.' }, { status: 400 })

  const competitor = await db.competitor.findFirst({
    where: { id, workspace: { ownerId: user.id } },
    select: {
      id: true,
      workspaceId: true,
      contextReviewRequired: true,
    },
  })
  if (!competitor) return NextResponse.json({ error: 'Competitor not found.' }, { status: 404 })

  const confirmingCurrentContext = status === 'ACTIVE'
    && competitor.contextReviewRequired
    && body.confirmCurrentBrandContext === true
  if (status === 'ACTIVE' && competitor.contextReviewRequired && !confirmingCurrentContext) {
    return NextResponse.json({
      error: 'The Brand Brain identity changed. Confirm this competitor for the current brand before resuming monitoring.',
      code: 'BRAND_CONTEXT_REVIEW_REQUIRED',
    }, { status: 409 })
  }

  let currentFingerprint: string | undefined
  if (confirmingCurrentContext) {
    const profile = await prisma.brandProfile.findUnique({
      where: { workspaceId: competitor.workspaceId },
      select: {
        brandName: true,
        industry: true,
        primaryOffer: true,
        websiteUrl: true,
      },
    })
    if (!profile?.brandName || !profile.industry) {
      return NextResponse.json({
        error: 'Complete the current Brand Brain name and industry before confirming this competitor.',
        code: 'BRAND_CONTEXT_REQUIRED',
      }, { status: 409 })
    }
    currentFingerprint = brandContextFingerprint(profile)
  }

  const now = new Date()
  const updated = await db.competitor.update({
    where: { id },
    data: {
      status,
      nextScanAt: status === 'ACTIVE' ? now : null,
      ...(confirmingCurrentContext ? {
        brandContextFingerprint: currentFingerprint,
        contextReviewRequired: false,
        contextInvalidatedAt: null,
        contextReviewedAt: now,
        baselineStatus: 'RUNNING',
        baselineAt: null,
        lastError: null,
      } : {}),
      sources: status === 'ACTIVE'
        ? {
            updateMany: {
              where: { enabled: true },
              data: {
                nextScanAt: now,
                lastError: null,
                ...(confirmingCurrentContext ? {
                  etag: null,
                  lastModified: null,
                  lastHash: null,
                  leaseUntil: null,
                  leaseToken: null,
                } : {}),
              },
            },
          }
        : undefined,
    },
    include: { sources: true, _count: { select: { signals: true } } },
  })
  return NextResponse.json({ competitor: updated })
}
