'use client';
import { motion } from 'framer-motion';
const agents = [
  {name:'NEX',role:'مُنتج الفيديوهات',desc:'يُنتج فيديوهات تسويقية احترافية باستخدام أحدث نماذج الذكاء الاصطناعي. يكتب السكريبت، يختار الصوت، ويُركّب المشاهد.',color:'#06b6d4',status:'جاهز للإنتاج'},
  {name:'VEX',role:'مُدير الإعلانات',desc:'يُدير حملاتك على فيسبوك، إنستغرام، وتيك توك. يُحسّن الميزانية، يختار الجمهور، ويُجري A/B testing تلقائياً.',color:'#f59e0b',status:'جاهز للإطلاق'},
  {name:'PULSE',role:'مُحلّل البيانات',desc:'يُحلّل أداء حملاتك في الوقت الفعلي. يكتشف الاتجاهات، يُنذرك بالمشاكل، ويُقدّم توصيات دقيقة.',color:'#10b981',status:'جاهز للتحليل'},
  {name:'SENTINEL',role:'مُراقب المنافسة',desc:'يمسح المنافسين والسوق عند توفر البيانات، ويُبرز التغيّرات المهمة لعلامتك.',color:'#f43f5e',status:'جاهز للمراقبة'},
];
export default function CrewSection() {
  return (
    <section id="crew" className="py-24 md:py-32 relative">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6}} className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">طاقم الذكاء الاصطناعي</h2>
          <p className="text-[#94a3b8] text-lg max-w-xl mx-auto">4 وكلاء متخصصون، كل منهم خبير في مجاله. يعملون معاً كفريق واحد لنمو علامتك التجارية.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {agents.map((a,i) => (
            <motion.div key={a.name} initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:i*0.1}} className="glass p-8 rounded-2xl text-center transition-all duration-300 hover:-translate-y-2 cursor-default"
              onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color+'44';e.currentTarget.style.boxShadow=`0 8px 32px ${a.color}22`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='';e.currentTarget.style.boxShadow='';}}>
              <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center text-2xl font-black" style={{background:`linear-gradient(135deg,${a.color}22,${a.color}44)`,border:`2.5px solid ${a.color}`,color:a.color}}>{a.name[0]}</div>
              <h3 className="text-xl font-bold mb-1" style={{color:a.color}}>{a.name}</h3>
              <div className="text-sm font-semibold mb-4" style={{color:a.color}}>{a.role}</div>
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-5">{a.desc}</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"/>{a.status}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
