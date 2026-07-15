import type { ExecutionQueueItem, WorkspaceExecutionTruth } from '@/lib/executionTruth'

export type OperationsHealth = 'healthy' | 'attention' | 'critical' | 'not_started'

export interface OperationsIssue {
  id: string
  source: 'monitor' | 'execution' | 'connection' | 'paid' | 'analytics' | 'credits'
  priority: 'critical' | 'high' | 'medium'
  href: string
  title: { en: string; ar: string }
  reason: { en: string; ar: string }
}

export interface OperationsOverview {
  version: 1
  generatedAt: string
  monitor: {
    health: OperationsHealth
    lastRunAt: string | null
    nextRunAt: string
    schedule: 'hourly_at_minute_15_utc'
    actionsDetected: number | null
    suggestionsCreated: number | null
  }
  summary: {
    incidents: number
    attentionItems: number
    critical: number
    pendingApprovals: number
    overdueApprovals: number
  }
  connections: { total: number; connected: number; attention: number }
  analytics: { publishedAwaitingEvidence: number; latestEvidenceAt: string | null }
  credits: {
    spent30d: number
    refunded30d: number
    transactions30d: number
    unversionedCharges30d: number
    chargesWithoutArtifact30d: number
  }
  paid: { activeCampaigns: number; reportedSpend: number; staleSyncs: number; budgetIncidents: number }
  retries: { last24h: number; latestAt: string | null }
  issues: OperationsIssue[]
}

