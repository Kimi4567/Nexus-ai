'use client'

import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { useState } from 'react'
import {
  Film, Megaphone, BarChart2, Shield, Sparkles, Zap, TrendingUp,
  Target, ArrowLeft, ArrowRight, Check, Star, Play, Eye, MousePointer,
  DollarSign, Users, Activity, Bell, AlertTriangle, Calendar,
  ChevronRight, Globe, Heart, Share2, Bookmark
} from 'lucide-react'
import StarField from '@/components/ui/StarField'

/* ═══════════════════════════════════════════════════════════════
   DEMO PAGE — Full Platform Preview with Sample Data
   Shows how Nexus AI works with realistic fake data
   ═══════════════════════════════════════════════════════════════ */

// ── Sample data ────────────────────────────────────────────────
const DEMO_CAMPAIGN = {
  name: 'حملة توضيحية — مطعم افتراضي',
  platform: 'Meta + TikTok',
  goal: 'تحويل · Conversion',
  budget: '$1,200',
  duration: '30 يوم',
  status: 'نشطة',
}

const DEMO_METRICS = [
  { label: 'مشاهدات',    labelEn: 'Impressions',  value: '128,450', change: '+34%',  up: true,  color: '#8b5cf6' },
  { label: 'نقرات',      labelEn: 'Clicks',        value: '9,321',   change: '+22%',  up: true,  color: '#06b6d4' },
  { label: 'تحويلات',   labelEn: 'Conversions',   value: '412',     change: '+18%',  up: true,  color: '#10b981' },
  { label: 'تكلفة/نقرة', labelEn: 'CPC',           value: '$0.87',   change: '-12%',  up: true,  color: '#f59e0b' },
]

const DEMO_NEX_OUTPUT = `🎬 سكريبت رمضاني لـ TikTok (30 ثانية)

[المشهد 1 — 0-5 ثواني]
الكاميرا تصوّر مائدة إفطار عائلية دافئة
صوت الأذان يبدأ في الخلفية
نص: "هذا الرمضان... اجمع من تحب"

[المشهد 2 — 5-15 ثانية]
لقطات قريبة من الأطباق الشهية
بخار يتصاعد، ألوان دافئة
نص: "مطعم الأصالة — أكلات بيتية بلمسة مطعم"

[المشهد 3 — 15-25 ثانية]
لقطة عائلة تضحك وتأكل معاً
CTA يظهر على الشاشة
نص: "احجز طاولتك الآن"

[المشهد 4 — 25-30 ثانية]
شعار المطعم + رقم الحجز
"خصم 20% على كل طلبات رمضان"`

const DEMO_VEX_OUTPUT = `📢 إعلان Meta — فرضية إبداعية للاختبار

العنوان الرئيسي:
"إفطار رمضاني لا يُنسى — احجز الآن بخصم 20%"

النص التشويقي:
"هل تبحث عن مكان يجمع عائلتك هذا رمضان؟
مطعم الأصالة يقدم لك تجربة أكل بيتية أصيلة
بأجواء رمضانية دافئة وأسعار لا تُصدّق 🌙"

CTA: احجز الآن — Book Now

نسخ A/B للاختبار:
A: "طاولات محدودة — احجز قبل فوات الأوان"
B: "خصم 20% حصري لرمضان — لا تفوّت الفرصة"
C: "اجعل إفطارك مميزاً — العائلة تستحق الأفضل"`

const DEMO_PULSE_OUTPUT = `📊 تحليل PULSE — أداء حملة رمضان

✅ نقاط القوة:
• معدل التفاعل 7.2% (أعلى من متوسط القطاع 3.8%)
• TikTok يحقق 68% من التحويلات بـ 40% من الميزانية
• الجمهور 25-35 سنة يستجيب بشكل مميز للمحتوى العاطفي

⚠️ نقاط تحتاج تحسين:
• إعلانات Instagram Stories بنسبة تحويل 1.2% فقط
• الفترة 2-5 مساءً تُسجل أعلى تفاعل — زد الميزانية فيها

🎯 توصيات فورية:
1. ضاعف ميزانية TikTok من 30% إلى 50%
2. أضف CTA أوضح في Stories
3. اختبر فيديو 15 ثانية مقابل 30 ثانية`

const DEMO_SENTINEL_OUTPUT = `🛡️ تقرير Sentinel — محاكاة واجهة البحث

🔍 حالة الدليل:
• لا توجد مصادر منافسين متصلة في هذا العرض
• لا توجد بيانات إنفاق أو بحث أو حملات فعلية

⚡ ما يفعله المنتج الحقيقي:
• يعرض روابط المصادر الحديثة للمراجعة
• يحول الملاحظات إلى فرضيات، لا إلى حقائق تلقائية
• لا يحدّث Brand Brain قبل موافقة المستخدم

🚨 قاعدة التشغيل:
لا تغيير أو إلغاء أو نشر بناءً على بيانات محاكاة.`

