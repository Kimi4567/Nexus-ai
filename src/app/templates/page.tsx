'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { Sparkles, ArrowLeft } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   TEMPLATES — قوالب الحملات الجاهزة
   ═══════════════════════════════════════════════════════════════ */

const TEMPLATES = [
  {
    id: 't1',
    icon: '⚡',
    name: 'إطلاق منتج',
    nameEn: 'Product Launch',
    desc: 'حملة إطلاق متكاملة مع هوكات، سكريبتات، وتقويم محتوى لـ 30 يوم',
    goal: 'SALES',
    platforms: ['Instagram', 'TikTok'],
    color: '#f59e0b',
    badge: null,
  },
  {
    id: 't2',
    icon: '🎯',
    name: 'توليد عملاء محتملين',
    nameEn: 'Lead Generation',
    desc: 'استقطب عملاء مؤهلين برسائل موجّهة وعبارات CTA قوية',
    goal: 'LEADS',
    platforms: ['Facebook', 'Instagram'],
    color: '#06b6d4',
    badge: null,
  },
  {
    id: 't3',
    icon: '📣',
    name: 'بناء الوعي بالعلامة',
    nameEn: 'Brand Awareness',
    desc: 'عزّز حضورك وابنِ هوية قوية عبر كل المنصات',
    goal: 'AWARENESS',
    platforms: ['Instagram', 'TikTok', 'Snapchat'],
    color: '#8b5cf6',
    badge: 'الأكثر استخداماً',
  },
  {
    id: 't4',
    icon: '❤️',
    name: 'تنمية المجتمع',
    nameEn: 'Community Growth',
    desc: 'تفاعل مع جمهورك وابنِ قاعدة متابعين وفيّة ومتفاعلة',
    goal: 'ENGAGEMENT',
    platforms: ['Instagram', 'Facebook'],
    color: '#ec4899',
    badge: null,
  },
  {
    id: 't5',
    icon: '🚦',
    name: 'زيادة الزيارات',
    nameEn: 'Traffic Driver',
    desc: 'قُد زيارات مستهدفة لموقعك وحوّل الزوار إلى عملاء',
    goal: 'TRAFFIC',
    platforms: ['Google', 'Facebook'],
    color: '#10b981',
    badge: null,
  },
  {
    id: 't6',
    icon: '🛍️',
    name: 'عرض محدود الوقت',
    nameEn: 'Flash Sale',
    desc: 'حملة إلحاحية عالية التأثير للعروض والخصومات الموقّتة',
    goal: 'SALES',
    platforms: ['Instagram', 'TikTok', 'Snapchat'],
    color: '#ef4444',
    badge: null,
  },
]

const GOAL_LABELS: Record<string, string> = {
  SALES: 'مبيعات',
  LEADS: 'عملاء محتملون',
  AWARENESS: 'وعي بالعلامة',
  ENGAGEMENT: 'تفاعل',
  TRAFFIC: 'زيارات',
}

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸',
  TikTok: '🎵',
  Facebook: '👥',
  Snapchat: '👻',
  Google: '🔍',
  YouTube: '▶️',
}

export default function TemplatesPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  const useTemplate = (template: typeof TEMPLATES[0]) => {
    const params = new URLSearchParams({
      goal: template.goal,
      platforms: template.platforms.join(','),
      template: template.nameEn,
    })
    router.push(`/campaigns/new?${params.toString()}`)
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-enter">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400/70 font-mono tracking-wider">NEXUS TEMPLATES</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">قوالب الحملات</h1>
          <p className="text-gray-400 text-sm">ابدأ من قالب مجرَّب — محدَّد بالهدف والمنصات والاستراتيجية مسبقاً.</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              className="relative rounded-2xl p-6 transition-all group hover:scale-[1.01]"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Badge */}
              {t.badge && (
                <div
                  className="absolute -top-3 right-5 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: t.color, color: '#000' }}
                >
                  {t.badge}
                </div>
              )}

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                style={{ background: `${t.color}15`, border: `1px solid ${t.color}25` }}
              >
                {t.icon}
              </div>

              {/* Content */}
              <h3
                className="font-bold text-lg mb-1 transition-colors"
                style={{ color: 'inherit' }}
              >
                {t.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">{t.desc}</p>

              {/* Goal + Platforms */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: `${t.color}12`, color: t.color, border: `1px solid ${t.color}20` }}
                >
                  {GOAL_LABELS[t.goal]}
                </span>
                {t.platforms.map(p => (
                  <span
                    key={p}
                    className="text-xs px-2 py-1 rounded-full text-gray-500"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {PLATFORM_ICONS[p] || '🌐'} {p}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => useTemplate(t)}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all text-white hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}bb)` }}
              >
                استخدم هذا القالب ←
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <Link
            href="/campaigns/new"
            className="text-sm text-gray-500 hover:text-white transition"
          >
            أو ابدأ من الصفر ←
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
