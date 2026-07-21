import { NextRequest, NextResponse } from 'next/server'
import {
  isLikelyCrawler,
  publicLandingPageRequesterParts,
  resolvePublicLandingPage,
} from '@/lib/publicLandingPage'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ publicId: string }> }

export async function GET(req: NextRequest, context: Context) {
  const { publicId } = await context.params
  const crawler = isLikelyCrawler(req.headers)
  const resolution = await resolvePublicLandingPage({
    publicId,
    requesterParts: publicLandingPageRequesterParts(req.headers),
    includeExperiment: !crawler,
    measurementEligible: !crawler,
  })

  if (!resolution.ok) {
    return NextResponse.json({ error: resolution.error, code: resolution.code }, {
      status: resolution.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json({
    page: resolution.page,
    publishedAt: resolution.publishedAt,
    experiment: resolution.experiment,
    measurementEligible: resolution.measurementEligible,
    conversionTruth: {
      pageView: 'CLIENT_REPORTED',
      ctaClick: 'CLIENT_REPORTED',
      formSubmission: 'SERVER_CONFIRMED',
      wonOutcome: 'MANUAL_CONFIRMED_IN_CRM',
      revenue: 'MANUAL_CONFIRMED_IN_CRM',
      platformPermissionsRequired: false,
      crawlerTrafficExcluded: true,
    },
  }, {
    headers: {
      'Cache-Control': resolution.cacheControl,
      ETag: resolution.etag,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
