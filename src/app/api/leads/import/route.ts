import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { dbRateLimit } from '@/lib/dbRateLimit'
import { findPrimaryLeadWorkspace, isLeadOperator } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'
import { parseLeadCsv, type LeadCsvIssue } from '@/lib/leadCsvImport'
import { calculateLeadResponseDueAt } from '@/lib/leadLifecycle'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

async function crmUnavailable() {
  if (!isLeadCrmRequested()) return leadCrmUnavailableResponse()
  const readiness = await getLeadCrmDatabaseReadiness()
  return readiness.ready ? null : leadCrmUnavailableResponse(readiness)
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await crmUnavailable()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  const rateLimit = await dbRateLimit(`lead-import:${userId}`, { limit: 10, windowMs: 60 * 60_000 })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.message, code: 'LEAD_IMPORT_RATE_LIMITED' }, { status: 429 })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })

  let parsed: ReturnType<typeof parseLeadCsv>
  try {
    parsed = parseLeadCsv(typeof body.csv === 'string' ? body.csv : '')
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid CSV' }, { status: 400 })
  }

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const campaignId = optionalText(body.campaignId, 100)
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found in this workspace' }, { status: 400 })
  }

  const assignedToId = optionalText(body.assignedToId, 100)
  if (assignedToId && !await isLeadOperator(workspace.id, userId, assignedToId)) {
    return NextResponse.json({ error: 'Assignee must be an active workspace operator' }, { status: 400 })
  }

  const duplicateCandidates = parsed.rows.flatMap(row => [
    ...(row.emailNormalized ? [{ emailNormalized: row.emailNormalized }] : []),
    ...(row.phoneNormalized ? [{ phoneNormalized: row.phoneNormalized }] : []),
  ])
  const existing = duplicateCandidates.length > 0
    ? await prisma.lead.findMany({
        where: { workspaceId: workspace.id, OR: duplicateCandidates },
        select: { emailNormalized: true, phoneNormalized: true },
      })
    : []
  const existingKeys = new Set(existing.flatMap(row => [
    row.emailNormalized ? `email:${row.emailNormalized}` : null,
    row.phoneNormalized ? `phone:${row.phoneNormalized}` : null,
  ].filter(Boolean) as string[]))

  const issues: LeadCsvIssue[] = [...parsed.issues]
  const importRows = parsed.rows.filter(row => {
    const duplicate = (row.emailNormalized && existingKeys.has(`email:${row.emailNormalized}`))
      || (row.phoneNormalized && existingKeys.has(`phone:${row.phoneNormalized}`))
    if (duplicate) {
      issues.push({
        rowNumber: row.rowNumber,
        code: 'DUPLICATE_IN_WORKSPACE',
        message: 'A lead with this email or phone already exists in the workspace.',
      })
      return false
    }
    return true
  })

  if (body.dryRun === true || importRows.length === 0) {
    return NextResponse.json({
      dryRun: true,
      totalRows: parsed.rows.length + parsed.issues.length,
      readyRows: importRows.length,
      rejectedRows: issues.length,
      issues,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const now = new Date()
  try {
    const created = await prisma.$transaction(async tx => {
      const leads = []
      for (const row of importRows) {
        const lead = await tx.lead.create({
          data: {
            workspaceId: workspace.id,
            campaignId,
            assignedToId,
            fullName: row.fullName,
            email: row.email,
            emailNormalized: row.emailNormalized,
            phone: row.phone,
            phoneNormalized: row.phoneNormalized,
            company: row.company,
            jobTitle: row.jobTitle,
            source: 'IMPORT',
            sourceDetail: row.sourceDetail,
            stage: 'NEW',
            consentStatus: row.consentStatus,
            consentSource: row.consentSource,
            consentAt: row.consentStatus === 'UNKNOWN' ? null : now,
            attribution: row.attribution,
            responseDueAt: calculateLeadResponseDueAt(now),
            lastActivityAt: now,
          },
          select: { id: true, fullName: true, email: true, phone: true },
        })
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'CREATED',
            actor: 'IMPORT',
            metadata: {
              source: 'IMPORT',
              rowNumber: row.rowNumber,
              campaignId,
              assignedToId,
              consentStatus: row.consentStatus,
            },
            occurredAt: now,
          },
        })
        leads.push(lead)
      }
      return leads
    })

    return NextResponse.json({
      dryRun: false,
      imported: created.length,
      rejectedRows: issues.length,
      issues,
      leads: created,
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002') {
      return NextResponse.json({
        error: 'A duplicate appeared while the import was being committed. No rows were imported; review and retry.',
        code: 'LEAD_IMPORT_CONCURRENT_DUPLICATE',
      }, { status: 409 })
    }
    console.error('[Lead import]', error)
    return NextResponse.json({ error: 'Lead import failed. No rows were imported.' }, { status: 500 })
  }
}
