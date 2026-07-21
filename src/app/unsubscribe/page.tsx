'use client'

import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function UnsubscribePage() {
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '')
  }, [])

  async function confirmPreference() {
    if (!token) {
      setError('This preference link is incomplete.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/lifecycle/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update your preference.')
      setDone(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not update your preference.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main dir="ltr" className="grid min-h-screen place-items-center bg-[#F6F8FC] px-4 py-10">
      <section className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-10">
        <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{done ? <CheckCircle2 className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}</div>
        <h1 className="mt-5 text-2xl font-black text-[#0B1028]">{done ? 'Preference recorded' : 'Communication preference'}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">{done ? 'This channel has been added to a durable suppression list. You do not need to do anything else.' : 'Confirm below to stop lifecycle marketing messages on the channel linked to this signed request.'}</p>
        {error ? <div role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        {!done ? <button type="button" onClick={() => void confirmPreference()} disabled={submitting || !token} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#101A4D] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Stop lifecycle marketing on this channel</button> : null}
        <p className="mt-5 text-xs leading-6 text-slate-400">This page never displays your email, phone number, workspace, or campaign data.</p>
      </section>
    </main>
  )
}
