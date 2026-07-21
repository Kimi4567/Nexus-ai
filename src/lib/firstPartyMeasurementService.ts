import { prisma } from '@/lib/prisma'
import { summarizeFirstPartyMeasurement } from '@/lib/firstPartyMeasurement'

export async function readFirstPartyMeasurement(workspaceId: string) {
  const [eventCount, leadCount, events, leads] = await Promise.all([
    prisma.conversionEvent.count({ where: { workspaceId } }),
    prisma.lead.count({ where: { workspaceId } }),
    prisma.conversionEvent.findMany({
      where: { workspaceId },
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
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      take: 10_000,
      select: {
        id: true,
        source: true,
        stage: true,
        attribution: true,
        createdAt: true,
        convertedAt: true,
        conversionValue: true,
        conversionCurrency: true,
      },
    }),
  ])
  const summary = summarizeFirstPartyMeasurement(events, leads)
  const partial = eventCount > events.length || leadCount > leads.length
  return partial ? {
    ...summary,
    stage: 'collecting' as const,
    coverage: { eventRowsAnalyzed: events.length, leadRowsAnalyzed: leads.length, partial: true },
    insights: [{
      code: 'FIRST_PARTY_DATA_WINDOW_PARTIAL', evidenceLevel: 'insufficient' as const, causalClaim: false as const,
      title: 'The current view is partial', titleAr: 'العرض الحالي جزئي',
      rationale: `${events.length} of ${eventCount} event rows and ${leads.length} of ${leadCount} leads were analyzed.`,
      rationaleAr: `تم تحليل ${events.length} من ${eventCount} صف أحداث و${leads.length} من ${leadCount} عميل.`,
      nextAction: 'Narrow the reporting period or move aggregation to a reporting table before making a directional decision.',
      nextActionAr: 'حدّد فترة التقرير أو انقل التجميع إلى جدول تقارير قبل اتخاذ قرار اتجاهي.',
    }],
  } : summary
}
