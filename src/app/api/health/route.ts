import { NextRequest, NextResponse } from 'next/server'
import { cronAuthError } from '@/lib/cronAuth'
import { getRuntimeConfig } from '@/lib/runtimeConfig'
import { getBillingDatabaseReadiness } from '@/lib/billingDatabaseReadiness'
import { getLeadCrmDatabaseReadiness } from '@/lib/leadCrmReadiness'
import { getLifecycleDatabaseReadiness } from '@/lib/lifecycleReadiness'
import { getLandingPageDatabaseReadiness } from '@/lib/landingPageReadiness'
import { getLandingExperimentDatabaseReadiness } from '@/lib/landingPageExperimentReadiness'

export const dynamic = 'force-dynamic'

/**
 * Liveness/readiness endpoint.
 *
 * The default response is intentionally tiny and public so load balancers can
 * probe it without receiving configuration details. `?detail=1` is restricted
 * with the same Bearer CRON_SECRET used by scheduled jobs and is suitable for
 * deployment checks and incident triage.
 */
export async function GET(req: NextRequest) {
  const now = new Date().toISOString()
  if (req.nextUrl.searchParams.get('detail') !== '1') {
    return NextResponse.json({ ok: true, service: 'nexus-ai', timestamp: now })
  }

  const authError = cronAuthError(req)
  if (authError) return authError

  const config = getRuntimeConfig()
  const leadCrmRequested = config.leadCrm?.requested === true
  const lifecycleRequested = config.lifecycleMessaging?.requested === true
  const landingPagesRequested = config.landingPages?.requested === true
  const landingExperimentsRequested = config.landingPageExperiments?.requested === true
  const [database, leadCrmDatabase, lifecycleDatabase, landingPagesDatabase, landingExperimentsDatabase] = await Promise.all([
    getBillingDatabaseReadiness(),
    leadCrmRequested ? getLeadCrmDatabaseReadiness() : Promise.resolve(null),
    lifecycleRequested ? getLifecycleDatabaseReadiness() : Promise.resolve(null),
    landingPagesRequested ? getLandingPageDatabaseReadiness() : Promise.resolve(null),
    landingExperimentsRequested ? getLandingExperimentDatabaseReadiness() : Promise.resolve(null),
  ])
  const billingSchemaRequired = config.billing.requested || config.wallet.requested
  const databaseReady = database.reachable && (!billingSchemaRequired || database.ready)
  const leadCrmReady = !leadCrmRequested || leadCrmDatabase?.ready === true
  const lifecycleReady = !lifecycleRequested || lifecycleDatabase?.ready === true
  const landingPagesReady = !landingPagesRequested || landingPagesDatabase?.ready === true
  const landingExperimentsReady = !landingExperimentsRequested || landingExperimentsDatabase?.ready === true
  const ready = config.ready && databaseReady && leadCrmReady && lifecycleReady && landingPagesReady && landingExperimentsReady
  return NextResponse.json({
    ok: ready,
    service: 'nexus-ai',
    timestamp: now,
    config,
    database: {
      reachable: database.reachable,
      billingSchemaRequired,
      billingWebhookEvents: database.billingWebhookEvents,
      state: database.state,
    },
    leadCrmDatabase: {
      required: leadCrmRequested,
      reachable: leadCrmDatabase?.reachable ?? null,
      leads: leadCrmDatabase?.leads ?? null,
      activities: leadCrmDatabase?.activities ?? null,
      tasks: leadCrmDatabase?.tasks ?? null,
      captureForms: leadCrmDatabase?.captureForms ?? null,
      state: leadCrmDatabase?.state ?? 'disabled',
    },
    lifecycleDatabase: {
      required: lifecycleRequested,
      reachable: lifecycleDatabase?.reachable ?? null,
      suppressions: lifecycleDatabase?.suppressions ?? null,
      messages: lifecycleDatabase?.messages ?? null,
      state: lifecycleDatabase?.state ?? 'disabled',
    },
    landingPagesDatabase: {
      required: landingPagesRequested,
      reachable: landingPagesDatabase?.reachable ?? null,
      landingPages: landingPagesDatabase?.landingPages ?? null,
      revisions: landingPagesDatabase?.revisions ?? null,
      conversionEvents: landingPagesDatabase?.conversionEvents ?? null,
      state: landingPagesDatabase?.state ?? 'disabled',
    },
    landingPageExperimentsDatabase: {
      required: landingExperimentsRequested,
      reachable: landingExperimentsDatabase?.reachable ?? null,
      experiments: landingExperimentsDatabase?.experiments ?? null,
      assignments: landingExperimentsDatabase?.assignments ?? null,
      state: landingExperimentsDatabase?.state ?? 'disabled',
    },
  }, { status: ready ? 200 : 503 })
}
