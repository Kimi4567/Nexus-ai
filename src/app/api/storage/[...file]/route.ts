import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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

export async function GET(req: Request, { params }: { params: { file: string[] } }) {
  try {
    const parts = params.file
    if (!parts || parts.length === 0) {
      return NextResponse.json({ error: 'File required' }, { status: 400 })
    }

    const rel = parts.join('/')

    // Primary location: <cwd>/.storage/<rel>
    const base = path.resolve(process.cwd(), '.storage')
    const full = path.join(base, rel)
    // Guard against path traversal
    if (!full.startsWith(base)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Resolve actual file path — check primary, then Vercel /tmp fallback
    let filePath = full
    if (!fs.existsSync(full)) {
      // On Vercel, local uploads are written to /tmp/nexus_uploads/<filename>
      const fileName = path.basename(rel)
      const tmpPath = path.join('/tmp/nexus_uploads', fileName)
      if (fs.existsSync(tmpPath)) {
        filePath = tmpPath
      } else {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath)
    const contentType = mimeFromExt(ext)

    const headers: Record<string, string> = {
      'Content-Length': String(stat.size),
      'Content-Type': contentType,
      // Allow browsers to cache static uploads
      'Cache-Control': 'public, max-age=31536000, immutable',
    }

    const stream = fs.createReadStream(filePath)
    return new NextResponse(stream as any, { headers })
  } catch (err) {
    console.error('Storage serve error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
