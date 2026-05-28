"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
} from "lucide-react";
import { usePathname } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/*  Knowledge Base (Arabic + English)                                  */
/* ------------------------------------------------------------------ */

const KNOWLEDGE: Record<string, string> = {
  نكس: `نكس (NEX) هو منتج الفيديو بالذكاء الاصطناعي. يقدر ينتج لك فيديوهات تسويقية كاملة من وصف نصي بسيط. ادخل على صفحة /studio عشان تجربه.`,
  nex: `NEX is the AI video producer. Creates full marketing videos from a simple text description. Go to /studio to try it.`,
  vex: `ڤكس (VEX) هو مدير الإعلانات الذكي. ينشئ حملات إعلانية، يكتب نصوص إعلانية (Ad Copy)، ويدير ميزانياتك عبر كل المنصات. ادخل على /vex.`,
  pulse: `پلس (PULSE) هو محلل البيانات. يعرضك تحليلات متقدمة برسوم بيانية ويعطيك توصيات مبنية على بيانات حقيقية. صفحة /analytics.`,
  sentinel: `سنتينل (Sentinel) هو الحارس الرقمي. يراقب أداء منافسيك ويحذرك من أي مشاكل قبل ما تحصل. صفحة /sentinel.`,
  api: `عشان تضيف API Key، ادخل على إعدادات → API Keys. المنصة بتدعم OpenAI و Grok. لو ماعندك مفتاح، الميزات هتشتغل بـ Demo Mode.`,
  سعر: `عندنا 3 خطط: Starter (مجاني — 5 فيديوهات/شهر)، Pro ($99 — غير محدود)، Enterprise ($249 — دعم 24/7). اضغط على "الأسعار" في الصفحة الرئيسية للتفاصيل.`,
  خطط: `عندنا 3 خطط: Starter (مجاني — 5 فيديوهات/شهر)، Pro ($99 — غير محدود)، Enterprise ($249 — دعم 24/7). اضغط على "الأسعار" في الصفحة الرئيسية للتفاصيل.`,
  "كيف ابدأ": `أهلاً! الخطوات: ١) سجل حساب من /auth/register → ٢) اربط API Key من /settings → ٣) اختار الوكيل (NEX للفيديو، VEX للإعلانات) → ٤) ابدأ إنشاء!`,
  فيديو: `عشان تصنع فيديو، ادخل على صفحة الستوديو /studio، اكتب وصف المنتج أو الخدمة، وانقر "توليد السكريبت". النظام هيولّد لك سكريبت كامل جاهز للتصوير.`,
  "إعلان حملة": `عشان تنشئ حملة إعلانية، روح لصفحة /campaigns/new واملي الخطوات الخمس: الهدف، الجمهور، الميزانية، المحتوى، المراجعة. ڤكس هيولّد كل حاجة.`,
  "نسيت كلمة السر": `روح لـ /auth/forgot-password وادخل إيميلك. هيوصلك رابط إعادة تعيين كلمة السر في دقايق.`,
  "ما هو nexus": `نيكسوس AI هي منصة ذكاء اصطناعي متكاملة للتسويق. عندها 4 وكلاء (NEX, VEX, PULSE, Sentinel) بيشتغلوا مع بعض عشان ينتجوا حملات تسويقية كاملة من الفكرة للتنفيذ.`,
  "دعم فني": `لو محتاج مساعدة مباشرة، ابعت إيميل لـ support@nexus-grow.com أو استخدم الـ Live Chat هنا. فريقنا بيرد في أقل من 24 ساعة.`,
  "تحليلات متقدمة": `صفحة التحليلات /analytics فيها رسوم بيانية تفاعلية تعرض معدلات النقر، التحويل، والإيرادات. پلس كمان بيقدم توصيات ذكية بناءً على البيانات.`,
  "منافسين مراقبة": `سنتينل بيراقب منافسيك 24/7. يتتبع تغييرات الأسعار، الحملات الجديدة، والمراجعات. لو حصل تغيير مهم، هيوصلك تنبيه فوري على /sentinel.`,
  price: `We have 3 plans: Starter (Free — 5 videos/month), Pro ($99 — unlimited), Enterprise ($249 — 24/7 support). Click "Pricing" on the home page for details.`,
  plans: `We have 3 plans: Starter (Free — 5 videos/month), Pro ($99 — unlimited), Enterprise ($249 — 24/7 support). Click "Pricing" on the home page for details.`,
  "how start": `Welcome! Steps: 1) Sign up at /auth/register → 2) Connect API Key from /settings → 3) Choose your agent (NEX for video, VEX for ads) → 4) Start creating!`,
  video: `To create a video, go to /studio, write a product description, and click "Generate Script". The system will produce a full script ready for filming.`,
  campaign: `To create an ad campaign, go to /campaigns/new and fill the 5 steps: Goal, Audience, Budget, Content, Review. VEX will generate everything.`,
  "forgot password": `Go to /auth/forgot-password and enter your email. You'll receive a password reset link within minutes.`,
  "what is nexus": `NEXUS AI is an integrated AI marketing platform with 4 agents (NEX, VEX, PULSE, Sentinel) working together to produce complete marketing campaigns from idea to execution.`,
  support: `If you need direct help, email support@nexus-grow.com or use this Live Chat. Our team responds within 24 hours.`,
  analytics: `The /analytics page has interactive charts showing click rates, conversions, and revenue. PULSE also provides smart recommendations based on data.`,
  competitors: `Sentinel monitors your competitors 24/7. It tracks price changes, new campaigns, and reviews. When something important happens, you get an instant alert at /sentinel.`,
};

