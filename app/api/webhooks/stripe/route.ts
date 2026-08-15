import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { opsTable } from "@/lib/marketing-os/operations";
import { getStripe } from "@/lib/stripe";

// Stripe requires the raw request body to verify the webhook signature, and
// the SDK needs Node's crypto — no edge runtime and no body parsing here.
export const runtime = "nodejs";

type BillingPlan = "monthly" | "annual";

function planFromPriceId(priceId: string | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  return null;
}

async function resolveOwnerId(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const metadataOwnerId = subscription.metadata?.owner_id;
  if (metadataOwnerId) return metadataOwnerId;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const { data } = await opsTable(admin, "marketing_os_billing_subscriptions")
    .select("owner_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as { owner_id: string } | null)?.owner_id ?? null;
}

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
) {
  const ownerId = await resolveOwnerId(admin, subscription);
  if (!ownerId) {
    console.error(
      `Stripe webhook: no owner_id for subscription ${subscription.id} (customer ${
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id
      })`,
    );
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const item = subscription.items.data[0];
  const plan =
    planFromPriceId(item?.price.id) ??
    (subscription.metadata?.plan as BillingPlan | undefined) ??
    null;

  await opsTable(admin, "marketing_os_billing_subscriptions").upsert(
    {
      owner_id: ownerId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan,
      status: subscription.status,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "owner_id" },
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscription(admin, subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscription(admin, subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
