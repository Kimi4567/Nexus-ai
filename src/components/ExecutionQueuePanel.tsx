'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, ListChecks, ShieldCheck } from 'lucide-react'
import type { ExecutionPriority, WorkspaceExecutionTruth } from '@/lib/executionTruth'

const PRIORITY_STYLE: Record<ExecutionPriority, { dot: string; bg: string; border: string }> = {
  critical: { dot: '#E11D48', bg: '#FFF1F2', border: 'rgba(225,29,72,0.18)' },
  high: { dot: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.18)' },
  medium: { dot: '#5E5CE6', bg: '#F5F3FF', border: 'rgba(94,92,230,0.18)' },
  low: { dot: '#64748B', bg: '#F8FAFC', border: 'rgba(100,116,139,0.16)' },
}

export function ExecutionQueuePanel({
  truth,
  locale,
}: {
  truth: WorkspaceExecutionTruth
  locale: string
}) {
  const ar = locale === 'ar'
  const visibleQueue = truth.queue.slice(0, 6)

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500" />
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50">
              <ListChecks className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-950">
                  {ar ? 'طابور التنفيذ' : 'Execution queue'}
                </h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {visibleQueue.length} {ar ? 'إجراءات ظاهرة' : 'visible actions'}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                {ar
                  ? 'مصدر موحّد لحالة الاستراتيجية والمحتوى والجدولة. يعرض الإجراء التالي فقط، ولا ينفّذ نشرًا أو إنفاقًا تلقائيًا.'
                  : 'One source of truth for strategy, content, and scheduling. It surfaces the next action only and never auto-publishes or spends.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[290px]">
            {[
              { value: truth.summary.needsAttention, en: 'Issues', ar: 'تعثر', color: truth.summary.needsAttention ? '#E11D48' : '#059669' },
              { value: truth.summary.awaitingApproval, en: 'Approvals', ar: 'موافقات', color: '#D97706' },
              { value: truth.summary.scheduledPosts, en: 'Scheduled', ar: 'مجدول', color: '#5E5CE6' },
            ].map((metric) => (
              <div key={metric.en} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <p className="text-lg font-bold" style={{ color: metric.color }}>{metric.value}</p>
                <p className="text-[10px] font-semibold text-slate-500">{ar ? metric.ar : metric.en}</p>
              </div>
            ))}
          </div>
        </div>

        {visibleQueue.length > 0 ? (
          <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {visibleQueue.map((action) => {
              const style = PRIORITY_STYLE[action.priority]
              const SafetyIcon = action.safety === 'review_required'
                ? ShieldCheck
                : action.safety === 'monitor_only'
                  ? Clock3
                  : CheckCircle2
              return (
                <div key={action.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                      style={{ background: style.bg, borderColor: style.border }}
                    >
                      {action.priority === 'critical'
                        ? <AlertTriangle className="h-4 w-4" style={{ color: style.dot }} />
                        : <SafetyIcon className="h-4 w-4" style={{ color: style.dot }} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{ar ? action.title.ar : action.title.en}</p>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {action.campaignName}
                        </span>
                        {action.requiresApproval && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            {ar ? 'تحتاج موافقتك' : 'Your approval required'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{ar ? action.reason.ar : action.reason.en}</p>
                    </div>
                  </div>
                  <Link
                    href={action.href}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100"
                  >
                    {action.safety === 'monitor_only'
                      ? (ar ? 'عرض الحالة' : 'View status')
                      : (ar ? 'فتح الإجراء' : 'Open action')}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800">
              {ar ? 'لا توجد إجراءات تشغيل معلقة الآن.' : 'There are no pending execution actions right now.'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
