'use client'

import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PublicFormConfig {
  publicId: string
  title: string
  description?: string | null
  consentStatement?: string | null
}

const EMPTY_SUBMISSION = {
  fullName: '', email: '', phone: '', company: '', jobTitle: '', consentGranted: false, website: '',
}

export default function PublicLeadFormPage() {
  const params = useParams<{ publicId: string }>()
  const publicId = params.publicId
  const [config, setConfig] = useState<PublicFormConfig | null>(null)
  const [form, setForm] = useState(EMPTY_SUBMISSION)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/leads/intake/${encodeURIComponent(publicId)}`, {
          cache: 'no-store', signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'This form is unavailable.')
        setConfig(data.form)
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'This form is unavailable.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [publicId])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const searchParams = new URLSearchParams(window.location.search)
      const landingPagePublicId = searchParams.get('lp')
      const experimentToken = searchParams.get('exp')
      const response = await fetch(`/api/leads/intake/${encodeURIComponent(publicId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          landingPage: window.location.href,
          landingPagePublicId,
          experimentToken,
          referrer: document.referrer || null,
          attribution: {
            source: searchParams.get('utm_source'),
            medium: searchParams.get('utm_medium'),
            campaign: searchParams.get('utm_campaign'),
            content: searchParams.get('utm_content'),
            term: searchParams.get('utm_term'),
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Submission could not be accepted.')
      setSubmitted(true)
      setForm(EMPTY_SUBMISSION)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Submission could not be accepted.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#F6F8FC]"><Loader2 className="h-8 w-8 animate-spin text-[#5E63FF]" /></main>
  }

  return (
    <main dir="ltr" className="min-h-screen bg-[radial-gradient(circle_at_top,#EEF1FF_0%,#F7F8FC_45%,#FFFFFF_100%)] px-4 py-10 sm:py-16">
      <section className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_30px_80px_-40px_rgba(31,42,99,0.45)] sm:p-9">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#4C51CF]">
            <ShieldCheck className="h-4 w-4" /> Secure form · نموذج آمن
          </div>
          <span className="font-mono text-xs font-black tracking-[0.18em] text-[#101A4D]">NEXUS</span>
        </div>

        {error && !config ? (
          <div className="py-12 text-center" role="alert">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-black text-[#0B1028]">This form is unavailable</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">It may have been closed or the link may be incorrect. No information was submitted.</p>
            <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>
            <Link href="/" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-5 text-sm font-black text-white">
              <ArrowLeft className="h-4 w-4" /> Back to NEXUS
            </Link>
          </div>
        ) : submitted ? (
          <div className="py-12 text-center" aria-live="polite">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-5 text-2xl font-black text-[#0B1028]">Your request was received</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">تم استلام بياناتك. No message, subscription, or automated outreach was triggered.</p>
          </div>
        ) : config ? (
          <>
            <h1 className="mt-8 text-2xl font-black leading-tight text-[#0B1028] sm:text-3xl">{config.title}</h1>
            {config.description ? <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{config.description}</p> : null}
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm font-black text-slate-700">Full name / الاسم
                <input value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-medium outline-none focus:border-indigo-400" maxLength={140} autoComplete="name" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-black text-slate-700">Email / البريد
                  <input value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-medium outline-none focus:border-indigo-400" type="email" maxLength={254} autoComplete="email" />
                </label>
                <label className="block text-sm font-black text-slate-700">Phone / الهاتف
                  <input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-medium outline-none focus:border-indigo-400" maxLength={40} autoComplete="tel" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-black text-slate-700">Company / الشركة
                  <input value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-medium outline-none focus:border-indigo-400" maxLength={140} autoComplete="organization" />
                </label>
                <label className="block text-sm font-black text-slate-700">Job title / المسمى
                  <input value={form.jobTitle} onChange={event => setForm(current => ({ ...current, jobTitle: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 font-medium outline-none focus:border-indigo-400" maxLength={140} autoComplete="organization-title" />
                </label>
              </div>
              <label aria-hidden="true" className="sr-only">Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={event => setForm(current => ({ ...current, website: event.target.value }))} />
              </label>
              {config.consentStatement ? (
                <label className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm font-medium leading-6 text-slate-700">
                  <input required type="checkbox" checked={form.consentGranted} onChange={event => setForm(current => ({ ...current, consentGranted: event.target.checked }))} className="mt-1 h-4 w-4 accent-[#5E63FF]" />
                  <span>{config.consentStatement}</span>
                </label>
              ) : null}
              {error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
              <button disabled={submitting || (!form.email.trim() && !form.phone.trim())} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit / إرسال
              </button>
              <p className="text-center text-[11px] font-medium leading-5 text-slate-400">Submission records evidence only. It does not prove identity or trigger automated outreach.</p>
            </form>
          </>
        ) : null}
      </section>
    </main>
  )
}
