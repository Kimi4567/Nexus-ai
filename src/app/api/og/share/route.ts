/**
 * GET /api/og/share?token=[token]
 * Returns a dynamic OG image (SVG→PNG via browser, or SVG directly) for a shared campaign.
 * Uses SVG rendered as an image response — compatible with Next.js edge runtime.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const GOAL_LABELS: Record<string, string> = {
  SALES: 'Sales', AWARENESS: 'Brand Awareness', LEADS: 'Lead Generation',
  TRAFFIC: 'Traffic', ENGAGEMENT: 'Engagement', BRAND_BUILDING: 'Brand Building',
}

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] || character)
}

export async function GET(req: NextRequest) {
  try {
  const token = req.nextUrl.searchParams.get('token')
  if (!token || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) return new NextResponse('Invalid token', { status: 400 })

  const campaign = await prisma.campaign.findFirst({
    where: { shareToken: token, isPublic: true },
    select: {
      name: true, goal: true, platforms: true, tone: true,
      project: { select: { workspace: { select: { name: true } } } },
    },
  }).catch(() => null)

  const name = escapeXml(campaign?.name || 'AI Marketing Campaign')
  const goal = GOAL_LABELS[campaign?.goal || ''] || 'Campaign'
  const workspace = escapeXml(campaign?.project?.workspace?.name || 'Nexus AI')
  const platforms = (campaign?.platforms || []).slice(0, 3)

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#080807;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#111110;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="60%" y2="100%">
      <stop offset="0%" style="stop-color:#FF9500;stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:#FF9500;stop-opacity:0" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="600" height="630" fill="url(#glow)" />

  <!-- Accent border top -->
  <rect width="1200" height="3" fill="#FF9500" opacity="0.8" />

  <!-- Nexus logo mark -->
  <rect x="60" y="52" width="40" height="40" rx="10" fill="#FF9500" />
  <polyline points="73,65 80,79 87,65" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="73" y1="65" x2="87" y2="65" stroke="white" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Nexus AI wordmark -->
  <text x="112" y="78" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="700" fill="white">Nexus AI</text>
  <text x="112" y="95" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#666">AI Marketing Platform</text>

  <!-- Divider -->
  <line x1="60" y1="124" x2="1140" y2="124" stroke="#1a1a18" stroke-width="1"/>

  <!-- Goal chip -->
  <rect x="60" y="155" width="${goal.length * 9 + 30}" height="30" rx="15" fill="rgba(255,149,0,0.1)" stroke="rgba(255,149,0,0.3)" stroke-width="1"/>
  <text x="${60 + (goal.length * 9 + 30) / 2}" y="174" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="600" fill="#FF9500" text-anchor="middle">✦ ${goal}</text>

  <!-- Campaign name -->
  <text x="60" y="250" font-family="system-ui,-apple-system,sans-serif" font-size="${name.length > 40 ? 36 : name.length > 25 ? 44 : 52}" font-weight="800" fill="white" dominant-baseline="auto">
    ${name.length > 50 ? name.substring(0, 47) + '…' : name}
  </text>

  <!-- Subtitle -->
  <text x="60" y="310" font-family="system-ui,-apple-system,sans-serif" font-size="20" fill="#888">Strategy · Hooks · Scripts · 30-Day Calendar</text>

  <!-- Platforms row -->
  <text x="60" y="390" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#555" font-weight="600" letter-spacing="1">PLATFORMS</text>
  <text x="60" y="430" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#FF9500" font-weight="600">${platforms.map(p => p.replace('_', ' ')).join('  ·  ')}</text>

  <!-- Workspace name -->
  <text x="60" y="560" font-family="system-ui,-apple-system,sans-serif" font-size="14" fill="#444">Campaign by</text>
  <text x="60" y="585" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="700" fill="#777">${workspace}</text>

  <!-- CTA right -->
  <rect x="880" y="520" width="260" height="56" rx="14" fill="#FF9500"/>
  <text x="1010" y="553" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="800" fill="#080807" text-anchor="middle">Generate yours free →</text>

  <!-- nexus-grow.com -->
  <text x="1140" y="595" font-family="system-ui,-apple-system,sans-serif" font-size="13" fill="#333" text-anchor="end">nexus-grow.com</text>

  <!-- Decorative grid dots -->
  ${Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) =>
      `<circle cx="${900 + i * 35}" cy="${160 + j * 60}" r="1.5" fill="#FF9500" opacity="${0.05 + (i + j) * 0.015}"/>`
    ).join('')
  ).join('')}
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
  } catch (err) {
    console.error('[og/share]', err)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
