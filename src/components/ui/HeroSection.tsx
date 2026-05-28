'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function HeroSection() {
  return (
    <section className="min-h-[100dvh] flex items-center pt-24 pb-16 relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-2 gap-12 items-center w-full">
        {/* Left: Text */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center md:text-right order-2 md:order-1"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] text-amber-500 text-sm mb-6 bg-amber-500/5">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            المنصة #1 لتوليد فيديوهات بالذكاء الاصطناعي
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
            <span className="shimmer">
              4 وكلاء ذكاء اصطناعي يُديرون تسويقك بالكامل
            </span>
          </h1>

          <p className="text-[#94a3b8] text-lg mb-8 max-w-lg mx-auto md:mx-0 leading-relaxed">
            NEX يُنتج الفيديوهات. VEX يُدير الإعلانات. PULSE يُحلّل البيانات. SENTINEL يُراقب المنافسين. كل هذا وأنت نائم.
          </p>

          <div className="flex gap-4 justify-center md:justify-start flex-wrap">
            <Link
              href="/auth/register"
              className="px-8 py-3.5 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(245,158,11,0.4)] transition-all no-underline inline-flex items-center gap-2"
            >
              ابدأ مجاناً
            </Link>
            <button
              onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3.5 glass text-[#f8fafc] font-bold rounded-xl hover:border-cyan-500/50 transition-all bg-transparent cursor-pointer"
            >
              شاهد كيف يعمل
            </button>
          </div>

          <div className="flex gap-8 justify-center md:justify-start mt-10 opacity-70 flex-wrap text-sm text-[#94a3b8]">
            <span className="flex items-center gap-1"><span>🔒</span> بيانات مشفرة</span>
            <span className="flex items-center gap-1"><span>👥</span> +500 عميل</span>
            <span className="flex items-center gap-1"><span>✓</span> إلغاء فوري</span>
          </div>
        </motion.div>

        {/* Right: Orbit Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="flex justify-center items-center order-1 md:order-2"
        >
          <div className="relative w-72 h-72 md:w-96 md:h-96">
            {/* Outer orbit ring */}
            <div className="absolute inset-4 border border-white/[0.06] rounded-full animate-[spin_30s_linear_infinite]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-amber-500/50 rounded-full" />
            </div>

            {/* Inner orbit ring */}
            <div className="absolute inset-12 border border-white/[0.04] rounded-full animate-[spin_20s_linear_infinite_reverse]">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 bg-cyan-500/50 rounded-full" />
            </div>

            {/* Center N */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 border-2 border-amber-500/40 flex items-center justify-center z-10">
              <span className="text-3xl md:text-4xl font-black text-amber-400">N</span>
            </div>

            {/* Orbiting Agents */}
            {[
              { name: 'NEX', color: '#06b6d4', angle: 45 },
              { name: 'VEX', color: '#f59e0b', angle: 135 },
              { name: 'PULSE', color: '#10b981', angle: 225 },
              { name: 'SENT', color: '#f43f5e', angle: 315 },
            ].map((agent, i) => {
              const radius = 130; // distance from center
              const rad = (agent.angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;
              return (
                <motion.div
                  key={agent.name}
                  className="absolute top-1/2 left-1/2 z-20"
                  style={{ x, y }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                >
                  <div className="w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-xl flex items-center justify-center font-black text-sm shadow-lg animate-[float_4s_ease-in-out_infinite]"
                    style={{
                      background: `linear-gradient(135deg, ${agent.color}22, ${agent.color}44)`,
                      border: `2px solid ${agent.color}`,
                      color: agent.color,
                      animationDelay: `${i * 0.5}s`,
                    }}
                  >
                    {agent.name[0]}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
