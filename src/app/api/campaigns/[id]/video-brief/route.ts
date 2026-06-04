// REMOVED: AI video generation is no longer supported.
import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ error: 'Video generation removed.' }, { status: 410 })
}
export async function POST() {
  return NextResponse.json({ error: 'Video generation removed.' }, { status: 410 })
}
