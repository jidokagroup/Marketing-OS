"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { opsTable } from "@/lib/marketing-os/operations";
import { getSiteOriginFromHeaders } from "@/lib/site-url";
import {
  BILLING_TRIAL_DAYS,
  getStripe,
  priceIdForPlan,
  type BillingPlan,
} from "@/lib/stripe";

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

function readPlan(formData: FormData): BillingPlan {
  const plan = String(formData.get("plan") ?? "monthly");
  return plan === "annual" ? "annual" : "monthly";
}

async function findOrCreateCustomerId(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  ownerId: string,
  email: string | undefined,
): Promise<string> {
  const { data } = await opsTable(supabase, "marketing_os_billing_subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const existing = data as SubscriptionRow | null;
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { owner_id: ownerId },
  });

  await opsTable(supabase, "marketing_os_billing_subscriptions").upsert(
    { owner_id: ownerId, stripe_customer_id: customer.id },
    { onConflict: "owner_id" },
  );

  return customer.id;
}

/** Creates a Stripe Checkout session for a new subscription and redirects to it. */
export async function startCheckoutAction(formData: FormData) {
  const { user, supabase } = await requireUser();
  const plan = readPlan(formData);
  const origin = await getSiteOriginFromHeaders();

  const customerId = await findOrCreateCustomerId(supabase, user.id, user.email);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    subscription_data: {
      trial_period_days: BILLING_TRIAL_DAYS,
      metadata: { owner_id: user.id, plan },
    },
    metadata: { owner_id: user.id, plan },
    success_url: `${origin}/settings?tab=billing&checkout=success`,
    cancel_url: `${origin}/settings?tab=billing&checkout=canceled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  redirect(session.url);
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
