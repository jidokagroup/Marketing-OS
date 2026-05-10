"use client";
import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { mockUsage } from "@/lib/mock-data";
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
  },
  {
    id: "growth",
    name: "Growth",
    price: "$79",
    period: "/mo",
    features: ["1,000 AI replies/mo", "3 social accounts", "Advanced brand voice", "Priority support", "Smart Scheduler"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$199",
    period: "/mo",
    features: ["Unlimited AI replies", "10 social accounts", "Custom AI training", "Dedicated account manager", "Scheduler + Analytics"],
  },
];

const chartData = mockUsage.dailyCounts.map((count, i) => ({
  day: i + 1,
  replies: count,
}));

const pct = Math.round((mockUsage.repliesUsed / mockUsage.limit) * 100);

type MainTab = "account" | "billing" | "data";

function DemoLock({ label = "Start a free trial to unlock this feature." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      <div className="flex items-center gap-2">
        <span className="text-base">🔒</span>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
      <Link
        href="/signup"
        className="shrink-0 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
      >
        Start Free Trial →
      </Link>
    </div>
  );
}

export default function DemoAccountPage() {
  const [mainTab, setMainTab] = useState<MainTab>("account");
  const [selectedPlan, setSelectedPlan] = useState("starter");

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

      {/* ACCOUNT TAB */}
      {mainTab === "account" && (
        <div className="space-y-6">
          <Card header={
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Membership Plan</h2>
              <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
                Demo
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
                    <p className="text-sm font-semibold text-text-primary mb-1">{plan.name}</p>
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
            <DemoLock label="Start a free trial to select and activate a plan." />
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-error">Cancel Subscription</p>
                <p className="text-xs text-text-muted mt-1">Only available to active subscribers.</p>
              </div>
              <span className="shrink-0 text-sm text-text-muted border border-border rounded-xl px-4 py-2 font-medium opacity-40 cursor-not-allowed">
                Cancel Plan
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* BILLING TAB */}
      {mainTab === "billing" && (
        <div className="space-y-6">
          <Card header={<h2 className="text-base font-semibold text-text-primary">Billing Overview</h2>}>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <p className="text-sm text-text-secondary">Next billing date</p>
                <p className="text-sm font-medium text-text-muted">— (demo)</p>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <p className="text-sm text-text-secondary">Payment method</p>
                <p className="text-sm font-medium text-text-muted">•••• •••• •••• ——</p>
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-sm text-text-secondary">Amount</p>
                <p className="text-sm font-medium text-text-muted">— / month</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-border bg-surface-elevated p-4">
                <p className="text-sm font-semibold text-text-primary mb-1">Update Payment Method</p>
                <p className="text-xs text-text-muted mb-3">Securely update your card or payment details via Stripe.</p>
                <DemoLock label="Start a free trial to manage payment methods." />
              </div>
              <div className="rounded-xl border border-border bg-surface-elevated p-4">
                <p className="text-sm font-semibold text-text-primary mb-1">Download Invoices</p>
                <p className="text-xs text-text-muted mb-3">View and download all past invoices from your Stripe billing portal.</p>
                <DemoLock label="Start a free trial to access your invoice history." />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* DATA USAGE TAB */}
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
            <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
              Simulated Data
            </span>
          </div>

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
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
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
            <Link href="/signup" className="text-xs text-primary border border-primary/30 rounded-lg px-4 py-2 hover:bg-primary/5 transition-colors">
              Start free trial to track your real usage →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
