/**
 * GET /api/admin/users
 * Returns all users with plan, credits, and workspace count.
 * Admin-only — requires role === ADMIN in the database.
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

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      subscriptionStatus: true,
      aiCredits: true,
      stripeCustomerId: true,
      createdAt: true,
      lastLoginAt: true,
      company: true,
      _count: {
        select: { workspaces: true },
      },
    },
  })

  // Revenue summary
  const planCounts = await prisma.user.groupBy({
    by: ['subscriptionStatus'],
    _count: { _all: true },
  })

  return NextResponse.json({ users, planCounts })
}