/* fuzzy keyword matcher */
function findAnswer(input: string): string | null {
  const normalized = input.toLowerCase().trim();
  for (const [keyword, answer] of Object.entries(KNOWLEDGE)) {
    if (normalized.includes(keyword.toLowerCase())) return answer;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Context-aware greeting                                             */
/* ------------------------------------------------------------------ */

function getPageGreeting(path: string): string {
  if (path === "/" || path === "")
    return `أهلاً! أنا مساعد Nexus AI 🤖\n\nسألني عن أي حاجة — إزاي تنشئ فيديو، حملة إعلانية، أو تحليلات. أو اختار سؤال سريع من تحت 👇`;
  if (path.includes("studio"))
    return `أهلاً في الستوديو! 🎬\n\nعايز مساعدة في إنشاء سكريبت فيديو؟ اكتب لي وصف المنتج وأنا هساعدك.`;
  if (path.includes("vex") || path.includes("campaign"))
    return `أهلاً في مدير الإعلانات! 📢\n\nمحتاج مساعدة في حملة إعلانية أو كتابة Ad Copy؟ سألني.`;
  if (path.includes("analytics"))
    return `أهلاً في التحليلات! 📊\n\nعايز تفهم أي رسم بياني أو تحتاج توصية؟ أنا تحت أمرك.`;
  if (path.includes("sentinel"))
    return `أهلاً في Sentinel! 🛡️\n\nعايز تعرف إزاي تراقب منافسيك أو تفهم أي تنبيه؟ سألني.`;
  if (path.includes("settings"))
    return `أهلاً في الإعدادات! ⚙️\n\nمحتاج مساعدة في API Keys أو تفضيلات الحساب؟`;
  if (path.includes("login") || path.includes("register"))
    return `أهلاً! 🔐\n\nمحتاج مساعدة في تسجيل الدخول أو إنشاء حساب؟`;
  return `أهلاً! أنا مساعد Nexus AI 🤖\n\nسألني عن أي حاجة — إزاي تستخدم المنصة، إعدادات، أو أي سؤال تاني.`;
}

/* ------------------------------------------------------------------ */
/*  Quick replies per page                                             */
/* ------------------------------------------------------------------ */

function getQuickReplies(path: string): string[] {
  if (path === "/" || path === "")
    return [
      "إزاي أبدأ؟",
      "إيه الفرق بين NEX و VEX؟",
      "إزاي أضيف API Key؟",
      "إيه الخطط والأسعار؟",
    ];
  if (path.includes("studio"))
    return ["إزاي أعمل فيديو؟", "إيه الصيغ المدعومة؟", "السكريبت طويل أو قصير؟"];
  if (path.includes("vex") || path.includes("campaign"))
    return [
      "إزاي أنشئ حملة؟",
      "إيه أفضل ميزانية؟",
      "ڤكس بيدعم إيه منصات؟",
    ];
  if (path.includes("analytics"))
    return ["إزاي أقرأ الرسوم؟", "إيه معدل التحويل؟", "التوصيات الذكية إزاي بتشتغل؟"];
  if (path.includes("sentinel"))
    return ["إزاي أضيف منافس؟", "التنبيهات بتيجي إمتى؟", "إيه بيانات بتراقبها؟"];
  if (path.includes("settings"))
    return ["إزاي أضيف API؟", "إزاي أغير الباسورد؟", "الإشعارات إزاي أتحكم فيها؟"];
  return ["إزاي أبدأ؟", "إيه الخطط؟", "محتاج دعم فني"];
}

/* ------------------------------------------------------------------ */
/*  Component — Performance Optimized (no framer-motion)               */
/* ------------------------------------------------------------------ */

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /* load history */
  useEffect(() => {
    const raw = localStorage.getItem("nexus_chat");
    if (raw) {
      try {
        setMessages(JSON.parse(raw));
        setHasGreeted(true);
      } catch {
        /* ignore corrupt */
      }
    }
  }, []);

  /* persist history */
  useEffect(() => {
    if (messages.length) localStorage.setItem("nexus_chat", JSON.stringify(messages));
  }, [messages]);

  /* greet on open */
  useEffect(() => {
    if (open && !hasGreeted && messages.length === 0) {
      setHasGreeted(true);
      const greeting = getPageGreeting(pathname || "");
      const replies = getQuickReplies(pathname || "");
      addBotMessage(greeting, replies);
    }
  }, [open]);

  /* scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function addBotMessage(content: string, quickReplies?: string[]) {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        role: "assistant",
        content,
        quickReplies,
        timestamp: Date.now(),
      },
    ]);
  }

  async function handleSend(text?: string) {
    const content = (text || input).trim();
    if (!content) return;

    if (!text) setInput("");

    setMessages((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), role: "user", content, timestamp: Date.now() },
    ]);

    setTyping(true);

    /* simulate network delay for realism */
    await new Promise((r) => setTimeout(r, 800));

    const direct = findAnswer(content);
    let reply: string;
    let replies: string[] | undefined;

    if (direct) {
      reply = direct;
    } else if (/فرق|مقارنة|nex.*vex|وكيل/i.test(content)) {
      reply = `NEX = منتج الفيديو 🎬\nVEX = مدير الإعلانات 📢\nPULSE = تحليل البيانات 📊\nSentinel = مراقبة المنافسين 🛡️\n\nكل وكيل متخصص في مجاله وكلهم متكاملين مع بعض في منصة واحدة.`;
      replies = ["إزاي أستخدم NEX؟", "إزاي أستخدم VEX؟", "التحليلات إزاي بتشتغل؟"];
    } else if (/مرحبا|أهلا|سلام|هاي/i.test(content)) {
      reply = `أهلاً وسهلاً! 👋 أنا مساعد Nexus AI. جاهز أساعدك في أي حاجة — فيديوهات، إعلانات، تحليلات، أو إعدادات. سألني!`;
      replies = getQuickReplies(pathname || "");
    } else if (/شكر|تسلم|thx|thanks/i.test(content)) {
      reply = `العفو! 😊 لو احتجت حاجة تاني، أنا موجود. بالتوفيق!`;
    } else {
      reply = `لسه مش متأكد من الإجابة المثلى على "${content}". 🤔\n\nجرب تسأل بكلمات مختلفة زي:\n• "إزاي أعمل فيديو؟"\n• "إزاي أنشئ حملة إعلانية؟"\n• "إزاي أضيف API Key؟"\n• "إيه خطط الأسعار؟"\n\nأو تواصل مع الدعم الفني على support@nexus-grow.com`;
      replies = ["إزاي أبدأ؟", "الدعم الفني", "خطط الأسعار"];
    }

    setTyping(false);
    addBotMessage(reply, replies);
  }

  return (
    <>
      {/* ── Floating button ─────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl chat-btn"
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          boxShadow: "0 8px 32px rgba(245,158,11,0.4)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.95)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        }}
      >
        {open ? (
          <X className="w-6 h-6 text-black" strokeWidth={2.5} />
        ) : (
          <MessageCircle className="w-6 h-6 text-black" strokeWidth={2.5} />
        )}
      </button>

      {/* ── Chat Panel ── Only render when open to save DOM */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[100] w-[360px] max-w-[92vw] flex flex-col overflow-hidden chat-panel"
          style={{
            height: "520px",
            maxHeight: "calc(100vh - 120px)",
            background: "rgba(10,10,12,0.97)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            animation: "chatSlideIn 0.25s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* Header */}
          <div
            className="shrink-0 px-5 py-4 flex items-center gap-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(245,158,11,0.12)" }}>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">مساعد NEXUS AI</p>
              <p className="text-[11px] text-emerald-400">● متصل الآن</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/5 transition"
            >
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center"
                  style={{ background: msg.role === "assistant" ? "rgba(245,158,11,0.12)" : "rgba(6,182,212,0.12)" }}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="w-4 h-4 text-amber-400" />
                  ) : (
                    <User className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div className="max-w-[85%]">
                  <div
                    className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={{
                      background: msg.role === "assistant"
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(245,158,11,0.08)",
                      color: msg.role === "assistant" ? "#e2e8f0" : "#f8fafc",
                      border: msg.role === "assistant"
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(245,158,11,0.15)",
                    }}
                  >
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-1" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>

                  {msg.quickReplies && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.quickReplies.map((qr) => (
                        <button
                          key={qr}
                          onClick={() => handleSend(qr)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5 transition"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#94a3b8",
                          }}
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full grid place-items-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                  <Bot className="w-4 h-4 text-amber-400" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="shrink-0 px-4 py-3 flex items-center gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="اكتب سؤالك هنا..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <button
              onClick={() => handleSend()}
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0 hover:brightness-110 transition"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Send className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes chatSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .chat-btn:active {
          transform: scale(0.95) !important;
        }
      `}</style>
    </>
  );
}
