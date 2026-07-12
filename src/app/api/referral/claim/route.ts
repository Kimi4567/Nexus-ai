/**
 * POST /api/referral/claim
 * Called after a new user completes onboarding and has a referral code.
 *
 * Body: { referralCode: string }
 *
 * Effect:
 *   1. Find the referrer by code
 *   2. Link new user to referrer (referredById)
 *   3. Award REFERRAL_BONUS_CREDITS to BOTH users
 *   4. Prevent double-claiming
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { REFERRAL_BONUS_CREDITS } from '@/lib/stripe'
// B1d-b — create matching REFERRAL grants in parallel with the aiCredits bonuses
// (idempotent per side; flag-independent; no change to amounts/messages/status).
import { ensureGrant, buildBonusGrant, referralSource } from '@/lib/credits/creditGrants'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await adminClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const referralCode = typeof body.referralCode === 'string' ? body.referralCode.trim().toUpperCase() : ''
  if (!/^NEXUS-[A-HJ-NP-Z2-9]{6}$/.test(referralCode)) {
    return NextResponse.json({ error: 'Valid referralCode required' }, { status: 400 })
  }

  try {
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Serialize claims per referred user. The conditional update below is the
      // final race guard; the lock also prevents awarding two referrers.
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `referral-claim:${user.id}`)
      const dbUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { referredById: true },
      })
      if (!dbUser) throw new Error('REFERRAL_USER_NOT_FOUND')
      if (dbUser.referredById) throw new Error('REFERRAL_ALREADY_CLAIMED')

      const referrer = await tx.user.findUnique({
        where: { referralCode },
        select: { id: true },
      })
      if (!referrer) throw new Error('REFERRAL_CODE_INVALID')
      if (referrer.id === user.id) throw new Error('REFERRAL_SELF_CLAIM')

      const base = referralSource(referrer.id, user.id)
      // New (referred) user — link referral + bonus
      const claimed = await tx.user.updateMany({
        where: { id: user.id, referredById: null },
        data: {
          referredById: referrer.id,
          aiCredits: { increment: REFERRAL_BONUS_CREDITS },
        },
      })
      if (claimed.count !== 1) throw new Error('REFERRAL_ALREADY_CLAIMED')
      // Referrer — bonus + earned counter
      await tx.user.update({
        where: { id: referrer.id },
        data: {
          aiCredits: { increment: REFERRAL_BONUS_CREDITS },
          referralCreditsEarned: { increment: REFERRAL_BONUS_CREDITS },
        },
      })
      await ensureGrant(
        buildBonusGrant(user.id, 'REFERRAL', REFERRAL_BONUS_CREDITS, `${base}:referred`),
        tx,
      )
      await ensureGrant(
        buildBonusGrant(referrer.id, 'REFERRAL', REFERRAL_BONUS_CREDITS, `${base}:referrer`),
        tx,
      )
      return { referrerId: referrer.id }
    })

    console.log(`[Referral] ${user.id} claimed code ${referralCode} → referrer ${result.referrerId} both get +${REFERRAL_BONUS_CREDITS} credits`)

    return NextResponse.json({
      ok: true,
      bonusCredits: REFERRAL_BONUS_CREDITS,
      message: `You received ${REFERRAL_BONUS_CREDITS} bonus credits!`,
    })
  } catch (err: any) {
    if (err?.message === 'REFERRAL_USER_NOT_FOUND') return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (err?.message === 'REFERRAL_ALREADY_CLAIMED') return NextResponse.json({ error: 'Referral already claimed' }, { status: 409 })
    if (err?.message === 'REFERRAL_CODE_INVALID') return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
    if (err?.message === 'REFERRAL_SELF_CLAIM') return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    console.error('[Referral claim]', err)
    return NextResponse.json({ error: 'Failed to claim referral' }, { status: 500 })
  }
}
