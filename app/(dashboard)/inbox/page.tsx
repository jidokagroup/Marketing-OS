"use client";
import { useState, useMemo, useEffect } from "react";
import MessageCard, { Message, MessageStatus } from "@/components/ui/MessageCard";

interface InboxRow {
  id: string;
  comment_id: string;
  draft_text: string;
  edited_text: string | null;
  status: string;
  created_at: string;
  comment?: {
    id: string;
    commenter_username: string;
    comment_text: string;
    social_account_id: string;
  };
}

function mapToMessage(row: InboxRow): Message {
  const statusMap: Record<string, MessageStatus> = {
    pending: "review",
    approved: "approved",
    posted: "sent",
    rejected: "escalated",
  };
  return {
    id: row.id,
    username: row.comment?.commenter_username ?? "unknown",
    platform: "instagram",
    comment: row.comment?.comment_text ?? "",
    aiReply: row.edited_text ?? row.draft_text,
    status: statusMap[row.status] ?? "review",
    confidenceScore: 0,
    detectedIntent: "",
    tags: ["Comment"],
    timestamp: new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

interface DmRow {
  id: string;
  recipient_ig_id: string;
  recipient_username: string | null;
  handoff_reason: string | null;
  last_message_at: string | null;
  history: { role: string; content: string; ts: string }[] | null;
}

function mapDmToMessage(dm: DmRow): Message {
  const history = Array.isArray(dm.history) ? dm.history : [];
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  const reasonLabel = dm.handoff_reason === "max_messages_reached"
    ? "Long conversation — needs a human"
    : "Sensitive topic (refund/billing/legal) — needs a human";
  return {
    // dm: prefix lets handlers route DM actions to the right endpoint
    id: `dm:${dm.id}`,
    username: dm.recipient_username ?? `IG ${dm.recipient_ig_id}`,
    platform: "instagram",
    comment: lastUser?.content ?? "(no message captured)",
    aiReply: lastAssistant?.content ?? "",
    status: "escalated",
    confidenceScore: 0,
    detectedIntent: reasonLabel,
    tags: ["DM", "Needs human"],
    timestamp: dm.last_message_at
      ? new Date(dm.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "",
  };
}

type FilterTab = "all" | "auto" | "review" | "escalated" | "responses";

const TABS: { label: string; value: FilterTab; count?: number }[] = [
  { label: "Escalated", value: "escalated" },
  { label: "Needs Review", value: "review" },
  { label: "Responses", value: "responses" },
  { label: "Auto Posted", value: "auto" },
  { label: "All", value: "all" },
];

interface ResponseLogItem {
  id: string;
  channel: "comment" | "dm";
  platform: string;
  recipient: string;
  incoming_text: string;
  response_text: string;
  ts: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  reddit: "Reddit",
};

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [responses, setResponses] = useState<ResponseLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("escalated");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inbox")
      .then(r => r.json())
      .then(json => {
        const comments: Message[] = (json.data ?? []).map(mapToMessage);
        const dmMsgs: Message[] = (json.dms ?? []).map(mapDmToMessage);
        // Escalated DMs first so handoffs are front-and-center.
        const all = [...dmMsgs, ...comments];
        setMessages(all);
        setResponses(json.responses ?? []);
        setSelectedId(all[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Platforms present in the responses log (for the per-platform filter).
  const platforms = useMemo(
    () => Array.from(new Set(responses.map((r) => r.platform))).sort(),
    [responses]
  );

  const filteredResponses = useMemo(() => {
    let result = responses;
    if (platformFilter !== "all") result = result.filter((r) => r.platform === platformFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.recipient.toLowerCase().includes(q) ||
          r.incoming_text.toLowerCase().includes(q) ||
          r.response_text.toLowerCase().includes(q)
      );
    }
    return result;
  }, [responses, platformFilter, search]);

  // Mark an escalated DM handoff as resolved (id is prefixed "dm:").
  const resolveDm = async (messageId: string) => {
    const dmId = messageId.replace(/^dm:/, "");
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setSelectedId(null);
    try {
      await fetch("/api/inbox/dm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dmId, stage: "resolved" }),
      });
    } catch {
      /* optimistic — already removed from list */
    }
  };

  const filtered = useMemo(() => {
    let result = messages;
    if (activeTab !== "all") result = result.filter((m) => m.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.username.toLowerCase().includes(q) ||
          m.comment.toLowerCase().includes(q) ||
          m.aiReply.toLowerCase().includes(q)
      );
    }
    return result;
  }, [messages, activeTab, search]);

  const tabCounts = useMemo(() => ({
    all: messages.length,
    auto: messages.filter((m) => m.status === "auto" || m.status === "sent").length,
    review: messages.filter((m) => m.status === "review").length,
    escalated: messages.filter((m) => m.status === "escalated").length,
    responses: responses.length,
  }), [messages, responses]);

  const selectedMessage = filtered.find((m) => m.id === selectedId) ?? filtered[0];
  const selectedResponse = filteredResponses.find((r) => r.id === selectedId);

  const updateStatus = (id: string, status: MessageStatus) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));

  const isDm = (id: string) => id.startsWith("dm:");
  // For DM handoffs the primary action resolves the conversation; for comments it approves.
  const handleApprove = (id: string) => (isDm(id) ? resolveDm(id) : updateStatus(id, "approved"));

  return (
    <div className="flex h-full bg-bg">
      {/* Left column: list */}
      <div className="flex flex-col w-full md:w-80 lg:w-96 border-r border-border shrink-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-1">Inbox</h1>
          <p className="text-xs text-text-muted">Review, approve, and send AI-powered replies before leads go cold.</p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages & responses..."
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 px-3 py-2 border-b border-border overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${activeTab === tab.value
                  ? "bg-primary/10 text-primary shadow-[0_0_10px_rgba(123,63,242,0.06)]"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
                }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                ${activeTab === tab.value ? "bg-primary/20 text-primary" : "bg-border text-text-muted"}`}>
                {tabCounts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Platform filter — responses log only */}
        {activeTab === "responses" && platforms.length > 0 && (
          <div className="px-4 py-2.5 border-b border-border">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary/40 transition-colors cursor-pointer"
            >
              <option value="all">All platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABEL[p] ?? p}</option>
              ))}
            </select>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3 animate-pulse">💬</div>
              <p className="text-sm font-medium text-text-secondary">Loading...</p>
            </div>
          ) : activeTab === "responses" ? (
            filteredResponses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📜</div>
                <p className="text-sm font-medium text-text-secondary">No responses yet</p>
                <p className="text-xs text-text-muted mt-1">AI replies to comments &amp; DMs will be logged here.</p>
              </div>
            ) : (
              filteredResponses.map((r) => (
                <ResponseRow
                  key={r.id}
                  item={r}
                  isSelected={selectedId === r.id}
                  onSelect={() => setSelectedId(r.id)}
                />
              ))
            )
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm font-medium text-text-secondary">No messages yet</p>
              <p className="text-xs text-text-muted mt-1">Connect your Instagram account to start receiving comments.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm font-medium text-text-secondary">No messages found</p>
              <p className="text-xs text-text-muted mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filtered.map((msg) => (
              <MessageCard
                key={msg.id}
                message={msg}
                compact
                isSelected={selectedId === msg.id}
                onSelect={(m) => setSelectedId(m.id)}
                onApprove={handleApprove}
                onEscalate={(id) => updateStatus(id, "escalated")}
                onSend={(id) => updateStatus(id, "sent")}
              />
            ))
          )}
        </div>
      </div>

      {/* Right column: preview panel (desktop only) */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-bg">
        {activeTab === "responses" ? (
          selectedResponse ? (
            <ResponseDetail item={selectedResponse} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">📜</div>
                <p className="text-text-secondary font-medium">Select a response to view</p>
                <p className="text-xs text-text-muted mt-1">Every AI reply sent to comments &amp; DMs is logged here</p>
              </div>
            </div>
          )
        ) : selectedMessage ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <MessageCard
                message={selectedMessage}
                isSelected
                onApprove={handleApprove}
                onEscalate={(id) => updateStatus(id, "escalated")}
                onSend={(id) => updateStatus(id, "sent")}
              />

              {/* Thread context */}
              <div className="mt-4 rounded-2xl border border-border bg-surface-elevated p-5">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-3">Reply Thread Context</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                      {selectedMessage.username.replace("@", "").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 bg-surface rounded-xl px-3 py-2">
                      <p className="text-xs font-medium text-text-secondary mb-0.5">{selectedMessage.username}</p>
                      <p className="text-xs text-text-primary">{selectedMessage.comment}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pl-6">
                    <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">AI</div>
                    <div className="flex-1 bg-primary/5 border border-primary/10 rounded-xl px-3 py-2">
                      <p className="text-xs font-medium text-primary/70 mb-0.5">Autom8 AI</p>
                      <p className="text-xs text-text-primary">{selectedMessage.aiReply}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-text-secondary font-medium">Select a message to review</p>
              <p className="text-xs text-text-muted mt-1">Click any message in the list to see the full thread</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: full-screen card (shown when selected on mobile) */}
      {selectedId && (
        <div className="fixed inset-0 z-50 md:hidden bg-bg overflow-y-auto">
          <div className="p-4">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-2 text-sm text-text-secondary mb-4 hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Inbox
            </button>
            {activeTab === "responses" && selectedResponse ? (
              <ResponseDetail item={selectedResponse} />
            ) : selectedMessage ? (
              <MessageCard
                message={selectedMessage}
                onApprove={(id) => { handleApprove(id); setSelectedId(null); }}
                onEscalate={(id) => { updateStatus(id, "escalated"); setSelectedId(null); }}
                onSend={(id) => { updateStatus(id, "sent"); setSelectedId(null); }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Responses log: list row + detail panel ──────────────────────────────────

function PlatformTag({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-text-secondary border border-white/10 capitalize">
      {PLATFORM_LABEL[platform] ?? platform}
    </span>
  );
}

function ResponseRow({ item, isSelected, onSelect }: { item: ResponseLogItem; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150
        ${isSelected
          ? "border-primary/40 bg-primary/5 shadow-[0_0_16px_rgba(123,63,242,0.08)]"
          : "border-border bg-surface hover:border-border/80 hover:bg-surface-elevated"
        }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <PlatformTag platform={item.platform} />
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
            {item.channel === "dm" ? "DM" : "Comment"}
          </span>
        </div>
        <span className="text-[11px] text-text-muted shrink-0">
          {item.ts ? new Date(item.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
        </span>
      </div>
      <p className="text-xs font-medium text-text-primary truncate mb-0.5">{item.recipient}</p>
      <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{item.response_text}</p>
    </button>
  );
}

function ResponseDetail({ item }: { item: ResponseLogItem }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <PlatformTag platform={item.platform} />
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
            {item.channel === "dm" ? "Direct Message" : "Comment reply"}
          </span>
          <span className="text-[11px] text-text-muted ml-auto">
            {item.ts ? new Date(item.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        </div>

        <p className="text-sm font-semibold text-text-primary">{item.recipient}</p>

        {item.incoming_text && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
              {item.recipient.replace(/^@|^IG /, "").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 bg-surface rounded-xl px-3 py-2">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-0.5">They said</p>
              <p className="text-xs text-text-primary whitespace-pre-wrap">{item.incoming_text}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 pl-6">
          <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">AI</div>
          <div className="flex-1 bg-primary/5 border border-primary/10 rounded-xl px-3 py-2">
            <p className="text-[10px] font-medium text-primary/70 uppercase tracking-wider mb-0.5">Autom8 AI replied</p>
            <p className="text-xs text-text-primary whitespace-pre-wrap">{item.response_text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
