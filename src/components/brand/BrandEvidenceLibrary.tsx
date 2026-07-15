'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check, FileCheck2, FileText, Loader2, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { BRAND_EVIDENCE_MAX_DOCUMENTS, BRAND_EVIDENCE_WORKSPACE_MAX_BYTES } from '@/lib/brandEvidence'
import { fetchCreditOperation } from '@/lib/creditOperationClient'

interface EvidenceClaim {
  id: string
  claim: string
  category: string
  evidenceExcerpt: string
  sourceLocator: string | null
  confidence: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  truthStatus: 'PROPOSED' | 'CONFIRMED' | 'CONFLICTING' | 'OUTDATED'
  conflictClaimId: string | null
  conflictReason: string | null
  reviewedAt: string | null
}

interface EvidenceDocument {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  status: 'PENDING_UPLOAD' | 'UPLOADED' | 'ANALYZING' | 'NEEDS_REVIEW' | 'READY' | 'FAILED'
  errorMessage: string | null
  claims: EvidenceClaim[]
}

interface BrandEvidenceLibraryProps {
  locale: string
  authHeader: () => string
  onProofChanged: () => void
}

const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.json'
const MAX_BYTES = 6 * 1024 * 1024

function inferredMime(file: File): string {
  if (file.type) return file.type
  const extension = file.name.toLowerCase().split('.').pop()
  return ({
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
  } as Record<string, string>)[extension ?? ''] ?? ''
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => ({}))
  return typeof payload.error === 'string' ? payload.error : fallback
}

