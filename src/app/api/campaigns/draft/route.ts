import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { readLockedCampaignAllowance } from '@/lib/campaignCommercial'

export async function POST(req: NextRequest) {
  try {
    const userId = await getServerUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = { id: userId }
    const body = await req.json()
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const requestedName = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          id: projectId,
          workspace: {
            OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          },
        },
        select: { id: true, workspaceId: true, workspace: { select: { ownerId: true } } },
      })
      if (!project) return { notFound: true as const }

      const allowance = await readLockedCampaignAllowance(tx, project.workspace.ownerId)
      if (allowance.limit !== 999 && allowance.current >= allowance.limit) {
        return { limitReached: true as const, allowance }
      }

      const draftName = requestedName || `Draft campaign ${new Date().toISOString().slice(0, 10)}`
      const campaign = await tx.campaign.create({
        data: {
          name: draftName,
          description: '',
          workspaceId: project.workspaceId,
          projectId,
          goal: 'SALES',
          audience: '',
          tone: 'PROFESSIONAL',
          platforms: [],
          status: 'DRAFT',
        },
      })
      return { campaign, allowance }
    })

    if ('notFound' in result) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }
    if ('limitReached' in result) {
      return NextResponse.json({
        error: 'CAMPAIGN_LIMIT_REACHED',
        message: `This workspace owner plan allows ${result.allowance.limit} campaign creation${result.allowance.limit === 1 ? '' : 's'} per billing month.`,
        limit: result.allowance.limit,
        current: result.allowance.current,
        resetsAt: result.allowance.periodEnd.toISOString(),
        upgradeUrl: '/billing',
      }, { status: 403 })
    }
    return NextResponse.json({ campaign: result.campaign }, { status: 201 })
  } catch (error) {
    console.error('Draft campaign creation failed', error)
    return NextResponse.json({ error: 'Unable to create draft campaign' }, { status: 500 })
  }
}
