import { prisma } from '@/lib/prisma'
import { summarizeFirstPartyMeasurement } from '@/lib/firstPartyMeasurement'

export async function readFirstPartyMeasurement(workspaceId: string, campaignId?: string | null) {
  const eventWhere = { workspaceId, ...(campaignId ? { campaignId } : {}) }
  const leadWhere = { workspaceId, ...(campaignId ? { campaignId } : {}) }
  const touchWhere = { type: 'FORM_RECAPTURED', lead: leadWhere }
  const [eventCount, leadCount, touchCount, events, leads, leadTouches] = await Promise.all([
    prisma.conversionEvent.count({ where: eventWhere }),
    prisma.lead.count({ where: leadWhere }),
    prisma.leadActivity.count({ where: touchWhere }),
    prisma.conversionEvent.findMany({
      where: eventWhere,
      orderBy: { occurredAt: 'asc' },
      take: 20_000,
      select: {
        eventType: true,
        verificationState: true,
        attribution: true,
        occurredAt: true,
      },
    }),
    prisma.lead.findMany({
      where: leadWhere,
      orderBy: { createdAt: 'asc' },
      take: 10_000,
      select: {
        id: true,
        campaignId: true,
        source: true,
        stage: true,
        attribution: true,
        createdAt: true,
        convertedAt: true,
        conversionValue: true,
        conversionCurrency: true,
      },
    }),
    prisma.leadActivity.findMany({
      where: touchWhere,
      orderBy: { occurredAt: 'asc' },
      take: 20_000,
      select: {
        leadId: true,
        type: true,
        metadata: true,
        occurredAt: true,
      },
    }),
  ])
  const summary = summarizeFirstPartyMeasurement(events, leads, leadTouches)
  const partial = eventCount > events.length || leadCount > leads.length || touchCount > leadTouches.length
  return partial ? {
    ...summary,
    stage: 'collecting' as const,
    coverage: {
      eventRowsAnalyzed: events.length,
      leadRowsAnalyzed: leads.length,
      touchRowsAnalyzed: leadTouches.length,
      partial: true,
    },
    insights: [{
      code: 'FIRST_PARTY_DATA_WINDOW_PARTIAL', evidenceLevel: 'insufficient' as const, causalClaim: false as const,
      title: 'The current view is partial', titleAr: 'العرض الحالي جزئي',
      rationale: `${events.length} of ${eventCount} event rows, ${leads.length} of ${leadCount} leads, and ${leadTouches.length} of ${touchCount} recapture touches were analyzed.`,
      rationaleAr: `تم تحليل ${events.length} من ${eventCount} صف أحداث و${leads.length} من ${leadCount} عميل و${leadTouches.length} من ${touchCount} إعادة التقاط.`,
      nextAction: 'Narrow the reporting period or move aggregation to a reporting table before making a directional decision.',
      nextActionAr: 'حدّد فترة التقرير أو انقل التجميع إلى جدول تقارير قبل اتخاذ قرار اتجاهي.',
    }],
  } : summary
}