const DEMO_ALERTS = [
  { type: 'opportunity' as const, title: 'إشارة تجريبية: راجع فرضية محتوى وراء الكواليس', time: 'مثال' },
  { type: 'warning'     as const, title: 'تنبيه تجريبي: راجع حد الميزانية قبل الإطلاق', time: 'مثال' },
  { type: 'info'        as const, title: 'PULSE: وقت النشر يحتاج بيانات منصة فعلية', time: 'مثال' },
]

// ── Components ─────────────────────────────────────────────────
function DemoOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full blur-[160px] opacity-15"
        style={{ width: 700, height: 700, background: 'radial-gradient(circle, rgba(245,158,11,0.12), transparent 70%)', top: '-10%', left: '-10%', animation: 'float 18s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-[100px] opacity-12"
        style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)', bottom: '0%', right: '-10%', animation: 'float 14s ease-in-out infinite reverse' }} />
      <div className="absolute rounded-full blur-[80px] opacity-10"
        style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)', top: '50%', left: '50%', animation: 'float 10s ease-in-out infinite' }} />
    </div>
  )
}

function DemoBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>
      <Play size={13} className="fill-current" />
      وضع العرض التجريبي · Demo Mode
    </div>
  )
}

function AgentOutputCard({ agent, color, icon: Icon, label, labelEn, content, active, onClick }: {
  agent: string; color: string; icon: React.ElementType; label: string; labelEn: string
  content: string; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="w-full text-right p-4 rounded-2xl transition-all"
      style={{
        background: active ? `rgba(${color === '#f59e0b' ? '245,158,11' : color === '#06b6d4' ? '6,182,212' : color === '#8b5cf6' ? '139,92,246' : '16,185,129'},0.08)` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: active ? `0 0 30px ${color}10` : 'none',
      }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={17} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{agent}</span>
            <span className="text-xs" style={{ color }}>{labelEn}</span>
          </div>
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        {active && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />}
      </div>
      {active && (
        <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed text-right font-sans"
          style={{ maxHeight: 280, overflowY: 'auto' }}>
          {content}
        </pre>
      )}
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function DemoPage() {
  const [activeAgent, setActiveAgent] = useState<'nex' | 'vex' | 'pulse' | 'sentinel'>('nex')

  const glassCard = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }

  const agentOutputs = { nex: DEMO_NEX_OUTPUT, vex: DEMO_VEX_OUTPUT, pulse: DEMO_PULSE_OUTPUT, sentinel: DEMO_SENTINEL_OUTPUT }

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#030309' }}>
        <StarField />
        <DemoOrbs />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-10">

          {/* ── Hero banner ─────────────────────────────────────── */}
          <div className="rounded-3xl p-8 text-center space-y-4"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(139,92,246,0.06), rgba(6,182,212,0.06))', border: '1px solid rgba(255,255,255,0.1)' }}>
            <DemoBadge />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              شاهد <span style={{ color: '#f59e0b' }}>Nexus AI</span> في العمل
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              هذه محاكاة واضحة لواجهة العمل مع حملة تسويقية كاملة.
              البيانات وهمية لغرض العرض فقط.
            </p>
            <p className="text-gray-500 text-sm">
              This is a demo with sample data · البيانات في هذه الصفحة للعرض فقط
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/auth/login"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0a0a', boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}>
                <Sparkles size={16} />
                ابدأ مجاناً · Start Free
              </Link>
              <Link href="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                لوحة التحكم الحقيقية
                <ArrowLeft size={16} />
              </Link>
            </div>
          </div>

          {/* ── Campaign overview ────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 rounded-full" style={{ background: '#f59e0b' }} />
              <h2 className="text-lg font-bold text-white">الحملة النموذجية · Sample Campaign</h2>
              <span className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                {DEMO_CAMPAIGN.status}
              </span>
            </div>
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{DEMO_CAMPAIGN.name}</h3>
                  <p className="text-gray-400 text-sm mt-1">{DEMO_CAMPAIGN.platform} · {DEMO_CAMPAIGN.goal} · {DEMO_CAMPAIGN.duration}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{DEMO_CAMPAIGN.budget}</p>
                    <p className="text-xs text-gray-500">الميزانية</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Live metrics ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-6 rounded-full" style={{ background: '#06b6d4' }} />
              <h2 className="text-lg font-bold text-white">الأداء · Performance</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                بيانات تجريبية · Simulated data
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-4">هذه الأرقام بيانات عرض توضيحي فقط وليست نتائج فعلية أو ضمانات أداء. · These numbers are illustrative demo data only and do not represent real results or performance guarantees.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DEMO_METRICS.map((m, i) => (
                <div key={i} className="rounded-xl p-4" style={glassCard}>
                  <p className="text-xs text-gray-500 mb-2">{m.label} · {m.labelEn}</p>
                  <p className="text-2xl font-bold text-white">{m.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp size={11} style={{ color: m.up ? '#10b981' : '#ef4444' }} />
                    <span className="text-xs" style={{ color: m.up ? '#10b981' : '#ef4444' }}>{m.change} من الأسبوع الماضي</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 4 Agent outputs ──────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 rounded-full" style={{ background: '#8b5cf6' }} />
              <h2 className="text-lg font-bold text-white">الوكلاء الذكيون · AI Agents at Work</h2>
            </div>
            <p className="text-gray-500 text-sm mb-5">انقر على كل وكيل لرؤية ما يولّده بشكل تلقائي · Click each agent to see its output</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AgentOutputCard
                agent="NEX" color="#f59e0b" icon={Film}
                label="مختبر المحتوى الإبداعي" labelEn="Creative Lab"
                content={DEMO_NEX_OUTPUT}
                active={activeAgent === 'nex'} onClick={() => setActiveAgent('nex')} />
              <AgentOutputCard
                agent="VEX" color="#06b6d4" icon={Megaphone}
                label="محرك الإعلانات الذكي" labelEn="Ads Engine"
                content={DEMO_VEX_OUTPUT}
                active={activeAgent === 'vex'} onClick={() => setActiveAgent('vex')} />
              <AgentOutputCard
                agent="PULSE" color="#8b5cf6" icon={BarChart2}
                label="التحليلات والرؤى" labelEn="Analytics"
                content={DEMO_PULSE_OUTPUT}
                active={activeAgent === 'pulse'} onClick={() => setActiveAgent('pulse')} />
              <AgentOutputCard
                agent="Sentinel" color="#10b981" icon={Shield}
                label="مراقبة السوق ٢٤/٧" labelEn="Market Monitor"
                content={DEMO_SENTINEL_OUTPUT}
                active={activeAgent === 'sentinel'} onClick={() => setActiveAgent('sentinel')} />
            </div>
          </div>

          {/* ── Alert feed ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 rounded-full" style={{ background: '#10b981' }} />
              <h2 className="text-lg font-bold text-white">تنبيهات ذكية · Smart Alerts</h2>
            </div>
            <div className="space-y-3">
              {DEMO_ALERTS.map((a, i) => {
                const colors = {
                  opportunity: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#10b981', icon: TrendingUp },
                  warning:     { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b', icon: AlertTriangle },
                  info:        { bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.25)',   text: '#06b6d4', icon: Bell },
                }
                const c = colors[a.type]
                return (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-xl"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${c.text}20` }}>
                      <c.icon size={15} style={{ color: c.text }} />
                    </div>
                    <p className="text-sm text-white flex-1">{a.title}</p>
                    <span className="text-xs text-gray-600 flex-shrink-0">{a.time}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Workflow steps ───────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 rounded-full" style={{ background: '#f59e0b' }} />
              <h2 className="text-lg font-bold text-white">كيف تعمل المنصة · How It Works</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: '01', color: '#f59e0b', icon: Globe,    title: 'ربط المنصات',     body: 'وصّل حسابات Meta وGoogle وTikTok وLinkedIn في دقيقتين' },
                { step: '02', color: '#06b6d4', icon: Sparkles, title: 'أنشئ حملة بالذكاء',body: 'NEX يكتب السكريبت، VEX يصمم الإعلان، كل شيء بنقرة واحدة' },
                { step: '03', color: '#8b5cf6', icon: Activity, title: 'راقب الأداء',      body: 'PULSE يحلل الأرقام ويقترح التحسينات بشكل مستمر' },
                { step: '04', color: '#10b981', icon: Shield,   title: 'ابقَ متقدماً',     body: 'Sentinel يرصد المنافسين ويُنبّهك بالفرص ٢٤/٧' },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl p-5 space-y-3" style={glassCard}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black" style={{ color: `${s.color}40` }}>{s.step}</span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                      <s.icon size={16} style={{ color: s.color }} />
                    </div>
                  </div>
                  <h3 className="text-white font-bold text-sm">{s.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ─────────────────────────────────────────────── */}
          <div className="rounded-3xl p-8 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(139,92,246,0.08))', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex justify-center mb-4">
              <div className="flex -space-x-2">
                {['#f59e0b', '#06b6d4', '#8b5cf6', '#10b981'].map((c, i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-gray-900 flex items-center justify-center"
                    style={{ background: `${c}25`, borderColor: '#030309', zIndex: 4 - i }}>
                    <Star size={14} style={{ color: c }} />
                  </div>
                ))}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              جاهز تبدأ بحملتك الحقيقية؟
            </h2>
            <p className="text-gray-400 mb-6">انضم وابدأ مجاناً — لا تحتاج بطاقة ائتمانية</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/auth/login"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0a0a', boxShadow: '0 0 40px rgba(245,158,11,0.4)' }}>
                <Sparkles size={18} />
                ابدأ مجاناً الآن
              </Link>
              <Link href="/dashboard"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
                الدخول للوحة التحكم
                <ArrowLeft size={15} />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
