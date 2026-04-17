import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, generateSessionId } from "@/lib/utils";
import type { ChatResponse } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  is_fallback?: boolean;
}

interface AIChatProps {
  seatSection?: string;
}

/**
 * AI Chat component — light mode matching template design.
 * Typing indicator (P7), smart scroll (P14), quick-action chips.
 */
export function AIChat({ seatSection = "C" }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Hey! I'm your VenuePulse concierge. Ask me about food queues, exit timing, crowd levels, or anything about your stadium experience!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Where's the shortest food queue?",
    "How crowded is my section?",
    "When should I leave?",
  ]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(generateSessionId());
  const isAtBottom = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isAtBottom.current = atBottom;
    setShowScrollBtn(!atBottom && messages.length > 3);
  }, [messages.length]);

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          session_id: sessionId.current,
          seat_section: seatSection,
        }),
      });

      if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          { id: `err_${Date.now()}`, role: "assistant", content: "⏳ Too many messages! Please wait a moment before sending another." },
        ]);
        return;
      }

      const data: ChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        { id: `ai_${Date.now()}`, role: "assistant", content: data.response, is_fallback: data.is_fallback },
      ]);
      if (data.suggestions?.length) setSuggestions(data.suggestions);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-teal-500" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-teal-400 text-white rounded-br-md shadow-md shadow-teal-400/20"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator (P7) */}
        {loading && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-teal-500" />
            </div>
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin" />
              <span className="text-xs text-slate-400">Thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Scroll to bottom (P14) */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-36 right-4 w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center shadow-lg shadow-teal-400/20"
          aria-label="Scroll to new messages"
        >
          <ChevronDown className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Quick action chips */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors shadow-sm disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about food, exits, crowds..."
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            disabled={loading}
            aria-label="Chat message input"
            id="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-lg bg-teal-400 flex items-center justify-center disabled:opacity-30 hover:bg-teal-500 transition-colors shadow-sm"
            aria-label="Send message"
            id="chat-send-btn"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
