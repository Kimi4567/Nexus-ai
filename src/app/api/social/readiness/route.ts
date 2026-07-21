import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { isOAuthStateConfigured } from '@/lib/oauthState'
import { buildSocialProviderReadiness } from '@/lib/socialProviderReadiness'

export const dynamic = 'force-dynamic'

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const baseUrl = appBaseUrl()
  const secureStateConfigured = isOAuthStateConfigured()

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    providers: buildSocialProviderReadiness({ baseUrl, secureStateConfigured }),
  })
}
