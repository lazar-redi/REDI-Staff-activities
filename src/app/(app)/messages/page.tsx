"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message, Profile } from "@/lib/types";
import { Send, Hash, Users } from "lucide-react";

const CHANNELS = ["general", "activities", "tasks", "budget", "random"];

export default function MessagesPage() {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [channel, setChannel] = useState("general");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(
    async (ch: string) => {
      setLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel", ch)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as Message[]) || []);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*");
      const map: Record<string, Profile> = {};
      (profileData || []).forEach((p: Profile) => {
        map[p.id] = p;
      });
      setProfiles(map);
    }
    init();
  }, []);

  useEffect(() => {
    loadMessages(channel);

    const subscription = supabase
      .channel(`messages:${channel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel=eq.${channel}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channel, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;
    setSending(true);
    await supabase.from("messages").insert({
      sender_id: userId,
      channel,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500 mt-1">Team communication channels</p>
      </div>

      <div className="flex-1 flex bg-white rounded-xl border border-gray-100 overflow-hidden min-h-0">
        <aside className="w-48 border-r border-gray-100 flex-shrink-0 overflow-y-auto">
          <div className="px-3 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Users size={12} /> Channels
            </p>
          </div>
          <div className="p-2 space-y-0.5">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                  channel === ch
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Hash size={14} />
                {ch}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Hash size={16} /> {channel}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                No messages yet. Say hello!
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === userId;
              const sender = profiles[msg.sender_id];
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] ${
                      isMe
                        ? "bg-blue-600 text-white rounded-2xl rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md"
                    } px-4 py-2.5`}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold mb-0.5 text-blue-600">
                        {sender?.full_name || "Unknown"}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <p
                      className={`text-[10px] mt-1 ${
                        isMe ? "text-blue-200" : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={send}
            className="px-4 py-3 border-t border-gray-100 flex gap-2"
          >
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message #${channel}`}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
