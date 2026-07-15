import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ documents: [] })

    const documents = await prisma.brandEvidenceDocument.findMany({
      where: { workspaceId: workspace.id, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        errorMessage: true,
        extractionMetadata: true,
        createdAt: true,
        updatedAt: true,
        claims: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            claim: true,
            category: true,
            evidenceExcerpt: true,
            sourceLocator: true,
            confidence: true,
            status: true,
            truthStatus: true,
            conflictClaimId: true,
            conflictReason: true,
            reviewedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('[brand/evidence GET]', error)
    return NextResponse.json({ error: 'Failed to load brand evidence' }, { status: 500 })
  }
}
