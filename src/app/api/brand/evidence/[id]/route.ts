import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAuth'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await props.params
    const document = await prisma.brandEvidenceDocument.findFirst({
      where: { id, workspace: { ownerId: user.id } },
      include: {
        claims: { where: { promotedProof: { not: null } }, select: { promotedProof: true } },
      },
    })
    if (!document) return NextResponse.json({ error: 'Evidence document not found' }, { status: 404 })

    await prisma.$transaction(async tx => {
      const profile = await tx.brandProfile.findUnique({
        where: { workspaceId: document.workspaceId },
        select: { verifiedProof: true },
      })
      const removedProofs = new Set(document.claims.map(item => item.promotedProof).filter(Boolean))
      if (profile && removedProofs.size > 0) {
        await tx.brandProfile.update({
          where: { workspaceId: document.workspaceId },
          data: { verifiedProof: profile.verifiedProof.filter(proof => !removedProofs.has(proof)) },
        })
      }
      await tx.brandEvidenceDocument.delete({ where: { id: document.id } })
    })

    const { error } = await getSupabaseAdmin()
      .storage
      .from(document.storageBucket)
      .remove([document.storagePath])
    if (error) console.error('[brand/evidence DELETE] storage cleanup deferred', error.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[brand/evidence DELETE]', error)
    return NextResponse.json({ error: 'Failed to remove evidence document' }, { status: 500 })
  }
}