export interface OperationsOverviewInput {
  now: Date
  truth: WorkspaceExecutionTruth
  latestMonitor: {
    status: string
    createdAt: Date
    completedAt: Date | null
    outputData?: unknown
    error?: string | null
  } | null
  integrations: Array<{
    id: string
    type: string
    status: string
    updatedAt: Date
    config?: unknown
  }>
  adAccounts: Array<{
    id: string
    platform: string
    status: string
    tokenExpiresAt: Date | null
    lastError?: string | null
  }>
  pendingApprovals: number
  overdueApprovals: number
  creditTransactions: Array<{
    amount: number
    pricingVersion: string | null
    entityId: string | null
    entityType: string | null
  }>
  paidCampaigns: Array<{
    id: string
    name: string
    currency: string
    status: string
    platformCampaignId: string | null
    budgetType: string
    dailyBudget: number | null
    lifetimeBudget: number | null
    totalSpend: number
    startDate: Date | null
    endDate: Date | null
    lastSyncAt: Date | null
    lastSyncError: string | null
  }>
  publishedAwaitingEvidence: number
  latestAnalyticsAt: Date | null
  retriesLast24h: number
  latestRetryAt: Date | null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function nextHourlyRun(now: Date, minute = 15): Date {
  const next = new Date(now)
  next.setUTCMinutes(minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCHours(next.getUTCHours() + 1)
  return next
}

function monitorNumbers(value: unknown): { actionsDetected: number | null; suggestionsCreated: number | null } {
  const output = record(value)
  return {
    actionsDetected: typeof output.actionsDetected === 'number' ? output.actionsDetected : null,
    suggestionsCreated: typeof output.suggestionsCreated === 'number' ? output.suggestionsCreated : null,
  }
}

function connectionExpiry(config: unknown): Date | null {
  const value = record(config)
  return dateValue(value.expiresAt ?? value.expires_at ?? value.token_expiry)
}

function executionIssue(action: ExecutionQueueItem): OperationsIssue | null {
  if (action.priority !== 'critical' && action.priority !== 'high') return null
  return {
    id: `execution:${action.id}`,
    source: 'execution',
    priority: action.priority,
    href: action.href,
    title: action.title,
    reason: action.reason,
  }
}

function plannedSpendToDate(campaign: OperationsOverviewInput['paidCampaigns'][number], now: Date): number | null {
  if (campaign.budgetType === 'LIFETIME') return campaign.lifetimeBudget
  if (!campaign.dailyBudget || !campaign.startDate) return null
  const effectiveEnd = campaign.endDate && campaign.endDate.getTime() < now.getTime() ? campaign.endDate : now
  const elapsed = Math.max(1, Math.ceil((effectiveEnd.getTime() - campaign.startDate.getTime()) / 86_400_000) + 1)
  return campaign.dailyBudget * elapsed
}

export function buildOperationsOverview(input: OperationsOverviewInput): OperationsOverview {
  const issues = input.truth.queue.flatMap(action => {
    const issue = executionIssue(action)
    return issue ? [issue] : []
  })

  const lastRunAt = input.latestMonitor?.completedAt ?? input.latestMonitor?.createdAt ?? null
  const monitorAgeMs = lastRunAt ? input.now.getTime() - lastRunAt.getTime() : Number.POSITIVE_INFINITY
  const monitorFailed = Boolean(input.latestMonitor && input.latestMonitor.status !== 'COMPLETED')
  const monitorStale = Boolean(lastRunAt && monitorAgeMs > 2 * 60 * 60 * 1000)
  const monitorHealth: OperationsHealth = monitorFailed
    ? 'critical'
    : !lastRunAt
      ? 'not_started'
      : monitorStale
        ? 'attention'
        : 'healthy'

  if (monitorFailed || monitorStale || (!lastRunAt && input.truth.summary.campaigns > 0)) {
    issues.push({
      id: 'monitor:execution-heartbeat',
      source: 'monitor',
      priority: monitorFailed || monitorStale ? 'critical' : 'high',
      href: '/automation',
      title: {
        en: monitorFailed ? 'Execution monitor failed' : monitorStale ? 'Execution monitor heartbeat is overdue' : 'Execution monitor has not run yet',
        ar: monitorFailed ? 'فشل مراقب التنفيذ' : monitorStale ? 'تأخر نبض مراقب التنفيذ' : 'لم يعمل مراقب التنفيذ بعد',
      },
      reason: {
        en: monitorFailed
          ? input.latestMonitor?.error || 'The last persisted monitor run did not complete.'
          : monitorStale
            ? 'The hourly monitor has no successful heartbeat in the last two hours.'
            : 'A campaign exists, but no successful hourly monitor heartbeat is stored yet.',
        ar: monitorFailed
          ? input.latestMonitor?.error || 'لم يكتمل آخر تشغيل محفوظ للمراقب.'
          : monitorStale
            ? 'لا يوجد نبض ناجح للمراقب خلال آخر ساعتين.'
            : 'توجد حملة، لكن لا يوجد تشغيل ناجح محفوظ للمراقب حتى الآن.',
      },
    })
  }

  let connected = 0
  let connectionAttention = 0
  for (const integration of input.integrations) {
    const expiry = connectionExpiry(integration.config)
    const expiring = Boolean(expiry && expiry.getTime() <= input.now.getTime() + 7 * 86_400_000)
    const unhealthy = integration.status !== 'CONNECTED' || expiring
    if (integration.status === 'CONNECTED' && !expiring) connected++
    if (!unhealthy) continue
    connectionAttention++
    issues.push({
      id: `connection:social:${integration.id}`,
      source: 'connection',
      priority: integration.status === 'EXPIRED' || integration.status === 'ERROR' ? 'critical' : 'high',
      href: '/connections',
      title: { en: `${integration.type} connection needs attention`, ar: `اتصال ${integration.type} يحتاج انتباهًا` },
      reason: {
        en: expiring ? 'The verified token expires within seven days.' : `Provider status is ${integration.status}.`,
        ar: expiring ? 'تنتهي صلاحية التوكن الموثق خلال سبعة أيام.' : `حالة الموفر هي ${integration.status}.`,
      },
    })
  }
  for (const account of input.adAccounts) {
    const expiring = Boolean(account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= input.now.getTime() + 7 * 86_400_000)
    const unhealthy = account.status !== 'ACTIVE' || expiring || Boolean(account.lastError)
    if (account.status === 'ACTIVE' && !expiring && !account.lastError) connected++
    if (!unhealthy) continue
    connectionAttention++
    issues.push({
      id: `connection:ads:${account.id}`,
      source: 'connection',
      priority: account.status === 'ERROR' ? 'critical' : 'high',
      href: '/connections',
      title: { en: `${account.platform} Ads connection needs attention`, ar: `اتصال إعلانات ${account.platform} يحتاج انتباهًا` },
      reason: {
        en: account.lastError || (expiring ? 'The ads token expires within seven days.' : `Provider status is ${account.status}.`),
        ar: account.lastError || (expiring ? 'تنتهي صلاحية توكن الإعلانات خلال سبعة أيام.' : `حالة الموفر هي ${account.status}.`),
      },
    })
  }

  let paidStaleSyncs = 0
  let budgetIncidents = 0
  let reportedSpend = 0
  for (const campaign of input.paidCampaigns) {
    reportedSpend += Math.max(0, campaign.totalSpend || 0)
    const providerActive = campaign.status === 'ACTIVE' && Boolean(campaign.platformCampaignId)
    const staleSync = providerActive && (
      Boolean(campaign.lastSyncError)
      || !campaign.lastSyncAt
      || input.now.getTime() - campaign.lastSyncAt.getTime() > 26 * 60 * 60 * 1000
    )
    if (staleSync) {
      paidStaleSyncs++
      issues.push({
        id: `paid:sync:${campaign.id}`,
        source: 'paid',
        priority: 'high',
        href: `/paid-campaigns/${campaign.id}`,
        title: { en: `Paid metrics are stale: ${campaign.name}`, ar: `بيانات الإعلان متأخرة: ${campaign.name}` },
        reason: {
          en: campaign.lastSyncError || 'No verified provider metrics were synced in the last 26 hours.',
          ar: campaign.lastSyncError || 'لم تتم مزامنة بيانات موثقة من الموفر خلال آخر 26 ساعة.',
        },
      })
    }
    const plannedSpend = plannedSpendToDate(campaign, input.now)
    if (providerActive && plannedSpend !== null && plannedSpend > 0 && campaign.totalSpend > plannedSpend * 1.1) {
      budgetIncidents++
      issues.push({
        id: `paid:budget:${campaign.id}`,
        source: 'paid',
        priority: 'critical',
        href: `/paid-campaigns/${campaign.id}`,
        title: { en: `Spend exceeded the approved pace: ${campaign.name}`, ar: `الإنفاق تجاوز الوتيرة المعتمدة: ${campaign.name}` },
        reason: {
          en: `${campaign.currency} ${campaign.totalSpend.toFixed(2)} reported versus ${campaign.currency} ${plannedSpend.toFixed(2)} planned to date.`,
          ar: `الإنفاق المبلّغ ${campaign.currency} ${campaign.totalSpend.toFixed(2)} مقابل ${campaign.currency} ${plannedSpend.toFixed(2)} مخطط حتى الآن.`,
        },
      })
    }
  }

  if (input.publishedAwaitingEvidence > 0) {
    issues.push({
      id: 'analytics:missing-evidence',
      source: 'analytics',
      priority: 'high',
      href: '/analytics',
      title: { en: 'Published work is missing analytics evidence', ar: 'محتوى منشور بلا دليل تحليلات' },
      reason: {
        en: `${input.publishedAwaitingEvidence} published post${input.publishedAwaitingEvidence === 1 ? '' : 's'} still lack eligible provider evidence.`,
        ar: `${input.publishedAwaitingEvidence} منشور حي ما زال بلا دليل مؤهل من المنصة.`,
      },
    })
  }

  const debits = input.creditTransactions.filter(transaction => transaction.amount < 0)
  const spent30d = debits.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
  const refunded30d = input.creditTransactions
    .filter(transaction => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const unversionedCharges30d = debits.filter(transaction => !transaction.pricingVersion).length
  const chargesWithoutArtifact30d = debits.filter(transaction => !transaction.entityId || !transaction.entityType).length
  if (unversionedCharges30d > 0 || chargesWithoutArtifact30d > 0) {
    issues.push({
      id: 'credits:traceability',
      source: 'credits',
      priority: 'medium',
      href: '/billing',
      title: { en: 'Some recent credit charges lack full traceability', ar: 'بعض خصومات الكريديت الحديثة بلا تتبع كامل' },
      reason: {
        en: `${unversionedCharges30d} charge(s) lack a pricing version and ${chargesWithoutArtifact30d} lack an artifact link.`,
        ar: `${unversionedCharges30d} خصم بلا إصدار تسعير و${chargesWithoutArtifact30d} بلا رابط للمخرج.`,
      },
    })
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2 } as const
  issues.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority])
  const monitorStats = monitorNumbers(input.latestMonitor?.outputData)

  return {
    version: 1,
    generatedAt: input.now.toISOString(),
    monitor: {
      health: monitorHealth,
      lastRunAt: lastRunAt?.toISOString() ?? null,
      nextRunAt: nextHourlyRun(input.now).toISOString(),
      schedule: 'hourly_at_minute_15_utc',
      ...monitorStats,
    },
    summary: {
      incidents: issues.filter(issue => issue.source !== 'execution' || issue.priority === 'critical').length,
      attentionItems: issues.length,
      critical: issues.filter(issue => issue.priority === 'critical').length,
      pendingApprovals: input.pendingApprovals,
      overdueApprovals: input.overdueApprovals,
    },
    connections: {
      total: input.integrations.length + input.adAccounts.length,
      connected,
      attention: connectionAttention,
    },
    analytics: { publishedAwaitingEvidence: input.publishedAwaitingEvidence, latestEvidenceAt: input.latestAnalyticsAt?.toISOString() ?? null },
    credits: { spent30d, refunded30d, transactions30d: input.creditTransactions.length, unversionedCharges30d, chargesWithoutArtifact30d },
    paid: { activeCampaigns: input.paidCampaigns.length, reportedSpend, staleSyncs: paidStaleSyncs, budgetIncidents },
    retries: { last24h: input.retriesLast24h, latestAt: input.latestRetryAt?.toISOString() ?? null },
    issues,
  }
}
