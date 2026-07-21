import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { PublicLandingPageClient } from '@/components/landing-pages/PublicLandingPageClient'
import { buildLandingPageMetadata, unavailableLandingPageMetadata } from '@/lib/landingPageSeo'
import {
  isLikelyCrawler,
  publicLandingPageRequesterParts,
  resolvePublicLandingPage,
} from '@/lib/publicLandingPage'

export const dynamic = 'force-dynamic'
type PageProps = { params: Promise<{ publicId: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params
  const baseline = await resolvePublicLandingPage({
    publicId,
    includeExperiment: false,
    measurementEligible: false,
  })
  return baseline.ok
    ? buildLandingPageMetadata(baseline.page, publicId)
    : unavailableLandingPageMetadata()
}

export default async function PublicLandingPage({ params }: PageProps) {
  const { publicId } = await params
  const requestHeaders = await headers()
  const crawler = isLikelyCrawler(requestHeaders)
  const resolution = await resolvePublicLandingPage({
    publicId,
    requesterParts: publicLandingPageRequesterParts(requestHeaders),
    includeExperiment: !crawler,
    measurementEligible: !crawler,
  })

  if (!resolution.ok && resolution.status === 404) notFound()
  if (!resolution.ok) {
    return (
      <main dir="ltr" className="grid min-h-screen place-items-center bg-[#F6F8FC] px-5">
        <section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-black text-slate-900">Page unavailable</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">{resolution.error}</p>
        </section>
      </main>
    )
  }

  return (
    <PublicLandingPageClient
      publicId={publicId}
      page={resolution.page}
      experimentToken={resolution.experiment?.assignmentToken || null}
      measurementEligible={resolution.measurementEligible}
    />
  )
}
