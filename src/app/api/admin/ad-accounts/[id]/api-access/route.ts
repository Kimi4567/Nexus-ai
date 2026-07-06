/**
 * PATCH /api/admin/ad-accounts/[id]/api-access
 *
 * Admin-only gate for marking a connected Meta Ads account as reviewed for API
 * execution after Meta App Review / Business Verification approval.
 *
 * This route does not call Meta, does not create campaigns, does not activate
 * ads, and does not spend credits. It only toggles the existing
 * AdAccount.hasApiAccess flag after an explicit operator confirmation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import {
  deriveMetaAdsApiAccessState,
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    hasApiAccess?: unknown
    confirmation?: unknown
    evidenceUrl?: unknown
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

  const updated = await db.adAccount.update({
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

  const state = deriveMetaAdsApiAccessState({
    ...updated,
    accessToken: account.accessToken,
  })

  console.info('[admin/ad-accounts/api-access]', {
    adAccountId: updated.id,
    hasApiAccess: updated.hasApiAccess,
    reviewedBy: admin.id,
    evidenceUrl: body.evidenceUrl || null,
  })

  return NextResponse.json({
    ok: true,
    account: updated,
    apiAccessState: state,
    operatorReceipt: {
      reviewedBy: admin.id,
      reviewedByEmail: admin.email || null,
      reviewedAt: new Date().toISOString(),
      evidenceUrl: body.evidenceUrl || null,
      durableAuditLog: false,
      note: 'The existing hasApiAccess flag was updated through an admin-only route. Add a dedicated audit table before broad self-serve rollout.',
    },
  })
}
