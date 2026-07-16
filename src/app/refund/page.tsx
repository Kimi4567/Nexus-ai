'use client'

import { useI18n } from '@/lib/i18n-context'
import LegalDocumentPage from '@/components/legal/LegalDocumentPage'

const SECTIONS = [
  {
    titleAr: 'التجربة المجانية',
    titleEn: 'Free Trial',
    bodyAr: 'تتضمن التجربة 12 كريديت لمرة واحدة ولا تتطلب بطاقة ائتمان. راجع تكلفة كل إجراء داخل المنتج قبل التنفيذ.',
    bodyEn: 'The trial includes 15 one-time credits and requires no credit card. Review each action cost inside the product before running it.',
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
    bodyAr: `أرسل طلباً عبر البريد الإلكتروني: support@nexus-grow.com\n• الموضوع: "Refund Request — [بريدك الإلكتروني]"\n• نراجع الدفع الفعلي واستهلاك الحصة وحالة الحساب قبل القرار\n• إذا تمت الموافقة، يُصدر الاسترداد إلى وسيلة الدفع الأصلية عبر Stripe\n• يحدد Stripe والبنك زمن ظهور المبلغ وأي إشعار دفع متاح`,
    bodyEn: `Send a request to: support@nexus-grow.com\n• Subject: "Refund Request — [your email]"\n• We review the live payment, quota usage, and account standing before a decision\n• If approved, the refund is issued to the original payment method through Stripe\n• Stripe and the bank determine settlement timing and any available payment notification`,
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
    <LegalDocumentPage
      badge="Refund Policy"
      title={lgT?.refundTitle as string}
      subtitle={lgT?.refundSubtitle as string}
      lastUpdated={(lgT?.lastUpdated as string)?.replace('{year}', String(year))}
      sections={SECTIONS}
      isAr={isAr}
      isRTL={isRTL}
    />
  )
}
