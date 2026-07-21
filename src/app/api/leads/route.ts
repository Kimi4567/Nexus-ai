import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getServerUserId } from '@/lib/apiAuth'
import { findPrimaryLeadWorkspace, isLeadOperator } from '@/lib/leadCrmAccess'
import { prisma } from '@/lib/prisma'
import {
  calculateLeadResponseDueAt,
  LEAD_CONSENT_STATUSES,
  LEAD_SOURCES,
  LEAD_STAGES,
  isLeadConsentStatus,
  isLeadSource,
  isLeadStage,
  normalizeLeadEmail,
  normalizeLeadPhone,
  sanitizeLeadAttribution,
} from '@/lib/leadLifecycle'
import {
  getLeadCrmDatabaseReadiness,
  isLeadCrmRequested,
  leadCrmUnavailableResponse,
} from '@/lib/leadCrmReadiness'

export const dynamic = 'force-dynamic'

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

async function crmGate() {
  if (!isLeadCrmRequested()) return { ready: false as const, body: leadCrmUnavailableResponse() }
  const database = await getLeadCrmDatabaseReadiness()
  return database.ready
    ? { ready: true as const }
    : { ready: false as const, body: leadCrmUnavailableResponse(database) }
}

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await crmGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ leads: [], summary: { total: 0, byStage: {}, overdueResponseCount: 0 }, nextCursor: null })

  const stageParam = req.nextUrl.searchParams.get('stage')?.trim().toUpperCase()
  if (stageParam && stageParam !== 'ALL' && !isLeadStage(stageParam)) {
    return NextResponse.json({ error: 'Invalid lead stage', allowed: LEAD_STAGES }, { status: 400 })
  }

  const campaignId = optionalText(req.nextUrl.searchParams.get('campaignId'), 100)
  const query = optionalText(req.nextUrl.searchParams.get('q'), 120)
  const cursor = optionalText(req.nextUrl.searchParams.get('cursor'), 100)
  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') || 50)
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 50

  const where: Prisma.LeadWhereInput = {
    workspaceId: workspace.id,
    ...(stageParam && stageParam !== 'ALL' ? { stage: stageParam } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(query ? {
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { company: { contains: query, mode: 'insensitive' } },
      ],
    } : {}),
  }

  const [rows, stageCounts, overdueResponseCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        campaign: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            activities: true,
            tasks: { where: { status: 'OPEN' } },
          },
        },
      },
    }),
    prisma.lead.groupBy({
      by: ['stage'],
      where: { workspaceId: workspace.id },
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: {
        workspaceId: workspace.id,
        firstContactedAt: null,
        responseDueAt: { lt: new Date() },
        stage: { notIn: ['WON', 'LOST', 'DISQUALIFIED'] },
      },
    }),
  ])

  const hasMore = rows.length > limit
  const leads = hasMore ? rows.slice(0, limit) : rows
  const byStage = Object.fromEntries(LEAD_STAGES.map(stage => [
    stage,
    stageCounts.find(item => item.stage === stage)?._count._all ?? 0,
  ]))

  return NextResponse.json({
    leads,
    summary: {
      total: Object.values(byStage).reduce((sum, count) => sum + count, 0),
      byStage,
      overdueResponseCount,
    },
    nextCursor: hasMore ? leads.at(-1)?.id ?? null : null,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await crmGate()
  if (!gate.ready) return NextResponse.json(gate.body, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  }

  const rawEmail = optionalText(body.email, 254)
  const rawPhone = optionalText(body.phone, 40)
  const emailNormalized = normalizeLeadEmail(rawEmail)
  const phoneNormalized = normalizeLeadPhone(rawPhone)
  if (rawEmail && !emailNormalized) return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  if (rawPhone && !phoneNormalized) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  if (!emailNormalized && !phoneNormalized) {
    return NextResponse.json({ error: 'A valid email or phone number is required' }, { status: 400 })
  }

  const source = typeof body.source === 'string' ? body.source.toUpperCase() : 'MANUAL'
  const stage = typeof body.stage === 'string' ? body.stage.toUpperCase() : 'NEW'
  const consentStatus = typeof body.consentStatus === 'string' ? body.consentStatus.toUpperCase() : 'UNKNOWN'
  if (!isLeadSource(source)) return NextResponse.json({ error: 'Invalid lead source', allowed: LEAD_SOURCES }, { status: 400 })
  if (!isLeadStage(stage)) return NextResponse.json({ error: 'Invalid lead stage', allowed: LEAD_STAGES }, { status: 400 })
  if (!isLeadConsentStatus(consentStatus)) {
    return NextResponse.json({ error: 'Invalid consent status', allowed: LEAD_CONSENT_STATUSES }, { status: 400 })
  }

  const consentSource = optionalText(body.consentSource, 160)
  if (consentStatus === 'GRANTED' && !consentSource) {
    return NextResponse.json({ error: 'Consent source is required when consent is granted' }, { status: 400 })
  }

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const assignedToId = optionalText(body.assignedToId, 100) ?? userId
  if (!await isLeadOperator(workspace.id, userId, assignedToId)) {
    return NextResponse.json({ error: 'Assignee must be an active workspace operator' }, { status: 400 })
  }

  const campaignId = optionalText(body.campaignId, 100)
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found in this workspace' }, { status: 400 })
  }

  const duplicate = await prisma.lead.findFirst({
    where: {
      workspaceId: workspace.id,
      OR: [
        ...(emailNormalized ? [{ emailNormalized }] : []),
        ...(phoneNormalized ? [{ phoneNormalized }] : []),
      ],
    },
    select: { id: true },
  })
  if (duplicate) {
    return NextResponse.json({
      error: 'A lead with this email or phone already exists in the workspace.',
      code: 'LEAD_DUPLICATE',
      existingLeadId: duplicate.id,
    }, { status: 409 })
  }

  const scoreValue = Number(body.score ?? 0)
  if (!Number.isInteger(scoreValue) || scoreValue < 0 || scoreValue > 100) {
    return NextResponse.json({ error: 'Lead score must be an integer from 0 to 100' }, { status: 400 })
  }

  const responseSlaHours = Number(body.responseSlaHours ?? 24)
  if (!Number.isInteger(responseSlaHours) || responseSlaHours < 1 || responseSlaHours > 168) {
    return NextResponse.json({ error: 'Response SLA must be an integer from 1 to 168 hours' }, { status: 400 })
  }

  try {
    const now = new Date()
    const lead = await prisma.$transaction(async tx => {
      const created = await tx.lead.create({
        data: {
          workspaceId: workspace.id,
          campaignId,
          assignedToId,
          fullName: optionalText(body.fullName, 140),
          email: rawEmail,
          emailNormalized,
          phone: rawPhone,
          phoneNormalized,
          company: optionalText(body.company, 140),
          jobTitle: optionalText(body.jobTitle, 140),
          source,
          sourceDetail: optionalText(body.sourceDetail, 200),
          stage,
          score: scoreValue,
          consentStatus,
          consentSource,
          consentAt: consentStatus === 'UNKNOWN' ? null : now,
          attribution: sanitizeLeadAttribution(body.attribution),
          responseDueAt: calculateLeadResponseDueAt(now, responseSlaHours),
          lastActivityAt: now,
        },
        include: { campaign: { select: { id: true, name: true } } },
      })
      await tx.leadActivity.create({
        data: {
          leadId: created.id,
          type: 'CREATED',
          actor: source === 'IMPORT' ? 'IMPORT' : 'USER',
          note: optionalText(body.note, 1000),
          metadata: {
            source,
            stage,
            campaignId,
            assignedToId,
            responseDueAt: calculateLeadResponseDueAt(now, responseSlaHours).toISOString(),
            consentStatus,
          },
          occurredAt: now,
        },
      })
      return created
    })

    return NextResponse.json({ lead }, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002') {
      return NextResponse.json({
        error: 'A lead with this email or phone already exists in the workspace.',
        code: 'LEAD_DUPLICATE',
      }, { status: 409 })
    }
    console.error('[Leads POST]', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
