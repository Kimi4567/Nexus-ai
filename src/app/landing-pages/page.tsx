'use client'

import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { LandingExperimentPanel } from '@/components/landing-pages/LandingExperimentPanel'
import { LandingPageQualityGate } from '@/components/landing-pages/LandingPageQualityGate'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { evaluateLandingPageQuality } from '@/lib/landingPageQualityGate'
import { Archive, ArrowUpLeft, CheckCircle2, Copy, ExternalLink, FilePenLine, FlaskConical, Globe2, Link2, Loader2, MousePointerClick, Plus, Rocket, Search, ShieldCheck, UsersRound, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface CampaignOption { id: string; name: string; status: string }
interface CaptureFormOption { id: string; publicId: string; name: string; title: string; status: string; campaignId: string | null }
interface LandingPageRecord {
  id: string
  publicId: string
  publicPath: string
  name: string
  campaignId: string
  captureFormId: string | null
  campaign: CampaignOption
  captureForm?: CaptureFormOption | null
  locale: 'AR' | 'EN' | 'BILINGUAL'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  headline: string
  subheadline?: string | null
  body?: string | null
  benefits: unknown
  proof?: string | null
  primaryCtaLabel: string
  primaryCtaUrl?: string | null
  theme: unknown
  seoTitle?: string | null
  seoDescription?: string | null
  seoIndexable: boolean
  publishedSeoIndexable: boolean
  version: number
  publishedVersion?: number | null
  publishedAt?: string | null
  updatedAt: string
  hasUnpublishedChanges: boolean
  evidence: { reportedViews: number; reportedClicks: number; confirmedSubmissions: number }
}
interface Summary { total: number; reportedViews: number; reportedClicks: number; confirmedSubmissions: number }
interface Readiness { ready: boolean; requested: boolean; runtimeConfigured: boolean; databaseState: string; leadCrmState: string }

const EMPTY_EDITOR = {
  name: '', campaignId: '', captureFormId: '', locale: 'AR', headline: '', subheadline: '', body: '',
  benefitsText: '', proof: '', primaryCtaLabel: 'ابدأ الآن', primaryCtaUrl: '', theme: 'MIDNIGHT',
  seoTitle: '', seoDescription: '', seoIndexable: false, changeNote: '',
}

function jsonBenefits(value: unknown): string {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string').join('\n') : ''
}

function jsonTheme(value: unknown): string {
  return value && typeof value === 'object' && 'variant' in value && typeof value.variant === 'string'
    ? value.variant
    : 'MIDNIGHT'
}

function editorFromPage(page: LandingPageRecord): typeof EMPTY_EDITOR {
  return {
    name: page.name,
    campaignId: page.campaignId,
    captureFormId: page.captureFormId || '',
    locale: page.locale,
    headline: page.headline,
    subheadline: page.subheadline || '',
    body: page.body || '',
    benefitsText: jsonBenefits(page.benefits),
    proof: page.proof || '',
    primaryCtaLabel: page.primaryCtaLabel,
    primaryCtaUrl: page.primaryCtaUrl || '',
    theme: jsonTheme(page.theme),
    seoTitle: page.seoTitle || '',
    seoDescription: page.seoDescription || '',
    seoIndexable: page.seoIndexable,
    changeNote: '',
  }
}

function editorDraftFingerprint(editor: typeof EMPTY_EDITOR): string {
  return JSON.stringify({
    name: editor.name,
    campaignId: editor.campaignId,
    captureFormId: editor.captureFormId,
    locale: editor.locale,
    headline: editor.headline,
    subheadline: editor.subheadline,
    body: editor.body,
    benefitsText: editor.benefitsText,
    proof: editor.proof,
    primaryCtaLabel: editor.primaryCtaLabel,
    primaryCtaUrl: editor.primaryCtaUrl,
    theme: editor.theme,
    seoTitle: editor.seoTitle,
    seoDescription: editor.seoDescription,
    seoIndexable: editor.seoIndexable,
  })
}

function draftPayloadFromPage(page: LandingPageRecord) {
  const draft = editorFromPage(page)
  return {
    name: draft.name,
    campaignId: draft.campaignId,
    captureFormId: draft.captureFormId || null,
    locale: draft.locale,
    headline: draft.headline,
    subheadline: draft.subheadline || null,
    body: draft.body || null,
    benefits: draft.benefitsText.split('\n').map(item => item.trim()).filter(Boolean),
    proof: draft.proof || null,
    primaryCtaLabel: draft.primaryCtaLabel,
    primaryCtaUrl: draft.primaryCtaUrl || null,
    theme: { variant: draft.theme },
    seoTitle: draft.seoTitle || null,
    seoDescription: draft.seoDescription || null,
    seoIndexable: draft.seoIndexable,
  }
}

export default function LandingPagesWorkspace() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const copy = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar])
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [pages, setPages] = useState<LandingPageRecord[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [captureForms, setCaptureForms] = useState<CaptureFormOption[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, reportedViews: 0, reportedClicks: 0, confirmedSubmissions: 0 })
  const [editor, setEditor] = useState(EMPTY_EDITOR)
  const [selected, setSelected] = useState<LandingPageRecord | null>(null)
  const [experimentPage, setExperimentPage] = useState<LandingPageRecord | null>(null)
  const [trackingPage, setTrackingPage] = useState<LandingPageRecord | null>(null)
  const [tracking, setTracking] = useState({ source: '', medium: 'owned', campaign: '', content: '', term: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<LandingPageRecord | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoading(true)
    try {
      const readinessResponse = await fetch('/api/landing-pages/readiness', { headers: { Authorization: token }, cache: 'no-store' })
      const readinessData = await readinessResponse.json().catch(() => ({})) as Readiness
      setReadiness(readinessData)
      if (!readinessData.ready) return
      const response = await fetch('/api/landing-pages', { headers: { Authorization: token }, cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر تحميل صفحات الهبوط.', 'Could not load landing pages.'))
      setPages(Array.isArray(data.pages) ? data.pages : [])
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : [])
      setCaptureForms(Array.isArray(data.captureForms) ? data.captureForms : [])
      if (data.summary) setSummary(data.summary)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر تحميل مساحة صفحات الهبوط.', 'Could not load the landing-page workspace.') })
    } finally {
      setLoading(false)
    }
  }, [authHeader, copy])

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load()
  }, [authLoading, isAuthenticated, load])

  const matchingForms = useMemo(() => captureForms.filter(form => form.campaignId === editor.campaignId && form.status === 'ACTIVE'), [captureForms, editor.campaignId])
  const qualityResult = useMemo(() => evaluateLandingPageQuality({
    headline: editor.headline,
    subheadline: editor.subheadline,
    body: editor.body,
    benefits: editor.benefitsText.split('\n').map(item => item.trim()).filter(Boolean),
    proof: editor.proof,
    primaryCtaLabel: editor.primaryCtaLabel,
    primaryCtaUrl: editor.primaryCtaUrl,
    captureFormId: editor.captureFormId,
    seoTitle: editor.seoTitle,
    seoDescription: editor.seoDescription,
    seoIndexable: editor.seoIndexable,
  }), [editor])
  const editorDirty = useMemo(() => selected
    ? editorDraftFingerprint(editor) !== editorDraftFingerprint(editorFromPage(selected))
    : false, [editor, selected])
  const publishBlocked = editorDirty || qualityResult.blockers > 0

  function editPage(page: LandingPageRecord) {
    setSelected(page)
    setShowCreate(false)
    setEditor(editorFromPage(page))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editorPayload() {
    return {
      name: editor.name,
      campaignId: editor.campaignId,
      captureFormId: editor.captureFormId || null,
      locale: editor.locale,
      headline: editor.headline,
      subheadline: editor.subheadline || null,
      body: editor.body || null,
      benefits: editor.benefitsText.split('\n').map(item => item.trim()).filter(Boolean),
      proof: editor.proof || null,
      primaryCtaLabel: editor.primaryCtaLabel,
      primaryCtaUrl: editor.primaryCtaUrl || null,
      theme: { variant: editor.theme },
      seoTitle: editor.seoTitle || null,
      seoDescription: editor.seoDescription || null,
      seoIndexable: editor.seoIndexable,
    }
  }

  async function createPage(event: React.FormEvent) {
    event.preventDefault()
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(editorPayload()),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر إنشاء الصفحة.', 'Could not create the page.'))
      setEditor(EMPTY_EDITOR)
      setShowCreate(false)
      setNotice({ tone: 'success', text: copy('تم إنشاء مسودة. لم يتم نشر أي شيء بعد.', 'Draft created. Nothing has been published yet.') })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر إنشاء الصفحة.', 'Could not create the page.') })
    } finally {
      setSaving(false)
    }
  }

  async function savePage(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    const token = authHeader()
    if (!token) return
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editorPayload(), expectedVersion: selected.version, changeNote: editor.changeNote || null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر حفظ التعديلات.', 'Could not save changes.'))
      const savedPage = { ...selected, ...data.page, evidence: selected.evidence } as LandingPageRecord
      setSelected(savedPage)
      setPages(current => current.map(page => page.id === data.page.id ? { ...page, ...data.page } : page))
      setEditor(editorFromPage(savedPage))
      setNotice({ tone: 'success', text: copy('تم حفظ نسخة جديدة. النسخة المنشورة لم تتغير.', 'New revision saved. The published version did not change.') })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر حفظ التعديلات.', 'Could not save changes.') })
    } finally {
      setSaving(false)
    }
  }

  async function publishPage() {
    if (!selected || publishBlocked) return
    const token = authHeader()
    if (!token) return
    setPublishing(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(selected.id)}/publish`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: selected.version }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر نشر الصفحة.', 'Could not publish the page.'))
      setSelected(current => current ? { ...current, ...data.page, evidence: current.evidence } : current)
      setPages(current => current.map(page => page.id === data.page.id ? { ...page, ...data.page } : page))
      setNotice({ tone: 'success', text: copy('تم نشر النسخة التي راجعتها فقط.', 'Only the reviewed version was published.') })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر نشر الصفحة.', 'Could not publish the page.') })
    } finally {
      setPublishing(false)
    }
  }

  async function archivePage(page: LandingPageRecord) {
    const token = authHeader()
    if (!token) return
    setArchivingId(page.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/landing-pages/${encodeURIComponent(page.id)}`, {
        method: 'PATCH',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draftPayloadFromPage(page),
          status: 'ARCHIVED',
          expectedVersion: page.version,
          changeNote: 'Archived from the landing-page workspace',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || copy('تعذر أرشفة الصفحة.', 'Could not archive the page.'))
      if (selected?.id === page.id) setSelected(null)
      if (trackingPage?.id === page.id) setTrackingPage(null)
      if (experimentPage?.id === page.id) setExperimentPage(null)
      setArchiveTarget(null)
      setNotice({ tone: 'success', text: copy('تمت الأرشفة. الرابط العام متوقف وسجل القياس محفوظ.', 'Page archived. Public access is disabled and measurement history is retained.') })
      await load()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : copy('تعذر أرشفة الصفحة.', 'Could not archive the page.') })
    } finally {
      setArchivingId(null)
    }
  }

  async function copyPublicLink(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      setNotice({ tone: 'success', text: copy('تم نسخ رابط الصفحة.', 'Page link copied.') })
    } catch {
      setNotice({ tone: 'error', text: copy('تعذر نسخ الرابط تلقائيًا.', 'Could not copy the link automatically.') })
    }
  }

  function openTrackingBuilder(page: LandingPageRecord) {
    const campaign = page.campaign.name.toLowerCase().trim()
      .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 100)
    setTrackingPage(page)
    setTracking({ source: '', medium: 'owned', campaign, content: '', term: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function copyTrackedLink(event: React.FormEvent) {
    event.preventDefault()
    if (!trackingPage) return
    const source = tracking.source.trim()
    const medium = tracking.medium.trim()
    const campaign = tracking.campaign.trim()
    if (!source || !medium || !campaign) return
    try {
      const url = new URL(trackingPage.publicPath, window.location.origin)
      url.searchParams.set('utm_source', source.slice(0, 100))
      url.searchParams.set('utm_medium', medium.slice(0, 100))
      url.searchParams.set('utm_campaign', campaign.slice(0, 160))
      if (tracking.content.trim()) url.searchParams.set('utm_content', tracking.content.trim().slice(0, 160))
      if (tracking.term.trim()) url.searchParams.set('utm_term', tracking.term.trim().slice(0, 160))
      await navigator.clipboard.writeText(url.toString())
      setNotice({ tone: 'success', text: copy('تم نسخ رابط UTM. سيظهر المصدر والحملة في Attribution.', 'UTM link copied. Its source and campaign will appear in Attribution.') })
    } catch {
      setNotice({ tone: 'error', text: copy('تعذر إنشاء رابط التتبع.', 'Could not create the tracked link.') })
    }
  }

  const editorVisible = showCreate || Boolean(selected)
  const readinessText = !readiness?.requested
    ? copy('الميزة موجودة لكنها مغلقة بالـ feature flag في هذه البيئة.', 'The feature is built but its environment flag is off.')
    : !readiness.runtimeConfigured
      ? copy('يلزم تفعيل CRM وإضافة مفتاح HMAC سري قبل التشغيل.', 'Lead CRM and a server-only HMAC key are required before activation.')
      : copy('يلزم تطبيق الـ migration والتحقق منها في Preview قابلة للاسترجاع.', 'The migration must be applied and verified in a recoverable Preview environment.')

  if (authLoading || loading || readiness === null) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز صفحات التحويل" labelEn="Preparing conversion pages" />
  }

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page min-h-screen bg-[#F6F8FC] px-4 py-5 sm:px-6 lg:px-8">
        <LuxuryWorkspaceHeader
          pageTitle={copy('صفحات الهبوط والتحويل', 'Landing pages & conversion')}
          pageSubtitle={copy('حوّل الحملة إلى مسار قابل للقياس: عرض واضح، CTA، استقبال Lead، ودليل تحويل صريح.', 'Turn a campaign into a measurable journey: clear offer, CTA, lead intake, and explicit conversion evidence.')}
          primaryHref={null}
          secondaryHref="/leads/forms"
          secondaryLabel={copy('نماذج الاستقبال', 'Capture forms')}
        />

        {notice ? <div aria-live="polite" className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>{notice.text}</div> : null}

        {archiveTarget ? (
          <div role="dialog" aria-modal="true" aria-labelledby="archive-landing-title" className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <section className="w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Archive className="h-5 w-5" /></div>
              <h2 id="archive-landing-title" className="mt-4 text-xl font-black text-[#0B1028]">{copy('أرشفة صفحة الهبوط؟', 'Archive this landing page?')}</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{copy('سيتوقف الرابط العام ويصبح السجل للقراءة فقط. سيظل سجل القياس محفوظًا للمراجعة ولن تُحذف الزيارات أو النقرات أو النماذج المؤكدة.', 'Its public URL stops resolving and the record becomes read-only. Measurement history is retained; reported views, clicks, and confirmed forms are not deleted.')}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">{copy('الصفحة المحددة', 'Selected page')}</p><p className="mt-1 text-sm font-black text-slate-900">{archiveTarget.name}</p></div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" disabled={archivingId === archiveTarget.id} onClick={() => setArchiveTarget(null)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-50">{copy('إلغاء', 'Cancel')}</button>
                <button type="button" disabled={archivingId === archiveTarget.id} onClick={() => void archivePage(archiveTarget)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50">{archivingId === archiveTarget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}{archivingId === archiveTarget.id ? copy('جارٍ الأرشفة', 'Archiving') : copy('تأكيد الأرشفة', 'Confirm archive')}</button>
              </div>
            </section>
          </div>
        ) : null}

        {!readiness.ready ? (
          <section className="nx-os-card mx-auto max-w-3xl p-8 text-center"><ShieldCheck className="mx-auto h-11 w-11 text-[#5E63FF]" /><h2 className="mt-4 text-xl font-black text-[#0B1028]">{copy('التشغيل مغلق بأمان', 'Activation is safely gated')}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">{readinessText}</p><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-600">{copy('لا توجد صفحات عامة أو أرقام تحويل مُدّعاة قبل نجاح فحص قاعدة البيانات.', 'No public pages or claimed conversion numbers appear before database readiness passes.')}</div></section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [Globe2, summary.total, copy('إجمالي الصفحات', 'Total pages')],
                [UsersRound, summary.reportedViews, copy('زيارات مُبلّغ عنها', 'Reported views')],
                [MousePointerClick, summary.reportedClicks, copy('نقرات مُبلّغ عنها', 'Reported clicks')],
                [CheckCircle2, summary.confirmedSubmissions, copy('نماذج مؤكدة من السيرفر', 'Server-confirmed forms')],
              ].map(([Icon, value, label]) => {
                const MetricIcon = Icon as typeof Globe2
                return <article key={String(label)} className="nx-os-card p-4"><MetricIcon className="h-5 w-5 text-[#5E63FF]" /><p className="mt-3 text-2xl font-black text-[#0B1028]">{String(value)}</p><p className="mt-1 text-[11px] font-bold text-slate-500">{String(label)}</p></article>
              })}
            </section>

            <section className="nx-os-card mt-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-black text-[#0B1028]">{copy('مسار التحويل', 'Conversion journey')}</h2><p className="mt-1 text-xs leading-6 text-slate-500">Campaign → Landing Page → CTA/Form → Lead → Server-confirmed submission</p></div><button type="button" onClick={() => { setSelected(null); setEditor(EMPTY_EDITOR); setShowCreate(current => !current) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white"><Plus className="h-4 w-4" />{showCreate ? copy('إغلاق', 'Close') : copy('صفحة جديدة', 'New page')}</button></div>
            </section>

            {editorVisible ? (
              <section className="nx-os-card mt-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="text-base font-black text-[#0B1028]">{showCreate ? copy('إنشاء مسودة', 'Create draft') : copy(`تعديل النسخة ${selected?.version}`, `Edit version ${selected?.version}`)}</h2><p className="mt-1 text-[11px] font-bold text-slate-500">{copy('نصوص منظمة فقط؛ لا HTML ولا Scripts.', 'Structured text only; no HTML or scripts.')}</p></div><button type="button" aria-label={copy('إغلاق المحرر', 'Close editor')} onClick={() => { setShowCreate(false); setSelected(null) }} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><X className="h-4 w-4" /></button></div>
                <form onSubmit={showCreate ? createPage : savePage} className="grid gap-4 p-5 lg:grid-cols-2">
                  <label className="text-xs font-black text-slate-700">{copy('اسم داخلي', 'Internal name')}<input required maxLength={120} value={editor.name} onChange={event => setEditor(current => ({ ...current, name: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400" /></label>
                  <label className="text-xs font-black text-slate-700">{copy('الحملة', 'Campaign')}<select required disabled={Boolean(selected?.publishedVersion)} value={editor.campaignId} onChange={event => setEditor(current => ({ ...current, campaignId: event.target.value, captureFormId: '' }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"><option value="">{copy('اختر حملة', 'Select campaign')}</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>{selected?.publishedVersion ? <span className="mt-1.5 block text-[10px] font-bold text-slate-400">{copy('هوية الحملة تثبت بعد أول نشر.', 'Campaign identity is fixed after first publication.')}</span> : null}</label>
                  <label className="text-xs font-black text-slate-700 lg:col-span-2">{copy('العنوان الرئيسي', 'Headline')}<input required maxLength={180} value={editor.headline} onChange={event => setEditor(current => ({ ...current, headline: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-base font-black outline-none focus:border-indigo-400" /></label>
                  <label className="text-xs font-black text-slate-700 lg:col-span-2">{copy('العنوان الداعم', 'Subheadline')}<textarea maxLength={500} value={editor.subheadline} onChange={event => setEditor(current => ({ ...current, subheadline: event.target.value }))} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" /></label>
                  <label className="text-xs font-black text-slate-700 lg:col-span-2">{copy('شرح العرض', 'Offer body')}<textarea maxLength={2400} value={editor.body} onChange={event => setEditor(current => ({ ...current, body: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" /></label>
                  <label className="text-xs font-black text-slate-700">{copy('المزايا — سطر لكل ميزة', 'Benefits — one per line')}<textarea value={editor.benefitsText} onChange={event => setEditor(current => ({ ...current, benefitsText: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" placeholder={copy('حتى 6 مزايا', 'Up to 6 benefits')} /></label>
                  <label className="text-xs font-black text-slate-700">{copy('إثبات اختياري مقدم منك', 'Optional proof supplied by you')}<textarea maxLength={600} value={editor.proof} onChange={event => setEditor(current => ({ ...current, proof: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" placeholder={copy('لا تضف ادعاءً غير موثق', 'Do not add an unverified claim')} /></label>
                  <label className="text-xs font-black text-slate-700">CTA<input required maxLength={80} value={editor.primaryCtaLabel} onChange={event => setEditor(current => ({ ...current, primaryCtaLabel: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400" /></label>
                  <label className="text-xs font-black text-slate-700">{copy('اللغة', 'Language')}<select value={editor.locale} onChange={event => setEditor(current => ({ ...current, locale: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="AR">العربية</option><option value="EN">English</option><option value="BILINGUAL">Bilingual</option></select></label>
                  <label className="text-xs font-black text-slate-700">{copy('نموذج استقبال مرتبط', 'Linked capture form')}<select value={editor.captureFormId} onChange={event => setEditor(current => ({ ...current, captureFormId: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">{copy('بدون نموذج', 'No form')}</option>{matchingForms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-700">{copy('رابط HTTPS بديل', 'Fallback HTTPS URL')}<input inputMode="url" value={editor.primaryCtaUrl} onChange={event => setEditor(current => ({ ...current, primaryCtaUrl: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400" placeholder="https://example.com" /></label>
                  <label className="text-xs font-black text-slate-700">{copy('المظهر', 'Theme')}<select value={editor.theme} onChange={event => setEditor(current => ({ ...current, theme: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="MIDNIGHT">Midnight</option><option value="IVORY">Ivory</option><option value="VIOLET">Violet</option></select></label>
                  <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2">
                    <legend className="px-2 text-xs font-black text-slate-800">{copy('الظهور في محركات البحث', 'Search visibility')}</legend>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-slate-700">
                      <input type="checkbox" checked={editor.seoIndexable} onChange={event => setEditor(current => ({ ...current, seoIndexable: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                      <span>{copy('أطلب فهرسة النسخة بعد نشرها. هذا يضيف index ويدخلها في sitemap، لكنه لا يضمن ترتيبًا أو زيارات.', 'Request indexing after this revision is published. This adds index and includes it in the sitemap, but does not promise rankings or traffic.')}</span>
                    </label>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="text-xs font-black text-slate-700">{copy('عنوان نتيجة البحث', 'Search result title')}<input required={editor.seoIndexable} minLength={editor.seoIndexable ? 10 : undefined} maxLength={70} value={editor.seoTitle} onChange={event => setEditor(current => ({ ...current, seoTitle: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400" /><span className="mt-1 block text-[10px] font-bold text-slate-400">{editor.seoTitle.length}/70</span></label>
                      <label className="text-xs font-black text-slate-700">{copy('وصف نتيجة البحث', 'Search result description')}<textarea required={editor.seoIndexable} minLength={editor.seoIndexable ? 50 : undefined} maxLength={180} value={editor.seoDescription} onChange={event => setEditor(current => ({ ...current, seoDescription: event.target.value }))} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400" /><span className="mt-1 block text-[10px] font-bold text-slate-400">{editor.seoDescription.length}/180</span></label>
                    </div>
                    <p className="mt-3 text-[10px] font-bold leading-5 text-slate-500">{copy('تغييرات SEO تظل مسودة مثل النص؛ الصفحة العامة وCanonical وSitemap لا تتغير إلا بعد نشر هذه النسخة.', 'SEO edits remain draft-only like page copy; public metadata, canonical, and sitemap change only after publishing this revision.')}</p>
                  </fieldset>
                  <LandingPageQualityGate result={qualityResult} locale={ar ? 'ar' : 'en'} hasUnsavedChanges={editorDirty} />
                  {!showCreate ? <label className="text-xs font-black text-slate-700">{copy('ملاحظة النسخة', 'Revision note')}<input maxLength={300} value={editor.changeNote} onChange={event => setEditor(current => ({ ...current, changeNote: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400" /></label> : <div />}
                  <div className="flex flex-wrap gap-2 lg:col-span-2"><button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5E63FF] px-5 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePenLine className="h-4 w-4" />}{showCreate ? copy('إنشاء المسودة', 'Create draft') : copy('حفظ نسخة جديدة', 'Save new revision')}</button>{!showCreate && selected ? <button type="button" disabled={publishing || saving || publishBlocked} onClick={publishPage} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}{editorDirty ? copy('احفظ التعديلات قبل النشر', 'Save edits before publishing') : qualityResult.blockers > 0 ? copy('أكمل متطلبات النشر', 'Complete publish requirements') : copy('نشر النسخة المحفوظة', 'Publish saved revision')}</button> : null}</div>
                </form>
              </section>
            ) : null}

            {trackingPage ? (
              <form onSubmit={copyTrackedLink} className="nx-os-card mt-4 p-5" aria-labelledby="utm-builder-title">
                <div className="flex items-start justify-between gap-3"><div><h2 id="utm-builder-title" className="text-base font-black text-[#0B1028]">{copy('إنشاء رابط UTM قابل للإسناد', 'Build an attributable UTM link')}</h2><p className="mt-1 text-xs font-bold text-slate-500">{trackingPage.name} · {copy('لا يحتاج تصريح منصة', 'No platform permission required')}</p></div><button type="button" aria-label={copy('إغلاق منشئ الرابط', 'Close link builder')} onClick={() => setTrackingPage(null)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><X className="h-4 w-4" /></button></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="text-xs font-black text-slate-700">utm_source *<input required maxLength={100} value={tracking.source} onChange={event => setTracking(current => ({ ...current, source: event.target.value }))} placeholder="instagram / newsletter" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs" /></label>
                  <label className="text-xs font-black text-slate-700">utm_medium *<input required maxLength={100} value={tracking.medium} onChange={event => setTracking(current => ({ ...current, medium: event.target.value }))} placeholder="organic / email" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs" /></label>
                  <label className="text-xs font-black text-slate-700">utm_campaign *<input required maxLength={160} value={tracking.campaign} onChange={event => setTracking(current => ({ ...current, campaign: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs" /></label>
                  <label className="text-xs font-black text-slate-700">utm_content<input maxLength={160} value={tracking.content} onChange={event => setTracking(current => ({ ...current, content: event.target.value }))} placeholder="reel_hook_a" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs" /></label>
                  <label className="text-xs font-black text-slate-700">utm_term<input maxLength={160} value={tracking.term} onChange={event => setTracking(current => ({ ...current, term: event.target.value }))} placeholder="optional" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-xs" /></label>
                </div>
                <button type="submit" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#101A4D] px-4 text-xs font-black text-white"><Copy className="h-4 w-4" />{copy('نسخ رابط UTM', 'Copy UTM link')}</button>
              </form>
            ) : null}

            {experimentPage ? <LandingExperimentPanel pageId={experimentPage.id} pageName={experimentPage.name} onClose={() => setExperimentPage(null)} onPageChanged={load} /> : null}

            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              {pages.length === 0 ? <div className="nx-os-card p-10 text-center xl:col-span-2"><Globe2 className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-4 text-lg font-black text-[#0B1028]">{copy('لا توجد صفحات بعد', 'No landing pages yet')}</h2><p className="mt-2 text-sm text-slate-500">{copy('ابدأ بحملة ونموذج استقبال مرتبط بها.', 'Start with a campaign and a capture form linked to it.')}</p></div> : pages.map(page => (
                <article key={page.id} className="nx-os-card p-5">
                  <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-base font-black text-[#0B1028]">{page.name}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{page.campaign.name} · v{page.version}</p></div><span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${page.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : page.status === 'DRAFT' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{page.status}{page.hasUnpublishedChanges ? ' · DRAFT CHANGES' : ''}</span></div>
                  <p className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black ${page.status === 'PUBLISHED' && page.publishedSeoIndexable ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}><Search className="h-3 w-3" />{page.status === 'PUBLISHED' && page.publishedSeoIndexable ? copy('منشور وقابل للفهرسة', 'Published · indexable') : copy('غير مدرج للفهرسة', 'Not indexed')}</p>
                  <h3 className="mt-4 line-clamp-2 text-lg font-black leading-7 text-slate-900">{page.headline}</h3>
                  <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-indigo-50 p-3 text-center"><p className="text-lg font-black text-indigo-700">{page.evidence.reportedViews}</p><p className="text-[9px] font-black text-indigo-500">{copy('زيارات مُبلّغ عنها', 'Reported views')}</p></div><div className="rounded-xl bg-violet-50 p-3 text-center"><p className="text-lg font-black text-violet-700">{page.evidence.reportedClicks}</p><p className="text-[9px] font-black text-violet-500">{copy('نقرات مُبلّغ عنها', 'Reported clicks')}</p></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-lg font-black text-emerald-700">{page.evidence.confirmedSubmissions}</p><p className="text-[9px] font-black text-emerald-600">{copy('إرسال مؤكد', 'Confirmed forms')}</p></div></div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {page.status !== 'ARCHIVED' ? <>
                      <button type="button" onClick={() => editPage(page)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#101A4D] px-3 text-[11px] font-black text-white"><FilePenLine className="h-3.5 w-3.5" />{copy('تحرير', 'Edit')}</button>
                      {page.status === 'PUBLISHED' ? <>
                        <button type="button" onClick={() => { setExperimentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 px-3 text-[11px] font-black text-indigo-700"><FlaskConical className="h-3.5 w-3.5" />A/B</button>
                        <button type="button" onClick={() => openTrackingBuilder(page)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 px-3 text-[11px] font-black text-emerald-700"><Link2 className="h-3.5 w-3.5" />UTM</button>
                        <button type="button" onClick={() => copyPublicLink(page.publicPath)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-600"><Copy className="h-3.5 w-3.5" />{copy('نسخ الرابط', 'Copy link')}</button>
                        <Link href={page.publicPath} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-600"><ExternalLink className="h-3.5 w-3.5" />{copy('فتح', 'Open')}</Link>
                      </> : null}
                      <button type="button" disabled={archivingId === page.id} onClick={() => setArchiveTarget(page)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-[11px] font-black text-slate-600 disabled:opacity-50"><Archive className="h-3.5 w-3.5" />{archivingId === page.id ? copy('جارٍ الأرشفة', 'Archiving') : copy('أرشفة', 'Archive')}</button>
                    </> : <span className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-[11px] font-black text-slate-500"><Archive className="h-3.5 w-3.5" />{copy('الرابط العام متوقف · السجل محفوظ', 'Public access disabled · history retained')}</span>}
                  </div>
                </article>
              ))}
            </section>

            <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] font-bold text-slate-400"><ArrowUpLeft className="h-3.5 w-3.5" />{copy('الزيارات والنقرات إشارات متصفح؛ إرسال النموذج يؤكده السيرفر؛ WON وقيمة الصفقة يؤكدهما مسؤول داخل CRM.', 'Views and clicks are browser signals; form intake is server-confirmed; WON and outcome value are confirmed by a CRM operator.')}</p>
          </>
        )}
      </main>
    </AppShell>
  )
}
