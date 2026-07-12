import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

// Map common extensions to MIME types for correct Content-Type header
function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
  }
  return map[ext.toLowerCase()] || 'application/octet-stream'
}

export async function GET(req: Request, props: { params: Promise<{ file: string[] }> }) {
  const params = await props.params;
  try {
    const userId = await getServerUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const parts = params.file
    if (!parts || parts.length === 0) {
      return NextResponse.json({ error: 'File required' }, { status: 400 })
    }

    const rel = parts.join('/')
    const mediaUrl = `/api/storage/${rel}`
    const media = await prisma.media.findFirst({
      where: {
        url: mediaUrl,
        workspace: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
      select: { id: true },
    })
    if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Primary location: <cwd>/.storage/<rel>
    const base = path.resolve(process.cwd(), '.storage')
    const full = path.resolve(base, rel)
    // Guard against path traversal
    if (!full.startsWith(`${base}${path.sep}`)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (!fs.existsSync(full)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const stat = fs.statSync(full)
    const ext = path.extname(full)
    const contentType = mimeFromExt(ext)

    const headers: Record<string, string> = {
      'Content-Length': String(stat.size),
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }

    const stream = fs.createReadStream(full)
    return new NextResponse(stream as any, { headers })
  } catch (err) {
    console.error('Storage serve error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
