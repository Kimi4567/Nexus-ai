/**
 * GET /api/cron/nurture-emails
 * Runs daily. Sends the right nurture email to each user based on their
 * account age. Tracks sent stages in user.preferences.nurtureStage.
 *
 * Schedule: every day at 09:00 UTC
 * Protected by CRON_SECRET header.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendNurtureDay1,
  sendNurtureDay3,
  sendNurtureDay5,
  sendNurtureDay7,
} from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

// Windows (in hours) for each nurture stage
// Wide windows so we never miss a user due to cron timing
const STAGES = [
  { stage: 1, minHours: 20,  maxHours: 32,  send: sendNurtureDay1 },
  { stage: 3, minHours: 68,  maxHours: 80,  send: sendNurtureDay3 },
  { stage: 5, minHours: 116, maxHours: 128, send: sendNurtureDay5 },
  { stage: 7, minHours: 164, maxHours: 176, send: sendNurtureDay7 },
]

export async function GET(req: NextRequest) {
  // Verify cron secret — matches Vercel's Authorization: Bearer <CRON_SECRET> format
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'development') { return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 }) }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'No RESEND_API_KEY' })
  }

  const now = Date.now()
  const results: Record<string, number> = { sent: 0, skipped: 0, errors: 0 }

  // Only process free users (paid users don't need nurture)
  const users = await prisma.user.findMany({
    where: {
      email: { not: undefined },
      subscriptionStatus: 'FREE',
      // Only look at users created in the last 8 days
      createdAt: { gte: new Date(now - 8 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, email: true, name: true, createdAt: true, preferences: true },
  })

  for (const user of users) {
    const ageHours = (now - user.createdAt.getTime()) / 3_600_000
    const prefs = (user.preferences as any) || {}
    const sentStage: number = prefs.nurtureStage ?? 0

    // Find which stage this user should be at right now
    for (const { stage, minHours, maxHours, send } of STAGES) {
      if (ageHours >= minHours && ageHours < maxHours && sentStage < stage) {
        try {
          await send(user.email, user.name || user.email.split('@')[0])

          // Mark stage as sent in preferences
          await prisma.user.update({
            where: { id: user.id },
            data: {
              preferences: { ...prefs, nurtureStage: stage } as any,
            },
          })

          results.sent++
          console.log(`[nurture] Stage ${stage} sent to ${user.email} (age: ${ageHours.toFixed(1)}h)`)
        } catch (err: any) {
          results.errors++
          console.error(`[nurture] Failed stage ${stage} for ${user.email}:`, err?.message)
        }
        break // Only one stage per user per run
      }
    }

    if (sentStage >= 7) results.skipped++
  }

  return NextResponse.json({
    ok: true,
    usersChecked: users.length,
    ...results,
    ts: new Date().toISOString(),
  })
}
