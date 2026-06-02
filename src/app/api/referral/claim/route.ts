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

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await adminClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { referralCode } = await req.json()
  if (!referralCode) return NextResponse.json({ error: 'referralCode required' }, { status: 400 })

  try {
    // Check if user already claimed a referral
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { referredById: true, aiCredits: true },
    })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (dbUser.referredById) {
      return NextResponse.json({ error: 'Referral already claimed' }, { status: 409 })
    }

    // Find referrer
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.trim().toUpperCase() },
      select: { id: true, aiCredits: true, referralCreditsEarned: true },
    })
    if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })

    // Prevent self-referral
    if (referrer.id === user.id) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    }

    // Award credits to new user + link referral
    await prisma.user.update({
      where: { id: user.id },
      data: {
        referredById: referrer.id,
        aiCredits: { increment: REFERRAL_BONUS_CREDITS },
      },
    })

    // Award credits to referrer
    await prisma.user.update({
      where: { id: referrer.id },
      data: {
        aiCredits: { increment: REFERRAL_BONUS_CREDITS },
        referralCreditsEarned: { increment: REFERRAL_BONUS_CREDITS },
      },
    })

    console.log(`[Referral] ${user.id} claimed code ${referralCode} → referrer ${referrer.id} both get +${REFERRAL_BONUS_CREDITS} credits`)

    return NextResponse.json({
      ok: true,
      bonusCredits: REFERRAL_BONUS_CREDITS,
      message: `You received ${REFERRAL_BONUS_CREDITS} bonus credits!`,
    })
  } catch (err: any) {
    console.error('[Referral claim]', err)
    return NextResponse.json({ error: 'Failed to claim referral' }, { status: 500 })
  }
}
