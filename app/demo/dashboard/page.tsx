"use client";
import Link from "next/link";
import MetricCard from "@/components/ui/MetricCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { mockActivityFeed } from "@/lib/mock-data";

const activityIcon: Record<string, string> = {
  reply: "💬",
  lead: "🔥",
  inbox: "📬",
  escalation: "⚠️",
};

const metrics = [
  { title: "Replies Sent", value: "1,284", change: "+12% this week", changePositive: true },
  { title: "Leads Captured", value: "94", change: "+8 today", changePositive: true },
  { title: "Conversion Rate", value: "7.3%", change: "+1.2%", changePositive: true },
  { title: "Review Queue", value: "4", change: "needs review", changePositive: false },
];

const usagePct = 68;
const usedReplies = 340;
const replyLimit = 500;

const REFERRAL_CODE = "REFER26";
const TEXT_SUPPORT = "2404101925";
const shares = [
  { label: "Text / SMS", icon: "💬" },
  { label: "Instagram", icon: "📸" },
  { label: "Facebook", icon: "📘" },
  { label: "Messenger", icon: "💬" },
  { label: "TikTok", icon: "🎵" },
  { label: "WhatsApp", icon: "🟢" },
  { label: "LinkedIn", icon: "💼" },
];

const socialAccounts = [
  { name: "Instagram", icon: "📸", status: "live" as const, desc: "Comments, DMs & Stories", href: "/demo/settings", cta: "Connect Now" },
  { name: "TikTok", icon: "🎵", status: "soon" as const, desc: "Comments & DM replies" },
  { name: "YouTube", icon: "▶️", status: "soon" as const, desc: "Comment management" },
  { name: "X / Twitter", icon: "𝕏", status: "soon" as const, desc: "Mentions & replies" },
  { name: "Facebook", icon: "📘", status: "soon" as const, desc: "Comments & Messenger" },
];

export default function DemoDashboardPage() {
  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Overview</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          Welcome back, Demo 👋
        </h1>
        <p className="text-sm text-text-secondary mt-1">Here&apos;s what&apos;s happening with your Autom8.</p>
      </div>

      {/* Revenue Impact Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_24px_rgba(123,63,242,0.06)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary text-lg">📈</span>
            <p className="text-sm font-bold text-primary">Revenue Opportunity Detected</p>
          </div>
          <p className="text-sm text-text-primary font-medium">
            You&apos;re leaving <span className="text-primary font-bold">~32% of leads</span> unreplied.
          </p>
          <p className="text-xs text-text-secondary mt-1">
            4 comments are waiting in your review queue right now. Every missed comment is a missed lead.
          </p>
        </div>
        <Link href="/demo/inbox">
          <Button variant="primary" size="md" className="shrink-0">Review Now →</Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <MetricCard key={m.title} {...m} highlight={i === 0} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Connect Accounts */}
        <Card header={<h2 className="text-base font-semibold text-text-primary">Connect Accounts</h2>}>
          <div className="space-y-2.5">
            {socialAccounts.map((account) => {
              const isLive = account.status === "live";
              const inner = (
                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all group
                  ${isLive
                    ? "border-border hover:border-primary/30 hover:bg-primary/3 cursor-pointer"
                    : "border-border bg-surface/50 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <span className="text-xl shrink-0">{account.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isLive ? "text-text-primary group-hover:text-white transition-colors" : "text-text-muted"}`}>
                      {account.name}
                    </p>
                    <p className="text-xs text-text-muted truncate">{account.desc}</p>
                  </div>
                  {isLive ? (
                    <span className="text-xs text-primary shrink-0 group-hover:translate-x-0.5 transition-transform">{account.cta} →</span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-border text-text-muted px-2 py-0.5 rounded-full shrink-0">Coming Soon</span>
                  )}
                </div>
              );
              return isLive ? (
                <Link key={account.name} href={account.href!}>{inner}</Link>
              ) : (
                <div key={account.name}>{inner}</div>
              );
            })}
          </div>
        </Card>

        {/* Activity Feed */}
        <Card header={<h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>}>
          <div className="space-y-3">
            {mockActivityFeed.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{activityIcon[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary leading-relaxed">{item.text}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Usage bar */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Reply Usage This Month</p>
            <p className="text-xs text-text-muted mt-0.5">May 1 → May 31</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{usagePct}%</p>
            <p className="text-xs text-text-muted">{usedReplies} / {replyLimit} replies</p>
          </div>
        </div>
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(123,63,242,0.4)] transition-all duration-700" style={{ width: `${usagePct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-warning">⚠ You&apos;re at {usagePct}% — consider upgrading</p>
          <Link href="/signup" className="text-xs text-primary hover:underline">Upgrade →</Link>
        </div>
      </Card>

      {/* Referral Section */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent-purple/5 p-6 shadow-[0_0_32px_rgba(123,63,242,0.04)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎁</span>
              <p className="text-base font-bold text-text-primary">Refer a Friend, Get a Free Month</p>
            </div>
            <p className="text-sm text-text-secondary">Share your referral code and both of you get rewarded when they sign up.</p>
          </div>
          <div className="shrink-0 text-center">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/10 px-6 py-3">
              <p className="text-[10px] text-primary uppercase tracking-widest mb-0.5">Your Code</p>
              <p className="text-2xl font-black text-primary tracking-widest">{REFERRAL_CODE}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-text-muted mb-3">Share via:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {shares.map((s) => (
            <span key={s.label}
              className="flex items-center gap-1.5 bg-surface border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-muted opacity-50 cursor-not-allowed select-none">
              <span>{s.icon}</span> {s.label}
            </span>
          ))}
        </div>
        {/* Lock CTA */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <p className="text-sm text-text-secondary"><span className="font-semibold text-text-primary">Start a free trial</span> to get your referral code and share links.</p>
          </div>
          <Link href="/signup" className="shrink-0 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
            Start Free Trial →
          </Link>
        </div>
      </div>

      {/* Recommendations — locked */}
      <div className="rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="flex items-start gap-4 mb-5">
          <span className="text-3xl shrink-0">💡</span>
          <div>
            <p className="text-base font-bold text-text-primary mb-1">Help Us Build What You Need</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Autom8&apos;s goal is continuous evolution. If you have a suggestion, we want to hear it — and we&apos;ll build it together. We&apos;re web3-inspired: if your recommendation gets approved and built, you can be compensated for your contribution.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <p className="text-sm text-text-secondary"><span className="font-semibold text-text-primary">Start a free trial</span> to send us your recommendations.</p>
          </div>
          <Link href="/signup" className="shrink-0 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
            Start Free Trial →
          </Link>
        </div>
      </div>
    </div>
  );
}
