"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { mockUsage } from "@/lib/mock-data";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    period: "/mo",
    features: ["250 AI replies/mo", "1 Instagram account", "Basic brand voice", "Email support"],
    current: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$79",
    period: "/mo",
    features: ["1,000 AI replies/mo", "3 social accounts", "Advanced brand voice", "Priority support", "Smart Scheduler"],
    current: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$199",
    period: "/mo",
    features: ["Unlimited AI replies", "10 social accounts", "Custom AI training", "Dedicated account manager", "Scheduler + Analytics"],
    current: false,
  },
];

const chartData = mockUsage.dailyCounts.map((count, i) => ({
  day: i + 1,
  replies: count,
}));

type MainTab = "account" | "billing" | "data";

export default function AccountSettingsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("account");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState<"confirm" | "offer" | "done">("confirm");
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCancelProceed = () => setCancelStep("offer");
  const handleAcceptOffer = () => setCancelStep("done");
  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    setCancelStep("confirm");
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        alert(data.error ?? "Could not open billing portal. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  const pct = Math.round((mockUsage.repliesUsed / mockUsage.limit) * 100);

  const mainTabs: { id: MainTab; label: string; icon: string }[] = [
    { id: "account", label: "Account", icon: "⚙️" },
    { id: "billing", label: "Billing", icon: "💳" },
    { id: "data", label: "Data Usage", icon: "📊" },
  ];

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Settings</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Account Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your plan, billing, and usage.</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-border">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${mainTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ── ACCOUNT TAB ── */}
      {mainTab === "account" && (
        <div className="space-y-6">
          {/* Plan selector */}
          <Card header={
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Membership Plan</h2>
              <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
                Active
              </span>
            </div>
          }>
            <div className="space-y-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-all
                    ${selectedPlan === plan.id
                      ? "border-primary/40 bg-primary/8 shadow-[0_0_16px_rgba(123,63,242,0.06)]"
                      : "border-border bg-surface hover:border-primary/20"
                    }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text-primary">{plan.name}</p>
                      {plan.current && (
                        <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">CURRENT</span>
                      )}
                    </div>
                    <ul className="space-y-0.5">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs text-text-muted flex items-center gap-1.5">
                          <span className="text-primary">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xl font-bold text-text-primary">{plan.price}</span>
                    <span className="text-xs text-text-muted">{plan.period}</span>
                  </div>
                </button>
              ))}
            </div>
            {selectedPlan !== "starter" && (
              <div className="mt-4 flex justify-end">
                <Button variant="primary" size="md">
                  Upgrade to {plans.find((p) => p.id === selectedPlan)?.name} →
                </Button>
              </div>
            )}
          </Card>

          {/* Danger Zone */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-error">Cancel Subscription</p>
                <p className="text-xs text-text-muted mt-1">
                  You&apos;ll lose access to AI replies, scheduling, and all automation features at the end of your billing period.
                </p>
              </div>
              <button
                onClick={() => { setShowCancelModal(true); setCancelStep("confirm"); }}
                className="shrink-0 text-sm text-error border border-error/20 hover:bg-error/5 transition-colors rounded-xl px-4 py-2 font-medium"
              >
                Cancel Plan
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ── BILLING TAB ── */}
      {mainTab === "billing" && (
        <div className="space-y-6">
          <Card header={<h2 className="text-base font-semibold text-text-primary">Billing Overview</h2>}>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <p className="text-sm text-text-secondary">Next billing date</p>
                <p className="text-sm font-medium text-text-primary">June 9, 2026</p>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <p className="text-sm text-text-secondary">Payment method</p>
                <p className="text-sm font-medium text-text-primary">•••• •••• •••• 4242</p>
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-sm text-text-secondary">Amount</p>
                <p className="text-sm font-medium text-text-primary">$29.00 / month</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-border bg-surface-elevated p-4">
                <p className="text-sm font-semibold text-text-primary mb-1">Update Payment Method</p>
                <p className="text-xs text-text-muted mb-3">Securely update your card or payment details via Stripe.</p>
                <Button variant="secondary" size="sm" onClick={handlePortal} loading={portalLoading}>
                  Update Payment Method →
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-surface-elevated p-4">
                <p className="text-sm font-semibold text-text-primary mb-1">Download Invoices</p>
                <p className="text-xs text-text-muted mb-3">View and download all past invoices from your Stripe billing portal.</p>
                <Button variant="secondary" size="sm" onClick={handlePortal} loading={portalLoading}>
                  View All Invoices →
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">💡</span>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">Need a different plan?</p>
                <p className="text-xs text-text-muted mb-3">Switch to the Account tab to upgrade, or manage everything through the Stripe portal.</p>
                <div className="flex gap-2">
                  <button onClick={() => setMainTab("account")} className="text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors">
                    View Plans
                  </button>
                  <Button variant="ghost" size="sm" onClick={handlePortal} loading={portalLoading}>
                    Manage in Stripe →
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── DATA USAGE TAB ── */}
      {mainTab === "data" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Billing period</p>
              <p className="text-xs text-text-muted mt-0.5">
                <span className="text-text-secondary">{mockUsage.periodStart}</span>
                {" → "}
                <span className="text-text-secondary">{mockUsage.periodEnd}</span>
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={handleRefresh} loading={refreshing}>
              ↻ Refresh
            </Button>
          </div>

          {pct >= 100 && (
            <div className="bg-error/10 border border-error/20 text-error rounded-xl px-5 py-4 text-sm">
              🚫 You&apos;ve reached your reply limit.{" "}
              <button onClick={() => setMainTab("billing")} className="underline font-semibold">Upgrade your plan</button>{" "}
              to continue.
            </div>
          )}
          {pct >= 80 && pct < 100 && (
            <div className="bg-warning/10 border border-warning/20 text-warning rounded-xl px-5 py-4 text-sm">
              ⚠️ You&apos;ve used {pct}% of your replies.{" "}
              <button onClick={() => setMainTab("billing")} className="underline font-semibold">Upgrade now</button>{" "}
              to avoid interruptions.
            </div>
          )}

          <Card>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Replies Used</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-primary">{mockUsage.repliesUsed}</span>
                    <span className="text-text-muted text-lg mb-0.5">/ {mockUsage.limit}</span>
                  </div>
                </div>
                <span className={`text-2xl font-bold ${pct >= 80 ? "text-error" : pct >= 60 ? "text-warning" : "text-primary"}`}>
                  {pct}%
                </span>
              </div>
              <ProgressBar value={pct} showLabel={false} />
            </div>
          </Card>

          <Card header={<h2 className="font-semibold text-sm text-text-secondary">Daily Replies — Last 30 Days</h2>}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={14}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "#242424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="replies" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.replies > 20 ? "#7b3ff2" : "#7b3ff266"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="text-center">
            <button onClick={() => setMainTab("billing")} className="text-xs text-primary border border-primary/30 rounded-lg px-4 py-2 hover:bg-primary/5 transition-colors">
              Need more replies? View plans →
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">

            {cancelStep === "confirm" && (
              <>
                <div className="text-3xl mb-3">😢</div>
                <h2 className="text-lg font-bold text-text-primary mb-2">Are you sure you want to cancel?</h2>
                <p className="text-sm text-text-secondary mb-5">
                  You&apos;ll lose all your AI replies, brand voice settings, and scheduled content. Your account access ends at the next billing cycle.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 border border-border text-text-secondary hover:text-text-primary hover:border-primary/30 transition-colors rounded-xl py-2.5 text-sm font-medium"
                  >
                    Keep My Plan
                  </button>
                  <button
                    onClick={handleCancelProceed}
                    className="flex-1 bg-error/10 border border-error/20 text-error hover:bg-error/20 transition-colors rounded-xl py-2.5 text-sm font-medium"
                  >
                    Continue to Cancel
                  </button>
                </div>
              </>
            )}

            {cancelStep === "offer" && (
              <>
                <div className="text-3xl mb-3">🎁</div>
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  Special Retention Offer
                </div>
                <h2 className="text-lg font-bold text-text-primary mb-2">
                  Stay for <span className="text-primary">50% off</span> your next 30 days
                </h2>
                <p className="text-sm text-text-secondary mb-5">
                  We don&apos;t want to lose you. Keep your plan active for the next 30 days at half the price — no commitment beyond that.
                </p>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5 text-center">
                  <p className="text-xs text-text-muted mb-1">Your next 30 days</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold text-text-muted line-through">$29</span>
                    <span className="text-3xl font-black text-primary">$14.50</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">Then back to regular pricing</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmCancel}
                    className="flex-1 bg-error/10 border border-error/20 text-error hover:bg-error/20 transition-colors rounded-xl py-2.5 text-sm font-medium"
                  >
                    No thanks, cancel
                  </button>
                  <button
                    onClick={handleAcceptOffer}
                    className="flex-1 bg-primary text-white hover:opacity-90 transition-opacity rounded-xl py-2.5 text-sm font-bold"
                  >
                    Accept 50% Off →
                  </button>
                </div>
              </>
            )}

            {cancelStep === "done" && (
              <>
                <div className="text-3xl mb-3">🎉</div>
                <h2 className="text-lg font-bold text-text-primary mb-2">Discount Applied!</h2>
                <p className="text-sm text-text-secondary mb-5">
                  Your next 30 days are 50% off. We&apos;re glad you&apos;re staying — keep growing with Autom8!
                </p>
                <Button variant="primary" className="w-full" onClick={() => { setShowCancelModal(false); setCancelStep("confirm"); }}>
                  Back to Dashboard →
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
