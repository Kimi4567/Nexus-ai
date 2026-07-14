"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Trash2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  streaming?: boolean;
}

type APIMessage = { role: "user" | "assistant"; content: string };

/* ------------------------------------------------------------------ */
/*  Context-aware greeting                                             */
/* ------------------------------------------------------------------ */

function getPageGreeting(path: string, isAr: boolean): string {
  if (isAr) {
    if (path.includes("campaign"))
      return "مرحباً! أنا مساعد Nexus الذكي 🎯\n\nاسألني عن حملاتك، أو كيف تحسّن استراتيجيتك، أو أي شيء عن المنصة.";
    if (path.includes("brand"))
      return "مرحباً! أنا هنا أساعدك تبني Brand Brain قوي 🧠\n\nاسألني كيف تملأ أي قسم أو ما أهمية كل بيانات.";
    if (path.includes("analytics"))
      return "مرحباً! أنا أساعدك تفهم بيانات أداء حملاتك 📊\n\nاسألني عن أي رقم أو مؤشر.";
    if (path.includes("billing"))
      return "مرحباً! اسألني عن الخطط أو كيف تستخدم كريديتس بأفضل طريقة 💳";
    if (path.includes("connections"))
      return "مرحباً! اسألني كيف تربط حساباتك على السوشيال ميديا بـ Nexus 🔗";
    if (path.includes("calendar"))
      return "مرحباً! اسألني كيف تخطط جدول نشر حملاتك 📅";
    if (path.includes("media"))
      return "مرحباً! اسألني عن إدارة وترتيب ميديا علامتك التجارية 🖼️";
    return "مرحباً! أنا مساعد Nexus الذكي 🤖\n\nاسألني أي شيء عن منصة Nexus أو حملاتك التسويقية.";
  } else {
    if (path.includes("campaign"))
      return "Hi! I'm your Nexus AI assistant 🎯\n\nAsk me about your campaigns, how to improve your strategy, or anything about the platform.";
    if (path.includes("brand"))
      return "Hi! I'm here to help you build a powerful Brand Brain 🧠\n\nAsk me how to fill any section or why each piece of data matters.";
    if (path.includes("analytics"))
      return "Hi! I can help you understand your campaign performance data 📊\n\nAsk me about any metric or number.";
    if (path.includes("billing"))
      return "Hi! Ask me about plans or how to get the most out of your AI credits 💳";
    if (path.includes("connections"))
      return "Hi! Ask me how to connect your social media accounts to Nexus 🔗";
    if (path.includes("calendar"))
      return "Hi! Ask me how to plan your campaign publishing schedule 📅";
    if (path.includes("media"))
      return "Hi! Ask me about managing your brand media assets 🖼️";
    return "Hi! I'm your Nexus AI assistant 🤖\n\nAsk me anything about Nexus or your marketing campaigns.";
  }
}

