"use client";

import { useState, useRef, useEffect, memo } from "react";
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
import { useI18n } from "@/lib/i18n-context";

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
  نكس: `نكس (NEX) هو منتج الفيديو بالذكاء الاصطناعي. يُنتج فيديوهات تسويقية كاملة من وصف نصي بسيط. ادخل على صفحة /studio لتجربته.`,
  nex: `NEX is the AI video producer. Creates full marketing videos from a simple text description. Go to /studio to try it.`,
  vex: `ڤكس (VEX) هو مدير الإعلانات الذكي. يُنشئ حملات إعلانية، يكتب نصوصاً إعلانية، ويدير ميزانياتك عبر جميع المنصات. ادخل على /vex.`,
  pulse: `پلس (PULSE) هو محلل البيانات. يعرض تحليلات متقدمة برسوم بيانية ويقدم توصيات مبنية على بيانات حقيقية. صفحة /analytics.`,
  sentinel: `سنتينل (Sentinel) هو الحارس الرقمي. يراقب أداء منافسيك ويُنبّهك من أي مشاكل قبل حدوثها. صفحة /sentinel.`,
  api: `لإضافة API Key، ادخل على إعدادات → API Keys. المنصة تدعم OpenAI و Grok. إذا لم يكن لديك مفتاح، ستعمل الميزات في وضع العرض التجريبي.`,
  سعر: `لدينا 3 خطط: Starter (مجاني — 5 فيديوهات/شهر)، Pro ($99 — غير محدود)، Enterprise ($249 — دعم 24/7). اضغط على "الأسعار" في الصفحة الرئيسية للتفاصيل.`,
  خطط: `لدينا 3 خطط: Starter (مجاني — 5 فيديوهات/شهر)، Pro ($99 — غير محدود)، Enterprise ($249 — دعم 24/7). اضغط على "الأسعار" في الصفحة الرئيسية للتفاصيل.`,
  "كيف ابدأ": `مرحباً! الخطوات: ١) أنشئ حساباً من /auth/register → ٢) اربط API Key من /settings → ٣) اختر الوكيل (NEX للفيديو، VEX للإعلانات) → ٤) ابدأ الإنشاء!`,
  فيديو: `لإنشاء فيديو، ادخل على صفحة الاستوديو /studio، اكتب وصف المنتج أو الخدمة، وانقر "توليد السكريبت". النظام سيولّد لك سكريبتاً كاملاً جاهزاً للتصوير.`,
  "إعلان حملة": `لإنشاء حملة إعلانية، انتقل إلى صفحة /campaigns/new واملأ الخطوات الخمس: الهدف، الجمهور، الميزانية، المحتوى، المراجعة. ڤكس سيولّد كل شيء.`,
  "نسيت كلمة السر": `انتقل إلى /auth/forgot-password وأدخل بريدك الإلكتروني. سيصلك رابط إعادة تعيين كلمة المرور خلال دقائق.`,
  "ما هو nexus": `نيكسوس AI هي منصة ذكاء اصطناعي متكاملة للتسويق. لديها 4 وكلاء (NEX, VEX, PULSE, Sentinel) يعملون معاً لإنتاج حملات تسويقية كاملة من الفكرة إلى التنفيذ.`,
  "دعم فني": `إذا كنت بحاجة إلى مساعدة مباشرة، أرسل بريداً إلكترونياً إلى support@nexus-grow.com أو استخدم الدردشة المباشرة هنا. فريقنا يُجيب في أقل من 24 ساعة.`,
  "تحليلات متقدمة": `صفحة التحليلات /analytics تحتوي على رسوم بيانية تفاعلية تعرض معدلات النقر، التحويل، والإيرادات. پلس كذلك يقدم توصيات ذكية بناءً على البيانات.`,
  "منافسين مراقبة": `سنتينل يراقب منافسيك على مدار الساعة. يتتبع تغييرات الأسعار، الحملات الجديدة، والمراجعات. إذا حدث تغيير مهم، ستصلك تنبيه فوري على /sentinel.`,
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
    return `مرحباً! أنا مساعد NEXUS AI 🤖\n\nاسألني عن أي شيء — كيف تُنشئ فيديو، حملة إعلانية، أو تحليلات. أو اختر سؤالاً سريعاً من الأسفل 👇`;
  if (path.includes("studio"))
    return `مرحباً في الاستوديو! 🎬\n\nهل تحتاج مساعدة في إنشاء سكريبت فيديو؟ اكتب لي وصف المنتج وسأساعدك.`;
  if (path.includes("vex") || path.includes("campaign"))
    return `مرحباً في مدير الإعلانات! 📢\n\nهل تحتاج مساعدة في حملة إعلانية أو كتابة نص إعلاني؟ اسألني.`;
  if (path.includes("analytics"))
    return `مرحباً في التحليلات! 📊\n\nهل تريد فهم أي رسم بياني أو تحتاج توصية؟ أنا تحت أمرك.`;
  if (path.includes("sentinel"))
    return `مرحباً في Sentinel! 🛡️\n\nهل تريد معرفة كيف تراقب منافسيك أو تفهم أي تنبيه؟ اسألني.`;
  if (path.includes("settings"))
    return `مرحباً في الإعدادات! ⚙️\n\nهل تحتاج مساعدة في مفاتيح API أو تفضيلات الحساب؟`;
  if (path.includes("login") || path.includes("register"))
    return `مرحباً! 🔐\n\nهل تحتاج مساعدة في تسجيل الدخول أو إنشاء حساب؟`;
  return `مرحباً! أنا مساعد NEXUS AI 🤖\n\nاسألني عن أي شيء — كيف تستخدم المنصة، الإعدادات، أو أي سؤال آخر.`;
}

