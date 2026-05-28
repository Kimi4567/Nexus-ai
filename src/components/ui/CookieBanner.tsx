'use client'

import { useState, useEffect } from 'react'
import { Cookie, X, Check } from 'lucide-react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('nexus_cookie_consent')
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])

  const acceptAll = () => {
    localStorage.setItem('nexus_cookie_consent', JSON.stringify({
      essential: true,
      functional: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    }))
    setVisible(false)
  }

  const acceptEssential = () => {
    localStorage.setItem('nexus_cookie_consent', JSON.stringify({
      essential: true,
      functional: false,
      analytics: false,
      timestamp: new Date().toISOString(),
    }))
    setVisible(false)
  }

  if (!mounted) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[90] px-4 py-4 md:px-6 cookie-banner"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="max-w-4xl mx-auto p-5 flex flex-col md:flex-row items-start md:items-center gap-4"
        style={{
          background: 'rgba(10,10,18,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Cookie className="w-4 h-4 text-amber" />
            </div>
            <span className="text-sm font-bold text-text-primary">نستخدم الكوكيز</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            نستخدم الكوكيز لتحسين تجربتك — الحفاظ على جلستك، تذكر تفضيلاتك، وتحليل الاستخدام المجهول.
            {' '}
            <Link href="/cookies" className="text-amber-500 hover:text-amber-400 underline">سياسة الكوكيز</Link>
            {' • '}
            <Link href="/privacy" className="text-amber-500 hover:text-amber-400 underline">سياسة الخصوصية</Link>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={acceptAll}
            className="px-4 py-2 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Check className="w-3.5 h-3.5" />
            أوافق على الكل
          </button>
          <button
            onClick={acceptEssential}
            className="px-4 py-2 rounded-xl text-xs font-medium text-text-muted border border-white/10 hover:border-white/20 transition-all"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            أساسية فقط
          </button>
          <button
            onClick={() => setVisible(false)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>
    </div>
  )
}
