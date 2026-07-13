/**
 * GET /api/cron/refresh-ad-tokens
 *
 * Cron job — runs daily. Refreshes Meta long-lived ad account tokens
 * before they expire (60-day lifetime).
 *
 * Strategy:
 *   - Find all AdAccounts with tokenExpiresAt within 15 days
 *   - Exchange the existing long-lived token for a new one
 *   - Update the DB with the new token + expiry
 *   - Mark accounts with expired tokens as DISCONNECTED
 *
 * Meta long-lived token refresh:
 *   GET /oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=<old_token>
 *
 * Note: Meta tokens can only be refreshed if they haven't already expired.
 * Once expired, the user must reconnect.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptToken, decryptToken } from '@/lib/tokenCrypto'
import { cronAuthError } from '@/lib/cronAuth'
import { metaGraphUrl } from '@/lib/socialPlatformConfig'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const now = new Date()
  const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const stats = {
    checked: 0,
    refreshed: 0,
    expired: 0,
    errors: 0,
  }

  try {
    const db = prisma as any

    // Find accounts expiring soon OR already expired (but not too long ago — still refreshable)
    const accounts = await db.adAccount.findMany({
      where: {
        platform: 'META',
        status: 'ACTIVE',
        tokenExpiresAt: {
          lte: fifteenDaysFromNow,
          gte: sevenDaysAgo, // Don't try to refresh tokens that expired > 7 days ago
        },
        accessToken: { not: null },
      },
      select: {
        id: true,
        workspaceId: true,
        platformAccountId: true,
        platformAccountName: true,
        accessToken: true,
        tokenExpiresAt: true,
        workspace: {
          select: {
            ownerId: true,
          },
        },
      },
    })

    stats.checked = accounts.length
    console.log(`[refresh-ad-tokens] Found ${accounts.length} Meta ad accounts to refresh`)

    const appId = process.env.META_APP_ID!
    const appSecret = process.env.META_APP_SECRET!

    if (!appId || !appSecret) {
      console.error('[refresh-ad-tokens] META_APP_ID or META_APP_SECRET not configured')
      return NextResponse.json({ error: 'Meta credentials not configured', stats }, { status: 500 })
    }

    for (const account of accounts) {
      try {
        // Decrypt the stored token
        const currentToken = decryptToken(account.accessToken) || account.accessToken

        // Attempt to exchange for a fresh long-lived token
        const refreshRes = await fetch(
          `${metaGraphUrl('oauth/access_token')}` +
          `?grant_type=fb_exchange_token` +
          `&client_id=${appId}` +
          `&client_secret=${appSecret}` +
          `&fb_exchange_token=${encodeURIComponent(currentToken)}`
        )

        const refreshData = await refreshRes.json()

        if (refreshData.error) {
          const errorCode = refreshData.error?.code
          const errorMsg = refreshData.error?.message || 'Unknown error'

          // Error 190 = invalid/expired token — mark as disconnected
          if (errorCode === 190 || errorCode === 102 || refreshData.error?.type === 'OAuthException') {
            console.warn(`[refresh-ad-tokens] Token expired/invalid for account ${account.id}: ${errorMsg}`)
            await db.adAccount.update({
              where: { id: account.id },
              data: { status: 'DISCONNECTED' },
            })
            stats.expired++
          } else {
            console.error(`[refresh-ad-tokens] Refresh failed for account ${account.id}:`, refreshData.error)
            stats.errors++
          }
          continue
        }

        if (refreshData.access_token) {
          // Calculate new expiry
          const expiresIn = refreshData.expires_in // seconds, typically 5183944 (~60 days)
          const newExpiry = new Date(
            now.getTime() + (expiresIn ? expiresIn * 1000 : 60 * 24 * 60 * 60 * 1000)
          )

          // Encrypt and save
          const newEncryptedToken = encryptToken(refreshData.access_token)

          await db.adAccount.update({
            where: { id: account.id },
            data: {
              accessToken: newEncryptedToken,
              tokenExpiresAt: newExpiry,
              status: 'ACTIVE',
              lastSyncAt: now,
            },
          })

          stats.refreshed++
          console.log(
            `[refresh-ad-tokens] Refreshed token for account ${account.platformAccountName} ` +
            `(${account.platformAccountId}) — new expiry: ${newExpiry.toISOString()}`
          )
        }
      } catch (accountErr) {
        console.error(`[refresh-ad-tokens] Error processing account ${account.id}:`, accountErr)
        stats.errors++
      }
    }

    // Also mark any accounts whose tokens are clearly expired (> 7 days ago) as DISCONNECTED
    const expiredAccounts = await db.adAccount.updateMany({
      where: {
        platform: 'META',
        status: 'ACTIVE',
        tokenExpiresAt: { lt: sevenDaysAgo },
      },
      data: { status: 'DISCONNECTED' },
    })

    console.log(`[refresh-ad-tokens] Done. Stats:`, stats)
    if (expiredAccounts.count > 0) {
      console.log(`[refresh-ad-tokens] Marked ${expiredAccounts.count} long-expired accounts as DISCONNECTED`)
    }

    return NextResponse.json({
      success: true,
      stats,
      expiredMarked: expiredAccounts.count,
      runAt: now.toISOString(),
    })
  } catch (err) {
    console.error('[refresh-ad-tokens] Fatal error:', err)
    return NextResponse.json({ error: 'Cron failed', stats }, { status: 500 })
  }
}
