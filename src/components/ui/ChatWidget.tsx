"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  ChevronRight,
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
/*  Knowledge Base (Arabic)                                            */
/* ------------------------------------------------------------------ */

const KNOWLEDGE: Record<string, string> = {
  نكس: `نكس (NEX) هو منتج الفيديو بالذكاء الاصطناعي. يقدر ينتج لك فيديوهات تسويقية كاملة من وصف نصي بسيط. ادخل على صفحة /studio عشان تجربه.`,
  vex: `ڤكس (VEX) هو مدير الإعلانات الذكي. ينشئ حملات إعلانية، يكتب نصوص إعلانية (Ad Copy)، ويدير ميزانياتك عبر كل المنصات. ادخل على /vex.`,
  pulse: `پلس (PULSE) هو محلل البيانات. يعرضك تحليلات متقدمة برسوم بيانية (Recharts) ويعطيك توصيات مبنية على بيانات حقيقية. صفحة /analytics.`,
  sentinel: `سنتينل (Sentinel) هو الحارس الرقمي. يراقب أداء منافسيك ويحذرك من أي مشاكل قبل ما تحصل. صفحة /sentinel.`,
  api: `عشان تضيف API Key، ادخل على إعدادات → API Keys. المنصة بتدعم OpenAI و Grok. لو ماعندك مفتاح، الميزات هتشتغل بـ Demo Mode.`,
  سعر: `عندنا 3 خطط: Starter (مجاني — 5 فيديوهات/شهر)، Pro ($49 — غير محدود)، Enterprise ($199 — دعم 24/7). اضغط على "الأسعار" في الصفحة الرئيسية للتفاصيل.`,
  خطط: `عندنا 3 خطط: Starter (مجاني — 5 فيديوهات/شهر)، Pro ($49 — غير محدود)، Enterprise ($199 — دعم 24/7). اضغط على "الأسعار" في الصفحة الرئيسية للتفاصيل.`,
  "كيف ابدأ": `أهلاً! الخطوات: ١) سجل حساب من /auth/register → ٢) اربط API Key من /settings → ٣) اختار الوكيل (NEX للفيديو، VEX للإعلانات) → ٤) ابدأ إنشاء!`,
  فيديو: `عشان تصنع فيديو، ادخل على صفحة الستوديو /studio، اكتب وصف المنتج أو الخدمة، وانقر "توليد السكريبت". النظام هيولّد لك سكريبت كامل جاهز للتصوير.`,
  "إعلان حملة": `عشان تنشئ حملة إعلانية، روح لصفحة /campaigns/new واملي الخطوات الخمس: الهدف، الجمهور، الميزانية، المحتوى، المراجعة. ڤكس هيولّد كل حاجة.`,
  "نسيت كلمة السر": `روح لـ /auth/forgot-password وادخل إيميلك. هيوصلك رابط إعادة تعيين كلمة السر في دقايق.`,
  "ما هو nexus": `نيكسوس AI هي منصة ذكاء اصطناعي متكاملة للتسويق. عندها 4 وكلاء (NEX, VEX, PULSE, Sentinel) بيشتغلوا مع بعض عشان ينتجوا حملات تسويقية كاملة من الفكرة للتنفيذ.`,
  "دعم فني": `لو محتاج مساعدة مباشرة، ابعت إيميل لـ support@nexus-grow.com أو استخدم الـ Live Chat هنا. فريقنا بيرد في أقل من 24 ساعة.`,
  "تحليلات متقدمة": `صفحة التحليلات /analytics فيها رسوم بيانية تفاعلية (LineChart, BarChart) تعرض معدلات النقر، التحويل، والإيرادات. پلس كمان بيقدم توصيات ذكية بناءً على البيانات.`,
  "منافسين مراقبة": `سنتينل بيراقب منافسيك 24/7. يتتبع تغييرات الأسعار، الحملات الجديدة، والمراجعات. لو حصل تغيير مهم، هيوصلك تنبيه فوري على /sentinel.`,
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
    return `أهلاً! أنا مساعد Nexus AI 🤖

سألني عن أي حاجة — إزاي تنشئ فيديو، حملة إعلانية، أو تحليلات. أو اختار سؤال سريع من تحت 👇`;
  if (path.includes("studio"))
    return `أهلاً في الستوديو! 🎬

عايز مساعدة في إنشاء سكريبت فيديو؟ اكتب لي وصف المنتج وأنا هساعدك.`;
  if (path.includes("vex") || path.includes("campaign"))
    return `أهلاً في مدير الإعلانات! 📢

محتاج مساعدة في حملة إعلانية أو كتابة Ad Copy؟ سألني.`;
  if (path.includes("analytics"))
    return `أهلاً في التحليلات! 📊

عايز تفهم أي رسم بياني أو تحتاج توصية؟ أنا تحت أمرك.`;
  if (path.includes("sentinel"))
    return `أهلاً في Sentinel! 🛡️

عايز تعرف إزاي تراقب منافسيك أو تفهم أي تنبيه؟ سألني.`;
  if (path.includes("settings"))
    return `أهلاً في الإعدادات! ⚙️

محتاج مساعدة في API Keys أو تفضيلات الحساب؟`;
  if (path.includes("login") || path.includes("register"))
    return `أهلاً! 🔐

محتاج مساعدة في تسجيل الدخول أو إنشاء حساب؟`;
  return `أهلاً! أنا مساعد Nexus AI 🤖

سألني عن أي حاجة — إزاي تستخدم المنصة، إعدادات، أو أي سؤال تاني.`;
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
/*  Component                                                          */
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
      reply = `NEX = منتج الفيديو 🎬
VEX = مدير الإعلانات 📢
PULSE = تحليل البيانات 📊
Sentinel = مراقبة المنافسين 🛡️

كل وكيل متخصص في مجاله وكلهم متكاملين مع بعض في منصة واحدة.`;
      replies = ["إزاي أستخدم NEX؟", "إزاي أستخدم VEX؟", "التحليلات إزاي بتشتغل؟"];
    } else if (/مرحبا|أهلا|سلام|هاي/i.test(content)) {
      reply = `أهلاً وسهلاً! 👋 أنا مساعد Nexus AI. جاهز أساعدك في أي حاجة — فيديوهات، إعلانات، تحليلات، أو إعدادات. سألني!`;
      replies = getQuickReplies(pathname || "");
    } else if (/شكر|تسلم|thx|thanks/i.test(content)) {
      reply = `العفو! 😊 لو احتجت حاجة تاني، أنا موجود. بالتوفيق!`;
    } else {
      reply = `لسه مش متأكد من الإجابة المثلى على "${content}". 🤔

جرب تسأل بكلمات مختلفة زي:
• "إزاي أعمل فيديو؟"
• "إزاي أنشئ حملة إعلانية؟"
• "إزاي أضيف API Key؟"
• "إيه خطط الأسعار؟"

أو تواصل مع الدعم الفني على support@nexus-grow.com`;
      replies = ["إزاي أبدأ؟", "الدعم الفني", "خطط الأسعار"];
    }

    setTyping(false);
    addBotMessage(reply, replies);
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {/* ── Floating button ─────────────────────────── */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          boxShadow: "0 8px 32px rgba(245,158,11,0.4)",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6 text-black" strokeWidth={2.5} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MessageCircle className="w-6 h-6 text-black" strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Chat panel ──────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed bottom-24 right-6 z-[100] w-[380px] max-w-[calc(100vw-3rem)] flex flex-col overflow-hidden"
            style={{
              height: 520,
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center gap-3 shrink-0"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
              >
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">مساعد Nexus AI</p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  متصل الآن
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div className="shrink-0 mt-0.5">
                    {msg.role === "assistant" ? (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.2)" }}
                      >
                        <Bot className="w-4 h-4 text-amber" />
                      </div>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.2)" }}
                      >
                        <User className="w-4 h-4 text-cyan" />
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="max-w-[85%]">
                    <div
                      className="px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap rounded-2xl"
                      style={{
                        background:
                          msg.role === "assistant"
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(245,158,11,0.1)",
                        color: msg.role === "assistant" ? "#e2e8f0" : "#f59e0b",
                        border:
                          msg.role === "assistant"
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "1px solid rgba(245,158,11,0.15)",
                        borderRadius:
                          msg.role === "assistant" ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Quick replies */}
                    {msg.quickReplies && msg.quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.quickReplies.map((qr) => (
                          <button
                            key={qr}
                            onClick={() => handleSend(qr)}
                            className="px-3 py-1.5 text-[11px] font-medium rounded-full transition-all hover:scale-[1.02] active:scale-95"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#94a3b8",
                            }}
                            onMouseEnter={(e) => {
                              (e.target as HTMLElement).style.background = "rgba(245,158,11,0.1)";
                              (e.target as HTMLElement).style.color = "#f59e0b";
                              (e.target as HTMLElement).style.borderColor = "rgba(245,158,11,0.2)";
                            }}
                            onMouseLeave={(e) => {
                              (e.target as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                              (e.target as HTMLElement).style.color = "#94a3b8";
                              (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                            }}
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {typing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2.5"
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.2)" }}
                  >
                    <Bot className="w-4 h-4 text-amber" />
                  </div>
                  <div
                    className="px-4 py-3 rounded-2xl flex items-center gap-1"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "18px 18px 18px 4px",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="px-4 py-3 flex items-center gap-2 shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="اكتب سؤالك هنا..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none py-2 px-1"
                dir="rtl"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSend()}
                disabled={!input.trim() || typing}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30"
                style={{
                  background: input.trim() && !typing ? "#f59e0b" : "rgba(255,255,255,0.05)",
                }}
              >
                {typing ? (
                  <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-black" />
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
