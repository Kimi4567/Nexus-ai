import { getLandingPageGate } from '@/lib/landingPageAccess'
import {
  getLandingExperimentDatabaseReadiness,
  isLandingPageExperimentsRequested,
  landingExperimentsUnavailableResponse,
} from '@/lib/landingPageExperimentReadiness'

export async function getLandingExperimentGate() {
  if (!isLandingPageExperimentsRequested()) {
    return { ready: false as const, body: landingExperimentsUnavailableResponse() }
  }
  const landingPages = await getLandingPageGate()
  if (!landingPages.ready) return landingPages
  const experiments = await getLandingExperimentDatabaseReadiness()
  if (!experiments.ready) {
    return { ready: false as const, body: landingExperimentsUnavailableResponse(experiments) }
  }
  return { ready: true as const, landingPages, experiments }
}

export async function getPublicLandingExperimentState() {
  if (!isLandingPageExperimentsRequested()) return { enabled: false as const }
  const gate = await getLandingExperimentGate()
  return gate.ready
    ? { enabled: true as const, ready: true as const }
    : { enabled: true as const, ready: false as const, body: gate.body }
}
