import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { isLeadOperator, leadWorkspaceAccessFilter } from '@/lib/leadCrmAccess'
import { prisma } from '@/lib/prisma'
import {
  canTransitionLeadStage,
  isLeadConsentStatus,
  isLeadStage,
  stageProvidesContactEvidence,
} from '@/lib/leadLifecycle'
import {
  getLeadCrmDatabaseReadiness,
  isLeadCrmRequested,
  leadCrmUnavailableResponse,
} from '@/lib/leadCrmReadiness'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

function conversionValue(value: unknown): string | null | 'INVALID' {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9_999_999_999.99) return 'INVALID'
  return parsed.toFixed(2)
}

async function gateResponse() {
  if (!isLeadCrmRequested()) return leadCrmUnavailableResponse()
  const readiness = await getLeadCrmDatabaseReadiness()
  return readiness.ready ? null : leadCrmUnavailableResponse(readiness)
}

async function ownedLead(userId: string, id: string) {
  return prisma.lead.findFirst({
    where: { id, workspace: leadWorkspaceAccessFilter(userId) },
    include: {
      campaign: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      tasks: {
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        take: 100,
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
      },
      activities: { orderBy: { occurredAt: 'desc' }, take: 100 },
    },
  })
}

export async function GET(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await gateResponse()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  const { id } = await context.params
  const lead = await ownedLead(userId, id)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json({ lead }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await gateResponse()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  }

  const { id } = await context.params
  const current = await ownedLead(userId, id)
  if (!current) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string'
    ? new Date(body.expectedUpdatedAt)
    : null
  if (!expectedUpdatedAt || !Number.isFinite(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: 'expectedUpdatedAt is required for a safe update' }, { status: 400 })
  }

  const nextStage = typeof body.stage === 'string' ? body.stage.toUpperCase() : current.stage
  if (!isLeadStage(current.stage) || !isLeadStage(nextStage)) {
    return NextResponse.json({ error: 'Invalid lead stage' }, { status: 400 })
  }
  if (!canTransitionLeadStage(current.stage, nextStage)) {
    return NextResponse.json({
      error: `Lead cannot move directly from ${current.stage} to ${nextStage}`,
      code: 'INVALID_LEAD_STAGE_TRANSITION',
    }, { status: 409 })
  }

  const nextConsent = typeof body.consentStatus === 'string'
    ? body.consentStatus.toUpperCase()
    : current.consentStatus
  if (!isLeadConsentStatus(nextConsent)) {
    return NextResponse.json({ error: 'Invalid consent status' }, { status: 400 })
  }
  const consentSource = optionalText(body.consentSource, 160) ?? current.consentSource
  if (nextConsent === 'GRANTED' && !consentSource) {
    return NextResponse.json({ error: 'Consent source is required when consent is granted' }, { status: 400 })
  }

  const nextScore = body.score === undefined ? current.score : Number(body.score)
  if (!Number.isInteger(nextScore) || nextScore < 0 || nextScore > 100) {
    return NextResponse.json({ error: 'Lead score must be an integer from 0 to 100' }, { status: 400 })
  }

  const lostReason = nextStage === 'LOST'
    ? optionalText(body.lostReason, 500) ?? current.lostReason
    : null
  if (nextStage === 'LOST' && !lostReason) {
    return NextResponse.json({ error: 'A lost reason is required when moving a lead to LOST' }, { status: 400 })
  }

  const hasConversionValue = Object.prototype.hasOwnProperty.call(body, 'conversionValue')
  const hasConversionCurrency = Object.prototype.hasOwnProperty.call(body, 'conversionCurrency')
  if (nextStage !== 'WON' && (hasConversionValue || hasConversionCurrency)) {
    return NextResponse.json({ error: 'Outcome value can only be recorded for a WON lead' }, { status: 400 })
  }
  const currentConversionValue = current.conversionValue === null || current.conversionValue === undefined
    ? null
    : Number(current.conversionValue).toFixed(2)
  const nextConversionValue = nextStage === 'WON'
    ? (hasConversionValue ? conversionValue(body.conversionValue) : currentConversionValue)
    : null
  if (nextConversionValue === 'INVALID') {
    return NextResponse.json({ error: 'Outcome value must be between 0 and 9,999,999,999.99' }, { status: 400 })
  }
  const nextConversionCurrency = nextStage === 'WON' && nextConversionValue !== null
    ? (hasConversionCurrency
        ? (typeof body.conversionCurrency === 'string' ? body.conversionCurrency.trim().toUpperCase() : null)
        : current.conversionCurrency?.toUpperCase() || null)
    : null
  if (nextConversionValue !== null && (!nextConversionCurrency || !/^[A-Z]{3}$/.test(nextConversionCurrency))) {
    return NextResponse.json({ error: 'A three-letter ISO currency is required with an outcome value' }, { status: 400 })
  }
  const nextConvertedAt = nextStage === 'WON'
    ? (current.stage === 'WON' && current.convertedAt ? current.convertedAt : new Date())
    : null

  const hasAssigneeChange = Object.prototype.hasOwnProperty.call(body, 'assignedToId')
  const nextAssignedToId = hasAssigneeChange ? optionalText(body.assignedToId, 100) : current.assignedToId
  if (nextAssignedToId && !await isLeadOperator(current.workspaceId, userId, nextAssignedToId)) {
    return NextResponse.json({ error: 'Assignee must be an active workspace operator' }, { status: 400 })
  }

  const hasResponseDueChange = Object.prototype.hasOwnProperty.call(body, 'responseDueAt')
  const nextResponseDueAt = hasResponseDueChange
    ? (typeof body.responseDueAt === 'string' ? new Date(body.responseDueAt) : null)
    : current.responseDueAt
  if (hasResponseDueChange && nextResponseDueAt && !Number.isFinite(nextResponseDueAt.getTime())) {
    return NextResponse.json({ error: 'responseDueAt must be a valid timestamp or null' }, { status: 400 })
  }

  const stageChanged = nextStage !== current.stage
  const consentChanged = nextConsent !== current.consentStatus
  const scoreChanged = nextScore !== current.score
  const assigneeChanged = nextAssignedToId !== current.assignedToId
  const responseDueChanged = (nextResponseDueAt?.getTime() ?? null) !== (current.responseDueAt?.getTime() ?? null)
  const conversionChanged = nextConversionValue !== currentConversionValue
    || nextConversionCurrency !== (current.conversionCurrency || null)
    || (nextStage === 'WON') !== (current.stage === 'WON')
  const note = optionalText(body.note, 1000)
  if (!stageChanged && !consentChanged && !scoreChanged && !assigneeChanged && !responseDueChanged && !conversionChanged && !note) {
    return NextResponse.json({ error: 'No lead changes were provided' }, { status: 400 })
  }

  const now = new Date()
  try {
    await prisma.$transaction(async tx => {
      const updated = await tx.lead.updateMany({
        where: {
          id: current.id,
          workspaceId: current.workspaceId,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          stage: nextStage,
          score: nextScore,
          lostReason,
          consentStatus: nextConsent,
          consentSource: nextConsent === 'UNKNOWN' ? null : consentSource,
          consentAt: consentChanged ? (nextConsent === 'UNKNOWN' ? null : now) : current.consentAt,
          assignedToId: nextAssignedToId,
          responseDueAt: nextResponseDueAt,
          firstContactedAt: !current.firstContactedAt && stageProvidesContactEvidence(nextStage)
            ? now
            : current.firstContactedAt,
          lastActivityAt: now,
          convertedAt: nextConvertedAt,
          conversionValue: nextConversionValue,
          conversionCurrency: nextConversionCurrency,
          conversionValueSource: nextConversionValue !== null ? 'MANUAL_CONFIRMED' : null,
        },
      })
      if (updated.count !== 1) throw new Error('LEAD_CONCURRENT_CHANGE')

      const events = [
        ...(stageChanged ? [{
          leadId: current.id,
          type: 'STAGE_CHANGED',
          actor: 'USER',
          note,
          metadata: { from: current.stage, to: nextStage, lostReason },
          occurredAt: now,
        }] : []),
        ...(consentChanged ? [{
          leadId: current.id,
          type: 'CONSENT_CHANGED',
          actor: 'USER',
          note: stageChanged ? null : note,
          metadata: { from: current.consentStatus, to: nextConsent, consentSource },
          occurredAt: now,
        }] : []),
        ...(scoreChanged ? [{
          leadId: current.id,
          type: 'SCORE_CHANGED',
          actor: 'USER',
          note: stageChanged || consentChanged ? null : note,
          metadata: { from: current.score, to: nextScore },
          occurredAt: now,
        }] : []),
        ...(assigneeChanged ? [{
          leadId: current.id,
          type: 'ASSIGNEE_CHANGED',
          actor: 'USER',
          note: stageChanged || consentChanged || scoreChanged ? null : note,
          metadata: { from: current.assignedToId, to: nextAssignedToId },
          occurredAt: now,
        }] : []),
        ...(responseDueChanged ? [{
          leadId: current.id,
          type: 'RESPONSE_SLA_CHANGED',
          actor: 'USER',
          note: stageChanged || consentChanged || scoreChanged || assigneeChanged ? null : note,
          metadata: {
            from: current.responseDueAt?.toISOString() ?? null,
            to: nextResponseDueAt?.toISOString() ?? null,
          },
          occurredAt: now,
        }] : []),
        ...(conversionChanged ? [{
          leadId: current.id,
          type: nextStage === 'WON'
            ? (current.stage === 'WON' ? 'CONVERSION_VALUE_CHANGED' : 'CONVERSION_RECORDED')
            : 'CONVERSION_REVOKED',
          actor: 'USER',
          note: stageChanged || consentChanged || scoreChanged || assigneeChanged || responseDueChanged ? null : note,
          metadata: {
            fromStage: current.stage,
            toStage: nextStage,
            value: nextConversionValue,
            currency: nextConversionCurrency,
            valueSource: nextConversionValue !== null ? 'MANUAL_CONFIRMED' : null,
          },
          occurredAt: now,
        }] : []),
        ...(!stageChanged && !consentChanged && !scoreChanged && !assigneeChanged && !responseDueChanged && !conversionChanged && note ? [{
          leadId: current.id,
          type: 'NOTE_ADDED',
          actor: 'USER',
          note,
          metadata: {},
          occurredAt: now,
        }] : []),
      ]
      await tx.leadActivity.createMany({ data: events })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_CONCURRENT_CHANGE') {
      return NextResponse.json({
        error: 'Lead changed while you were reviewing it. Refresh and try again.',
        code: 'LEAD_CONCURRENT_CHANGE',
      }, { status: 409 })
    }
    console.error('[Lead PATCH]', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }

  const lead = await ownedLead(userId, id)
  return NextResponse.json({ lead })
}

export async function DELETE(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await gateResponse()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  const { id } = await context.params
  const current = await prisma.lead.findFirst({
    where: { id, workspace: leadWorkspaceAccessFilter(userId) },
    select: { id: true, workspaceId: true, updatedAt: true },
  })
  if (!current) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const expectedUpdatedAt = req.nextUrl.searchParams.get('expectedUpdatedAt')
  if (!expectedUpdatedAt || new Date(expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
    return NextResponse.json({
      error: 'Lead changed before deletion. Refresh and confirm again.',
      code: 'LEAD_CONCURRENT_CHANGE',
    }, { status: 409 })
  }

  try {
    await prisma.$transaction(async tx => {
      await tx.marketingLearningEvent.create({
        data: {
          workspaceId: current.workspaceId,
          eventType: 'LEAD_DELETED',
          source: 'CRM_WORKFLOW',
          actor: 'USER',
          metadata: { leadId: current.id, personalDataDeleted: true },
        },
      })
      const deleted = await tx.lead.deleteMany({
        where: { id: current.id, workspaceId: current.workspaceId, updatedAt: current.updatedAt },
      })
      if (deleted.count !== 1) throw new Error('LEAD_CONCURRENT_CHANGE')
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'LEAD_CONCURRENT_CHANGE') {
      return NextResponse.json({
        error: 'Lead changed before deletion. Refresh and confirm again.',
        code: 'LEAD_CONCURRENT_CHANGE',
      }, { status: 409 })
    }
    console.error('[Lead DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, personalDataDeleted: true })
}
