'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
export default function HeroSection() {
  return (
    <section className="min-h-[100dvh] flex items-center pt-24 pb-16 relative">
      <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-2 gap-12 items-center w-full">
        <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{duration:0.8}} className="text-center md:text-right">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] text-amber-500 text-sm mb-6 bg-amber-500/5">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"/>
            المنصة #1 لتوليد فيديوهات بالذكاء الاصطناعي
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
            <span className="shimmer">4 وكلاء ذكاء اصطناعي يُديرون تسويقك بالكامل</span>
          </h1>
          <p className="text-[#94a3b8] text-lg mb-8 max-w-lg mx-auto md:mx-0">NEX يُنتج الفيديوهات. VEX يُدير الإعلانات. PULSE يُحلّل البيانات. SENTINEL يُراقب المنافسين. كل هذا وأنت نائم.</p>
          <div className="flex gap-4 justify-center md:justify-start flex-wrap">
            <Link href="/auth/register" className="px-8 py-3.5 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(245,158,11,0.4)] transition-all no-underline inline-flex items-center gap-2">ابدأ مجاناً</Link>
            <button onClick={()=>document.getElementById('how')?.scrollIntoView({behavior:'smooth'})} className="px-8 py-3.5 glass text-[#f8fafc] font-bold rounded-xl hover:border-cyan-500/50 transition-all bg-transparent cursor-pointer">شاهد كيف يعمل</button>
          </div>
          <div className="flex gap-8 justify-center md:justify-start mt-10 opacity-70 flex-wrap text-sm text-[#94a3b8]">
            <span>🔒 بيانات مشفرة</span><span>👥 +500 عميل</span><span>✓ إلغاء فوري</span>
          </div>
        </motion.div>
        <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} transition={{duration:1,delay:0.3}} className="flex justify-center items-center">
          <div className="relative w-72 h-72 md:w-80 md:h-80">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-72 md:h-72 border border-white/[0.08] rounded-full animate-[spin_20s_linear_infinite]">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]"/>
            </div>
            {[{c:'#06b6d4',l:'NEX',t:'0%',lft:'50%',d:'0s'},{c:'#f59e0b',l:'VEX',t:'50%',lft:'100%',d:'1.5s'},{c:'#10b981',l:'PULSE',t:'100%',lft:'50%',d:'3s'},{c:'#f43f5e',l:'SENT',t:'50%',lft:'0%',d:'4.5s'}].map(a => (
              <div key={a.l} className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 animate-[float_6s_ease-in-out_infinite]" style={{top:a.t,left:a.lft,animationDelay:a.d}}>
                <div className="w-full h-full rounded-xl flex items-center justify-center font-black text-lg shadow-lg" style={{background:`linear-gradient(135deg,${a.c}22,${a.c}44)`,border:`2px solid ${a.c}`,color:a.c}}>{a.l[0]}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
