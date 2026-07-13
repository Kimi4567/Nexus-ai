/**
 * GET  /api/referral          — get current user's referral code + stats
 * POST /api/referral/generate — generate a referral code if not yet set
 *
 * Referral flow:
 *   1. User shares nexus-grow.com/register?ref=NEXUS-XXXXXX
 *   2. New user signs up → POST /api/referral/claim is called server-side
 *   3. Both users receive REFERRAL_BONUS_CREDITS credits
 */
import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { prisma } from '@/lib/prisma'
import { REFERRAL_BONUS_CREDITS } from '@/lib/stripe'
import { randomInt } from 'crypto'

// ── Generate a short unique referral code ─────────────────────────────────────
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'NEXUS-'
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(chars.length)]
  }
  return code
}

// ── GET — fetch referral info for authenticated user ─────────────────────────
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await adminClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        referralCode: true,
        referralCreditsEarned: true,
        _count: { select: { referrals: true } },
      },
    })

    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Auto-generate referral code if not set yet
    if (!dbUser.referralCode) {
      let code = generateCode()
      // Ensure uniqueness (retry up to 5x)
      for (let i = 0; i < 5; i++) {
        const exists = await prisma.user.findUnique({ where: { referralCode: code } })
        if (!exists) break
        code = generateCode()
      }
      dbUser = await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: code },
        select: {
          referralCode: true,
          referralCreditsEarned: true,
          _count: { select: { referrals: true } },
        },
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-grow.com'
    return NextResponse.json({
      code: dbUser.referralCode,
      referralUrl: `${baseUrl}/register?ref=${dbUser.referralCode}`,
      totalReferrals: dbUser._count.referrals,
      creditsEarned: dbUser.referralCreditsEarned,
      bonusPerReferral: REFERRAL_BONUS_CREDITS,
    })
  } catch (err: any) {
    console.error('[Referral GET]', err)
    return NextResponse.json({ error: 'Failed to fetch referral info' }, { status: 500 })
  }
}
