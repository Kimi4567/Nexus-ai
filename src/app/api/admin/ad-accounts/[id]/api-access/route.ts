/**
 * GET/PATCH /api/admin/ad-accounts/[id]/api-access
 *
 * Admin-only gate for marking a connected Meta Ads account as reviewed for API
 * execution after Meta App Review / Business Verification approval.
 *
 * This route does not call Meta, does not create campaigns, does not activate
 * ads, and does not spend credits. It only toggles the existing
 * AdAccount.hasApiAccess flag after an explicit operator confirmation and writes
 * an immutable AdAccountApiAccessReview row in the same transaction.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import {
  deriveMetaAdsApiAccessState,
  missingMetaAdsReviewScopes,
  validateMetaAdsApiAccessChange,
} from '@/lib/metaAdsApiAccess'

const db = prisma as any

async function requireAdmin(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { role: true, email: true },
  })

  if (dbUser?.role !== 'ADMIN') return null
  return { ...authUser, email: authUser.email || dbUser.email || undefined }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const account = await db.adAccount.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      platform: true,
      status: true,
      hasApiAccess: true,
      accessToken: true,
      permissionScopes: true,
      platformAccountId: true,
      platformAccountName: true,
      pageId: true,
      pageName: true,
      businessId: true,
      businessName: true,
      workspaceId: true,
      updatedAt: true,
      apiAccessReviews: {
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          reviewedById: true,
          reviewedByEmail: true,
          previousHasApiAccess: true,
          nextHasApiAccess: true,
          evidenceUrl: true,
          reason: true,
          missingScopes: true,
          createdAt: true,
        },
      },
    },
  })

  if (!account) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })

  const state = deriveMetaAdsApiAccessState(account)
  const safeAccount = {
    id: account.id,
    platform: account.platform,
    status: account.status,
    hasApiAccess: account.hasApiAccess,
    permissionScopes: account.permissionScopes,
    platformAccountId: account.platformAccountId,
    platformAccountName: account.platformAccountName,
    pageId: account.pageId,
    pageName: account.pageName,
    businessId: account.businessId,
    businessName: account.businessName,
    workspaceId: account.workspaceId,
    updatedAt: account.updatedAt,
  }

  return NextResponse.json({
    account: safeAccount,
    apiAccessState: state,
    reviews: account.apiAccessReviews,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    hasApiAccess?: unknown
    confirmation?: unknown
    evidenceUrl?: unknown
    reason?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.hasApiAccess !== 'boolean') {
    return NextResponse.json({ error: 'hasApiAccess boolean is required' }, { status: 400 })
  }

  const account = await db.adAccount.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      platform: true,
      status: true,
      hasApiAccess: true,
      accessToken: true,
      permissionScopes: true,
      platformAccountId: true,
      platformAccountName: true,
      pageId: true,
      pageName: true,
      businessId: true,
      businessName: true,
      workspaceId: true,
      updatedAt: true,
    },
  })

  if (!account) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })

  const validation = validateMetaAdsApiAccessChange({
    account,
    nextHasApiAccess: body.hasApiAccess,
    confirmation: typeof body.confirmation === 'string' ? body.confirmation : null,
    evidenceUrl: typeof body.evidenceUrl === 'string' ? body.evidenceUrl : null,
  })

  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  const confirmation = typeof body.confirmation === 'string' ? body.confirmation : ''
  const evidenceUrl = typeof body.evidenceUrl === 'string' ? body.evidenceUrl : null
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim().slice(0, 1000)
    : null
  const missingScopes = missingMetaAdsReviewScopes(account)

  const { updated, review } = await db.$transaction(async (tx: any) => {
    const updatedAccount = await tx.adAccount.update({
      where: { id: params.id },
      data: { hasApiAccess: body.hasApiAccess },
      select: {
        id: true,
        platform: true,
        status: true,
        hasApiAccess: true,
        permissionScopes: true,
        platformAccountId: true,
        platformAccountName: true,
        pageId: true,
        pageName: true,
        businessId: true,
        businessName: true,
        updatedAt: true,
      },
    })

    const reviewRow = await tx.adAccountApiAccessReview.create({
      data: {
        adAccountId: account.id,
        workspaceId: account.workspaceId,
        reviewedById: admin.id,
        reviewedByEmail: admin.email || null,
        platform: account.platform,
        platformAccountId: account.platformAccountId,
        platformAccountName: account.platformAccountName,
        businessId: account.businessId,
        businessName: account.businessName,
        pageId: account.pageId,
        pageName: account.pageName,
        previousHasApiAccess: account.hasApiAccess,
        nextHasApiAccess: body.hasApiAccess,
        confirmation,
        evidenceUrl,
        reason,
        missingScopes,
      },
      select: {
        id: true,
        reviewedById: true,
        reviewedByEmail: true,
        previousHasApiAccess: true,
        nextHasApiAccess: true,
        evidenceUrl: true,
        reason: true,
        missingScopes: true,
        createdAt: true,
      },
    })

    return { updated: updatedAccount, review: reviewRow }
  })

  const state = deriveMetaAdsApiAccessState({
    ...updated,
    accessToken: account.accessToken,
  })

  console.info('[admin/ad-accounts/api-access]', {
    adAccountId: updated.id,
    hasApiAccess: updated.hasApiAccess,
    reviewedBy: admin.id,
    reviewId: review.id,
    evidenceUrl,
  })

  return NextResponse.json({
    ok: true,
    account: updated,
    apiAccessState: state,
    operatorReceipt: {
      reviewedBy: admin.id,
      reviewedByEmail: admin.email || null,
      reviewedAt: review.createdAt,
      reviewId: review.id,
      evidenceUrl,
      previousHasApiAccess: review.previousHasApiAccess,
      nextHasApiAccess: review.nextHasApiAccess,
      durableAuditLog: true,
      note: 'The existing hasApiAccess flag and AdAccountApiAccessReview ledger row were written in one admin-only transaction.',
    },
    review,
  })
}
