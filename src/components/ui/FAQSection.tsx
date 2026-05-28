'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
const faqs = [
  {q:'هل أحتاج خبرة تقنية لاستخدام NEXUS؟',a:'لا على الإطلاق. NEXUS مُصمم للمسوقين وأصحاب الأعمال، لا للمُبرمجين. كل ما تحتاجه هو وصف منتجك، والوكلاء يقومون بالباقي.'},
  {q:'كم يستغرق إنتاج الفيديو الأول؟',a:'من 5 إلى 15 دقيقة فقط. NEX يكتب السكريبت، يولد الصور، يُركّب المشاهد، ويُضيف الصوت والموسيقى — كل هذا تلقائياً.'},
  {q:'هل يمكنني إلغاء الاشتراك في أي وقت؟',a:'نعم، إلغاء فوري بدون أسئلة. لا عقود طويلة الأجل ولا غرامات.'},
  {q:'هل الفيديوهات خاصة بي؟',a:'100% نعم. كل ما تُنتجه NEXUS هو ملكك الكامل. يمكنك استخدامه في الإعلانات، موقعك، أو أي منصة أخرى.'},
  {q:'ما هي المنصات المدعومة؟',a:'فيسبوك، إنستغرام، تيك توك، يوتيوب، جوجل، وسناب شات. VEX يدعم إنشاء وإدارة الحملات على كل هذه المنصات.'},
];
export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number|null>(null);
  return (
    <section id="faq" className="py-24 md:py-32 relative">
      <div className="max-w-[800px] mx-auto px-6">
        <motion.div initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6}} className="text-center mb-12"><h2 className="text-3xl md:text-4xl font-extrabold mb-4">الأسئلة الشائعة</h2></motion.div>
        <div className="space-y-4">
          {faqs.map((faq,i)=>(
            <motion.div key={i} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.4,delay:i*0.05}} className="glass rounded-xl overflow-hidden">
              <button onClick={()=>setOpenIndex(openIndex===i?null:i)} className="w-full flex items-center justify-between px-6 py-5 text-right bg-transparent border-none cursor-pointer text-[#f8fafc] hover:bg-cyan-500/5 transition-colors">
                <span className="font-semibold text-base">{faq.q}</span>
                <motion.span animate={{rotate:openIndex===i?180:0}} transition={{duration:0.3}} className="text-cyan-400 text-lg flex-shrink-0 mr-4">▼</motion.span>
              </button>
              <AnimatePresence>
                {openIndex===i && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.3}} className="overflow-hidden"><div className="px-6 pb-5 text-[#94a3b8] leading-relaxed">{faq.a}</div></motion.div>}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
