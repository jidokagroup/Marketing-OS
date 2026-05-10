import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUsage } from "@/lib/actions/usage";
import { getBrandProfile } from "@/lib/actions/brand";
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

const REFERRAL_CODE = "REFER26";

const socialShareLinks = (code: string, url: string) => [
  { label: "Text / SMS", icon: "💬", href: `sms:?body=Use my code ${code} on Autom8 to get a free month! ${url}` },
  { label: "Instagram", icon: "📸", href: `https://www.instagram.com/` },
  { label: "Facebook", icon: "📘", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=Use+my+code+${code}+to+get+a+free+month+on+Autom8!` },
  { label: "Messenger", icon: "💬", href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=YOUR_APP_ID` },
  { label: "TikTok", icon: "🎵", href: `https://www.tiktok.com/` },
  { label: "WhatsApp", icon: "🟢", href: `https://wa.me/?text=Use+my+code+${code}+for+a+free+month+on+Autom8%21+${encodeURIComponent(url)}` },
  { label: "LinkedIn", icon: "💼", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
];

const socialAccounts = [
  {
    name: "Instagram",
    icon: "📸",
    status: "live" as const,
    desc: "Comments, DMs & Stories",
    href: "/onboarding",
    cta: "Connect Now",
  },
  {
    name: "TikTok",
    icon: "🎵",
    status: "soon" as const,
    desc: "Comments & DM replies",
    href: null,
    cta: "Coming Soon",
  },
  {
    name: "YouTube",
    icon: "▶️",
    status: "soon" as const,
    desc: "Comment management",
    href: null,
    cta: "Coming Soon",
  },
  {
    name: "X / Twitter",
    icon: "𝕏",
    status: "soon" as const,
    desc: "Mentions & replies",
    href: null,
    cta: "Coming Soon",
  },
  {
    name: "Facebook",
    icon: "📘",
    status: "soon" as const,
    desc: "Comments & Messenger",
    href: null,
    cta: "Coming Soon",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [usage, brand] = await Promise.all([
    user ? getCurrentUsage(user.id).catch(() => null) : null,
    getBrandProfile().catch(() => null),
  ]);

  let reviewCount = 0;
  if (user) {
    const { count } = await supabase
      .from("ai_replies")
      .select(
        "id, comment:comments!inner(social_account:social_accounts!inner(user_id))",
        { count: "exact", head: true }
      )
      .eq("status", "pending")
      .eq("comment.social_account.user_id", user.id);
    reviewCount = count ?? 0;
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined)
    ?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there";

  const usagePct = usage?.percentUsed ?? 0;
  const usedReplies = usage?.used ?? 0;
  const replyLimit = usage?.limit ?? 250;
  const periodStart = usage?.billingPeriodStart
    ? new Date(usage.billingPeriodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  const periodEnd = usage?.billingPeriodEnd
    ? new Date(usage.billingPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const metrics = [
    { title: "Replies Sent", value: String(usedReplies), change: "", changePositive: true },
    { title: "Leads Captured", value: "—", change: "", changePositive: true },
    { title: "Conversion Rate", value: "—", change: "", changePositive: true },
    { title: "Review Queue", value: String(reviewCount), change: "", changePositive: false },
  ];

  const referralUrl = `https://autom8.app/signup?ref=${REFERRAL_CODE}`;
  const shares = socialShareLinks(REFERRAL_CODE, referralUrl);

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Overview</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          Welcome back, {displayName} 👋
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
            {reviewCount > 0
              ? `${reviewCount} comment${reviewCount !== 1 ? "s are" : " is"} waiting in your review queue right now. Every missed comment is a missed lead.`
              : "Connect your Instagram account and start capturing leads with AI replies."}
          </p>
        </div>
        <Link href="/inbox">
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
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all group
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
                    <span className="text-xs text-primary shrink-0 group-hover:translate-x-0.5 transition-transform">
                      {account.cta} →
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-border text-text-muted px-2 py-0.5 rounded-full shrink-0">
                      Coming Soon
                    </span>
                  )}
                </div>
              );

              return isLive ? (
                <Link key={account.name} href={account.href!}>
                  {inner}
                </Link>
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
            <p className="text-xs text-text-muted mt-0.5">{periodStart} → {periodEnd}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{usagePct}%</p>
            <p className="text-xs text-text-muted">{usedReplies} / {replyLimit} replies</p>
          </div>
        </div>
        <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              usagePct >= 80 ? "bg-error" : usagePct >= 60 ? "bg-warning" : "bg-primary shadow-[0_0_8px_rgba(123,63,242,0.4)]"
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        {usagePct >= 60 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-warning">⚠ You&apos;re at {usagePct}% — consider upgrading</p>
            <Link href="/billing" className="text-xs text-primary hover:underline">Upgrade →</Link>
          </div>
        )}
      </Card>

      {/* Referral Section */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent-purple/5 p-6 shadow-[0_0_32px_rgba(123,63,242,0.04)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎁</span>
              <p className="text-base font-bold text-text-primary">Refer a Friend, Get a Free Month</p>
            </div>
            <p className="text-sm text-text-secondary">
              Share your referral code and both of you get rewarded when they sign up.
            </p>
          </div>
          <div className="shrink-0 text-center">
            <div className="rounded-xl border-2 border-primary/30 bg-primary/10 px-6 py-3">
              <p className="text-[10px] text-primary uppercase tracking-widest mb-0.5">Your Code</p>
              <p className="text-2xl font-black text-primary tracking-widest">{REFERRAL_CODE}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-text-muted mb-3">Share via:</p>
        <div className="flex flex-wrap gap-2">
          {shares.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-surface border border-border hover:border-primary/30 hover:bg-primary/5 transition-all rounded-xl px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <span>{s.icon}</span> {s.label}
            </a>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs text-text-muted">
            Referral link:{" "}
            <span className="text-primary font-mono text-[11px]">{referralUrl}</span>
          </p>
        </div>
      </div>

      {/* Recommendations for Improvement */}
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
        <a
          href="mailto:hello@barebranding.site?subject=Autom8 Recommendation for Improvement"
          className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          📩 Send a Recommendation
        </a>
        <p className="text-[11px] text-text-muted mt-3">
          Suggestions are reviewed by the team. Contributors whose ideas are selected may be compensated upon further review and approval.
        </p>
      </div>
    </div>
  );
}
