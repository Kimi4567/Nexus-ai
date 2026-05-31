import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { createUploadError } from '@/lib/uploadValidation'
import { logUploadEvent } from '@/lib/auditLogger'
import crypto from 'crypto'

function normalizeCloudinaryFolder(folder: string) {
  return folder.replace(/[^a-zA-Z0-9_\/\-]/g, '_').replace(/^\/+|\/+$/g, '')
}

export async function POST(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json(createUploadError(401, 'Unauthorized', 'UNAUTHORIZED'), { status: 401 })

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json(createUploadError(400, 'Cloudinary not configured', 'CLOUDINARY_DISABLED'), { status: 400 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sessionToken = body?.sessionToken as string | undefined
    const requestedFolder = body?.folder as string | undefined

    // If a sessionToken is provided, validate it (strict flow from UploadPanel).
    // If not provided, generate a signature for the folder sent in the request body
    // (lightweight flow used by the Media Library page).
    let folder: string
    let resourceType = 'auto'

    if (sessionToken) {
      const session = await prisma.uploadSession.findUnique({ where: { token: sessionToken } })
      if (!session || session.userId !== userId) {
        await logUploadEvent({ userId, sessionId: session?.id, eventType: 'INVALID_UPLOAD_SESSION', severity: 'WARN', metadata: { sessionToken } })
        return NextResponse.json(createUploadError(403, 'Invalid upload session', 'INVALID_SESSION'), { status: 403 })
      }
      if (session.status !== 'PENDING' || session.expiresAt < new Date()) {
        await logUploadEvent({ userId, workspaceId: session.workspaceId, sessionId: session.id, eventType: 'EXPIRED_UPLOAD_SESSION', severity: 'WARN' })
        return NextResponse.json(createUploadError(410, 'Upload session expired', 'SESSION_EXPIRED'), { status: 410 })
      }
      folder = normalizeCloudinaryFolder(`nexus/${session.workspaceId}`)
      resourceType = session.resourceType || 'auto'
    } else {
      // Sessionless path — sign using provided folder or a user-scoped default
      folder = normalizeCloudinaryFolder(requestedFolder || `nexus/${userId}`)
    }

    const timestamp = Math.floor(Date.now() / 1000)
    // resource_type is specified in the upload URL path, NOT in the signed params.
    // Including it here causes "Invalid Signature" errors.
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = crypto.createHash('sha1').update(paramsToSign + process.env.CLOUDINARY_API_SECRET).digest('hex')

    return NextResponse.json({
      signature,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      timestamp,
      folder,
      resource_type: resourceType,
      ...(sessionToken ? { sessionToken } : {}),
    })
  } catch (err) {
    console.error('Cloudinary signature error', err)
    return NextResponse.json(createUploadError(500, 'Failed to create signature', 'SIGNATURE_FAILED'), { status: 500 })
  }
}
