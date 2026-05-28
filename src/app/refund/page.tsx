import Link from 'next/link'

export const metadata = { title: 'سياسة الاسترداد | NEXUS AI' }

export default function RefundPage() {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen" style={{ background: '#020204' }}>
      <nav className="sticky top-0 z-40 px-6 py-4 flex justify-between items-center"
        style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" className="text-2xl font-bold gradient-text">NEXUS AI</Link>
        <Link href="/auth/login" className="text-sm text-text-muted hover:text-text-primary transition">تسجيل الدخول →</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>Refund Policy</span>
          <span className="text-text-muted text-sm">آخر تحديث: {year}</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">سياسة الاسترداد</h1>
        <p className="text-text-muted mb-10">Refund Policy — NEXUS AI Platform</p>

        <div className="space-y-8">
          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-violet-400 mb-3">فترة التجربة المجانية</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              خطة Starter مجانية 100% ومفتوحة للجميع. لا تحتاج بطاقة ائتمان. استخدمها لتجربة المنصة قبل أي التزام مالي.
              <br /><br />
              The Starter plan is 100% free. No credit card required. Use it to try the platform before any financial commitment.
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-violet-400 mb-3">الاسترداد خلال 14 يوماً</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              إذا اشتركت في خطة Pro أو Enterprise ولم تكن راضياً، يمكنك طلب استرداد كامل خلال 14 يوماً من تاريخ الاشتراك الأول. شروط الاسترداد:
              <br />• يجب أن يكون الطلب خلال 14 يوماً من أول فوترة
              <br />• لا يتجاوز استخدامك 20% من حصتك الشهرية (مثلاً: 1 فيديو من 5 للـ Starter)
              <br />• يجب أن يكون الحساب في حالة جيدة (بدون انتهاكات)
              <br /><br />
              If you subscribe to Pro or Enterprise and are not satisfied, you may request a full refund within 14 days of your first billing date. Conditions: within 14 days, usage under 20% of monthly quota, account in good standing.
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-violet-400 mb-3">ما لا يُسترد</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              لا يوجد استرداد في الحالات التالية:
              <br />• بعد مرور 14 يوماً من الاشتراك
              • استخدام أكثر من 20% من الحصة
              • الحسابات المُعلقة بسبب انتهاك شروط الاستخدام
              • الاشتراكات المُجددة تلقائياً (الشهر الثاني وما بعده)
              <br /><br />
              No refunds after 14 days, over 20% usage, suspended accounts, or auto-renewed subscriptions (month 2+).
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-violet-400 mb-3">كيفية طلب الاسترداد</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              أرسل طلباً عبر البريد الإلكتروني: support@nexus-grow.com
              <br />• الموضوع: "Refund Request — [بريدك الإلكتروني]"
              • سيتم المعالجة خلال 5-7 أيام عمل
              • المبلغ يُعاد لنفس وسيلة الدفع الأصلية
              • ستصلك رسالة تأكيد عند اكتمال الاسترداد
              <br /><br />
              Send request to: support@nexus-grow.com with subject "Refund Request — [your email]". Processing: 5-7 business days. Refund to original payment method.
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-violet-400 mb-3">الإلغاء بدون استرداد</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              يمكنك إلغاء اشتراكك في أي وقت عبر إعدادات الحساب. الإلغاء يسري في نهاية الفترة الحالية — تستطيع استخدام الخدمة حتى آخر يوم مدفوع.
              <br /><br />
              You may cancel anytime via account settings. Cancellation takes effect at the end of the current billing period — you keep access until the last paid day.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" className="hover:text-text-primary transition">← الرئيسية</Link>
          <Link href="/terms" className="hover:text-text-primary transition">شروط الخدمة</Link>
          <Link href="/privacy" className="hover:text-text-primary transition">سياسة الخصوصية</Link>
        </div>
      </div>
    </div>
  )
}
