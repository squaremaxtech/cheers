"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { markChatRead, sendChatMessage } from "@/actions/chats";
import FileUploadButton from "@/components/ui/FileUploadButton";
import { CHAT_MESSAGE_MAX_CHARS, CHAT_ROOM_MESSAGE_CAP } from "@/lib/constants";
import type { ChatMessage, ChatStreamEvent, ChatViewerRole } from "@/types";

// "2:35 PM" for today's messages, "Jul 7, 2:35 PM" for older ones.
function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${time}`;
}

// Live chat view: initial messages come from the server render; new ones
// arrive over the room's SSE stream (sender included — sends are de-duped by
// id). Staff get a read-only transcript. Presence of the counterpart shows
// when known (initialOnline null = hidden/not applicable). Messages and
// presence are keyed by participant ROLE — no account ids on the wire.
export default function ChatRoom({
  roomId,
  viewerRole,
  initialMessages,
  counterpartLabel,
  initialOnline,
}: {
  roomId: string;
  viewerRole: ChatViewerRole;
  initialMessages: ChatMessage[];
  counterpartLabel: string;
  initialOnline: boolean | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(initialOnline);
  const listRef = useRef<HTMLDivElement>(null);
  const participant = viewerRole !== "staff";

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message]
    );
  }, []);

  // Live stream: new messages + counterpart presence, pushed by the server.
  useEffect(() => {
    const source = new EventSource(`/api/chat/${roomId}/stream`);
    source.onmessage = (e) => {
      try {
        const event: ChatStreamEvent = JSON.parse(e.data);
        if (event.kind === "message") append(event.message);
        else if (event.kind === "presence" && event.role !== viewerRole) {
          // initialOnline null = presence hidden for this viewer; stay hidden.
          setOnline((prev) => (prev === null ? null : event.online));
        }
      } catch {
        // malformed frame — ignore
      }
    };
    return () => source.close();
  }, [roomId, append, viewerRole]);

  // Keep the unread badge honest while the room is on screen.
  useEffect(() => {
    if (!participant || messages.length === 0) return;
    const timer = setTimeout(() => {
      void markChatRead({ roomId });
    }, 400);
    return () => clearTimeout(timer);
  }, [roomId, participant, messages.length]);

  // Pin to the newest message — scroll the list only, never the page
  // (scrollIntoView walks ancestor scrollers and yanked the window to top).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    const body = text.trim();
    if ((body.length === 0 && !attachedUrl) || sending) return;
    setSending(true);
    const res = await sendChatMessage({
      roomId,
      body,
      imageUrl: attachedUrl ?? undefined,
    });
    setSending(false);
    if (res.ok) {
      append(res.data.message);
      setText("");
      setAttachedUrl(null);
    } else {
      toast.error(res.error);
    }
  }

  const remaining = CHAT_MESSAGE_MAX_CHARS - text.length;

  return (
    <div className="card flex h-[65vh] min-h-[420px] flex-col">
      {online !== null && (
        <p className="flex items-center gap-2 border-b border-hairline px-5 py-2.5 text-xs text-muted">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              online ? "bg-success" : "bg-faint"
            }`}
          />
          {counterpartLabel} is {online ? "online" : "offline"}
        </p>
      )}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-5">
        <p className="text-center text-[11px] text-faint">
          Only the most recent {CHAT_ROOM_MESSAGE_CAP.toLocaleString("en-US")}{" "}
          messages are kept.
        </p>
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-faint">
            No messages yet — say hello.
          </p>
        )}
        {messages.map((m, i) => {
          const own = m.senderRole === viewerRole;
          const showLabel =
            !own && (i === 0 || messages[i - 1].senderRole !== m.senderRole);
          return (
            <div
              key={m.id}
              className={`flex ${own ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] sm:max-w-[65%]`}>
                {showLabel && (
                  <p className="mb-1 text-[11px] text-faint">{m.senderLabel}</p>
                )}
                <div
                  className={`rounded-2xl border px-4 py-2.5 ${
                    own
                      ? "border-gold/30 bg-gold/10"
                      : "border-hairline bg-raised"
                  }`}
                >
                  {m.imageUrl && (
                    <a
                      href={m.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* Plain <img>: served by the auth-gated media route. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imageUrl}
                        alt="Shared in chat"
                        className="mb-1 max-h-64 rounded-lg"
                      />
                    </a>
                  )}
                  {m.body && (
                    <p className="whitespace-pre-line break-words text-sm leading-6 text-ink">
                      {m.body}
                    </p>
                  )}
                  <p
                    className="mt-1 text-right text-[10px] text-faint"
                    title={new Date(m.createdAt).toLocaleString()}
                  >
                    {formatMessageTime(m.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {participant ? (
        <div className="border-t border-hairline p-4">
          {attachedUrl && (
            <div className="mb-3 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedUrl}
                alt="Attached"
                className="max-h-24 rounded-lg border border-hairline"
              />
              <button
                type="button"
                className="text-xs text-faint hover:text-danger"
                onClick={() => setAttachedUrl(null)}
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <FileUploadButton
              kind="chat"
              roomId={roomId}
              accept="image/jpeg,image/png,image/webp,image/gif"
              label="📷"
              className="btn-ghost shrink-0 px-3 text-base"
              onUploaded={(url) => setAttachedUrl(url)}
            />
            <textarea
              className="input max-h-32 min-h-[42px] flex-1 resize-none py-2.5"
              rows={1}
              placeholder="Write a message…"
              maxLength={CHAT_MESSAGE_MAX_CHARS}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              className="btn-gold shrink-0"
              disabled={sending || (text.trim().length === 0 && !attachedUrl)}
              onClick={() => void handleSend()}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
          {remaining <= 150 && (
            <p
              className={`mt-1.5 text-right text-[11px] ${
                remaining <= 50 ? "text-warn" : "text-faint"
              }`}
            >
              {remaining} character{remaining === 1 ? "" : "s"} left
            </p>
          )}
        </div>
      ) : (
        <p className="border-t border-hairline p-4 text-center text-xs text-faint">
          Support view — read-only transcript.
        </p>
      )}
    </div>
  );
}
