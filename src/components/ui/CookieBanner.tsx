'use client'

import { useState, useEffect } from 'react'
import { Cookie, X, Check } from 'lucide-react'
import Link from 'next/link'
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from '@/components/ConsentAwareTelemetry'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (visible) setMounted(true)
  }, [visible])

  const acceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      functional: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    }))
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT))
    setVisible(false)
  }

  const acceptEssential = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      functional: true,
      analytics: false,
      timestamp: new Date().toISOString(),
    }))
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT))
    setVisible(false)
  }

  if (!mounted) return null

  return (
    <div
      className="cookie-banner fixed inset-x-3 bottom-3 z-[90] sm:inset-x-4 sm:bottom-4 md:start-6 md:end-auto md:w-[min(480px,calc(50vw-3rem))]"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="mx-auto flex flex-col items-start gap-3 p-4 sm:p-5"
        style={{
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: '16px',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.12)',
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Cookie className="w-4 h-4 text-amber" />
            </div>
            <span className="text-sm font-bold text-slate-950">ملفات تعريف الارتباط</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            نستخدم التخزين الأساسي للحفاظ على جلستك. لا تعمل تحليلات الاستخدام والأداء الاختيارية إلا إذا اخترت «أوافق على الكل».
            {' '}
            <Link href="/cookies" className="text-amber-500 hover:text-amber-400 underline">سياسة ملفات تعريف الارتباط</Link>
            {' • '}
            <Link href="/privacy" className="text-amber-500 hover:text-amber-400 underline">سياسة الخصوصية</Link>
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2">
          <button
            onClick={acceptAll}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-[1.01]"
            style={{ background: '#111827' }}
          >
            <Check className="w-3.5 h-3.5" />
            أوافق على الكل
          </button>
          <button
            onClick={acceptEssential}
            className="min-h-10 flex-1 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-all hover:border-slate-300"
            style={{ background: '#FFFFFF' }}
          >
            أساسية فقط
          </button>
          <button
            onClick={() => setVisible(false)}
            aria-label="إغلاق إشعار ملفات تعريف الارتباط"
            className="grid min-h-10 min-w-10 place-items-center rounded-lg transition-colors hover:bg-slate-100"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
