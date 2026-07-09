export default function Footer() {
  const links = [
    { label: 'الخصوصية', href: '/privacy' },
    { label: 'الشروط', href: '/terms' },
    { label: 'الدعم', href: 'mailto:support@nexus-grow.com' },
    { label: 'تواصل معنا', href: 'mailto:support@nexus-grow.com' },
  ]

  return (
    <footer className="border-t border-white/[0.08] py-12 text-center bg-[#020204]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex justify-center gap-8 mb-6 flex-wrap">
          {links.map(link => (
            <a key={link.label} href={link.href} className="text-[#94a3b8] text-sm no-underline hover:text-amber-500 transition-colors">
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-[#64748b] text-sm">© 2026 NEXUS AI. جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  );
}
