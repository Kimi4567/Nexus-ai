import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export const APPROVAL_PREFERENCE_EVIDENCE_VERSION = 1
export const MIN_APPROVAL_PREFERENCE_SAMPLE = 3

const REVIEWED_POST_STATUSES = new Set(['APPROVED', 'SCHEDULED', 'PROCESSING', 'PUBLISHED'])
const CONCRETE_DETAIL_PATTERN = /[\p{N}%٪]|(?:AED|USD|EUR|GBP|SAR|درهم|ريال|دولار|يورو|جنيه)/iu
const REVIEW_FIRST_PATTERN = /\b(?:review|check|confirm|verify)\b|(?:راجع|راجعي|تحقق|تحققي|تأكد|تأكدي)/iu

export interface ApprovalPreferenceEvent {
  id: string
  socialPostId: string | null
  campaignId: string | null
  createdAt: Date | string
}

export interface ApprovalPreferencePost {
  id: string
  campaignId: string | null
  platform: string
  publishTarget: string | null
  caption: string
  status: string
  approvedSnapshotId: string | null
}

export type ApprovalPreferenceSignalType =
  | 'concrete_reviewable_details'
  | 'review_before_action_cta'

export interface ApprovalPreferenceEvidence {
  schemaVersion: 1
  source: 'user_approval_history'
  signalType: ApprovalPreferenceSignalType
  fingerprint: string
  causalClaim: false
  performanceEvidence: false
  approvalEventCount: number
  uniqueApprovedPostCount: number
  duplicateApprovalEventsIgnored: number
  matchedPostCount: number
  matchedRatio: number
  socialPostIds: string[]
  eventIds: string[]
  campaignIds: string[]
  platformCounts: Record<string, number>
  periodStart: string
  periodEnd: string
}

export interface ApprovalPreferencePlan {
  campaignId: string | null
  trigger: 'approved_content'
  field: 'strategicNotes'
  displayName: 'Editorial preference'
  icon: '🧭'
  proposed: string
  reason: string
  evidence: ApprovalPreferenceEvidence
}

export interface ApprovalPreferencePlanResult {
  plans: ApprovalPreferencePlan[]
  approvalEventCount: number
  uniqueApprovedPostCount: number
  duplicateApprovalEventsIgnored: number
}

export interface ApprovalPreferenceRefreshResult extends ApprovalPreferencePlanResult {
  created: number
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString()
}

