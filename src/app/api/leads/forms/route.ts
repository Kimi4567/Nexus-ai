import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { dbRateLimit } from '@/lib/dbRateLimit'
import { findPrimaryLeadWorkspace } from '@/lib/leadCrmAccess'
import { getLeadCrmDatabaseReadiness, isLeadCrmRequested, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function clean(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

function allowedOrigin(value: unknown): string | null {
  const candidate = clean(value, 300)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null
  } catch {
    return null
  }
}

async function crmUnavailable() {
  if (!isLeadCrmRequested()) return leadCrmUnavailableResponse()
  const readiness = await getLeadCrmDatabaseReadiness()
  return readiness.ready ? null : leadCrmUnavailableResponse(readiness)
}

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await crmUnavailable()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ forms: [] })
  const forms = await prisma.leadCaptureForm.findMany({
    where: { workspaceId: workspace.id },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({
    forms: forms.map(form => ({ ...form, publicPath: `/lead-form/${form.publicId}` })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const unavailable = await crmUnavailable()
  if (unavailable) return NextResponse.json(unavailable, { status: 503 })

  const rateLimit = await dbRateLimit(`lead-form-create:${userId}`, { limit: 20, windowMs: 24 * 60 * 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: rateLimit.message, code: 'LEAD_FORM_RATE_LIMITED' }, { status: 429 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Valid JSON body required' }, { status: 400 })
  const name = clean(body.name, 120)
  const title = clean(body.title, 160)
  if (!name || !title) return NextResponse.json({ error: 'Form name and public title are required' }, { status: 400 })

  const requestedOrigin = clean(body.allowedOrigin, 300)
  const origin = allowedOrigin(requestedOrigin)
  if (requestedOrigin && !origin) return NextResponse.json({ error: 'Allowed origin must be a valid http(s) origin' }, { status: 400 })

  const workspace = await findPrimaryLeadWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const campaignId = clean(body.campaignId, 100)
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found in this workspace' }, { status: 400 })
  }

  const form = await prisma.leadCaptureForm.create({
    data: {
      workspaceId: workspace.id,
      campaignId,
      createdById: userId,
      name,
      title,
      description: clean(body.description, 1200),
      consentStatement: clean(body.consentStatement, 1200),
      allowedOrigin: origin,
      status: 'ACTIVE',
    },
    include: { campaign: { select: { id: true, name: true } } },
  })

  return NextResponse.json({
    form: { ...form, publicPath: `/lead-form/${form.publicId}` },
    outreachAutomation: false,
  }, { status: 201 })
}
