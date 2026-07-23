'use client'

import { useState, useEffect } from 'react'
import { Cookie, X, Check } from 'lucide-react'
import Link from 'next/link'
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from '@/components/ConsentAwareTelemetry'
import { useI18n } from '@/lib/i18n-context'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const { isRTL } = useI18n()

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

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

  // Remove dismissed controls from the accessibility tree instead of leaving
  // an invisible, focusable banner mounted behind the page.
  if (!visible) return null

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="cookie-banner fixed inset-x-3 bottom-3 z-[90] sm:inset-x-4 sm:bottom-6 lg:inset-x-auto lg:start-[max(1.5rem,calc((100vw-1180px)/2+1.5rem))] lg:end-auto lg:w-[min(480px,calc(50vw-3rem))]"
    >
      <div
        className="mx-auto flex flex-col items-start gap-2 p-2.5 sm:gap-2.5 sm:p-4"
        style={{
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: '16px',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.12)',
        }}
      >
        <div className="flex w-full items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Cookie className="w-4 h-4 text-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <span id="cookie-consent-title" className="text-sm font-bold text-slate-950">
              {isRTL ? 'ملفات تعريف الارتباط' : 'Cookie preferences'}
            </span>
            <p className="mt-0.5 hidden text-[11px] leading-5 text-slate-500 sm:block">
            {isRTL
              ? 'التخزين الأساسي يحافظ على الجلسة؛ التحليلات الاختيارية لا تعمل دون موافقتك.'
              : 'Essential storage maintains your session; optional analytics stay off without consent.'}
            </p>
          </div>
          <Link href="/cookies" className="shrink-0 text-[10px] font-bold text-amber-700 underline sm:hidden">
            {isRTL ? 'التفاصيل' : 'Details'}
          </Link>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label={isRTL ? 'إغلاق إشعار ملفات تعريف الارتباط' : 'Close cookie preferences'}
            className="grid min-h-8 min-w-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-slate-100"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={acceptAll}
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:brightness-105"
            style={{ background: '#111827' }}
          >
            <Check className="w-3.5 h-3.5" />
            {isRTL ? 'أوافق على الكل' : 'Accept all'}
          </button>
          <button
            type="button"
            onClick={acceptEssential}
            className="min-h-9 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:border-slate-300"
            style={{ background: '#FFFFFF' }}
          >
            {isRTL ? 'أساسية فقط' : 'Essential only'}
          </button>
        </div>
        <details className="hidden w-full text-[10px] leading-5 text-slate-500 sm:block">
          <summary className="cursor-pointer select-none font-semibold text-slate-600">
            {isRTL ? 'السياسات والتفاصيل' : 'Policies and details'}
          </summary>
          <p className="pt-1">
            {isRTL
              ? '«أساسية فقط» تحفظ اختيارك وتُبقي تحليلات الاستخدام والأداء معطلة.'
              : '“Essential only” saves your choice and keeps usage and performance analytics disabled.'}
            {' '}
            <Link href="/cookies" className="text-amber-600 underline">
              {isRTL ? 'ملفات تعريف الارتباط' : 'Cookies'}
            </Link>
            {' • '}
            <Link href="/privacy" className="text-amber-600 underline">
              {isRTL ? 'الخصوصية' : 'Privacy'}
            </Link>
          </p>
        </details>
      </div>
    </div>
  )
}
