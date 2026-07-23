'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Gift, Copy, CheckCheck, Users, Sparkles } from 'lucide-react'

interface ReferralData {
  code: string
  referralUrl: string
  totalReferrals: number
  creditsEarned: number
  bonusPerReferral: number
}

export default function ReferralWidget() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch('/api/referral', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error('Referral request failed')
        return response.json()
      })
      .then(responseData => { if (responseData.code) setData(responseData) })
      .catch(fetchError => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return
        setError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [accessToken])

  const handleCopy = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <section className="nx-os-card mb-6 animate-pulse p-6" aria-label={ar ? 'تحميل برنامج الإحالة' : 'Loading referral program'}>
      <div className="mb-4 h-4 w-32 rounded bg-slate-100" />
      <div className="h-10 w-full rounded bg-slate-100" />
    </section>
  )

  if (!data) {
    if (!error) return null
    return (
      <section className="nx-os-card mb-6 border-amber-100 p-5 text-[12px] font-bold text-amber-800" role="status">
        {ar ? 'تعذر تحميل رابط الإحالة الآن. حدّث الصفحة وحاول مرة أخرى.' : 'The referral link could not be loaded. Refresh and try again.'}
      </section>
    )
  }

  return (
    <section className="nx-os-card mb-6 overflow-hidden p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
          <Gift className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <h2 className="text-sm font-black text-[#111b3f]">{ar ? 'ادعُ صديقًا واكسب كريديت' : 'Refer and earn credits'}</h2>
          <p className="text-xs text-[#64708f]">
            {ar ? 'تحصل أنت وصديقك بعد إكمال الإعداد على ' : 'After onboarding, you and your friend each receive '}
            <span className="font-bold text-violet-600">{data.bonusPerReferral} {ar ? 'كريديت' : 'credits'}</span>
          </p>
        </div>
      </div>

      {/* Referral link copy */}
      <div className="flex gap-2 mb-4">
        <div dir="ltr" className="min-w-0 flex-1 truncate rounded-lg border border-[#e3e8f3] bg-[#fbfcff] px-3 py-2 font-mono text-xs text-[#53617f]">
          {data.referralUrl}
        </div>
        <button
          onClick={handleCopy}
          aria-label={ar ? 'نسخ رابط الإحالة' : 'Copy referral link'}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-700"
        >
          {copied ? (
            <><CheckCheck className="h-3.5 w-3.5" /> {ar ? 'تم النسخ' : 'Copied'}</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> {ar ? 'نسخ الرابط' : 'Copy link'}</>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#e8edf7] bg-[#fbfcff] p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-[#8a96ad]" />
            <span className="text-xs text-[#64708f]">{ar ? 'أصدقاء أكملوا الإعداد' : 'Completed referrals'}</span>
          </div>
          <div className="text-xl font-black text-[#111b3f]">{data.totalReferrals}</div>
        </div>
        <div className="rounded-lg border border-[#e8edf7] bg-[#fbfcff] p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[#8a96ad]" />
            <span className="text-xs text-[#64708f]">{ar ? 'الكريديت المكتسب' : 'Credits earned'}</span>
          </div>
          <div className="text-xl font-black text-violet-600">{data.creditsEarned}</div>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-[#7b87a3]">
        {ar ? 'تُضاف المكافأة مرة واحدة بعد إنشاء الحساب وإكمال إعداد Brand Brain. لا يمكن استخدام رابطك لإحالة نفسك.' : 'The one-time reward is added after account creation and Brand Brain onboarding. Self-referrals are not allowed.'}
      </p>
    </section>
  )
}
