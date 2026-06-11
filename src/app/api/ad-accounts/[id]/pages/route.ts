/**
 * GET /api/ad-accounts/[id]/pages
 * Returns all Facebook Pages accessible with the ad account's token.
 * Used in the Paid Campaigns UI to let users pick which Page to use for ad creatives.
 *
 * PATCH /api/ad-accounts/[id]/pages
 * Body: { pageId, pageName }
 * Saves the selected Facebook Page for this ad account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { decryptToken } from '@/lib/tokenCrypto'

const db = prisma as any

// GET — list available Facebook Pages
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await db.adAccount.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      select: { accessToken: true, pageId: true, pageName: true, status: true },
    })

    if (!account) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
    if (!account.accessToken) return NextResponse.json({ error: 'Account not connected' }, { status: 400 })

    const token = decryptToken(account.accessToken) || account.accessToken

    // Fetch pages from Meta Graph API
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts` +
      `?fields=id,name,category,fan_count,picture` +
      `&access_token=${token}`
    )
    const pagesData = await pagesRes.json()

    if (pagesData.error) {
      console.error('[ad-accounts/pages GET] Meta API error:', pagesData.error)
      return NextResponse.json({ error: pagesData.error.message, pages: [] }, { status: 400 })
    }

    return NextResponse.json({
      pages: pagesData.data || [],
      currentPageId: account.pageId,
      currentPageName: account.pageName,
    })
  } catch (err) {
    console.error('[ad-accounts/pages GET]', err)
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
  }
}

// PATCH — save selected Facebook Page
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await db.adAccount.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
    })
    if (!account) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })

    const { pageId, pageName } = await req.json()
    if (!pageId) return NextResponse.json({ error: 'pageId is required' }, { status: 400 })

    const updated = await db.adAccount.update({
      where: { id: params.id },
      data: { pageId, pageName: pageName || null },
    })

    return NextResponse.json({ success: true, pageId: updated.pageId, pageName: updated.pageName })
  } catch (err) {
    console.error('[ad-accounts/pages PATCH]', err)
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
  }
}
