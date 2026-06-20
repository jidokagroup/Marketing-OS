"use client";
import { useEffect, useState, useCallback } from "react";

type AdminAccount = {
  id: string;
  created_at: string;
  email: string | null;
  status: "pending" | "approved" | "declined";
  requested_reason: string | null;
  reviewed_at: string | null;
};

type MyStatus = {
  level: "superadmin" | "admin" | null;
  isSuperadmin: boolean;
  request: { status: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  approved: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  declined: "bg-red-400/10 text-red-400 border-red-400/20",
};

export default function AdminAccessPage() {
  const [me, setMe] = useState<MyStatus | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/admin/accounts");
    if (res.ok) setAccounts((await res.json()).data ?? []);
  }, []);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/admin/request");
    const j = await res.json();
    setMe(j);
    if (j.isSuperadmin) loadAccounts();
  }, [loadAccounts]);

  useEffect(() => { loadMe(); }, [loadMe]);

  const submitRequest = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/admin/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      await loadMe();
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (id: string, status: "approved" | "declined") => {
    setBusyId(id);
    try {
      await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await loadAccounts();
    } finally {
      setBusyId(null);
    }
  };

  if (!me) return <div className="p-6 text-sm text-text-muted">Loading…</div>;

  // ── Superadmin: manage requests ─────────────────────────────────────────────
  if (me.isSuperadmin) {
    const pending = accounts.filter((a) => a.status === "pending");
    return (
      <div className="p-4 sm:p-5 md:p-7 max-w-3xl mx-auto space-y-5">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Access control</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Admin Accounts</h1>
          <p className="text-sm text-text-secondary mt-1">Approve who can access the Collab Admin portal. Only you can do this.</p>
        </div>

        {pending.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Pending requests ({pending.length})</p>
            <div className="space-y-2">
              {pending.map((a) => (
                <div key={a.id} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{a.email}</p>
                    {a.requested_reason && <p className="text-xs text-text-secondary mt-1">{a.requested_reason}</p>}
                    <p className="text-[11px] text-text-muted mt-1">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => review(a.id, "approved")} disabled={busyId === a.id} className="text-xs font-medium text-emerald-400 border border-emerald-400/30 rounded-lg px-3 py-1.5 hover:bg-emerald-400/10 disabled:opacity-50">✓ Approve</button>
                    <button onClick={() => review(a.id, "declined")} disabled={busyId === a.id} className="text-xs font-medium text-red-400 border border-red-400/30 rounded-lg px-3 py-1.5 hover:bg-red-400/10 disabled:opacity-50">✕ Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">All admin accounts</p>
          {accounts.length === 0 ? (
            <p className="text-sm text-text-muted py-4">No admin accounts yet.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-surface p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{a.email}</p>
                    <p className="text-[11px] text-text-muted">{a.reviewed_at ? `Reviewed ${new Date(a.reviewed_at).toLocaleDateString()}` : `Requested ${new Date(a.created_at).toLocaleDateString()}`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                    {a.status === "approved" && <button onClick={() => review(a.id, "declined")} disabled={busyId === a.id} className="text-[11px] text-red-400 hover:underline disabled:opacity-50">Revoke</button>}
                    {a.status === "declined" && <button onClick={() => review(a.id, "approved")} disabled={busyId === a.id} className="text-[11px] text-emerald-400 hover:underline disabled:opacity-50">Approve</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Approved admin ──────────────────────────────────────────────────────────
  if (me.level === "admin") {
    return (
      <div className="p-6 max-w-md mx-auto text-center mt-10">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-lg font-semibold text-text-primary mb-1">You&apos;re an approved admin</h1>
        <p className="text-sm text-text-muted">You have access to the Collab Admin portal.</p>
      </div>
    );
  }

  // ── Regular user: request access ────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto mt-8 space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-3">🛡️</div>
        <h1 className="text-lg font-semibold text-text-primary mb-1">Request admin access</h1>
        <p className="text-sm text-text-muted">Admin accounts can manage the Collab Program. Requests are reviewed by the Autom8 owner.</p>
      </div>

      {me.request ? (
        <div className={`rounded-xl border p-4 text-center ${STATUS_STYLES[me.request.status] ?? "border-border"}`}>
          <p className="text-sm font-medium capitalize">Request {me.request.status}</p>
          {me.request.status === "pending" && <p className="text-xs text-text-secondary mt-1">We&apos;ll review your request shortly.</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need admin access? (optional)"
            rows={3}
            className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary/40 resize-none"
          />
          <button
            onClick={submitRequest}
            disabled={submitting}
            className="w-full text-sm font-semibold text-white bg-gradient-to-r from-accent-pink to-accent-purple rounded-lg px-5 py-2.5 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Request access"}
          </button>
        </div>
      )}
    </div>
  );
}