/* ------------------------------------------------------------------ */
/*  Quick replies per page                                             */
/* ------------------------------------------------------------------ */

function getQuickReplies(path: string): string[] {
  if (path === "/" || path === "")
    return [
      "كيف أبدأ؟",
      "ما الفرق بين NEX و VEX؟",
      "كيف أضيف API Key؟",
      "ما هي الخطط والأسعار؟",
    ];
  if (path.includes("studio"))
    return ["كيف أُنشئ فيديو؟", "ما هي الصيغ المدعومة؟", "هل السكريبت طويل أم قصير؟"];
  if (path.includes("vex") || path.includes("campaign"))
    return [
      "كيف أُنشئ حملة؟",
      "ما هي أفضل ميزانية؟",
      "ما المنصات التي يدعمها VEX؟",
    ];
  if (path.includes("analytics"))
    return ["كيف أقرأ الرسوم البيانية؟", "ما هو معدل التحويل؟", "كيف تعمل التوصيات الذكية؟"];
  if (path.includes("sentinel"))
    return ["كيف أُضيف منافساً؟", "متى تصل التنبيهات؟", "ما البيانات التي تراقبها؟"];
  if (path.includes("settings"))
    return ["كيف أُضيف API؟", "كيف أُغيّر كلمة المرور؟", "كيف أتحكم في الإشعارات؟"];
  return ["كيف أبدأ؟", "ما هي الخطط؟", "أحتاج دعماً فنياً"];
}

/* ------------------------------------------------------------------ */
/*  Component — Performance Optimized (no framer-motion)               */
/* ------------------------------------------------------------------ */

export default memo(function ChatWidget() {
  const { t } = useI18n()
  const cwT = t('chatWidget')
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
      reply = `NEX = منتج الفيديو 🎬\nVEX = مدير الإعلانات 📢\nPULSE = تحليل البيانات 📊\nSentinel = مراقبة المنافسين 🛡️\n\nكل وكيل متخصص في مجاله وكلهم متكاملون معاً في منصة واحدة.`;
      replies = ["كيف أستخدم NEX؟", "كيف أستخدم VEX؟", "كيف تعمل التحليلات؟"];
    } else if (/مرحبا|أهلا|سلام|هاي/i.test(content)) {
      reply = `مرحباً بك! 👋 أنا مساعد NEXUS AI. جاهز لمساعدتك في أي شيء — فيديوهات، إعلانات، تحليلات، أو إعدادات. اسألني!`;
      replies = getQuickReplies(pathname || "");
    } else if (/شكر|تسلم|thx|thanks/i.test(content)) {
      reply = `العفو! 😊 إذا احتجت شيئاً آخر، أنا موجود. بالتوفيق!`;
    } else {
      reply = `لم أتأكد بعد من أفضل إجابة على "${content}". 🤔\n\nجرب أن تسأل بكلمات مختلفة مثل:\n• "كيف أُنشئ فيديو؟"\n• "كيف أُنشئ حملة إعلانية؟"\n• "كيف أُضيف API Key؟"\n• "ما هي خطط الأسعار؟"\n\nأو تواصل مع الدعم الفني على support@nexus-grow.com`;
      replies = ["كيف أبدأ؟", "الدعم الفني", "خطط الأسعار"];
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
              <p className="text-sm font-bold text-white truncate">{cwT?.title as string}</p>
              <p className="text-[11px] text-emerald-400">{cwT?.online as string}</p>
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
              placeholder={cwT?.placeholder as string}
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
});
