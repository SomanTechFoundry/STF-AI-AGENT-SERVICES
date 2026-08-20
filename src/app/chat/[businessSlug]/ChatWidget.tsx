"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================
// Types
// ============================================================

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface Props {
  businessId: string;
  businessName: string;
  agentName: string;
  welcomeMessage: string;
  businessPhone: string | null;
  businessLocation: string | null;
}

// ============================================================
// Helpers
// ============================================================

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ============================================================
// Sub-components
// ============================================================

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function AgentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center select-none">
      {initials}
    </div>
  );
}

function MessageBubble({
  message,
  agentName,
}: {
  message: Message;
  agentName: string;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} items-end`}>
      {!isUser && <AgentAvatar name={agentName} />}

      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-violet-600 text-white rounded-br-sm"
              : message.isError
              ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-sm"
              : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[11px] text-gray-400 px-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Main ChatWidget
// ============================================================

export function ChatWidget({
  businessId,
  businessName,
  agentName,
  welcomeMessage,
  businessPhone,
  businessLocation,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "agent",
      content: welcomeMessage,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Append user message immediately
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          message: text,
          conversationId,
          channel: "WEBCHAT",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
      }

      // Save conversationId for continuity
      if (json.data?.conversationId) {
        setConversationId(json.data.conversationId);
      }

      const agentMsg: Message = {
        id: generateId(),
        role: "agent",
        content: json.data?.response ?? "I'm sorry, I didn't get a response. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Connection error. Please try again.";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "agent",
          content: errMsg,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      // Refocus input after response
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, businessId, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center">
          {agentName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {agentName}
          </h1>
          <p className="text-xs text-gray-500 truncate">{businessName}</p>
        </div>
        <div className="text-right hidden sm:block">
          {businessLocation && (
            <p className="text-xs text-gray-400">{businessLocation}</p>
          )}
          {businessPhone && (
            <a
              href={`tel:${businessPhone}`}
              className="text-xs text-violet-600 hover:underline font-medium"
            >
              {businessPhone}
            </a>
          )}
        </div>
        <StatusDot />
      </header>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        <div className="text-center py-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            Today
          </span>
        </div>

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} agentName={agentName} />
        ))}

        {isLoading && (
          <div className="flex gap-2 items-end">
            <AgentAvatar name={agentName} />
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Error banner ───────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center justify-between gap-2">
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Input bar ──────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-200 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none py-1 max-h-28 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            aria-label="Send message"
            className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-300 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ── Inline icons (no external dependency) ────────────────────────────────────

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4 translate-x-0.5"
    >
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  );
}

function StatusDot() {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      <span className="text-xs text-gray-400 hidden sm:inline">Online</span>
    </div>
  );
}
