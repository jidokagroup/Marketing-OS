"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Application = {
  id: string;
  name: string;
  instagram_handle: string;
  status: "pending" | "approved" | "declined" | "paused";
  referral_code: string | null;
  free_month_claimed_at: string | null;
  created_at: string;
};

type BillingStatus = { status: string | null };

export default function CollabDashboardPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [referrals, setReferrals] = useState(0);
  const [referralsThisMonth, setReferralsThisMonth] = useState(0);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, billRes] = await Promise.all([
        fetch("/api/collab/me"),
        fetch("/api/billing/status"),
      ]);
      const me = await meRes.json();
      const bill = await billRes.json().catch(() => ({}));
      setApp(me.application ?? null);
      setReferrals(me.referrals ?? 0);
      setReferralsThisMonth(me.referralsThisMonth ?? 0);
      setBilling({ status: bill.status ?? null });
    } finally {
      setLoading(false);
    }
  }, []);

  const claimFreeMonth = async () => {
    setClaiming(true);
    try {
      const res = await fetch("/api/collab/claim-free-month", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else { setClaiming(false); alert(json.error ?? "Could not start your free month."); }
    } catch {
      setClaiming(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const code = app?.referral_code ?? "";
  const link = typeof window !== "undefined" && code ? `${window.location.origin}/signup?ref=${code}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading…</div>;

  // Not applied yet
  if (!app) {
    return (
      <div className="p-6 max-w-md mx-auto text-center mt-10">
        <div className="text-4xl mb-3">🤝</div>
        <h1 className="text-lg font-semibold text-text-primary mb-1">Join the Collab Program</h1>
        <p className="text-sm text-text-muted mb-5">You haven&apos;t applied yet. Apply to get a free month and your own referral link.</p>
        <Link href="/collab" className="inline-block text-sm font-medium text-white bg-gradient-to-r from-accent-pink to-accent-purple rounded-lg px-5 py-2.5">
          Apply now →
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 md:p-7 max-w-3xl mx-auto space-y-5">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Collab Program</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Your Collaborator Hub</h1>
        <p className="text-sm text-text-secondary mt-1">Welcome, {app.name.split(" ")[0]} — track your referrals and grab your link.</p>
      </div>

      {/* Status banners */}
      {app.status === "pending" && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex gap-2">
          <span className="text-amber-400 shrink-0">⏳</span>
          <p className="text-sm text-text-secondary"><strong className="text-text-primary">Application under review.</strong> We respond within 3–5 business days — check back soon.</p>
        </div>
      )}
      {app.status === "declined" && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 flex gap-2">
          <span className="text-red-400 shrink-0">✕</span>
          <p className="text-sm text-text-secondary">Your application wasn&apos;t approved this round. Feel free to reach out if your audience grows.</p>
        </div>
      )}

      {app.status === "approved" && (
        <>
          {/* Free-month claim / status */}
          {billing && ["trialing", "active"].includes(billing.status ?? "") ? (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 flex gap-2">
              <span className="text-emerald-400 shrink-0">🎉</span>
              <p className="text-sm text-text-secondary">
                <strong className="text-text-primary">Your free month is active.</strong> Enjoy full access — add a card anytime before it ends to keep going without interruption.
              </p>
            </div>
          ) : app.free_month_claimed_at ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex gap-2">
              <span className="text-amber-400 shrink-0">⏰</span>
              <p className="text-sm text-text-secondary">
                <strong className="text-text-primary">Your free month has ended.</strong> Add a card to continue — you&apos;ll be prompted on your next dashboard visit.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-text-primary">Claim your free month</p>
                <p className="text-xs text-text-secondary mt-0.5">Full platform access for 30 days — no credit card required.</p>
              </div>
              <button
                onClick={claimFreeMonth}
                disabled={claiming}
                className="shrink-0 text-sm font-semibold text-white bg-gradient-to-r from-accent-pink to-accent-purple rounded-lg px-5 py-2.5 disabled:opacity-60"
              >
                {claiming ? "Starting…" : "Start free month →"}
              </button>
            </div>
          )}

          {/* Referrals stats — this month + all time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Referrals this month</p>
              <p className="text-2xl font-bold text-text-primary">{referralsThisMonth}</p>
              <p className="text-xs text-text-secondary mt-0.5">since the 1st (UTC)</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Referrals all time</p>
              <p className="text-2xl font-bold text-text-primary">{referrals}</p>
              <p className="text-xs text-text-secondary mt-0.5">total signups from your link</p>
            </div>
          </div>

          {/* Referral link */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Your referral link</p>
              <p className="text-xs text-text-muted">Share it anywhere — every signup is attributed to you.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
              <code className="text-xs text-text-primary truncate flex-1">{link || "Generating…"}</code>
              <button
                onClick={copy}
                disabled={!link}
                className="shrink-0 text-xs font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            {code && (
              <p className="text-xs text-text-muted">
                Referral code: <span className="font-mono text-text-secondary">{code}</span>
              </p>
            )}
          </div>

          {/* What to post */}
          <div className="rounded-xl border border-border bg-surface-elevated p-4">
            <p className="text-sm font-semibold text-text-primary mb-2">Your side of the collab</p>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              <li className="flex gap-2"><span className="text-primary">①</span> Use Autom8 free for a month — no credit card.</li>
              <li className="flex gap-2"><span className="text-primary">②</span> Add your referral link so your audience gets set up — and you get credit.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
