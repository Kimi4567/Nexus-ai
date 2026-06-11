import { NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getCreditHistory } from '@/lib/credits'

/**
 * GET /api/credits/history
 *
 * Returns the last N credit transactions for the authenticated user.
 * Query params:
 *   limit  — max rows to return (default 50, max 100)
 */
export async function GET(request: Request) {
  const userId = await getServerUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawLimit = parseInt(searchParams.get('limit') || '50', 10)
  const limit = Math.min(Math.max(1, rawLimit), 100)

  const history = await getCreditHistory(userId, limit)

  return NextResponse.json({ history })
}
