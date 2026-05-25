import { NextResponse } from 'next/server'

// This route has been disabled for security
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
