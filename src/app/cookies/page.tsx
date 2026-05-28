import Link from 'next/link'

export const metadata = { title: 'سياسة الكوكيز | NEXUS AI' }

export default function CookiePolicyPage() {
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
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>Cookie Policy</span>
          <span className="text-text-muted text-sm">آخر تحديث: {year}</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">سياسة الكوكيز</h1>
        <p className="text-text-muted mb-10">Cookie Policy — NEXUS AI Platform</p>

        <div className="space-y-8">
          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-emerald-400 mb-3">ما هي الكوكيز؟</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              الكوكيز هي ملفات نصية صغيرة تُخزن على جهازك عند زيارة موقع إلكتروني. تُستخدم للتعرف على متصفحك وتوفير تجربة أفضل. نستخدم أيضاً تقنيات مشابهة مثل local storage وsession storage.
              <br /><br />
              Cookies are small text files stored on your device when you visit a website. We also use similar technologies like local storage and session storage.
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-emerald-400 mb-3">أنواع الكوكيز التي نستخدمها</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-text-primary mb-1">1. كوكيز أساسية (Essential)</h3>
                <p className="text-sm text-text-secondary">ضرورية لتشغيل الموقع — تذكر جلستك، تتيح لك تسجيل الدخول، وتحافظ على أمان حسابك. لا يمكن تعطيلها.</p>
              </div>
              <div>
                <h3 className="font-bold text-text-primary mb-1">2. كوكيز وظيفية (Functional)</h3>
                <p className="text-sm text-text-secondary">تذكر تفضيلاتك (مثل اللغة، الوضع المظلم) وتحسين تجربتك الشخصية.</p>
              </div>
              <div>
                <h3 className="font-bold text-text-primary mb-1">3. كوكيز تحليلية (Analytics)</h3>
                <p className="text-sm text-text-secondary">Google Analytics (مجهولة الهوية) — تساعدنا في فهم كيفية استخدام الموقع لتحسينه.</p>
              </div>
            </div>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-emerald-400 mb-3">المدة</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              • كوكيز الجلسة: تُحذف عند إغلاق المتصفح
              • كوكيز التفضيلات: 1 سنة
              • كوكيز التحليلات: 13 شهر (Google Analytics)
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-emerald-400 mb-3">كيفية التحكم</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              يمكنك التحكم في الكوكيز عبر إعدادات متصفحك:
              • Chrome: Settings → Privacy and security → Cookies
              • Safari: Preferences → Privacy → Manage Website Data
              • Firefox: Options → Privacy & Security → Cookies
              <br /><br />
              تعطيل الكوكيز الأساسية قد يُعيق استخدام بعض ميزات المنصة.
            </p>
          </section>

          <section className="p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
            <h2 className="text-lg font-bold text-emerald-400 mb-3">التواصل</h2>
            <p className="text-sm text-text-secondary">
              للأسئلة: privacy@nexus-grow.com | Dubai, UAE
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 flex gap-6 text-sm text-text-muted" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" className="hover:text-text-primary transition">← الرئيسية</Link>
          <Link href="/privacy" className="hover:text-text-primary transition">سياسة الخصوصية</Link>
          <Link href="/terms" className="hover:text-text-primary transition">شروط الخدمة</Link>
        </div>
      </div>
    </div>
  )
}
