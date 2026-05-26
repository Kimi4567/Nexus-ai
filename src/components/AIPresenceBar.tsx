'use client'

/**
 * AIPresenceBar — slim operational intelligence strip above dashboard content.
 * Displays rule-based AI insights derived from real workspace data.
 * Rotates through insights automatically. Never shows fake metrics.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Insight {
  id: string
  type: 'action' | 'info' | 'warning' | 'success'
  icon: string
  message: string
  href?: string
}

const TYPE_STYLE: Record<string, string> = {
  action:  'text-accent border-accent/20 bg-accent/5',
  info:    'text-gray-400 border-[#222] bg-[#111]',
  warning: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  success: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
}

const DOT_STYLE: Record<string, string> = {
  action:  'bg-accent',
  info:    'bg-gray-500',
  warning: 'bg-amber-400',
  success: 'bg-emerald-400',
}

interface AIPresenceBarProps {
  authHeader: () => string
}

export default function AIPresenceBar({ authHeader }: AIPresenceBarProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const token = authHeader()
    if (!token) return
    fetch('/api/analytics/insights', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(d => {
        if (d.insights?.length) {
          setInsights(d.insights)
          setLoaded(true)
        }
      })
      .catch(() => {})
  }, [authHeader])

  // Rotate insights every 6 seconds
  useEffect(() => {
    if (insights.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex(i => (i + 1) % insights.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [insights.length])

  if (!loaded || insights.length === 0 || !visible) return null

  const current = insights[activeIndex]

  const content = (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors ${TYPE_STYLE[current.type]}`}>
      {/* Animated dot */}
      <span className="relative flex-shrink-0 w-1.5 h-1.5">
        <span className={`absolute inset-0 rounded-full ${DOT_STYLE[current.type]} animate-ping opacity-60`} />
        <span className={`relative rounded-full w-1.5 h-1.5 block ${DOT_STYLE[current.type]}`} />
      </span>

      {/* AI label */}
      <span className="text-[10px] uppercase tracking-widest opacity-50 font-semibold flex-shrink-0">Nexus AI</span>

      {/* Message — slides on change */}
      <span key={current.id} className="flex-1 truncate" style={{ animation: 'slideDown 0.2s ease both' }}>
        {current.icon} {current.message}
      </span>

      {/* Pagination dots */}
      {insights.length > 1 && (
        <div className="flex gap-1 flex-shrink-0">
          {insights.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.preventDefault(); setActiveIndex(i) }}
              className={`w-1 h-1 rounded-full transition-all ${i === activeIndex ? 'opacity-100 w-3' : 'opacity-30'} ${DOT_STYLE[current.type]}`}
            />
          ))}
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={() => setVisible(false)}
        className="flex-shrink-0 opacity-30 hover:opacity-70 transition ml-1 text-base leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )

  return (
    <div className="border-b border-[#1a1a1a] ai-pulse">
      {current.href ? (
        <Link href={current.href} className="block hover:opacity-90 transition-opacity">
          {content}
        </Link>
      ) : content}
    </div>
  )
}
