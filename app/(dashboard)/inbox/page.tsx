"use client";
import { useState, useMemo } from "react";
import MessageCard, { Message, MessageStatus } from "@/components/ui/MessageCard";
import { mockMessages } from "@/lib/mock-data";

type FilterTab = "all" | "auto" | "review" | "escalated";

const TABS: { label: string; value: FilterTab; count?: number }[] = [
  { label: "Escalated", value: "escalated" },
  { label: "Needs Review", value: "review" },
  { label: "Auto Posted", value: "auto" },
  { label: "All", value: "all" },
];

export default function InboxPage() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [activeTab, setActiveTab] = useState<FilterTab>("escalated");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(messages[0]?.id ?? null);

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
  }), [messages]);

  const selectedMessage = filtered.find((m) => m.id === selectedId) ?? filtered[0];

  const updateStatus = (id: string, status: MessageStatus) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));

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
              placeholder="Search comments..."
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

        {/* Message list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filtered.length === 0 ? (
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
                onApprove={(id) => updateStatus(id, "approved")}
                onEscalate={(id) => updateStatus(id, "escalated")}
                onSend={(id) => updateStatus(id, "sent")}
              />
            ))
          )}
        </div>
      </div>

      {/* Right column: preview panel (desktop only) */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-bg">
        {selectedMessage ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <MessageCard
                message={selectedMessage}
                isSelected
                onApprove={(id) => updateStatus(id, "approved")}
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
            {selectedMessage && (
              <MessageCard
                message={selectedMessage}
                onApprove={(id) => { updateStatus(id, "approved"); setSelectedId(null); }}
                onEscalate={(id) => { updateStatus(id, "escalated"); setSelectedId(null); }}
                onSend={(id) => { updateStatus(id, "sent"); setSelectedId(null); }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
