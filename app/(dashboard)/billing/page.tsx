"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

// ─── Plan definitions ──────────────────────────────────────────────────── //

interface Plan {
  id: string;
  name: string;
  price: number;
  billingNote: string;
  replyLimit: number;
  features: string[];
  popular?: boolean;
  badge?: string;
}

const INDIVIDUAL_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    billingNote: "/ mo",
    replyLimit: 250,
    features: [
      "250 AI replies / month",
      "1 Instagram account",
      "Brand voice editor",
      "Manual review queue",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    billingNote: "/ mo",
    replyLimit: 1000,
    features: [
      "1,000 AI replies / month",
      "2 Instagram accounts",
      "Brand voice editor",
      "Auto-approve rules",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 149,
    billingNote: "/ mo",
    replyLimit: 5000,
    features: [
      "5,000 AI replies / month",
      "5 Instagram accounts",
      "Advanced brand voice",
      "Auto-approve + smart filters",
      "Dedicated support",
    ],
  },
];

const AGENCY_PLANS: Plan[] = [
  {
    id: "agency_starter",
    name: "Agency Starter",
    price: 149,
    billingNote: "/ mo",
    replyLimit: 500,
    features: [
      "500 AI replies / month",
      "Up to 5 client accounts",
      "White-label dashboard",
      "Brand voice per client",
      "Email support",
    ],
    badge: "AGENCY",
  },
  {
    id: "agency_growth",
    name: "Agency Growth",
    price: 299,
    billingNote: "/ mo",
    replyLimit: 2000,
    features: [
      "2,000 AI replies / month",
      "Up to 15 client accounts",
      "White-label dashboard",
      "Auto-approve rules per client",
      "Priority support",
    ],
    popular: true,
    badge: "AGENCY",
  },
  {
    id: "agency_pro",
    name: "Agency Pro",
    price: 599,
    billingNote: "/ mo",
    replyLimit: 10000,
    features: [
      "10,000 AI replies / month",
      "Unlimited client accounts",
      "White-label + custom domain",
      "Advanced analytics",
      "Dedicated account manager",
    ],
    badge: "AGENCY",
  },
];

const ADD_ONS = [
  {
    id: "replies_100",
    name: "100 Extra Replies",
    price: 9,
    desc: "One-time top-up — never miss a comment.",
  },
  {
    id: "replies_500",
    name: "500 Extra Replies",
    price: 39,
    desc: "Best value top-up for busy months.",
    badge: "BEST VALUE",
  },
];

// ─── Component ─────────────────────────────────────────────────────────── //

function BillingContent() {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");

  const [currentPlan, setCurrentPlan] = useState<string>("starter");
  const [hasCustomer, setHasCustomer] = useState(false);
  const [_isPending, _startTransition] = useTransition();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"individual" | "agency">("individual");

  // Load current subscription from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setCurrentPlan(data.plan ?? "starter");
        setHasCustomer(!!data.stripe_customer_id);
      }
    });
  }, []);

  const handleCheckout = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        alert(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        alert(data.error ?? "Could not open billing portal.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const plans = activeTab === "individual" ? INDIVIDUAL_PLANS : AGENCY_PLANS;

  const currentPlanLabel =
    [...INDIVIDUAL_PLANS, ...AGENCY_PLANS].find((p) => p.id === currentPlan)?.name ??
    currentPlan.replace(/_/g, " ");

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Billing</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Choose your plan</h1>
        <p className="text-sm text-text-secondary mt-1">
          Every missed comment is a missed lead. Autom8 pays for itself.
        </p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="bg-primary/10 border border-primary/20 text-primary rounded-xl px-5 py-4 text-sm flex items-center gap-2">
          <span>✓</span> Your plan has been upgraded successfully. Changes take effect immediately.
        </div>
      )}
      {cancelled && (
        <div className="bg-surface-elevated border border-border text-text-secondary rounded-xl px-5 py-4 text-sm">
          Checkout was cancelled. Your plan remains unchanged.
        </div>
      )}

      {/* Current plan strip */}
      <div className="rounded-2xl border border-border bg-surface-elevated px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Current Plan</p>
          <p className="font-semibold text-text-primary capitalize">{currentPlanLabel}</p>
        </div>
        {hasCustomer && (
          <Button variant="secondary" size="sm" onClick={handlePortal} loading={portalLoading}>
            Manage Billing
          </Button>
        )}
      </div>

      {/* Conversion hook */}
      <div className="rounded-2xl border border-primary/10 bg-primary/3 p-5 flex items-start gap-4">
        <span className="text-2xl shrink-0">📈</span>
        <div>
          <p className="text-sm font-bold text-primary mb-1">The math is simple</p>
          <p className="text-sm text-text-secondary">
            If you close just{" "}
            <span className="text-text-primary font-semibold">1 extra client per week</span>{" "}
            from a comment that would have gone unanswered, Autom8 pays for itself — many times over.
          </p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-surface-elevated border border-border rounded-xl p-1 w-fit">
        {(["individual", "agency"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? "bg-primary text-bg"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-5 items-stretch">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPopular = plan.popular;
          const isLoading = loadingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all
                ${isPopular
                  ? "border-accent-purple bg-surface-elevated shadow-[0_0_32px_rgba(131,58,180,0.12)] md:scale-105"
                  : "border-border bg-surface hover:shadow-sm"
                }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent-purple text-white text-[11px] font-bold px-4 py-1 rounded-full tracking-wide whitespace-nowrap">
                  MOST POPULAR
                </div>
              )}
              {plan.badge && !isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-surface-elevated border border-border text-text-muted text-[11px] font-bold px-4 py-1 rounded-full tracking-wide whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-text-primary">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-text-primary">${plan.price}</span>
                  <span className="text-text-muted text-sm pb-1.5">{plan.billingNote}</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {plan.replyLimit.toLocaleString()} replies / month
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-primary mt-0.5 shrink-0 text-xs">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                variant={isCurrent ? "ghost" : isPopular ? "primary" : "secondary"}
                disabled={isCurrent}
                loading={isLoading}
                onClick={isCurrent ? undefined : () => handleCheckout(plan.id)}
                className="w-full"
              >
                {isCurrent ? "Current Plan" : `Get ${plan.name} →`}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Add-ons */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Reply Top-ups</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {ADD_ONS.map((addon) => {
            const isLoading = loadingPlan === addon.id;
            return (
              <div
                key={addon.id}
                className="rounded-2xl border border-border bg-surface p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-text-primary text-sm">{addon.name}</p>
                    {addon.badge && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        {addon.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">{addon.desc}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black text-text-primary mb-2">${addon.price}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isLoading}
                    onClick={() => handleCheckout(addon.id)}
                  >
                    Buy Now
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust signals */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: "🔒", title: "Cancel anytime", desc: "No lock-in. Cancel or switch plans from your dashboard." },
          { icon: "⚡", title: "Instant activation", desc: "Your AI starts replying within minutes of setup." },
          { icon: "💬", title: "14-day free trial", desc: "Try it risk-free. No credit card required to start." },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-surface p-4 text-center">
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-sm font-medium text-text-primary mb-1">{item.title}</p>
            <p className="text-xs text-text-muted">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Custom plan CTA */}
      <p className="text-center text-xs text-text-muted">
        Managing multiple clients or need a custom plan?{" "}
        <Link href="mailto:hello@autom8ig.io" className="text-primary hover:underline">
          Talk to us →
        </Link>
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
