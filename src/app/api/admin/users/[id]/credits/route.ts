/**
 * PATCH /api/admin/users/[id]/credits
 * Grants or deducts AI credits for a user.
 * Body: { delta: number, reason?: string }
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { CURRENT_CREDIT_PRICING_VERSION } from '@/lib/credits/pricing'
import { addCredits } from '@/lib/credits'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { randomUUID } from 'crypto'

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

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  let delta: number
  try {
    const body = await req.json()
    delta = Number(body.delta)
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 10_000) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid delta value' }, { status: 400 })
  }

  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { aiCredits: true, email: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (delta < 0 && isCreditWalletEnabled()) {
      return NextResponse.json({
        error: 'Wallet-backed manual debits require a source-allocation workflow; use account reset for destructive removal.',
        code: 'WALLET_MANUAL_DEBIT_UNSUPPORTED',
      }, { status: 409 })
    }

    if (delta > 0) {
      const reason = `Admin ${admin.id}: manual credit grant`
      await addCredits(id, delta, reason, 'admin_manual', `manual:admin:${randomUUID()}`)
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `admin-credit:${id}`)
        const current = await tx.user.findUnique({ where: { id }, select: { aiCredits: true } })
        if (!current) throw new Error('USER_NOT_FOUND')
        const deduction = Math.min(current.aiCredits, Math.abs(delta))
        await tx.user.update({ where: { id }, data: { aiCredits: { decrement: deduction } } })
        await tx.creditTransaction.create({
          data: {
            userId: id,
            action: 'ADMIN_DEBIT',
            description: `Admin ${admin.id}: manual debit`,
            amount: -deduction,
            entityType: 'admin_manual',
            pricingVersion: CURRENT_CREDIT_PRICING_VERSION,
          },
        })
      })
    }
    const updated = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, aiCredits: true },
    })

    return NextResponse.json({ ok: true, user: updated })
  } catch (err: any) {
    console.error('[admin/credits]', err?.message)
    return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 })
  }
}