function getQuickReplies(path: string, isAr: boolean): string[] {
  if (isAr) {
    if (path.includes("campaign"))
      return ["كيف أحسّن استراتيجيتي؟", "كيف أقترح وقت النشر من بياناتي؟", "كيف أستخدم Brand Brain؟"];
    if (path.includes("brand"))
      return ["كيف أملأ Brand Brain؟", "ما أهمية Tone Keywords؟", "كيف تؤثر على الحملات؟"];
    if (path.includes("billing"))
      return ["ما الفرق بين الخطط؟", "كيف أوفّر في الكريديتس؟", "متى تتجدد الكريديتس؟"];
    return ["كيف أبدأ؟", "ما هي الكريديتس؟", "كيف أُنشئ حملة؟"];
  } else {
    if (path.includes("campaign"))
      return ["How do I improve my strategy?", "How is a posting time suggested from my data?", "How to use Brand Brain?"];
    if (path.includes("brand"))
      return ["How to fill Brand Brain?", "What are Tone Keywords?", "How does it affect campaigns?"];
    if (path.includes("billing"))
      return ["What's the difference between plans?", "How to save credits?", "When do credits reset?"];
    return ["How do I start?", "What are AI credits?", "How to create a campaign?"];
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default memo(function ChatWidget() {
  const { t, locale } = useI18n();
  const cwT = t("chatWidget");
  const { authHeader, user } = useAuth();
  const pathname = usePathname();
  const isAr = locale === "ar";

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatStorageKey = user?.id ? `nexus_chat_v3:${user.id}` : null;

  /* load history from localStorage */
  useEffect(() => {
    setMessages([]);
    setHasGreeted(false);
    if (!chatStorageKey) return;
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setHasGreeted(true);
        }
      }
    } catch { /* ignore */ }
  }, [chatStorageKey]);

  /* persist history — only save non-streaming messages */
  useEffect(() => {
    if (chatStorageKey && messages.length > 0) {
      const toSave = messages.filter((m) => !m.streaming).slice(-20); // keep last 20
      localStorage.setItem(chatStorageKey, JSON.stringify(toSave));
    }
  }, [chatStorageKey, messages]);

  useEffect(() => {
    const clearForWorkspaceReset = () => {
      setMessages([]);
      setHasGreeted(false);
    };
    window.addEventListener("nexus:workspace-reset", clearForWorkspaceReset);
    return () => window.removeEventListener("nexus:workspace-reset", clearForWorkspaceReset);
  }, []);

  /* greet on first open */
  useEffect(() => {
    if (open && !hasGreeted && messages.length === 0) {
      setHasGreeted(true);
      const greeting = getPageGreeting(pathname || "", isAr);
      const replies = getQuickReplies(pathname || "", isAr);
      addBotMessage(greeting, replies);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  function addBotMessage(content: string, quickReplies?: string[]) {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        role: "assistant",
        content,
        quickReplies,
        timestamp: Date.now(),
      } as ChatMessage & { quickReplies?: string[] },
    ]);
  }

  const handleClear = useCallback(() => {
    if (chatStorageKey) localStorage.removeItem(chatStorageKey);
    if (!open) {
      setMessages([]);
      setHasGreeted(false);
      return;
    }
    const greeting = getPageGreeting(pathname || "", isAr);
    const replies = getQuickReplies(pathname || "", isAr);
    setMessages([{
      id: Math.random().toString(36).slice(2),
      role: "assistant",
      content: greeting,
      quickReplies: replies,
      timestamp: Date.now(),
    } as ChatMessage & { quickReplies?: string[] }]);
    setHasGreeted(true);
  }, [chatStorageKey, isAr, open, pathname]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || isStreaming) return;
    if (!text) setInput("");

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Build message history for API (exclude streaming placeholder)
    const historyForAPI: APIMessage[] = messages
      .filter((m) => !m.streaming)
      .slice(-8) // last 8 messages for context
      .map((m) => ({ role: m.role, content: m.content }));
    historyForAPI.push({ role: "user", content });

    // Add streaming placeholder
    const streamId = Math.random().toString(36).slice(2);
    setMessages((prev) => [
      ...prev,
      { id: streamId, role: "assistant", content: "", timestamp: Date.now(), streaming: true },
    ]);

    const token = authHeader();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          messages: historyForAPI,
          page: pathname || "/",
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        const failureMessage = res.status === 402
          ? (isAr ? "رصيدك لا يكفي لهذه الرسالة. أضف كريديت من صفحة الفوترة." : "You do not have enough credits for this message. Add credits from Billing.")
          : (typeof errData.error === "string" && errData.error !== "Unknown error"
            ? errData.error
            : (isAr ? "عذراً، حدث خطأ. حاول مرة أخرى." : "Sorry, something went wrong. Please try again."));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId
              ? { ...m, content: failureMessage, streaming: false }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      // Stream reading
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId ? { ...m, content: accumulated } : m
          )
        );
      }

      // Finalize — remove streaming flag
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId ? { ...m, streaming: false } : m
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId
            ? { ...m, content: isAr ? "عذراً، انقطع الاتصال. حاول مرة أخرى." : "Connection lost. Please try again.", streaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, pathname, authHeader, isAr]);

  /* cleanup on unmount */
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const msgWithReplies = messages as Array<ChatMessage & { quickReplies?: string[] }>;

  return (
    <>
      {/* ── Floating button ─────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open
          ? (isAr ? 'إغلاق مساعد NEXUS' : 'Close NEXUS assistant')
          : (isAr ? 'فتح مساعد NEXUS' : 'Open NEXUS assistant')}
        aria-expanded={open}
        className="fixed bottom-6 end-6 z-[100] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl chat-btn"
        style={{
          background: "linear-gradient(135deg, #6366F1 0%, #5E5CE6 100%)",
          boxShadow: "0 8px 32px rgba(94,92,230,0.35)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
      >
        {open ? (
          <X className="w-6 h-6 text-white" strokeWidth={2.5} />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
        )}
      </button>

      {/* ── Chat Panel ── */}
      {open && (
        <div
          className="fixed bottom-24 end-6 z-[100] w-[360px] max-w-[92vw] flex flex-col overflow-hidden chat-panel"
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
              <p className="text-sm font-bold text-white truncate">
                {(cwT?.title as string) || "Nexus AI"}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <p className="text-[11px] text-emerald-400">
                  {(cwT?.online as string) || "Online"}
                </p>
              </div>
            </div>
            {messages.length > 1 && (
              <button
                onClick={handleClear}
                className="w-7 h-7 rounded-lg grid place-items-center hover:bg-white/5 transition opacity-50 hover:opacity-100"
                title={isAr ? "مسح المحادثة" : "Clear chat"}
              >
                <Trash2 className="w-3.5 h-3.5 text-white/50" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg grid place-items-center hover:bg-white/5 transition"
            >
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {msgWithReplies.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className="shrink-0 w-7 h-7 rounded-full grid place-items-center"
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
                    {msg.streaming && msg.content === "" ? (
                      <div className="flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      <>
                        {msg.content.split("\n").map((line, i) => (
                          <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>
                        ))}
                        {msg.streaming && (
                          <span className="inline-block w-0.5 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
                        )}
                      </>
                    )}
                  </div>

                  {msg.quickReplies && !msg.streaming && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {msg.quickReplies.map((qr) => (
                        <button
                          key={qr}
                          onClick={() => handleSend(qr)}
                          disabled={isStreaming}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5 transition disabled:opacity-40"
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

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="shrink-0 px-4 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={(cwT?.placeholder as string) || (isAr ? "اكتب سؤالك..." : "Ask anything...")}
                disabled={isStreaming}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  direction: isAr ? "rtl" : "ltr",
                }}
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={isStreaming || !input.trim()}
                aria-label={isAr ? 'إرسال الرسالة' : 'Send message'}
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 hover:brightness-110 transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 text-black animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-black" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-white/35">
              {isAr ? 'كل رسالة AI تكلف 1 كريديت؛ تُعاد عند فشل الخدمة.' : 'Each AI message costs 1 credit; failed requests are refunded.'}
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-btn:active { transform: scale(0.95) !important; }
      `}</style>
    </>
  );
});
