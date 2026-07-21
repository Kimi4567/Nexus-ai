import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { getCampaignDeliveryPackage } from '@/lib/campaignDeliveryPackageService'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: Context) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const delivery = await getCampaignDeliveryPackage(userId, id)
  if (!delivery) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  return NextResponse.json(delivery, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
