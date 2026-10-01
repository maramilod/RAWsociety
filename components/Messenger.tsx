"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

type Message = {
  id: number;
  fromMe: boolean;
  body: string;
  at: string;
};

type Conversation = {
  id: string;
  name: string;
  image: string | null;
  subtitle: string | null;
  unread: number;
  lastMessage: { body: string; fromMe: boolean; at: string } | null;
};

/** Open the messenger on a conversation from anywhere: openChat(conversationId) */
export function openChat(conversationId: string) {
  window.dispatchEvent(new CustomEvent("raw:open-chat", { detail: { conversationId } }));
}

const LIST_POLL_MS = 10000;
const THREAD_POLL_MS = 4000;

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ name, image, size }: { name: string; image: string | null; size: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${size} shrink-0 rounded-full bg-[#F7F4F0] text-[#C86C29] font-bold flex items-center justify-center`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Messenger() {
  const { status } = useSession();
  const authed = status === "authenticated";

  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const active = conversations.find((c) => c.id === activeId) || null;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
      setListLoaded(true);
    } catch {
      /* network hiccup: try again on the next poll */
    }
  }, []);

  // Show a conversation: reset the thread state, then the effect below loads its messages
  const selectConversation = useCallback((id: string | null) => {
    lastIdRef.current = 0;
    setMessages([]);
    setThreadLoading(id !== null);
    setError("");
    setActiveId(id);
  }, []);

  // Conversation list: load now, then keep it fresh
  useEffect(() => {
    if (!authed) return;
    const first = setTimeout(loadList, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadList();
    }, LIST_POLL_MS);
    // Coming back to the tab: refresh right away instead of waiting for the next poll
    const onVisible = () => {
      if (document.visibilityState === "visible") loadList();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authed, loadList]);

  // Someone (for example the Message button on a profile) asked to open a conversation
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ conversationId: string }>).detail?.conversationId;
      if (!id) return;
      setOpen(true);
      selectConversation(id);
      loadList();
    };
    window.addEventListener("raw:open-chat", handler);
    return () => window.removeEventListener("raw:open-chat", handler);
  }, [loadList, selectConversation]);

  // Open thread: load its messages, then poll for new ones
  useEffect(() => {
    if (!authed || !open || !activeId) return;
    let cancelled = false;

    const fetchMessages = async (initial: boolean) => {
      try {
        const url =
          `/api/conversations/${activeId}/messages` + (initial ? "" : `?after=${lastIdRef.current}`);
        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          if (initial) setError("Could not load this conversation.");
          return;
        }
        const data = await res.json();
        const incoming: Message[] = data.messages;
        if (initial) {
          setMessages(incoming);
        } else if (incoming.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...incoming.filter((m) => !seen.has(m.id))];
          });
          loadList();
        }
        if (incoming.length) lastIdRef.current = incoming[incoming.length - 1].id;
      } catch {
        if (!cancelled && initial) setError("Network error. Please try again.");
      } finally {
        if (!cancelled && initial) setThreadLoading(false);
      }
    };

    fetchMessages(true).then(() => loadList());
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") fetchMessages(false);
    }, THREAD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchMessages(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authed, open, activeId, loadList]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId, open]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send the message.");
        return;
      }
      setDraft("");
      const sent: Message = data.message;
      lastIdRef.current = Math.max(lastIdRef.current, sent.id);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      loadList();
    } catch {
      setError("Network error. Your message was not sent.");
    } finally {
      setSending(false);
    }
  };

  if (!authed) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[calc(100vw-2rem)] sm:w-96 h-[32rem] max-h-[calc(100dvh-7rem)] bg-white border border-[#EFE8E1] rounded-2xl shadow-xl flex flex-col overflow-hidden text-[#2C221E]">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#C86C29] text-white">
            {activeId && (
              <button
                onClick={() => selectConversation(null)}
                aria-label="Back to conversations"
                className="text-lg leading-none hover:opacity-80"
              >
                ←
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{active ? active.name : "Messages"}</p>
              {active?.subtitle && (
                <p className="text-xs text-white/80 truncate">{active.subtitle}</p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close messenger"
              className="text-lg leading-none hover:opacity-80"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          {!activeId ? (
            <ul className="flex-1 overflow-y-auto divide-y divide-[#EFE8E1]">
              {!listLoaded && (
                <li className="p-6 text-center text-sm text-[#7D6E65]">Loading...</li>
              )}
              {listLoaded && conversations.length === 0 && (
                <li className="p-6 text-center text-sm text-[#7D6E65]">
                  No conversations yet. Open a creator&apos;s profile and press Message to start one.
                </li>
              )}
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => selectConversation(c.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FDFBF7] transition"
                  >
                    <Avatar name={c.name} image={c.image} size="h-10 w-10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        {c.lastMessage && (
                          <span className="text-[11px] text-[#7D6E65] shrink-0">
                            {formatTime(c.lastMessage.at)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#7D6E65] truncate">
                        {c.lastMessage
                          ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}`
                          : "Say hello"}
                      </p>
                    </div>
                    {c.unread > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#C86C29] text-white text-[11px] font-semibold flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FDFBF7]">
                {threadLoading && (
                  <p className="text-center text-sm text-[#7D6E65]">Loading...</p>
                )}
                {!threadLoading && messages.length === 0 && !error && (
                  <p className="text-center text-sm text-[#7D6E65]">
                    No messages yet. Write the first one below.
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                        m.fromMe
                          ? "bg-[#C86C29] text-white rounded-br-sm"
                          : "bg-white border border-[#EFE8E1] rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.fromMe ? "text-white/70" : "text-[#7D6E65]"}`}>
                        {formatTime(m.at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {error && (
                <p role="alert" className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 border-t border-red-100">
                  {error}
                </p>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#EFE8E1] bg-white"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={2000}
                  className="flex-1 min-w-0 h-11 px-3 text-base sm:text-sm rounded-xl border border-[#D9CFC5] focus:outline-none focus:border-[#C86C29]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="h-10 px-4 text-sm font-medium rounded-xl bg-[#C86C29] text-white hover:bg-[#B05B1E] transition disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close messenger" : "Open messenger"}
        className="relative h-14 w-14 rounded-full bg-[#C86C29] text-white shadow-lg hover:bg-[#B05B1E] transition flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {totalUnread > 0 && !open && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
            {totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
