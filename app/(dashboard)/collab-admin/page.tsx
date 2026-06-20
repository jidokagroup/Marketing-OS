"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Application = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  instagram_handle: string;
  follower_count: string | null;
  content_niche: string | null;
  message: string | null;
  notes: string | null;
  status: "pending" | "approved" | "declined" | "paused";
  deliverable_status: "pending" | "posted" | "complete" | "missed";
  referral_code: string | null;
  referrals: number;
  referralsThisMonth: number;
  activeReferrals: number;
  estMonthlyPayout: number;
  estWeeklyPayout: number;
};

type Filter = "pending" | "approved" | "declined" | "all";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  approved: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  declined: "bg-red-400/10 text-red-400 border-red-400/20",
  paused: "bg-zinc-400/10 text-zinc-300 border-zinc-400/20",
};

const DELIVERABLES = ["pending", "posted", "complete", "missed"] as const;

export default function CollabAdminPage() {
  const [level, setLevel] = useState<"superadmin" | "admin" | null | "loading">("loading");
  const [apps, setApps] = useState<Application[]>([]);
  const [commission, setCommission] = useState(20);
  const [filter, setFilter] = useState<Filter>("pending");
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/collab/applications");
      if (res.status === 403) { setLevel(null); return; }
      const json = await res.json();
      setApps(json.data ?? []);
      setCommission(json.commissionPercent ?? 20);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/request")
      .then((r) => r.json())
      .then((j) => {
        setLevel(j.level ?? null);
        if (j.level) load();
      })
      .catch(() => setLevel(null));
  }, [load]);

  const patch = async (id: string, payload: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await fetch("/api/collab/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (level === "loading") return <div className="p-6 text-sm text-text-muted">Loading…</div>;

  if (!level) {
    return (
      <div className="p-6 max-w-md mx-auto text-center mt-10">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-lg font-semibold text-text-primary mb-1">Admin access required</h1>
        <p className="text-sm text-text-muted mb-5">The Collab Admin portal is for approved admin accounts only.</p>
        <Link href="/admin-access" className="inline-block text-sm font-medium text-white bg-gradient-to-r from-accent-pink to-accent-purple rounded-lg px-5 py-2.5">
          Request admin access →
        </Link>
      </div>
    );
  }

  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    declined: apps.filter((a) => a.status === "declined").length,
    all: apps.length,
  };
  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div className="p-4 sm:p-5 md:p-7 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Collab Program</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Influencer Admin</h1>
          <p className="text-sm text-text-secondary mt-1">
            Review applications, track referrals &amp; deliverables. Payouts estimated at <strong className="text-text-primary">{commission}%</strong> of active subscriptions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {level === "superadmin" && (
            <Link href="/admin-access" className="text-xs text-text-secondary border border-border rounded-lg px-3 py-1.5 hover:text-text-primary transition-colors">
              Manage admins
            </Link>
          )}
          <button onClick={load} disabled={fetching} className="text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors disabled:opacity-50">
            {fetching ? "Syncing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-0">
        {([
          { id: "pending", label: "Pending" },
          { id: "approved", label: "Approved" },
          { id: "declined", label: "Declined" },
          { id: "all", label: "All" },
        ] as { id: Filter; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${filter === t.id ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-secondary"}`}
          >
            {t.label}
            <span className="text-[10px] bg-surface-elevated border border-border rounded-full px-1.5 py-0.5">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {fetching && apps.length === 0 ? (
        <p className="text-sm text-text-muted py-6 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-elevated p-10 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-medium text-text-secondary">No {filter === "all" ? "" : filter} applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary">{a.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    <a href={`https://instagram.com/${a.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@{a.instagram_handle}</a>
                    {" · "}
                    <a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {a.follower_count && <span className="text-[11px] bg-surface-elevated border border-border text-text-muted px-2 py-0.5 rounded-full">{a.follower_count} followers</span>}
                    {a.content_niche && <span className="text-[11px] bg-surface-elevated border border-border text-text-muted px-2 py-0.5 rounded-full">{a.content_niche}</span>}
                    {a.referral_code && <span className="text-[11px] bg-surface-elevated border border-border text-primary px-2 py-0.5 rounded-full font-mono">{a.referral_code}</span>}
                    <span className="text-[11px] text-text-muted px-1 py-0.5">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  {a.message && <p className="text-xs text-text-secondary mt-2 leading-relaxed whitespace-pre-wrap">{a.message}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {a.status !== "approved" && (
                    <button onClick={() => patch(a.id, { status: "approved" })} disabled={busyId === a.id} className="text-xs font-medium text-emerald-400 border border-emerald-400/30 rounded-lg px-3 py-1.5 hover:bg-emerald-400/10 transition-colors disabled:opacity-50">✓ Approve</button>
                  )}
                  {a.status !== "declined" && (
                    <button onClick={() => patch(a.id, { status: "declined" })} disabled={busyId === a.id} className="text-xs font-medium text-red-400 border border-red-400/30 rounded-lg px-3 py-1.5 hover:bg-red-400/10 transition-colors disabled:opacity-50">✕ Decline</button>
                  )}
                </div>
              </div>

              {/* Metrics + deliverable tracking (approved collaborators) */}
              {a.status === "approved" && (
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Refs (mo)</p>
                    <p className="text-sm font-semibold text-text-primary">{a.referralsThisMonth}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Refs (total)</p>
                    <p className="text-sm font-semibold text-text-primary">{a.referrals}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Active subs</p>
                    <p className="text-sm font-semibold text-text-primary">{a.activeReferrals}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Est. payout</p>
                    <p className="text-sm font-semibold text-emerald-400">${a.estMonthlyPayout}/mo</p>
                    <p className="text-[10px] text-text-muted">${a.estWeeklyPayout}/wk</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Deliverable</p>
                    <select
                      value={a.deliverable_status}
                      disabled={busyId === a.id}
                      onChange={(e) => patch(a.id, { deliverable_status: e.target.value })}
                      className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary/40 capitalize"
                    >
                      {DELIVERABLES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Admin notes */}
              {a.status === "approved" && (
                <div className="mt-3">
                  <textarea
                    defaultValue={a.notes ?? ""}
                    placeholder="Admin notes (e.g. posted reel on 6/20, link…)"
                    rows={2}
                    onBlur={(e) => { if (e.target.value !== (a.notes ?? "")) patch(a.id, { notes: e.target.value }); }}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-primary/40 resize-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
