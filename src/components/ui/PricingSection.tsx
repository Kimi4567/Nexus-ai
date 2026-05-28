'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
const plans = [
  {name:'بداية',price:'$99',desc:'للأعمال الصغيرة',featured:false,features:['5 فيديوهات شهرياً','حملة واحدة','تقارير أساسية','دعم بالبريد'],cta:'ابدأ الآن',href:'/auth/register?plan=starter'},
  {name:'احترافي',price:'$299',desc:'للأعمال النامية',featured:true,badge:'الأكثر شيوعاً',features:['20 فيديو شهرياً','5 حملات متزامنة','تقارير متقدمة + ذكاء','دعم أولوية 24/7','مراقبة المنافسة'],cta:'ابدأ الآن',href:'/auth/register?plan=pro'},
  {name:'وكالة',price:'$799',desc:'للوكالات والشركات',featured:false,features:['فيديوهات غير محدودة','حملات غير محدودة','وكلاء مخصصون','API كامل','مدير حساب شخصي'],cta:'تواصل معنا',href:'/contact'},
];
export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32 relative">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6}} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">الأسعار</h2>
          <p className="text-[#94a3b8] text-lg">اختر الخطة التي تناسبك. إلغاء فوري في أي وقت.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((p,i) => (
            <motion.div key={p.name} initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:i*0.1}} className={`glass p-10 rounded-2xl text-center transition-all duration-300 hover:-translate-y-1 relative ${p.featured?'border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.1)] md:scale-105':''}`}>
              {p.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-br from-amber-500 to-amber-700 text-black text-xs font-bold rounded-full">{p.badge}</div>}
              <h3 className="text-xl font-bold mb-2">{p.name}</h3>
              <div className="text-4xl font-black my-4"><span className={p.featured?'gradient-text':''}>{p.price}</span><span className="text-base text-[#94a3b8] font-normal mr-1">/شهر</span></div>
              <p className="text-[#94a3b8] text-sm mb-6">{p.desc}</p>
              <ul className="text-right list-none mb-8 space-y-3">{p.features.map(f=><li key={f} className="flex items-center gap-2 text-sm text-[#94a3b8]"><span className="text-green-400 font-bold">✓</span><span>{f}</span></li>)}</ul>
              <Link href={p.href} className={`block w-full py-3 rounded-xl font-bold text-sm transition-all no-underline ${p.featured?'bg-gradient-to-br from-amber-500 to-amber-700 text-black hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,158,11,0.3)]':'glass text-[#f8fafc] hover:border-cyan-500/50'}`}>{p.cta}</Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
