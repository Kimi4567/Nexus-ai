'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
export default function CTASection() {
  return (
    <section className="py-24 md:py-32 relative text-center">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6}} className="glass p-16 rounded-2xl relative overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-[spin_10s_linear_infinite] opacity-30 pointer-events-none" style={{background:'radial-gradient(circle,rgba(245,158,11,0.3) 0%,transparent 50%)'}}/>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">جهّز فريق الذكاء الاصطناعي الخاص بك</h2>
            <p className="text-[#94a3b8] text-lg mb-8 max-w-lg mx-auto">انضم إلى +500 شركة تستخدم NEXUS لتنمية أعمالها. ابدأ مجاناً اليوم.</p>
            <Link href="/auth/register" className="inline-block px-10 py-4 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold text-lg rounded-xl hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(245,158,11,0.4)] transition-all no-underline">ابدأ مجاناً — لا بطاقة مطلوبة</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
