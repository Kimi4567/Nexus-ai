import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

export async function GET(req: Request, { params }: { params: { file: string[] } }) {
  try {
    const parts = params.file
    if (!parts || parts.length === 0) return NextResponse.json({ error: 'File required' }, { status: 400 })
    const rel = parts.join('/')
    const base = path.resolve(process.cwd(), '.storage')
    const full = path.join(base, rel)
    if (!full.startsWith(base)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    if (!fs.existsSync(full)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const stat = fs.statSync(full)
    const headers: any = { 'Content-Length': String(stat.size) }
    const stream = fs.createReadStream(full)
    return new NextResponse(stream as any, { headers })
  } catch (err) {
    console.error('Storage serve error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
