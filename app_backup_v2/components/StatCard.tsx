'use client'

import { type ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: ReactNode
}

export default function StatCard({ title, value, change, changeType = 'neutral', icon }: StatCardProps) {
  const changeColor =
    changeType === 'positive' ? 'text-emerald-400' : changeType === 'negative' ? 'text-red-400' : 'text-text-muted'

  return (
    <div className="glass p-5 flex items-start justify-between" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
      <div>
        <p className="text-text-muted text-sm mb-1">{title}</p>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        {change && <p className={`text-xs mt-1 ${changeColor}`}>{change}</p>}
      </div>
      <div className="p-2.5 rounded-xl bg-white/5 text-amber">
        {icon}
      </div>
    </div>
  )
}
