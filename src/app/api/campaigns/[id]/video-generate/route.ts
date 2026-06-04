// REMOVED: AI video generation is no longer supported.
// Users upload their own videos via the Media Library.
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ error: 'Video generation removed. Upload videos via Media Library.' }, { status: 410 })
}
