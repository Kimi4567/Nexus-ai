'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LeadsNav } from '@/components/leads/LeadsNav'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Option { id: string; name?: string | null; email?: string; role?: string }
interface ImportIssue { rowNumber: number; code: string; message: string }
interface ImportReport {
  dryRun: boolean
  totalRows?: number
  readyRows?: number
  rejectedRows: number
  imported?: number
  issues: ImportIssue[]
}

const TEMPLATE = 'full_name,email,phone,company,job_title,source_detail,consent_status,consent_source,utm_source,utm_medium,utm_campaign\nExample Person,person@example.com,,Example Co,Founder,Webinar,UNKNOWN,,linkedin,social,q3_launch'

export default function LeadImportPage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const [ready, setReady] = useState<boolean | null>(null)
  const [csv, setCsv] = useState(TEMPLATE)
  const [campaigns, setCampaigns] = useState<Option[]>([])
  const [operators, setOperators] = useState<Option[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState<'check' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    const token = authHeader()
    if (!token) return
    const controller = new AbortController()
    async function load() {
      try {
        const readinessResponse = await fetch('/api/leads/readiness', { headers: { Authorization: token }, cache: 'no-store', signal: controller.signal })
        const readiness = await readinessResponse.json().catch(() => ({}))
        setReady(Boolean(readiness.ready))
        if (!readiness.ready) return
        const [campaignResponse, operatorResponse] = await Promise.all([
          fetch('/api/campaigns', { headers: { Authorization: token }, cache: 'no-store', signal: controller.signal }),
          fetch('/api/leads/operators', { headers: { Authorization: token }, cache: 'no-store', signal: controller.signal }),
        ])
        const [campaignData, operatorData] = await Promise.all([campaignResponse.json(), operatorResponse.json()])
        const rows = Array.isArray(campaignData.campaigns) ? campaignData.campaigns : Array.isArray(campaignData) ? campaignData : []
        setCampaigns(rows.map((item: Option) => ({ id: item.id, name: item.name })))
        setOperators(Array.isArray(operatorData.operators) ? operatorData.operators : [])
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Could not load import workspace.')
      }
    }
    load()
    return () => controller.abort()
  }, [authHeader, authLoading, isAuthenticated])

  async function runImport(dryRun: boolean) {
    const token = authHeader()
    if (!token) return
    setBusy(dryRun ? 'check' : 'import')
    setError(null)
    try {
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, dryRun, campaignId: campaignId || null, assignedToId: assignedToId || null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Import failed.')
      setReport(data)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.')
    } finally {
      setBusy(null)
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return
    if (file.size > 256 * 1024) {
      setError(ar ? 'الملف يجب ألا يتجاوز 256KB.' : 'The file must be 256KB or smaller.')
      return
    }
    setCsv(await file.text())
    setReport(null)
    setError(null)
  }

  if (authLoading || ready === null) {
    return <AppShell><div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#5E63FF]" /></div></AppShell>
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'استيراد العملاء المحتملين' : 'Lead CSV import'}
          pageSubtitle={ar ? 'راجع الملف أولًا، ثم استورد الصفوف الصالحة فقط داخل Workspace الحالي.' : 'Validate first, then import only valid rows into the current workspace.'}
          primaryHref="/leads"
          primaryLabel={ar ? 'العودة للمسار' : 'Back to pipeline'}
          secondaryHref={null}
        />
        <LeadsNav />

        {!ready ? (
          <section className="nx-os-card mx-auto max-w-3xl p-7 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#5E63FF]" />
            <h2 className="mt-4 text-xl font-black text-[#0B1028]">{ar ? 'CRM غير مفعّل في هذه البيئة' : 'CRM is not enabled in this environment'}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">{ar ? 'لن نقرأ أو نكتب أي بيانات حتى تطبيق migrations واختبارات العزل.' : 'No data will be read or written until migrations and isolation checks pass.'}</p>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <section className="nx-os-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#0B1028]">{ar ? 'ملف CSV' : 'CSV file'}</h2>
                  <p className="mt-1 text-xs leading-6 text-slate-500">{ar ? 'حد أقصى 200 صف و256KB. البريد أو الهاتف مطلوب.' : 'Maximum 200 rows and 256KB. Email or phone is required.'}</p>
                </div>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700">
                  <FileSpreadsheet className="h-4 w-4" /> {ar ? 'اختيار ملف' : 'Choose file'}
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={event => readFile(event.target.files?.[0])} />
                </label>
              </div>
              <textarea value={csv} onChange={event => { setCsv(event.target.value); setReport(null) }} spellCheck={false} className="mt-4 min-h-80 w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-emerald-200 outline-none focus:border-indigo-400" aria-label={ar ? 'محتوى CSV' : 'CSV content'} />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <select value={campaignId} onChange={event => setCampaignId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  <option value="">{ar ? 'بدون حملة محددة' : 'No campaign assigned'}</option>
                  {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
                <select value={assignedToId} onChange={event => setAssignedToId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  <option value="">{ar ? 'بدون تعيين تلقائي' : 'No automatic assignee'}</option>
                  {operators.map(operator => <option key={operator.id} value={operator.id}>{operator.name || operator.email} · {operator.role}</option>)}
                </select>
              </div>
              {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(busy) || !csv.trim()} onClick={() => runImport(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 text-xs font-black text-indigo-700 disabled:opacity-50">
                  {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{ar ? 'فحص بدون استيراد' : 'Validate only'}
                </button>
                <button type="button" disabled={Boolean(busy) || !csv.trim()} onClick={() => runImport(false)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#101A4D] px-5 text-xs font-black text-white disabled:opacity-50">
                  {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{ar ? 'استيراد الصفوف الصالحة' : 'Import valid rows'}
                </button>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="nx-os-card p-5">
                <h2 className="text-sm font-black text-[#0B1028]">{ar ? 'عقد الاستيراد' : 'Import contract'}</h2>
                <ul className="mt-3 space-y-2 text-xs font-medium leading-6 text-slate-600">
                  <li>• {ar ? 'لا يتم افتراض الموافقة من وجود البريد.' : 'Email presence never implies consent.'}</li>
                  <li>• {ar ? 'GRANTED يحتاج consent_source لكل صف.' : 'GRANTED requires consent_source per row.'}</li>
                  <li>• {ar ? 'أي فشل قاعدة بيانات يلغي الدفعة كلها.' : 'A database failure rolls back the whole batch.'}</li>
                  <li>• {ar ? 'التكرار يُرفض ولا يُدمج بصمت.' : 'Duplicates are rejected, never silently merged.'}</li>
                </ul>
              </section>
              {report ? (
                <section className="nx-os-card p-5" aria-live="polite">
                  <div className="flex items-center gap-2">
                    {report.rejectedRows ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    <h2 className="text-sm font-black text-[#0B1028]">{report.dryRun ? (ar ? 'نتيجة الفحص' : 'Validation result') : (ar ? 'نتيجة الاستيراد' : 'Import result')}</h2>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xl font-black text-emerald-700">{report.imported ?? report.readyRows ?? 0}</p><p className="text-[11px] font-bold text-emerald-600">{report.dryRun ? (ar ? 'جاهز' : 'Ready') : (ar ? 'تم' : 'Imported')}</p></div>
                    <div className="rounded-xl bg-amber-50 p-3"><p className="text-xl font-black text-amber-700">{report.rejectedRows}</p><p className="text-[11px] font-bold text-amber-600">{ar ? 'مرفوض' : 'Rejected'}</p></div>
                  </div>
                  {report.issues.length ? <div className="mt-4 max-h-64 space-y-2 overflow-auto">{report.issues.map(issue => <div key={`${issue.rowNumber}-${issue.code}`} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs leading-5 text-amber-800"><strong>Row {issue.rowNumber} · {issue.code}</strong><br />{issue.message}</div>)}</div> : null}
                  {!report.dryRun && report.imported ? <Link href="/leads" className="mt-4 inline-flex text-xs font-black text-indigo-700">{ar ? 'عرض العملاء المستوردين ←' : 'View imported leads →'}</Link> : null}
                </section>
              ) : null}
            </aside>
          </div>
        )}
      </main>
    </AppShell>
  )
}
