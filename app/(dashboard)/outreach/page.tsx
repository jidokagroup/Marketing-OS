"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus = "pending_review" | "approved" | "rejected" | "posted" | "revised";
type Platform       = "x" | "reddit";
type BrandRoute     = "Autom8" | "Aurumverse" | "Bare Branding Systems" | "none";

interface SocialDraft {
  id: string;
  platform: Platform;
  source_url: string | null;
  source_account: string | null;
  subreddit: string | null;
  topic: string | null;
  thread_topic: string | null;
  user_pain_point: string | null;
  topic_domain: string | null;
  brand_route: BrandRoute | null;
  link_to_include: string | null;
  handle_to_include: string | null;
  routing_confidence: number | null;
  reason_for_route: string | null;
  draft_content: string;
  draft_type: string | null;
  suggested_action: string | null;
  engagement_level: string | null;
  audience_relevance: string | null;
  risk_level: string | null;
  promotional_risk_score: number | null;
  risk_notes: string | null;
  approval_status: ApprovalStatus;
  reviewer_notes: string | null;
  posted_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  posted_at: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === "x") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/20">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        X
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
      Reddit
    </span>
  );
}

const BRAND_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  "Autom8":               { label: "Autom8",        classes: "bg-primary/10 text-primary border-primary/20",           dot: "bg-primary" },
  "Aurumverse":           { label: "Aurumverse",    classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",     dot: "bg-amber-400" },
  "Bare Branding Systems":{ label: "Bare Branding", classes: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",        dot: "bg-cyan-400" },
  "none":                 { label: "No Brand",      classes: "bg-white/5 text-text-muted border-white/10",             dot: "bg-text-muted" },
};

function BrandBadge({ brand }: { brand: BrandRoute | null }) {
  const cfg = BRAND_CONFIG[brand ?? "none"] ?? BRAND_CONFIG["none"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function RiskBadge({ score, level }: { score?: number | null; level?: string | null }) {
  const display = score ?? null;
  const isHigh   = display !== null ? display >= 7  : level === "high";
  const isMedium = display !== null ? display >= 4  : level === "medium";

  const classes = isHigh
    ? "bg-error/10 text-error border-error/20"
    : isMedium
    ? "bg-warning/10 text-warning border-warning/20"
    : "bg-success/10 text-success border-success/20";

  const label = display !== null
    ? `Risk ${display}/10`
    : level === "high" ? "High Risk" : level === "medium" ? "Med Risk" : "Low Risk";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${classes}`}>
      {label}
    </span>
  );
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; classes: string; dot: string }> = {
  pending_review: { label: "Pending",  classes: "bg-warning/10 text-warning border-warning/20",   dot: "bg-warning" },
  approved:       { label: "Approved", classes: "bg-success/10 text-success border-success/20",   dot: "bg-success" },
  rejected:       { label: "Rejected", classes: "bg-error/10 text-error border-error/20",         dot: "bg-error" },
  posted:         { label: "Posted",   classes: "bg-primary/10 text-primary border-primary/20",   dot: "bg-primary" },
  revised:        { label: "Revised",  classes: "bg-white/5 text-text-muted border-white/10",     dot: "bg-text-muted" },
};

function StatusPill({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_review;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ConfidencePip({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "text-success" : pct >= 60 ? "text-warning" : "text-error";
  return <span className={`text-xs font-bold ${color}`}>{pct}%</span>;
}

function RelativeTime({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const label = days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : `${mins}m ago`;
  return <span className="text-[11px] text-text-muted">{label}</span>;
}

// ─── Filter tabs config ────────────────────────────────────────────────────────

type StatusFilter = "all" | ApprovalStatus;
type PlatformFilter = "all" | Platform;
type BrandFilter = "all" | BrandRoute;

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "Pending",  value: "pending_review" },
  { label: "All",      value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Posted",   value: "posted" },
  { label: "Rejected", value: "rejected" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialIntelPage() {
  const [drafts, setDrafts]           = useState<SocialDraft[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [statusTab, setStatusTab]     = useState<StatusFilter>("pending_review");
  const [platformFilter, setPlatform] = useState<PlatformFilter>("all");
  const [brandFilter, setBrand]       = useState<BrandFilter>("all");
  const [search, setSearch]           = useState("");
  const [saving, setSaving]           = useState(false);
  const [notesDraft, setNotesDraft]   = useState("");
  const [showNotesInput, setShowNotesInput] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusTab   !== "all") params.set("status",       statusTab);
      if (platformFilter !== "all") params.set("platform",  platformFilter);
      if (brandFilter    !== "all") params.set("brand_route", brandFilter);

      const res  = await fetch(`/api/social-drafts?${params}`);
      const json = await res.json();
      if (json.data) {
        setDrafts(json.data);
        setSelectedId(json.data[0]?.id ?? null);
      }
    } catch {
      // silently handled — empty state shown
    } finally {
      setLoading(false);
    }
  }, [statusTab, platformFilter, brandFilter]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return drafts;
    const q = search.toLowerCase();
    return drafts.filter(
      d =>
        d.topic?.toLowerCase().includes(q) ||
        d.draft_content.toLowerCase().includes(q) ||
        d.source_account?.toLowerCase().includes(q) ||
        d.subreddit?.toLowerCase().includes(q) ||
        d.brand_route?.toLowerCase().includes(q)
    );
  }, [drafts, search]);

  const counts = useMemo(() => ({
    all:            drafts.length,
    pending_review: drafts.filter(d => d.approval_status === "pending_review").length,
    approved:       drafts.filter(d => d.approval_status === "approved").length,
    posted:         drafts.filter(d => d.approval_status === "posted").length,
    rejected:       drafts.filter(d => d.approval_status === "rejected").length,
    revised:        drafts.filter(d => d.approval_status === "revised").length,
  }), [drafts]);

  const selected = filtered.find(d => d.id === selectedId) ?? filtered[0] ?? null;

  // ── Actions ────────────────────────────────────────────────────────────────
  const updateStatus = async (id: string, approval_status: ApprovalStatus, extra?: { reviewer_notes?: string; posted_url?: string }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/social-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approval_status, ...extra }),
      });
      if (res.ok) {
        setDrafts(prev =>
          prev.map(d =>
            d.id === id
              ? { ...d, approval_status, reviewer_notes: extra?.reviewer_notes ?? d.reviewer_notes, reviewed_at: new Date().toISOString() }
              : d
          )
        );
        setShowNotesInput(false);
        setNotesDraft("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleApprove  = () => selected && updateStatus(selected.id, "approved", { reviewer_notes: notesDraft || undefined });
  const handleReject   = () => selected && updateStatus(selected.id, "rejected", { reviewer_notes: notesDraft || undefined });
  const handleRevise   = () => selected && updateStatus(selected.id, "revised",  { reviewer_notes: notesDraft || undefined });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-bg">

      {/* ── Left panel: list ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-full md:w-80 lg:w-96 border-r border-border shrink-0 overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Outreach</h1>
          </div>
          <p className="text-xs text-text-muted">Outbound AI drafts for X &amp; Reddit — review before anything is posted.</p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drafts..."
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>

        {/* Platform + Brand quick filters */}
        <div className="flex gap-2 px-4 py-2.5 border-b border-border">
          <select
            value={platformFilter}
            onChange={e => setPlatform(e.target.value as PlatformFilter)}
            className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary/40 transition-colors cursor-pointer"
          >
            <option value="all">All platforms</option>
            <option value="x">X only</option>
            <option value="reddit">Reddit only</option>
          </select>
          <select
            value={brandFilter}
            onChange={e => setBrand(e.target.value as BrandFilter)}
            className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary/40 transition-colors cursor-pointer"
          >
            <option value="all">All brands</option>
            <option value="Autom8">Autom8</option>
            <option value="Aurumverse">Aurumverse</option>
            <option value="Bare Branding Systems">Bare Branding</option>
            <option value="none">No brand</option>
          </select>
        </div>

        {/* Status tabs */}
        <div className="flex gap-0.5 px-3 py-2 border-b border-border overflow-x-auto scrollbar-none">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${statusTab === tab.value
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
                }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                ${statusTab === tab.value ? "bg-primary/20 text-primary" : "bg-border text-text-muted"}`}>
                {counts[tab.value === "all" ? "all" : tab.value as ApprovalStatus]}
              </span>
            </button>
          ))}
        </div>

        {/* Draft list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-3xl mb-3 animate-pulse">⚡</div>
              <p className="text-sm text-text-secondary">Loading drafts…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm font-medium text-text-secondary">No drafts here</p>
              <p className="text-xs text-text-muted mt-1">
                {drafts.length === 0
                  ? "Connect your agent runtime to start generating drafts."
                  : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            filtered.map(draft => (
              <DraftListItem
                key={draft.id}
                draft={draft}
                isSelected={selectedId === draft.id}
                onSelect={() => setSelectedId(draft.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: detail ───────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-bg">
        {selected ? (
          <DraftDetailPanel
            draft={selected}
            saving={saving}
            notesDraft={notesDraft}
            setNotesDraft={setNotesDraft}
            showNotesInput={showNotesInput}
            setShowNotesInput={setShowNotesInput}
            onApprove={handleApprove}
            onReject={handleReject}
            onRevise={handleRevise}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">⚡</div>
              <p className="text-text-secondary font-medium">Select a draft to review</p>
              <p className="text-xs text-text-muted mt-1">Click any item in the list to see the full draft</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile full-screen ────────────────────────────────────────────── */}
      {selectedId && selected && (
        <div className="fixed inset-0 z-50 md:hidden bg-bg overflow-y-auto">
          <div className="p-4">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-2 text-sm text-text-secondary mb-4 hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to queue
            </button>
            <DraftDetailPanel
              draft={selected}
              saving={saving}
              notesDraft={notesDraft}
              setNotesDraft={setNotesDraft}
              showNotesInput={showNotesInput}
              setShowNotesInput={setShowNotesInput}
              onApprove={handleApprove}
              onReject={handleReject}
              onRevise={handleRevise}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Draft list item ──────────────────────────────────────────────────────────

function DraftListItem({
  draft, isSelected, onSelect,
}: {
  draft: SocialDraft;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const topic = draft.topic ?? draft.thread_topic ?? "Untitled topic";
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150
        ${isSelected
          ? "border-primary/40 bg-primary/5 shadow-[0_0_16px_rgba(123,63,242,0.08)]"
          : "border-border bg-surface hover:border-border/80 hover:bg-surface-elevated"
        }`}
    >
      {/* Top row: platform + brand + status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <PlatformBadge platform={draft.platform} />
          <BrandBadge brand={draft.brand_route} />
        </div>
        <StatusPill status={draft.approval_status} />
      </div>

      {/* Topic */}
      <p className="text-xs font-medium text-text-primary truncate mb-1">{topic}</p>

      {/* Draft preview */}
      <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed mb-2">{draft.draft_content}</p>

      {/* Bottom row: risk + time */}
      <div className="flex items-center justify-between gap-2">
        <RiskBadge score={draft.promotional_risk_score} level={draft.risk_level} />
        <RelativeTime iso={draft.created_at} />
      </div>
    </button>
  );
}

// ─── Draft detail panel ───────────────────────────────────────────────────────

function DraftDetailPanel({
  draft, saving,
  notesDraft, setNotesDraft,
  showNotesInput, setShowNotesInput,
  onApprove, onReject, onRevise,
}: {
  draft: SocialDraft;
  saving: boolean;
  notesDraft: string;
  setNotesDraft: (v: string) => void;
  showNotesInput: boolean;
  setShowNotesInput: (v: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onRevise: () => void;
}) {
  const isPending  = draft.approval_status === "pending_review" || draft.approval_status === "revised";
  const topic      = draft.topic ?? draft.thread_topic ?? "Untitled topic";
  const source     = draft.source_account ?? draft.subreddit ?? null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <PlatformBadge platform={draft.platform} />
              <BrandBadge brand={draft.brand_route} />
              <StatusPill status={draft.approval_status} />
              {draft.routing_confidence !== null && (
                <span className="text-[11px] text-text-muted">
                  Route confidence: <ConfidencePip score={draft.routing_confidence} />
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-text-primary leading-snug">{topic}</h2>
            {source && (
              <p className="text-xs text-text-muted mt-0.5">
                {draft.platform === "reddit" ? `r/${source}` : `@${source}`}
              </p>
            )}
          </div>
          <RelativeTime iso={draft.created_at} />
        </div>

        {/* Source link */}
        {draft.source_url && (
          <a
            href={draft.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View original {draft.platform === "reddit" ? "thread" : "post"}
          </a>
        )}

        {/* User pain point (Reddit) */}
        {draft.user_pain_point && (
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1.5">User Pain Point</p>
            <p className="text-sm text-text-secondary leading-relaxed">{draft.user_pain_point}</p>
          </div>
        )}

        {/* Draft content */}
        <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-primary/70 uppercase tracking-wider font-medium">
              {draft.platform === "reddit" ? "Draft Reply" : `Draft — ${draft.draft_type ?? "reply"}`}
            </p>
            {draft.engagement_level && (
              <span className="text-[11px] text-text-muted capitalize">
                Engagement: <span className="text-text-secondary font-medium">{draft.engagement_level}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{draft.draft_content}</p>
        </div>

        {/* Routing reason */}
        {draft.reason_for_route && (
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1.5">Why This Brand</p>
            <p className="text-sm text-text-secondary leading-relaxed">{draft.reason_for_route}</p>
          </div>
        )}

        {/* Link to include */}
        {draft.link_to_include && (
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1.5">Link to Include</p>
            <a
              href={draft.link_to_include}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {draft.link_to_include}
            </a>
            {draft.handle_to_include && (
              <p className="text-xs text-text-muted mt-1">Handle: {draft.handle_to_include}</p>
            )}
          </div>
        )}

        {/* Risk assessment */}
        {(draft.risk_notes || draft.promotional_risk_score !== null || draft.risk_level) && (
          <div className={`rounded-xl border p-4 ${
            (draft.promotional_risk_score ?? 0) >= 7 || draft.risk_level === "high"
              ? "bg-error/5 border-error/20"
              : (draft.promotional_risk_score ?? 0) >= 4 || draft.risk_level === "medium"
              ? "bg-warning/5 border-warning/20"
              : "bg-success/5 border-success/20"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Risk Assessment</p>
              <RiskBadge score={draft.promotional_risk_score} level={draft.risk_level} />
            </div>
            {draft.risk_notes && (
              <p className="text-sm text-text-secondary leading-relaxed">{draft.risk_notes}</p>
            )}
          </div>
        )}

        {/* Existing reviewer notes (if already reviewed) */}
        {draft.reviewer_notes && !isPending && (
          <div className="rounded-xl bg-surface border border-border p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1.5">Reviewer Notes</p>
            <p className="text-sm text-text-secondary leading-relaxed">{draft.reviewer_notes}</p>
          </div>
        )}

        {/* Action area — only shown for pending/revised drafts */}
        {isPending && (
          <div className="rounded-2xl border border-border bg-surface-elevated p-5 space-y-4">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Human Approval Required</p>

            {/* Notes input toggle */}
            {showNotesInput ? (
              <div>
                <p className="text-xs text-text-muted mb-2">Add notes (optional — sent with your decision)</p>
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="e.g. Tweak the opening line, tone feels slightly off…"
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary resize-none outline-none focus:border-primary/50 transition-colors placeholder-text-muted"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowNotesInput(true)}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2"
              >
                + Add reviewer notes
              </button>
            )}

            {/* Approve / Revise / Reject */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={onApprove}
                className="flex-1"
              >
                ✓ Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={saving}
                onClick={onRevise}
                className="flex-1"
              >
                ✎ Request Revision
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={saving}
                onClick={onReject}
                className="flex-1"
              >
                ✕ Reject
              </Button>
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              Approving means you will post this manually on the platform.
              Nothing is auto-posted. After posting, mark it as Posted from the approved queue.
            </p>
          </div>
        )}

        {/* Mark as posted — if approved */}
        {draft.approval_status === "approved" && (
          <div className="rounded-2xl border border-success/20 bg-success/5 p-5">
            <p className="text-xs font-medium text-success mb-1">Approved — Ready to post</p>
            <p className="text-xs text-text-muted mb-3">
              Post this manually on {draft.platform === "reddit" ? "Reddit" : "X"}, then mark it as posted here.
            </p>
            <Button variant="secondary" size="sm" onClick={() => {}}>
              Mark as Posted
            </Button>
          </div>
        )}

        {/* Already posted */}
        {draft.approval_status === "posted" && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-xs font-medium text-primary mb-1">Posted</p>
            {draft.posted_url ? (
              <a href={draft.posted_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline">
                View live post →
              </a>
            ) : (
              <p className="text-xs text-text-muted">No link saved.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
