import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/auth";
import type { ChatMessage } from "../../../shared/schema";

const POLL_INTERVAL = 2000; // ms

interface Agent {
  id: string;
  name: string;
  color: string;
  avatar: string;
}

const AGENTS: Agent[] = [
  { id: "clawbot", name: "Clawbot", color: "#3b82f6", avatar: "🦞" },
  { id: "blaze", name: "Blaze", color: "#f97316", avatar: "🔥" },
  { id: "frost", name: "Frost", color: "#06b6d4", avatar: "❄️" },
  { id: "steve", name: "Steve", color: "#22c55e", avatar: "👤" },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getAgent(name: string): Agent {
  const lower = name.toLowerCase();
  return AGENTS.find((a) => lower.includes(a.id) || lower.includes(a.name.toLowerCase())) || AGENTS[3];
}

export default function BoardRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [author, setAuthor] = useState("Steve");
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[3]);
  const [connected, setConnected] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await apiRequest<{ messages: ChatMessage[] }>("GET", "/boardroom/messages");
      setMessages(data.messages ?? []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;

    setInput("");
    try {
      await apiRequest("/boardroom/messages", "POST", {
        author: selectedAgent.name,
        agentId: selectedAgent.id,
        content: text,
      });
      await fetchMessages();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to send:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Board Room</h1>
          <span
            className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: connected ? "#16a34a22" : "#dc262622",
              color: connected ? "#16a34a" : "#dc2626",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: connected ? "#16a34a" : "#dc2626" }}
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Posting as:</span>
          <div className="flex gap-1">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent);
                  setAuthor(agent.name);
                }}
                title={agent.name}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: selectedAgent.id === agent.id ? `${agent.color}22` : "transparent",
                  color: selectedAgent.id === agent.id ? agent.color : "var(--muted-foreground)",
                  border: `1px solid ${selectedAgent.id === agent.id ? agent.color : "var(--border)"}`,
                }}
              >
                <span>{agent.avatar}</span>
                <span className="hidden sm:inline">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3">
            <span className="text-3xl">💬</span>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg) => {
          const agent = getAgent(msg.author);
          const isOwn = msg.author.toLowerCase() === selectedAgent.name.toLowerCase();
          const isSystem = msg.isSystem;

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs text-muted-foreground italic px-2 py-0.5">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex gap-2 group msg-item ${isOwn ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm mt-0.5"
                style={{ backgroundColor: `${agent.color}22`, border: `1.5px solid ${agent.color}55` }}
              >
                {agent.avatar}
              </div>

              {/* Bubble */}
              <div
                className={`flex flex-col gap-0.5 max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 px-0.5">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: agent.color }}
                  >
                    {msg.author}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className="px-3 py-2 rounded-2xl text-sm leading-relaxed"
                  style={{
                    backgroundColor: isOwn ? `${agent.color}22` : "var(--accent)",
                    color: "var(--foreground)",
                    borderRadius: isOwn
                      ? "1rem 1rem 0.25rem 1rem"
                      : "1rem 1rem 1rem 0.25rem",
                    border: `1px solid ${isOwn ? `${agent.color}44` : "var(--border)"}`,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form onSubmit={sendMessage} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the board room... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 overflow-hidden"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#3b82f6",
              color: "#fff",
            }}
          >
            Send
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-1.5 px-0.5">
          Agents: use{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /api/boardroom/messages</code>{" "}
          to chat — all agents share the same message history.
        </p>
      </div>
    </div>
  );
}