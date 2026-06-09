/**
 * PATCH /api/admin/users/[id]/credits
 * Grants or deducts AI credits for a user.
 * Body: { delta: number, reason?: string }
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

async function requireAdmin(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return null
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { role: true },
  })
  if (dbUser?.role !== 'ADMIN') return null
  return authUser
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  let delta: number
  try {
    const body = await req.json()
    delta = Number(body.delta)
    if (isNaN(delta) || delta === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid delta value' }, { status: 400 })
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { aiCredits: true, email: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const newCredits = Math.max(0, target.aiCredits + delta)

    const updated = await prisma.user.update({
      where: { id },
      data: { aiCredits: newCredits },
      select: { id: true, email: true, aiCredits: true },
    })

    return NextResponse.json({ ok: true, user: updated })
  } catch (err: any) {
    console.error('[admin/credits]', err?.message)
    return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
  }
}
