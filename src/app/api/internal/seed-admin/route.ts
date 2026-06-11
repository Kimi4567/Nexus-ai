/**
 * ONE-TIME internal endpoint — set admin role + reset credits.
 * DELETE THIS FILE after use.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ONE_TIME_TOKEN = 'nexus-admin-seed-2026'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== ONE_TIME_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const updated = await prisma.user.update({
      where: { email: 'raoufnaguib44@gmail.com' },
      data: {
        role: 'ADMIN',
        aiCredits: 500,
      },
      select: { id: true, email: true, role: true, aiCredits: true },
    })
    return NextResponse.json({ ok: true, user: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
