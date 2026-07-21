import { getLandingPageGate } from '@/lib/landingPageAccess'
import {
  publishedSnapshotCaptureFormPublicId,
  type PublicLandingPageSnapshot,
} from '@/lib/landingPageContract'
import { getPublicLandingExperimentState } from '@/lib/landingPageExperimentAccess'
import { assignLandingExperimentVariant, createLandingExperimentToken } from '@/lib/landingPageExperiment'
import { prisma } from '@/lib/prisma'

export interface PublicLandingExperimentAssignment {
  variant: 'CONTROL' | 'CHALLENGER'
  assignmentToken: string
  successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION'
}

export type PublicLandingPageResolution =
  | {
      ok: true
      page: PublicLandingPageSnapshot
      publishedAt: string | null
      experiment: PublicLandingExperimentAssignment | null
      measurementEligible: boolean
      cacheControl: string
      etag: string
    }
  | {
      ok: false
      status: number
      error: string
      code?: string
    }

const CRAWLER_USER_AGENT = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|google-inspectiontool/i

export function publicLandingPageRequesterParts(headers: Headers): string[] {
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || 'unknown'
  return [ip, headers.get('user-agent') || 'unknown', headers.get('accept-language') || 'unknown']
}

export function isLikelyCrawler(headers: Headers): boolean {
  return CRAWLER_USER_AGENT.test(headers.get('user-agent') || '')
}

export async function resolvePublicLandingPage(args: {
  publicId: string
  requesterParts?: string[]
  includeExperiment?: boolean
  measurementEligible?: boolean
}): Promise<PublicLandingPageResolution> {
  const gate = await getLandingPageGate()
  if (!gate.ready) {
    return {
      ok: false,
      status: 503,
      error: gate.body.error,
      code: gate.body.code,
    }
  }

  const page = await prisma.landingPage.findUnique({
    where: { publicId: args.publicId },
    select: {
      id: true,
      workspaceId: true,
      campaignId: true,
      status: true,
      publishedSnapshot: true,
      publishedHash: true,
      publishedAt: true,
    },
  })
  if (!page || page.status !== 'PUBLISHED' || !page.publishedSnapshot || !page.publishedHash) {
    return { ok: false, status: 404, error: 'Landing page not found' }
  }

  const measurementEligible = args.measurementEligible !== false
  let renderedSnapshot = page.publishedSnapshot as unknown as PublicLandingPageSnapshot
  let renderedHash = page.publishedHash
  let publicExperiment: PublicLandingExperimentAssignment | null = null

  if (args.includeExperiment !== false && measurementEligible) {
    const experimentState = await getPublicLandingExperimentState()
    if (experimentState.enabled && !experimentState.ready) {
      return {
        ok: false,
        status: 503,
        error: experimentState.body.error,
        code: experimentState.body.code,
      }
    }
    if (experimentState.enabled && experimentState.ready) {
      const experiment = await prisma.landingPageExperiment.findFirst({
        where: { landingPageId: page.id, status: 'RUNNING' },
        select: {
          id: true,
          challengerAllocationPercent: true,
          controlSnapshot: true,
          controlHash: true,
          challengerSnapshot: true,
          challengerHash: true,
        },
      })
      if (experiment) {
        const secret = process.env.CRO_EVENT_HASH_KEY as string
        const variant = assignLandingExperimentVariant({
          secret,
          experimentId: experiment.id,
          fingerprintParts: args.requesterParts || ['unknown'],
          challengerAllocationPercent: experiment.challengerAllocationPercent,
        })
        renderedSnapshot = (variant === 'CHALLENGER'
          ? experiment.challengerSnapshot
          : experiment.controlSnapshot) as unknown as PublicLandingPageSnapshot
        renderedHash = variant === 'CHALLENGER' ? experiment.challengerHash : experiment.controlHash
        publicExperiment = {
          variant,
          assignmentToken: createLandingExperimentToken(secret, {
            experimentId: experiment.id,
            landingPageId: page.id,
            variant,
          }),
          successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION',
        }
      }
    }
  }

  const publishedCaptureFormPublicId = publishedSnapshotCaptureFormPublicId(renderedSnapshot)
  if (publishedCaptureFormPublicId) {
    const activeCaptureForm = await prisma.leadCaptureForm.findFirst({
      where: {
        publicId: publishedCaptureFormPublicId,
        workspaceId: page.workspaceId,
        campaignId: page.campaignId,
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    if (!activeCaptureForm) {
      return { ok: false, status: 503, error: 'Campaign intake is temporarily unavailable.' }
    }
  }

  return {
    ok: true,
    page: renderedSnapshot,
    publishedAt: page.publishedAt?.toISOString() || null,
    experiment: publicExperiment,
    measurementEligible,
    cacheControl: publicExperiment ? 'private, no-store' : 'public, max-age=60, stale-while-revalidate=300',
    etag: `"${renderedHash}"`,
  }
}
