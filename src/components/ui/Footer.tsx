export default function Footer() {
  return (
    <footer className="border-t border-white/[0.08] py-12 text-center">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex justify-center gap-8 mb-6 flex-wrap">
          {['الخصوصية','الشروط','الدعم','تواصل معنا'].map(l=><a key={l} href="#" className="text-[#94a3b8] text-sm no-underline hover:text-amber-500 transition-colors">{l}</a>)}
        </div>
        <p className="text-[#64748b] text-sm">© 2026 NEXUS AI. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  );
}
