import type { User } from "@supabase/supabase-js";

import { opsTable } from "@/lib/marketing-os/operations";
import {
  BILLING_TRIAL_DAYS,
  getStripe,
  priceIdForPlan,
  type BillingPlan,
} from "@/lib/stripe";

type SubscriptionRow = {
  stripe_customer_id: string | null;
};

/**
 * Stripe customer for an owner, created on first use.
 *
 * The customer id is the join between Stripe and this app: the webhook looks
 * the owner up by `stripe_customer_id`, so a subscription started without one
 * on file cannot be attached to an account. Everything that opens Checkout
 * goes through here for that reason.
 */
async function findOrCreateCustomerId(
  supabase: unknown,
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

/**
 * Opens a Checkout session for a subscription and returns its URL.
 *
 * Shared by the billing settings form and the public `/join` route so the two
 * entry points cannot drift on trial length, metadata or return URLs.
 */
export async function createCheckoutUrl({
  supabase,
  user,
  plan,
  origin,
}: {
  supabase: unknown;
  user: User;
  plan: BillingPlan;
  origin: string;
}): Promise<string> {
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
  return session.url;
}