export function BrandEvidenceLibrary({ locale, authHeader, onProofChanged }: BrandEvidenceLibraryProps) {
  const ar = locale === 'ar'
  const inputId = useId()
  const [documents, setDocuments] = useState<EvidenceDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/brand/evidence', { headers: { Authorization: authHeader() } })
      if (!response.ok) throw new Error(await readError(response, 'Failed to load evidence'))
      const payload = await response.json()
      setDocuments(Array.isArray(payload.documents) ? payload.documents : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load evidence')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { void loadDocuments() }, [loadDocuments])

  const removeDocument = async (documentId: string, silent = false) => {
    if (!silent && !window.confirm(ar ? 'حذف هذا المصدر وكل الأدلة المرتبطة به؟' : 'Remove this source and all proof linked to it?')) return
    setBusyId(documentId)
    try {
      const response = await fetch(`/api/brand/evidence/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader() },
      })
      if (!response.ok) throw new Error(await readError(response, 'Failed to remove source'))
      await loadDocuments()
      onProofChanged()
    } catch (removeError) {
      if (!silent) setError(removeError instanceof Error ? removeError.message : 'Failed to remove source')
    } finally {
      setBusyId(null)
    }
  }

  const uploadFile = async (file: File) => {
    setError(null)
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setError(ar ? 'حجم الملف يجب أن يكون بين 1 بايت و6 ميجابايت.' : 'File size must be between 1 byte and 6 MB.')
      return
    }
    setUploading(true)
    let documentId: string | null = null
    try {
      const mimeType = inferredMime(file)
      const sessionResponse = await fetch('/api/brand/evidence/upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ fileName: file.name, mimeType, sizeBytes: file.size }),
      })
      if (!sessionResponse.ok) throw new Error(await readError(sessionResponse, 'Could not prepare secure upload'))
      const session = await sessionResponse.json()
      documentId = session.documentId

      const { error: uploadError } = await supabase.storage
        .from(session.bucket)
        .uploadToSignedUrl(session.path, session.token, file, { contentType: mimeType, upsert: false })
      if (uploadError) throw uploadError

      const finalizeResponse = await fetch(`/api/brand/evidence/${documentId}/finalize`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      if (!finalizeResponse.ok) throw new Error(await readError(finalizeResponse, 'Could not verify upload'))
      await loadDocuments()
    } catch (uploadError) {
      if (documentId) await removeDocument(documentId, true)
      setError(uploadError instanceof Error ? uploadError.message : 'Secure upload failed')
    } finally {
      setUploading(false)
    }
  }

  const analyze = async (documentId: string) => {
    setBusyId(documentId)
    setError(null)
    try {
      setDocuments(current => current.map(document => document.id === documentId ? { ...document, status: 'ANALYZING' } : document))
      const response = await fetchCreditOperation(`brand-evidence:analyze:${documentId}`, `/api/brand/evidence/${documentId}/analyze`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      if (!response.ok) throw new Error(await readError(response, 'Evidence analysis failed'))
      await loadDocuments()
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Evidence analysis failed')
      await loadDocuments()
    } finally {
      setBusyId(null)
    }
  }

  const review = async (claimId: string, action: 'approve' | 'approve_conflict' | 'reject' | 'mark_outdated') => {
    setBusyId(claimId)
    setError(null)
    try {
      const response = await fetch(`/api/brand/evidence/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) throw new Error(await readError(response, 'Could not review claim'))
      await loadDocuments()
      onProofChanged()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review claim')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 sm:p-5" aria-labelledby={`${inputId}-title`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 id={`${inputId}-title`} className="text-sm font-bold text-slate-900">
              {ar ? 'مكتبة أدلة البراند' : 'Brand Evidence Library'}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
              {ar
                ? 'ارفع مستندًا حقيقيًا. يستخرج NEXUS ادعاءات مرشحة فقط، وأنت تقرر ما يدخل ذاكرة البراند. الملفات خاصة ولا تحصل على رابط عام.'
                : 'Upload a real source document. NEXUS proposes claims; you decide what enters Brand Brain. Files stay private and never receive a public URL.'}
            </p>
          </div>
        </div>
        <label htmlFor={inputId} className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white transition ${uploading ? 'pointer-events-none bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? (ar ? 'جارٍ الرفع الآمن…' : 'Uploading securely…') : (ar ? 'رفع مصدر' : 'Upload source')}
          <input
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={uploading}
            onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void uploadFile(file)
            }}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">PDF · DOCX · PPTX · TXT · MD · CSV · JSON</span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{ar ? 'حتى 6 ميجابايت' : 'Up to 6 MB'}</span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
          {ar
            ? `${BRAND_EVIDENCE_MAX_DOCUMENTS} مصادر / ${BRAND_EVIDENCE_WORKSPACE_MAX_BYTES / (1024 * 1024)} ميجابايت للمساحة`
            : `${BRAND_EVIDENCE_MAX_DOCUMENTS} sources / ${BRAND_EVIDENCE_WORKSPACE_MAX_BYTES / (1024 * 1024)} MB per workspace`}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">{ar ? 'التحليل: 2 كريديت' : 'Analysis: 2 credits'}</span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{ar ? 'الرفع والمراجعة مجانًا' : 'Upload & review are free'}</span>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={15} className="animate-spin" />{ar ? 'جارٍ تحميل المصادر…' : 'Loading sources…'}</div>
      ) : documents.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-emerald-200 bg-white/70 p-4 text-center">
          <FileText className="mx-auto text-emerald-500" size={22} />
          <p className="mt-2 text-xs font-semibold text-slate-700">{ar ? 'لا توجد مصادر بعد' : 'No source documents yet'}</p>
          <p className="mt-1 text-[11px] text-slate-500">{ar ? 'ابدأ بملف تعريفي، شهادة، قائمة منتجات، أو نتائج موثقة.' : 'Start with a company profile, certificate, product sheet, or verified result.'}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {documents.map(document => {
            const pendingClaims = document.claims.filter(claim => claim.status === 'PENDING')
            const approvedCount = document.claims.filter(claim => claim.status === 'APPROVED').length
            const analyzing = document.status === 'ANALYZING' || busyId === document.id
            return (
              <article key={document.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FileCheck2 size={17} /></div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{document.originalName}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {fileSize(document.sizeBytes)} · {approvedCount} {ar ? 'دليل معتمد' : approvedCount === 1 ? 'approved proof' : 'approved proofs'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(document.status === 'UPLOADED' || document.status === 'FAILED') && (
                      <button type="button" onClick={() => void analyze(document.id)} disabled={analyzing}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                        {analyzing ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                        {ar ? 'تحليل مقابل 2 كريديت' : 'Analyze for 2 credits'}
                      </button>
                    )}
                    {document.status === 'ANALYZING' && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700"><Loader2 size={13} className="animate-spin" />{ar ? 'جارٍ التحقق…' : 'Verifying…'}</span>}
                    {document.status === 'READY' && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Check size={13} />{ar ? 'تمت المراجعة' : 'Reviewed'}</span>}
                    <button type="button" onClick={() => void removeDocument(document.id)} disabled={busyId === document.id}
                      aria-label={ar ? `حذف ${document.originalName}` : `Remove ${document.originalName}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {document.errorMessage && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{document.errorMessage}</p>}
                {pendingClaims.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{ar ? 'راجع قبل الإضافة إلى Brand Brain' : 'Review before adding to Brand Brain'}</p>
                    {pendingClaims.map(claim => (
                      <div key={claim.id} className={`rounded-lg border p-3 ${claim.truthStatus === 'CONFLICTING' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-semibold leading-5 text-slate-800">{claim.claim}</p>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[9px] font-bold text-slate-600">{claim.category}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${claim.truthStatus === 'CONFLICTING' ? 'bg-amber-200 text-amber-900' : 'bg-violet-100 text-violet-700'}`}>
                              {claim.truthStatus === 'CONFLICTING'
                                ? (ar ? 'متعارض' : 'Conflicting')
                                : (ar ? 'مقترح' : 'Proposed')}
                            </span>
                          </div>
                        </div>
                        <blockquote className="mt-2 border-s-2 border-emerald-300 ps-2 text-[11px] leading-5 text-slate-500">“{claim.evidenceExcerpt}”{claim.sourceLocator ? ` — ${claim.sourceLocator}` : ''}</blockquote>
                        {claim.truthStatus === 'CONFLICTING' && (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-900">
                            {ar
                              ? 'يوجد دليل رقمي مؤكد يقول عبارة شبه مطابقة برقم مختلف. راجع المصدرين قبل التأكيد؛ لن يستبدل NEXUS الحقيقة تلقائيًا.'
                              : 'Confirmed numeric evidence makes a near-identical statement with a different number. Review both sources; NEXUS will not replace truth automatically.'}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void review(claim.id, claim.truthStatus === 'CONFLICTING' ? 'approve_conflict' : 'approve')} disabled={busyId === claim.id}
                            className={`inline-flex min-h-8 items-center gap-1 rounded-lg px-3 text-[10px] font-bold text-white disabled:opacity-50 ${claim.truthStatus === 'CONFLICTING' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {busyId === claim.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {claim.truthStatus === 'CONFLICTING' ? (ar ? 'اعتماد الجديد ووَسم السابق كقديم' : 'Use new source; retire previous') : (ar ? 'اعتماد' : 'Approve')}
                          </button>
                          <button type="button" onClick={() => void review(claim.id, 'reject')} disabled={busyId === claim.id}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-red-200 hover:text-red-600 disabled:opacity-50">
                            <X size={12} />{ar ? 'رفض' : 'Reject'}
                          </button>
                          <button type="button" onClick={() => void review(claim.id, 'mark_outdated')} disabled={busyId === claim.id}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500 hover:border-amber-200 hover:text-amber-700 disabled:opacity-50">
                            {ar ? 'قديم' : 'Outdated'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
