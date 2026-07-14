/**
 * Legacy AI learning endpoint — retired.
 *
 * Generated strategies and approved drafts are not performance evidence, and a
 * hidden model call here created uncovered COGS. Brand Brain now learns through:
 *   - explicit user-confirmed profile changes;
 *   - deterministic editorial-preference proposals;
 *   - provenance-checked platform performance evidence after publishing.
 *
 * Keep the route as a clear compatibility boundary instead of silently running
 * a paid provider call or treating generated copy as learned truth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    error: 'AI_SIGNAL_EXTRACTION_RETIRED',
    code: 'AI_SIGNAL_EXTRACTION_RETIRED',
    message: 'Generated outputs are no longer converted into AI learning proposals. Use user-reviewed Brand Brain updates or verified post-performance evidence.',
    proposals: [],
    creditsUsed: 0,
  }, { status: 410 })
}
