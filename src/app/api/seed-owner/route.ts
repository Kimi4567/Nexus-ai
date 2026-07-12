import { NextResponse } from 'next/server'

/**
 * Legacy personal bootstrap endpoint removed from the production surface.
 * Admin roles and credit grants must use audited database/admin workflows.
 */
export async function GET() {
  return NextResponse.json({ error: 'Endpoint retired' }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: 'Endpoint retired' }, { status: 410 })
}
