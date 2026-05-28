'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from './components/Navbar'
import NeuralCanvas from './components/NeuralCanvas'
import { ChevronDown, Play, Check, ArrowLeft } from 'lucide-react'

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const crew = [
    { name: 'NEX', role: 'منتج الفيديو', desc: 'ينتج فيديوهات تسويقية احترافية بالذكاء الاصطناعي', color: 'from-amber to-orange' },
    { name: 'VEX', role: 'مدير الإعلانات', desc: 'يُنشئ ويدير حملات إعلانية عبر كل المنصات', color: 'from-cyan to-blue' },
    { name: 'PULSE', role: 'المحلل', desc: 'يحلل البيانات ويقدم توصيات based on real insights', color: 'from-purple to-pink' },
    { name: 'SENTINEL', role: 'الحارس', desc: 'يراقب الأداء ويحذرك من المشاكل قبل ما تحصل', color: 'from-emerald to-teal' },
  ]

  const pricing = [
    { name: 'Starter', price: '0', features: ['5 فيديوهات/شهر', '3 حملات إعلانية', 'تحليلات أساسية', 'دعم عبر البريد'] },
    { name: 'Pro', price: '49', features: ['فيديوهات غير محدودة', 'حملات غير محدودة', 'تحليلات متقدمة', 'دعم أولوية', 'API access'] },
    { name: 'Enterprise', price: '199', features: ['كل مميزات Pro', 'وكلاء مخصصين', 'تحليلات real-time', 'دعم 24/7', 'On-premise option'] },
  ]

  const faqs = [
    { q: 'إزاي NEXUS AI بيختلف عن الأدوات التانية؟', a: 'عندنا 4 وكلاء ذكاء اصطناعي بيشتغلوا مع بعض: NEX للفيديو، VEX للإعلانات، PULSE للتحليلات، وSentinel للمراقبة. كلهم متكاملين في منصة واحدة.' },
    { q: 'هل أحتاج خبرة تقنية؟', a: 'لا خالص! المنصة مصممة للمسوقين والأفراد مش للمطورين. كل حاجة drag-and-drop أو بكتابة وصف بسيط.' },
    { q: 'إزاي باستخدم الـ API بتاعي؟', a: 'بعد التسجيل، ادخل على إعدادات > API Keys، واضف مفتاح OpenAI أو أي API تاني. الوكلاء هيبدأوا يستخدموه فوراً.' },
    { q: 'هل فيه فترة تجربة مجانية؟', a: 'آه! خطة Starter مجانية 100% وتكفيك لتجربة كل المميزات الأساسية.' },
  ]

  return (
    <div className="relative min-h-screen" style={{ background: '#020204' }}>
      <NeuralCanvas />
      <Navbar />

      {/* Hero */}
      <section className="relative z-10 pt-32 pb-20 section-padding">
        <div className="container-nexus text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 text-sm text-text-secondary">
            <span className="status-dot" />
            النظام شغال — 4 وكلاء جاهزين
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight">
            فريق ذكاء اصطناعي
            <br />
            <span className="gradient-text">يشتغل لك 24/7</span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10">
            NEXUS AI عبارة عن 4 وكلاء متخصصين: NEX ينتج الفيديوهات، VEX يدير الإعلانات، PULSE يحلل البيانات، وSentinel يراقب كل حاجة.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg">
              ابدأ مجاناً
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <button className="btn-secondary text-lg">
              <Play className="w-5 h-5" />
              شوف العرض التوضيحي
            </button>
          </div>
        </div>
      </section>

      {/* Orbit Section */}
      <section className="relative z-10 py-20 section-padding">
        <div className="container-nexus">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-2">الطاقم</p>
            <h2 className="text-3xl md:text-4xl font-bold">4 وكلاء. هدف واحد.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {crew.map((agent) => (
              <div key={agent.name} className="glass p-6 text-center group hover:scale-[1.02] transition-transform" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-black font-bold text-xl`}>
                  {agent.name[0]}
                </div>
                <h3 className="text-lg font-bold mb-1">{agent.name}</h3>
                <p className="text-amber text-sm mb-3">{agent.role}</p>
                <p className="text-text-secondary text-sm">{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-20 section-padding">
        <div className="container-nexus">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-2">الأسعار</p>
            <h2 className="text-3xl md:text-4xl font-bold">اختار خطتك</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricing.map((plan) => (
              <div key={plan.name} className={`glass p-6 ${plan.name === 'Pro' ? 'border-amber/30' : ''}`} style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: plan.name === 'Pro' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">${plan.price}</span>
                  <span className="text-text-muted">/شهر</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`block text-center py-3 rounded-xl font-bold transition-all ${plan.name === 'Pro' ? 'btn-primary' : 'btn-secondary'}`}>
                  ابدأ الآن
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 py-20 section-padding">
        <div className="container-nexus max-w-3xl">
          <div className="text-center mb-16">
            <p className="text-amber font-semibold mb-2">الأسئلة</p>
            <h2 className="text-3xl md:text-4xl font-bold">الأسئلة المتكررة</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="glass overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-right">
                  <span className="font-medium">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-text-muted transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <p className="px-5 pb-5 text-text-secondary text-sm">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 section-padding">
        <div className="container-nexus text-center">
          <div className="glass p-12 max-w-3xl mx-auto" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              جاهز ت<span className="gradient-text"> revolutionize</span> تسويقك؟
            </h2>
            <p className="text-text-secondary mb-8">
              انضم لآلاف المسوقين اللي بيستخدموا NEXUS AI عشان يوفروا وقت ويزودوا العائد.
            </p>
            <Link href="/register" className="btn-primary text-lg inline-flex">
              ابدأ مجاناً
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/10">
        <div className="container-nexus text-center">
          <p className="text-text-muted text-sm">
            © 2026 NEXUS AI. كل الحقوق محفوظة.
          </p>
        </div>
      </footer>
    </div>
  )
}
