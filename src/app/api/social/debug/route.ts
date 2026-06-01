/**
 * GET /api/social/debug — temporary diagnostic endpoint
 * Returns raw integration state from DB for the current user.
 * DELETE THIS FILE after debugging is complete.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No auth token' }, { status: 401 })

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Invalid token', detail: error?.message }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
  if (!workspace) return NextResponse.json({ userId: user.id, workspace: null, integrations: [] })

  const integrations = await prisma.integration.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, type: true, status: true, accountId: true, accountName: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({
    userId: user.id,
    workspaceId: workspace.id,
    integrations,
  })
}
