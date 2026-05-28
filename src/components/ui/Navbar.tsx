'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 50); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  const scrollTo = (id: string) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false); };
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-4 py-4 transition-all duration-300 ${scrolled ? 'bg-[rgba(2,2,4,0.8)] backdrop-blur-xl border-b border-white/[0.08]' : ''}`}>
      <div className="max-w-[1200px] mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="w-9 h-9 border-2 border-amber-500 rounded-lg grid place-items-center font-black text-amber-500 text-lg">N</div>
          <span className="text-2xl font-extrabold tracking-wider bg-gradient-to-br from-amber-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent">NEXUS AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {[{label:'الوكلاء',id:'crew'},{label:'كيف يعمل',id:'how'},{label:'الأسعار',id:'pricing'},{label:'الأسئلة',id:'faq'}].map(item => (
            <button key={item.id} onClick={()=>scrollTo(item.id)} className="text-[#94a3b8] hover:text-[#f8fafc] text-sm font-medium transition-colors relative group bg-transparent border-none cursor-pointer">{item.label}<span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-amber-500 transition-all duration-300 group-hover:w-full"/></button>
          ))}
          <Link href="/auth/login" className="px-5 py-2 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl text-sm hover:-translate-y-0.5 transition-transform no-underline">تسجيل الدخول</Link>
        </div>
        <button onClick={()=>setMenuOpen(!menuOpen)} className="md:hidden text-[#f8fafc] text-2xl bg-transparent border-none cursor-pointer">{menuOpen?'✕':'☰'}</button>
      </div>
      {menuOpen && (
        <div className="md:hidden fixed top-16 left-4 right-4 bg-[#0a0a12] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2 z-50">
          {[{label:'الوكلاء',id:'crew'},{label:'كيف يعمل',id:'how'},{label:'الأسعار',id:'pricing'},{label:'الأسئلة',id:'faq'}].map(item => (
            <button key={item.id} onClick={()=>scrollTo(item.id)} className="text-[#f8fafc] text-right py-3 px-4 rounded-lg hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer">{item.label}</button>
          ))}
        </div>
      )}
    </nav>
  );
}
