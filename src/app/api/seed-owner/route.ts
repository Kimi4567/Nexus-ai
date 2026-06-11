/**
 * GET  /api/seed-owner  → diagnose: shows auth UUID + DB state
 * POST /api/seed-owner  → fix: upserts ADMIN + 500 credits for owner
 *
 * Only works when called with a valid JWT for raoufnaguib44@gmail.com
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const OWNER_EMAIL = 'raoufnaguib44@gmail.com'

/** GET — diagnostic: what does the app see for this user? */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Try to find the DB row by the ACTUAL auth UUID
    let dbUser = null
    let prismaError = null
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, role: true, aiCredits: true },
      })
    } catch (e: unknown) {
      prismaError = e instanceof Error ? e.message : String(e)
    }

    // Also count all rows with this email
    let emailRows: { id: string; email: string; role: string; aiCredits: number }[] = []
    try {
      emailRows = await prisma.user.findMany({
        where: { email: user.email! },
        select: { id: true, email: true, role: true, aiCredits: true },
      }) as { id: string; email: string; role: string; aiCredits: number }[]
    } catch { /* ignore */ }

    return NextResponse.json({
      authUUID: user.id,
      authEmail: user.email,
      dbRowByUUID: dbUser,
      allRowsByEmail: emailRows,
      prismaError,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

/** POST — fix: upsert ADMIN + 500 credits using the actual auth UUID */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        role: 'ADMIN',
        aiCredits: 500,
        email: user.email!,
      },
      create: {
        id: user.id,
        email: user.email!,
        name: 'Raouf',
        role: 'ADMIN',
        aiCredits: 500,
      },
    })

    return NextResponse.json({
      ok: true,
      message: '✅ Account fixed! Hard refresh the dashboard.',
      id: updated.id,
      email: updated.email,
      role: updated.role,
      aiCredits: updated.aiCredits,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
