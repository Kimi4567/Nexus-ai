import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAuth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await props.params

    const document = await prisma.brandEvidenceDocument.findFirst({
      where: { id, workspace: { ownerId: user.id } },
    })
    if (!document) return NextResponse.json({ error: 'Evidence document not found' }, { status: 404 })
    if (document.status !== 'PENDING_UPLOAD') {
      return NextResponse.json({ documentId: document.id, status: document.status })
    }

    const segments = document.storagePath.split('/')
    const fileName = segments.pop()
    const folder = segments.join('/')
    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(document.storageBucket)
      .list(folder, { limit: 10, search: fileName })
    const uploaded = data?.find(item => item.name === fileName)

    if (error || !uploaded) {
      return NextResponse.json({ error: 'Upload has not completed' }, { status: 409 })
    }
    const uploadedSize = Number(uploaded.metadata?.size)
    if (Number.isFinite(uploadedSize) && uploadedSize !== document.sizeBytes) {
      await getSupabaseAdmin().storage.from(document.storageBucket).remove([document.storagePath])
      await prisma.brandEvidenceDocument.update({
        where: { id: document.id },
        data: { status: 'FAILED', errorMessage: 'Uploaded file size did not match the signed request.' },
      })
      return NextResponse.json({ error: 'Uploaded file did not pass integrity checks' }, { status: 400 })
    }

    const updated = await prisma.brandEvidenceDocument.update({
      where: { id: document.id },
      data: { status: 'UPLOADED', errorMessage: null },
      select: { id: true, status: true },
    })
    return NextResponse.json({ documentId: updated.id, status: updated.status })
  } catch (error) {
    console.error('[brand/evidence finalize]', error)
    return NextResponse.json({ error: 'Failed to finalize evidence upload' }, { status: 500 })
  }
}
