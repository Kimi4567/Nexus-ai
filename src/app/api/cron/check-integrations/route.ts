/**
 * GET /api/cron/check-integrations
 * Runs daily at 07:00 UTC.
 *
 * FL2-A: Silent Failures Prevention
 * - Scans all connected integrations
 * - Detects tokens expiring within 7 days OR already expired
 * - Sends per-user email alert grouped by workspace
 * - Returns audit summary
 *
 * LinkedIn tokens expire every 60 days.
 * Meta tokens are long-lived (~60 days) but can be revoked.
 * We check Integration.updatedAt + platform-specific TTL as a heuristic,
 * OR if the config contains a real expiresAt field (set during OAuth).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendIntegrationExpiryEmail } from '@/lib/email/resend'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

// Token TTL heuristics per platform (days) — used when no expiresAt in config
const TOKEN_TTL_DAYS: Record<string, number> = {
  LINKEDIN: 60,
  META:     60,
  TIKTOK:   30,
  YOUTUBE:  180,
  X:        30,
  PINTEREST: 30,
}

const PLATFORM_LABELS: Record<string, string> = {
  META:     'Meta (Facebook/Instagram)',
  LINKEDIN: 'LinkedIn',
  TIKTOK:   'TikTok',
  YOUTUBE:  'YouTube',
  X:        'X',
  PINTEREST: 'Pinterest',
}

const WARN_DAYS = 7  // warn when ≤ 7 days left

function daysUntilExpiry(integration: {
  type: string
  updatedAt: Date
  config: any
}): number {
  // 1. Try config.expiresAt (set by our OAuth callbacks if present)
  const configExpiry = integration.config?.expiresAt
    ?? integration.config?.expires_at
    ?? integration.config?.token_expiry
  if (configExpiry) {
    const expiry = new Date(configExpiry)
    if (!isNaN(expiry.getTime())) {
      return Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }
  }

  // 2. Fall back to TTL heuristic from last token refresh (updatedAt)
  const ttl = TOKEN_TTL_DAYS[String(integration.type)] ?? 60
  const updatedAt = new Date(integration.updatedAt)
  const ageInDays = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))
  return ttl - ageInDays
}

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const results = {
    workspacesChecked: 0,
    integrationsChecked: 0,
    expiredCount: 0,
    expiringCount: 0,
    emailsSent: 0,
    errors: [] as string[],
  }

  try {
    // Load all connected integrations with workspace owner info
    // Use (prisma.integration as any) to bypass strict typed client for fields
    // added via raw SQL. Include workspace.owner (the direct relation).
    const integrations = await (prisma.integration as any).findMany({
      where: { status: 'CONNECTED' },
      include: {
        workspace: {
          include: {
            owner: { select: { id: true, email: true, name: true } },
          },
        },
      },
    }) as Array<{
      id: string
      type: string
      updatedAt: Date
      config: any
      workspace: {
        owner: { id: string; email: string; name: string | null } | null
      } | null
    }>

    results.integrationsChecked = integrations.length

    // Group by workspace owner for batch email
    const ownerIssues = new Map<string, {
      email: string
      name: string
      expiring: Array<{ platform: string; daysLeft: number }>
      expired: Array<{ platform: string }>
      integrationIds: string[]
    }>()

    for (const intg of integrations) {
      const owner = intg.workspace?.owner
      if (!owner?.email) continue

      const days = daysUntilExpiry({
        type: String(intg.type),
        updatedAt: intg.updatedAt,
        config: intg.config as any,
      })

      const platformLabel = PLATFORM_LABELS[String(intg.type)] ?? String(intg.type)

      if (days <= 0) {
        results.expiredCount++
        const existing = ownerIssues.get(owner.id) ?? {
          email: owner.email,
          name: owner.name ?? '',
          expiring: [],
          expired: [],
          integrationIds: [],
        }
        existing.expired.push({ platform: platformLabel })
        existing.integrationIds.push(intg.id)
        ownerIssues.set(owner.id, existing)

        // Mark integration as EXPIRED in DB
        await prisma.integration.update({
          where: { id: intg.id },
          data: { status: 'EXPIRED' as any },
        }).catch(() => null)

      } else if (days <= WARN_DAYS) {
        results.expiringCount++
        const existing = ownerIssues.get(owner.id) ?? {
          email: owner.email,
          name: owner.name ?? '',
          expiring: [],
          expired: [],
          integrationIds: [],
        }
        existing.expiring.push({ platform: platformLabel, daysLeft: days })
        existing.integrationIds.push(intg.id)
        ownerIssues.set(owner.id, existing)
      }
    }

    results.workspacesChecked = ownerIssues.size

    // Send one email per owner covering all their issues
    for (const [, info] of ownerIssues.entries()) {
      try {
        const allPlatforms: string[] = [
          ...info.expired.map(e => e.platform),
          ...info.expiring.map(e => `${e.platform} (${e.daysLeft}d left)`),
        ]
        const minDaysLeft = info.expired.length > 0
          ? 0
          : Math.min(...info.expiring.map(e => e.daysLeft))

        await sendIntegrationExpiryEmail(
          info.email,
          info.name,
          allPlatforms,
          minDaysLeft,
        )
        results.emailsSent++
      } catch (err: any) {
        results.errors.push(`Email to ${info.email}: ${err.message}`)
      }
    }
  } catch (err: any) {
    results.errors.push(`Top-level: ${err.message}`)
  }

  return NextResponse.json({ ok: true, ...results, ts: new Date().toISOString() })
}
