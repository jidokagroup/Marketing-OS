"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createCheckoutUrl } from "@/lib/billing/checkout";
import { opsTable } from "@/lib/marketing-os/operations";
import { getSiteOriginFromHeaders } from "@/lib/site-url";
import { getStripe, type BillingPlan } from "@/lib/stripe";

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

function readPlan(formData: FormData): BillingPlan {
  const plan = String(formData.get("plan") ?? "monthly");
  return plan === "annual" ? "annual" : "monthly";
}

/** Creates a Stripe Checkout session for a new subscription and redirects to it. */
export async function startCheckoutAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const origin = await getSiteOriginFromHeaders();

  const url = await createCheckoutUrl({
    supabase,
    user,
    plan: readPlan(formData),
    origin,
  });

  redirect(url);
}

/** Opens the Stripe customer portal for an existing subscriber. */
export async function manageBillingAction() {
  const { user, supabase } = await requireUser();
  const origin = await getSiteOriginFromHeaders();

  const { data } = await opsTable(supabase, "marketing_os_billing_subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  const existing = data as SubscriptionRow | null;
  if (!existing?.stripe_customer_id) {
    throw new Error("No Stripe customer on file yet — start a subscription first.");
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: `${origin}/settings?tab=billing`,
  });

  redirect(session.url);
}