function normalizedCaption(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function isArabic(value: string): boolean {
  return /[\u0600-\u06ff]/u.test(value)
}

function ratio(count: number, total: number): number {
  return total > 0 ? Number((count / total).toFixed(4)) : 0
}

function fingerprint(
  signalType: ApprovalPreferenceSignalType,
  posts: ApprovalPreferencePost[],
): string {
  const source = posts
    .map(post => `${post.id}:${normalizedCaption(post.caption)}`)
    .sort()
    .join('|')
  return createHash('sha256')
    .update(`${APPROVAL_PREFERENCE_EVIDENCE_VERSION}:${signalType}:${source}`)
    .digest('hex')
}

function evidenceFingerprint(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const stored = value as Record<string, unknown>
  return stored.schemaVersion === APPROVAL_PREFERENCE_EVIDENCE_VERSION
    && stored.source === 'user_approval_history'
    && typeof stored.fingerprint === 'string'
    ? stored.fingerprint
    : null
}

function proposalCopy(
  signalType: ApprovalPreferenceSignalType,
  input: {
    arabic: boolean
    matched: number
    total: number
    duplicateEventsIgnored: number
  },
): Pick<ApprovalPreferencePlan, 'proposed' | 'reason'> {
  const { arabic, matched, total, duplicateEventsIgnored } = input
  const duplicateNote = duplicateEventsIgnored > 0
    ? (arabic
        ? ` تم تجاهل ${duplicateEventsIgnored} من أحداث إعادة الاعتماد المكررة حتى لا تُحسب كعينات جديدة.`
        : ` ${duplicateEventsIgnored} repeated approval event${duplicateEventsIgnored === 1 ? ' was' : 's were'} ignored so they do not count as new samples.`)
    : ''

  if (signalType === 'concrete_reviewable_details') {
    return arabic
      ? {
          proposed: 'تفضيل تحريري (وليس دليل أداء): اجعل المسودات المقبلة مبنية على تفاصيل محددة قابلة للمراجعة، واستخدم فقط الحقائق المؤكدة في Brand Brain أو الأدلة المعتمدة.',
          reason: `استند هذا المقترح إلى ${total} منشورات فريدة اعتمدتها؛ ${matched} منها تضمّنت تفاصيل ملموسة مثل رقم أو سعر أو مدة.${duplicateNote} هذا يصف قرارك التحريري فقط، ولا يثبت التفاعل أو التحويل أو الإيراد.`,
        }
      : {
          proposed: 'Editorial preference (not performance evidence): keep future drafts grounded in concrete, reviewable details, using only facts confirmed in Brand Brain or approved evidence.',
          reason: `This proposal is based on ${total} unique posts you approved; ${matched} included concrete details such as a number, price, or timeframe.${duplicateNote} It describes your editorial decision only and does not prove engagement, conversion, or revenue.`,
        }
  }

  return arabic
    ? {
        proposed: 'تفضيل تحريري (وليس دليل أداء): استخدم دعوة إجراء تطلب المراجعة أو التحقق عندما يحتاج المسار إلى تأكيد التفاصيل، وأعد تقييم ملاءمتها في كل حملة.',
        reason: `استند هذا المقترح إلى ${total} منشورات فريدة اعتمدتها؛ ${matched} منها استخدمت خطوة مراجعة أو تحقق قبل الإجراء.${duplicateNote} هذا يصف تفضيلًا في سير العمل، ولا يثبت نتيجة جمهور أو أداء منصة.`,
      }
    : {
        proposed: 'Editorial preference (not performance evidence): use a review-or-verify CTA when the journey requires details to be confirmed, and re-check its fit for each campaign.',
        reason: `This proposal is based on ${total} unique posts you approved; ${matched} used a review or verification step before action.${duplicateNote} It describes a workflow preference, not an audience result or platform-performance claim.`,
      }
}

/**
 * Converts repeated, explicit user approvals into conservative review proposals.
 * It never memorizes generated copy, claims a winner, or infers audience response.
 */
export function buildApprovalPreferencePlans(input: {
  events: ApprovalPreferenceEvent[]
  posts: ApprovalPreferencePost[]
}): ApprovalPreferencePlanResult {
  const approvalEvents = input.events
    .filter(event => typeof event.socialPostId === 'string' && event.socialPostId.length > 0)
    .sort((a, b) => iso(a.createdAt).localeCompare(iso(b.createdAt)))

  const latestEventByPost = new Map<string, ApprovalPreferenceEvent>()
  for (const event of approvalEvents) latestEventByPost.set(event.socialPostId!, event)

  const postById = new Map(input.posts.map(post => [post.id, post]))
  const reviewed = [...latestEventByPost.entries()]
    .flatMap(([postId, event]) => {
      const post = postById.get(postId)
      if (
        !post
        || !REVIEWED_POST_STATUSES.has(post.status)
        || !post.approvedSnapshotId
        || !post.caption.trim()
      ) return []
      return [{ post, event }]
    })
    .sort((a, b) => a.post.id.localeCompare(b.post.id))

  const uniqueApprovedPostCount = reviewed.length
  const duplicateApprovalEventsIgnored = Math.max(0, approvalEvents.length - latestEventByPost.size)
  const base: Omit<ApprovalPreferencePlanResult, 'plans'> = {
    approvalEventCount: approvalEvents.length,
    uniqueApprovedPostCount,
    duplicateApprovalEventsIgnored,
  }
  if (uniqueApprovedPostCount < MIN_APPROVAL_PREFERENCE_SAMPLE) {
    return { ...base, plans: [] }
  }

  const posts = reviewed.map(item => item.post)
  const events = reviewed.map(item => item.event)
  const captions = posts.map(post => post.caption)
  const arabic = captions.filter(isArabic).length >= Math.ceil(captions.length / 2)
  const requiredMatchCount = Math.max(
    MIN_APPROVAL_PREFERENCE_SAMPLE,
    Math.ceil(uniqueApprovedPostCount * 0.67),
  )
  const period = events.map(event => iso(event.createdAt)).sort()
  const campaignIds = [...new Set(posts.map(post => post.campaignId).filter((id): id is string => Boolean(id)))]
  const platformCounts = posts.reduce<Record<string, number>>((counts, post) => {
    const platform = post.publishTarget || post.platform || 'UNKNOWN'
    counts[platform] = (counts[platform] ?? 0) + 1
    return counts
  }, {})

  const commonEvidence = {
    schemaVersion: APPROVAL_PREFERENCE_EVIDENCE_VERSION as 1,
    source: 'user_approval_history' as const,
    causalClaim: false as const,
    performanceEvidence: false as const,
    approvalEventCount: approvalEvents.length,
    uniqueApprovedPostCount,
    duplicateApprovalEventsIgnored,
    socialPostIds: posts.map(post => post.id),
    eventIds: events.map(event => event.id),
    campaignIds,
    platformCounts,
    periodStart: period[0]!,
    periodEnd: period[period.length - 1]!,
  }

  const candidates: Array<{
    signalType: ApprovalPreferenceSignalType
    matchedPostCount: number
  }> = [
    {
      signalType: 'concrete_reviewable_details',
      matchedPostCount: captions.filter(caption => CONCRETE_DETAIL_PATTERN.test(caption)).length,
    },
    {
      signalType: 'review_before_action_cta',
      matchedPostCount: captions.filter(caption => (
        REVIEW_FIRST_PATTERN.test(caption.trim().slice(-220))
      )).length,
    },
  ]

  const plans = candidates.flatMap(({ signalType, matchedPostCount }): ApprovalPreferencePlan[] => {
    if (matchedPostCount < requiredMatchCount) return []
    const copy = proposalCopy(signalType, {
      arabic,
      matched: matchedPostCount,
      total: uniqueApprovedPostCount,
      duplicateEventsIgnored: duplicateApprovalEventsIgnored,
    })
    return [{
      campaignId: campaignIds.length === 1 ? campaignIds[0]! : null,
      trigger: 'approved_content',
      field: 'strategicNotes',
      displayName: 'Editorial preference',
      icon: '🧭',
      proposed: copy.proposed,
      reason: copy.reason,
      evidence: {
        ...commonEvidence,
        signalType,
        fingerprint: fingerprint(signalType, posts),
        matchedPostCount,
        matchedRatio: ratio(matchedPostCount, uniqueApprovedPostCount),
      },
    }]
  })

  return { ...base, plans }
}

export async function refreshApprovalPreferenceProposals(
  workspaceId: string,
): Promise<ApprovalPreferenceRefreshResult> {
  const events = await prisma.marketingLearningEvent.findMany({
    where: {
      workspaceId,
      eventType: 'POST_APPROVED',
      source: 'EXECUTION_WORKFLOW',
      actor: 'USER',
      socialPostId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
    select: {
      id: true,
      socialPostId: true,
      campaignId: true,
      createdAt: true,
    },
  })
  const socialPostIds = [...new Set(events.flatMap(event => event.socialPostId ? [event.socialPostId] : []))]
  const posts = socialPostIds.length > 0
    ? await prisma.socialPost.findMany({
        where: { workspaceId, id: { in: socialPostIds } },
        select: {
          id: true,
          campaignId: true,
          platform: true,
          publishTarget: true,
          caption: true,
          status: true,
          approvedSnapshotId: true,
        },
      })
    : []

  const result = buildApprovalPreferencePlans({
    events,
    posts: posts.map(post => ({
      ...post,
      platform: String(post.platform),
      status: String(post.status),
    })),
  })
  if (result.plans.length === 0) return { ...result, created: 0 }

  const existing = await prisma.brainLearning.findMany({
    where: { workspaceId, trigger: 'approved_content' },
    select: { evidence: true },
    orderBy: { createdAt: 'desc' },
    take: 250,
  })
  const existingFingerprints = new Set(
    existing.flatMap(row => {
      const stored = evidenceFingerprint(row.evidence)
      return stored ? [stored] : []
    }),
  )
  const newPlans = result.plans.filter(plan => !existingFingerprints.has(plan.evidence.fingerprint))
  if (newPlans.length === 0) return { ...result, created: 0 }

  const profile = await prisma.brandProfile.findUnique({
    where: { workspaceId },
    select: { strategicNotes: true },
  })
  const created = await prisma.brainLearning.createMany({
    data: newPlans.map(plan => ({
      workspaceId,
      campaignId: plan.campaignId,
      trigger: plan.trigger,
      field: plan.field,
      displayName: plan.displayName,
      icon: plan.icon,
      current: profile?.strategicNotes ?? undefined,
      proposed: plan.proposed,
      reason: plan.reason,
      evidence: plan.evidence as unknown as Prisma.InputJsonValue,
      status: 'pending',
    })),
  })

  return { ...result, created: created.count }
}
