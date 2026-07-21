import { getLandingPageDatabaseReadiness, isLandingPagesRequested, isLandingPagesRuntimeConfigured, landingPagesUnavailableResponse } from '@/lib/landingPageReadiness'
import { getLeadCrmDatabaseReadiness, leadCrmUnavailableResponse } from '@/lib/leadCrmReadiness'

export async function getLandingPageGate() {
  if (!isLandingPagesRequested() || !isLandingPagesRuntimeConfigured()) {
    return { ready: false as const, body: landingPagesUnavailableResponse() }
  }
  const [landingPages, leadCrm] = await Promise.all([
    getLandingPageDatabaseReadiness(),
    getLeadCrmDatabaseReadiness(),
  ])
  if (!landingPages.ready) {
    return { ready: false as const, body: landingPagesUnavailableResponse(landingPages) }
  }
  if (!leadCrm.ready) {
    return { ready: false as const, body: leadCrmUnavailableResponse(leadCrm) }
  }
  return { ready: true as const, landingPages, leadCrm }
}
