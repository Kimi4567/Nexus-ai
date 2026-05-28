'use client';
import { motion } from 'framer-motion';
const steps = [
  {num:'1',title:'صِف منتجك',desc:'أخبر NEX عن منتجك أو خدمتك. اكتب وصفاً بسيطاً أو أرسل رابط، والباقي علينا.'},
  {num:'2',title:'الوكلاء يعملون',desc:'NEX يُنتج الفيديو. VEX يُطلق الإعلان. PULSE يُحلّل النتائج. SENTINEL يُراقب المنافسة. كل هذا تلقائياً.'},
  {num:'3',title:'تابع النمو',desc:'احصل على تقارير يومية ذكية. شاهد مبيعاتك تنمو بينما أنت نائم.'},
];
export default function HowItWorksSection() {
  return (
    <section id="how" className="py-24 md:py-32 relative">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6}} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">كيف يعمل؟</h2>
          <p className="text-[#94a3b8] text-lg">3 خطوات بسيطة لبدء تسويقك بالذكاء الاصطناعي</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s,i) => (
            <motion.div key={s.num} initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:i*0.15}} className="glass p-10 rounded-2xl text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-violet-500 grid place-items-center text-lg font-black text-black mx-auto mb-6 shadow-[0_4px_20px_rgba(245,158,11,0.4)]">{s.num}</div>
              <h3 className="text-lg font-bold mb-3">{s.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
