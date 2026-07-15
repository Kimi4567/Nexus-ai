import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import {
  BRAND_EVIDENCE_BUCKET,
  BRAND_EVIDENCE_MAX_DOCUMENTS,
  BRAND_EVIDENCE_WORKSPACE_MAX_BYTES,
  sanitizeEvidenceFileName,
  validateEvidenceFile,
} from '@/lib/brandEvidence'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabaseAuth'
import { uploadSessionRateLimitDb } from '@/lib/dbRateLimit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let documentId: string | null = null
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const validation = validateEvidenceFile(await req.json())
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const rateLimit = await uploadSessionRateLimitDb(user.id)
    if (!rateLimit.ok) {
      return NextResponse.json({ error: 'Too many upload requests. Try again later.' }, { status: 429 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

    const usage = await prisma.brandEvidenceDocument.aggregate({
      where: { workspaceId: workspace.id, status: { not: 'ARCHIVED' } },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    })
    const documentCount = usage._count._all
    const totalBytes = usage._sum.sizeBytes ?? 0
    if (
      documentCount >= BRAND_EVIDENCE_MAX_DOCUMENTS
      || totalBytes + validation.sizeBytes > BRAND_EVIDENCE_WORKSPACE_MAX_BYTES
    ) {
      return NextResponse.json({
        error: 'Brand evidence storage limit reached. Remove an old source before uploading another.',
        code: 'BRAND_EVIDENCE_STORAGE_LIMIT',
        limits: {
          documents: BRAND_EVIDENCE_MAX_DOCUMENTS,
          bytes: BRAND_EVIDENCE_WORKSPACE_MAX_BYTES,
        },
      }, { status: 409 })
    }

    const storagePath = `${workspace.id}/${randomUUID()}/${sanitizeEvidenceFileName(validation.fileName)}`
    const document = await prisma.brandEvidenceDocument.create({
      data: {
        workspaceId: workspace.id,
        uploadedById: user.id,
        originalName: validation.fileName,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
        storageBucket: BRAND_EVIDENCE_BUCKET,
        storagePath,
      },
      select: { id: true },
    })
    documentId = document.id

    const { data, error } = await getSupabaseAdmin()
      .storage
      .from(BRAND_EVIDENCE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false })

    if (error || !data?.token) {
      await prisma.brandEvidenceDocument.delete({ where: { id: document.id } }).catch(() => undefined)
      documentId = null
      console.error('[brand/evidence upload-session] signed URL failed', error?.message)
      return NextResponse.json({ error: 'Secure upload is temporarily unavailable' }, { status: 503 })
    }

    return NextResponse.json({
      documentId: document.id,
      bucket: BRAND_EVIDENCE_BUCKET,
      path: storagePath,
      token: data.token,
      expiresInSeconds: 7200,
    })
  } catch (error) {
    console.error('[brand/evidence upload-session]', error)
    if (documentId) {
      await prisma.brandEvidenceDocument.delete({ where: { id: documentId } }).catch(() => undefined)
    }
    return NextResponse.json({ error: 'Failed to create secure upload' }, { status: 500 })
  }
}
