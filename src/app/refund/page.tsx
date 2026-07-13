'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

const SECTIONS = [
  {
    titleAr: 'التجربة المجانية',
    titleEn: 'Free Trial',
    bodyAr: 'تتضمن التجربة 12 كريديت لمرة واحدة لمدة 14 يوماً ولا تتطلب بطاقة ائتمان. راجع تكلفة كل إجراء داخل المنتج قبل التنفيذ.',
    bodyEn: 'The trial includes 12 one-time credits for 14 days and requires no credit card. Review each action cost inside the product before running it.',
  },
  {
    titleAr: 'الاسترداد خلال 14 يوماً',
    titleEn: '14-Day Refund Window',
    bodyAr: `إذا اشتركت في خطة Growth أو Autopilot ولم تكن راضياً، يمكنك طلب استرداد كامل خلال 14 يوماً من تاريخ أول دفعة فعلية. معاملات Stripe Sandbox الاختبارية لا تخصم أموالاً حقيقية.\n\nشروط الاسترداد:\n• يجب أن يكون الطلب خلال 14 يوماً من أول فوترة فعلية\n• لا يتجاوز استخدامك 20% من حصتك الشهرية\n• يجب أن يكون الحساب في حالة جيدة (بدون انتهاكات)`,
    bodyEn: `If you subscribe to Growth or Autopilot and are not satisfied, you may request a full refund within 14 days of your first live payment. Stripe Sandbox transactions do not charge real money.\n\nConditions:\n• Request must be made within 14 days of the first live billing\n• Usage must not exceed 20% of your monthly quota\n• Account must be in good standing (no violations)`,
  },
  {
    titleAr: 'ما لا يُسترد',
    titleEn: 'Non-Refundable Cases',
    bodyAr: `لا يوجد استرداد في الحالات التالية:\n• بعد مرور 14 يوماً من الاشتراك\n• استخدام أكثر من 20% من الحصة الشهرية\n• الحسابات المُعلقة بسبب انتهاك شروط الاستخدام\n• الاشتراكات المُجددة تلقائياً (الشهر الثاني وما بعده)`,
    bodyEn: `No refunds in the following cases:\n• After 14 days from subscription date\n• Usage exceeding 20% of the monthly quota\n• Accounts suspended for ToS violations\n• Auto-renewed subscriptions (month 2 and beyond)`,
  },
  {
    titleAr: 'كيفية طلب الاسترداد',
    titleEn: 'How to Request a Refund',
    bodyAr: `أرسل طلباً عبر البريد الإلكتروني: support@nexus-grow.com\n• الموضوع: "Refund Request — [بريدك الإلكتروني]"\n• سيتم المعالجة خلال 5-7 أيام عمل\n• المبلغ يُعاد لنفس وسيلة الدفع الأصلية\n• ستصلك رسالة تأكيد عند اكتمال الاسترداد`,
    bodyEn: `Send a request to: support@nexus-grow.com\n• Subject: "Refund Request — [your email]"\n• Processing time: 5-7 business days\n• Refund issued to the original payment method\n• You will receive a confirmation email upon completion`,
  },
  {
    titleAr: 'الإلغاء بدون استرداد',
    titleEn: 'Cancellation Without Refund',
    bodyAr: 'يمكنك إلغاء اشتراكك في أي وقت عبر إعدادات الحساب. الإلغاء يسري في نهاية الفترة الحالية — تستطيع استخدام الخدمة حتى آخر يوم مدفوع.',
    bodyEn: 'You may cancel your subscription at any time via account settings. Cancellation takes effect at the end of the current billing period — you retain access until the last paid day.',
  },
]

export default function RefundPage() {
  const { t, locale, isRTL } = useI18n()
  const lgT = t('legal')
  const year = new Date().getFullYear()
  const isAr = locale === 'ar'

  return (
    <div className="min-h-screen" dir={isRTL ? 'rtl' : 'ltr'} style={{ background: '#020204' }}>
      <nav className="sticky top-0 z-40 px-6 py-4 flex justify-between items-center"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" className="text-2xl font-bold gradient-text">NEXUS AI</Link>
        <Link href="/auth/login" className="text-sm text-text-muted hover:text-text-primary transition">
          {lgT?.navLogin as string}
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
            Refund Policy
          </span>
          <span className="text-text-muted text-sm">
            {(lgT?.lastUpdated as string)?.replace('{year}', String(year))}
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-2">{lgT?.refundTitle as string}</h1>
        <p className="text-text-muted mb-10">{lgT?.refundSubtitle as string}</p>

        <div className="space-y-8">
          {SECTIONS.map((sec, i) => (
            <section key={i} className="p-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
              <h2 className="text-lg font-bold text-violet-400 mb-3">
                {isAr ? sec.titleAr : sec.titleEn}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {isAr ? sec.bodyAr : sec.bodyEn}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" className="hover:text-text-primary transition">{lgT?.backHome as string}</Link>
          <Link href="/terms" className="hover:text-text-primary transition">{lgT?.linkTerms as string}</Link>
          <Link href="/privacy" className="hover:text-text-primary transition">{lgT?.linkPrivacy as string}</Link>
        </div>
      </div>
    </div>
  )
}
