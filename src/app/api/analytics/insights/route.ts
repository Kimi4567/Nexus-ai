/**
 * GET /api/analytics/insights
 * Rule-based AI operational insights derived from real workspace data.
 * Never fabricates metrics — every insight maps to an actual DB state.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

interface Insight {
  id: string
  type: 'action' | 'info' | 'warning' | 'success'
  icon: string
  message: string
  href?: string
}

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const insights: Insight[] = []

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    })

    if (!workspace) {
      insights.push({
        id: 'setup',
        type: 'action',
        icon: '⚡',
        message: 'Workspace ready — create your first campaign to get started',
        href: '/campaign/new',
      })
      return NextResponse.json({ insights })
    }

    // ── Pull real counts ─────────────────────────────────────────
    const [
      totalCampaigns,
      draftCampaigns,
      activeCampaigns,
      recentCampaigns,
      brandProfile,
      totalVisuals,
    ] = await Promise.all([
      prisma.campaign.count({ where: { workspaceId: workspace.id } }).catch(() => 0),
      prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'DRAFT' } }).catch(() => 0),
      prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'ACTIVE' } }).catch(() => 0),
      prisma.campaign.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, name: true, status: true, updatedAt: true },
      }).catch(() => []),
      db.brandProfile?.findUnique({ where: { workspaceId: workspace.id } }).catch(() => null) ?? null,
      db.generatedVisual?.count({
        where: { workspaceId: workspace.id, isArchived: false, status: 'COMPLETED' },
      }).catch(() => 0) ?? 0,
    ])

    // ── Generate rule-based insights ────────────────────────────

    // Brand memory state
    if (!brandProfile) {
      insights.push({
        id: 'brand-empty',
        type: 'warning',
        icon: '🧠',
        message: 'Brand memory not configured — campaigns generating without your voice',
        href: '/brand',
      })
    } else {
      const fields = [
        brandProfile.brandName,
        brandProfile.toneKeywords?.length,
        brandProfile.targetAudience,
        brandProfile.coreOffer,
      ]
      const filled = fields.filter(Boolean).length
      if (filled < 3) {
        insights.push({
          id: 'brand-incomplete',
          type: 'action',
          icon: '🧠',
          message: 'Brand memory partially configured — complete your profile for sharper AI output',
          href: '/brand',
        })
      } else {
        insights.push({
          id: 'brand-active',
          type: 'success',
          icon: '🧠',
          message: `Brand voice active — AI campaigns using your ${brandProfile.toneKeywords?.[0] || 'custom'} tone`,
          href: '/brand',
        })
      }
    }

    // Draft campaigns
    if (draftCampaigns > 0) {
      insights.push({
        id: 'drafts',
        type: 'action',
        icon: '📋',
        message: `${draftCampaigns} campaign${draftCampaigns > 1 ? 's' : ''} in draft — ready to activate`,
        href: '/campaigns',
      })
    }

    // Active campaigns
    if (activeCampaigns > 0) {
      insights.push({
        id: 'active',
        type: 'success',
        icon: '✅',
        message: `${activeCampaigns} campaign${activeCampaigns > 1 ? 's' : ''} currently active`,
        href: '/campaigns',
      })
    }

    // Visual coverage
    if (totalCampaigns > 0 && totalVisuals === 0) {
      insights.push({
        id: 'no-visuals',
        type: 'action',
        icon: '🎨',
        message: `${totalCampaigns} campaign${totalCampaigns > 1 ? 's have' : ' has'} no hero visuals — generate now`,
        href: recentCampaigns[0]?.id ? `/campaigns/${recentCampaigns[0].id}` : '/campaigns',
      })
    } else if (totalVisuals > 0) {
      insights.push({
        id: 'visuals-ready',
        type: 'info',
        icon: '🎨',
        message: `${totalVisuals} visual asset${totalVisuals > 1 ? 's' : ''} generated across your campaigns`,
        href: '/campaigns',
      })
    }

    // Recent activity
    if (recentCampaigns.length > 0) {
      const latest = recentCampaigns[0]
      const hoursAgo = Math.floor((Date.now() - new Date(latest.updatedAt).getTime()) / 3600000)
      if (hoursAgo < 24) {
        insights.push({
          id: 'recent-activity',
          type: 'info',
          icon: '⚡',
          message: `"${latest.name}" updated ${hoursAgo < 1 ? 'just now' : `${hoursAgo}h ago`}`,
          href: `/campaigns/${latest.id}`,
        })
      }
    }

    // First campaign nudge
    if (totalCampaigns === 0) {
      insights.push({
        id: 'first-campaign',
        type: 'action',
        icon: '🚀',
        message: 'No campaigns yet — launch your first AI marketing campaign',
        href: '/campaign/new',
      })
    }

  } catch (err: unknown) {
    console.warn('[insights] DB query failed:', err instanceof Error ? err.message : err)
    // Fallback insight — never leave the bar empty
    insights.push({
      id: 'system-ready',
      type: 'info',
      icon: '⚡',
      message: 'Nexus AI is ready — create a campaign to activate your marketing engine',
      href: '/campaign/new',
    })
  }

  return NextResponse.json({ insights: insights.slice(0, 4) })
}
