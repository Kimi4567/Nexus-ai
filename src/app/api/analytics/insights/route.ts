/**
 * GET /api/analytics/insights
 * Rule-based AI operational insights derived from real workspace data.
 * Never fabricates metrics — every insight maps to an actual DB state.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { calculateBrandMaturity } from '@/lib/brandMaturity'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

interface Insight {
  id: string
  type: 'action' | 'info' | 'warning' | 'success'
  icon: string
  message: string
  messageAr?: string
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
        message: 'Workspace created — create your first campaign brief to get started',
        messageAr: 'تم إنشاء مساحة العمل — أنشئ أول بريف حملة للبدء',
        href: '/campaigns/new',
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
      generatedVisuals,
      finalMediaPosts,
      acceptedLearningCount,
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
      // Content Hub final-media truth lives on the post revision, regardless of
      // whether the media came from Video Studio, image generation, or an owned
      // upload. GeneratedVisual alone cannot represent that final attachment.
      db.socialPost?.count({
        where: {
          workspaceId: workspace.id,
          imageUrl: { not: null },
          generationStatus: 'DONE',
        },
      }).catch(() => 0) ?? 0,
      // PR-1I: same learning signal the Brand Brain page/score uses, so the
      // readiness status here can never disagree with /api/brand or the Dashboard.
      db.brainLearning?.count({ where: { workspaceId: workspace.id, status: 'accepted' } }).catch(() => 0) ?? 0,
    ])

    // ── Generate rule-based insights ────────────────────────────

    // Brand memory state
    if (!brandProfile) {
      insights.push({
        id: 'brand-empty',
        type: 'warning',
        icon: '🧠',
        message: 'Brand memory needs setup — add your voice before relying on generated strategy',
        messageAr: 'ذاكرة العلامة تحتاج إعداداً — أضف نبرة علامتك قبل الاعتماد على الاستراتيجية المولّدة',
        href: '/brand',
      })
    } else {
      // PR-1I: readiness state derives from the SAME maturity status the Brand
      // Brain page + Dashboard use (calculateBrandMaturity → 'active' ≥ 80,
      // 'building' 50–79, 'needs_data' < 50). Never claim "ready/active" while the
      // brand is still partial, so Analytics can't contradict the other surfaces.
      const brandTruthReport = reviewBrandTruthConsistency(brandProfile)
      const { status } = calculateBrandMaturity(brandProfile, { acceptedLearningCount })
      if (brandTruthReport.status === 'blocked') {
        insights.push({
          id: 'brand-truth-conflict',
          type: 'warning',
          icon: '⚠️',
          message: 'Brand Brain has a source-of-truth conflict — resolve it before strategy, content, or performance learning continues',
          messageAr: 'يوجد تعارض في مصدر الحقيقة داخل Brand Brain — احسمه قبل متابعة الاستراتيجية أو المحتوى أو تعلّم الأداء',
          href: '/brand',
        })
      } else if (status === 'active') {
        insights.push({
          id: 'brand-active',
          type: 'success',
          icon: '🧠',
          message: `Brand voice signals available — NEXUS can apply your ${brandProfile.toneKeywords?.[0] || 'custom'} tone during generation`,
          messageAr: `إشارات نبرة العلامة متاحة — يستطيع NEXUS تطبيق نبرة ${brandProfile.toneKeywords?.[0] || 'مخصصة'} أثناء التوليد`,
          href: '/brand',
        })
      } else if (status === 'building') {
        insights.push({
          id: 'brand-incomplete',
          type: 'action',
          icon: '🧠',
          message: 'Brand memory has core context — add proof, analytics, and reviewed signals over time to sharpen output',
          messageAr: 'Brand Brain يحتوي على سياق أساسي — أضف إثباتات وتحليلات وإشارات مراجَعة مع الوقت لتحسين المخرجات',
          href: '/brand',
        })
      } else {
        insights.push({
          id: 'brand-needs-data',
          type: 'warning',
          icon: '🧠',
          message: 'Brand memory is still early — add saved context, proof, analytics, and reviewed signals before treating outputs as sharper',
          messageAr: 'إشارات Brand Brain ما زالت مبكرة — أضف سياقاً محفوظاً وإثباتات وتحليلات وإشارات مراجَعة قبل اعتبار المخرجات أكثر دقة',
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
        message: `${draftCampaigns} campaign${draftCampaigns > 1 ? 's' : ''} in draft — review before scheduling`,
        messageAr: `${draftCampaigns} ${draftCampaigns === 1 ? 'حملة في المسودة' : 'حملات في المسودة'} — راجعها قبل الجدولة`,
        href: '/campaigns',
      })
    }

    // Active campaigns
    if (activeCampaigns > 0) {
      insights.push({
        id: 'active',
        type: 'success',
        icon: '✅',
        message: `${activeCampaigns} campaign workflow${activeCampaigns > 1 ? 's' : ''} in progress inside NEXUS`,
        messageAr: `${activeCampaigns} ${activeCampaigns === 1 ? 'سير عمل حملة داخل NEXUS' : 'مسارات عمل حملات داخل NEXUS'}`,
        href: '/campaigns',
      })
    }

    // Visual coverage
    if (totalCampaigns > 0 && generatedVisuals === 0 && finalMediaPosts === 0) {
      insights.push({
        id: 'no-visuals',
        type: 'action',
        icon: '🎨',
        message: `${totalCampaigns} campaign${totalCampaigns > 1 ? 's have' : ' has'} no hero visuals — review media needs before generation`,
        messageAr: `${totalCampaigns} ${totalCampaigns === 1 ? 'حملة بدون مرئيات رئيسية' : 'حملات بدون مرئيات رئيسية'} — راجع الاحتياج قبل التوليد`,
        href: recentCampaigns[0]?.id ? `/campaigns/${recentCampaigns[0].id}` : '/campaigns',
      })
    } else if (finalMediaPosts > 0) {
      insights.push({
        id: 'final-media-ready',
        type: 'success',
        icon: '🎨',
        message: `${finalMediaPosts} post package${finalMediaPosts > 1 ? 's have' : ' has'} confirmed final media linked`,
        messageAr: `${finalMediaPosts} ${finalMediaPosts === 1 ? 'حزمة منشور مرتبطة بوسائط نهائية مؤكدة' : 'حزم منشورات مرتبطة بوسائط نهائية مؤكدة'}`,
        href: '/content-hub',
      })
    } else if (generatedVisuals > 0) {
      insights.push({
        id: 'generated-visuals-available',
        type: 'info',
        icon: '🎨',
        message: `${generatedVisuals} generated visual asset${generatedVisuals > 1 ? 's are' : ' is'} available for review; final post attachment remains separate`,
        messageAr: `${generatedVisuals} ${generatedVisuals === 1 ? 'أصل بصري مولّد متاح' : 'أصول بصرية مولّدة متاحة'} للمراجعة؛ يظل الربط النهائي بالمنشور خطوة منفصلة`,
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
          messageAr: `تم تحديث "${latest.name}" ${hoursAgo < 1 ? 'الآن' : `منذ ${hoursAgo} ساعة`}`,
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
        message: 'No campaigns yet — create your first campaign workspace',
        messageAr: 'لا توجد حملات بعد — أنشئ أول حملة تسويقية بالذكاء الاصطناعي',
        href: '/campaigns/new',
      })
    }

  } catch (err: unknown) {
    console.warn('[insights] DB query failed:', err instanceof Error ? err.message : err)
    // Fallback insight — never leave the bar empty
    insights.push({
      id: 'system-ready',
      type: 'info',
      icon: '⚡',
      message: 'NEXUS is available — create a campaign workspace when ready',
      messageAr: 'NEXUS متاح — أنشئ مساحة عمل حملة عندما تكون مستعداً',
      href: '/campaigns/new',
    })
  }

  return NextResponse.json({ insights: insights.slice(0, 4) })
}
