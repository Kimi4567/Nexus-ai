'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
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
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!session?.access_token) return
    fetch('/api/referral', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.code) setData(d) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session])

  const handleCopy = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 animate-pulse">
      <div className="h-4 w-32 bg-white/10 rounded mb-4" />
      <div className="h-10 w-full bg-white/10 rounded" />
    </div>
  )

  if (!data) return null

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Gift className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Refer & Earn Credits</h3>
          <p className="text-xs text-white/50">
            You + your friend both get <span className="text-violet-400 font-medium">{data.bonusPerReferral} free credits</span>
          </p>
        </div>
      </div>

      {/* Referral link copy */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 font-mono truncate">
          {data.referralUrl}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors whitespace-nowrap"
        >
          {copied ? (
            <><CheckCheck className="w-3.5 h-3.5" /> Copied!</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> Copy Link</>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/40">Friends Referred</span>
          </div>
          <div className="text-xl font-bold text-white">{data.totalReferrals}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/40">Credits Earned</span>
          </div>
          <div className="text-xl font-bold text-violet-400">{data.creditsEarned}</div>
        </div>
      </div>
    </div>
  )
}
