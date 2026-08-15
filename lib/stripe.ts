import Stripe from "stripe";

/** Server-only Stripe client. Never import this into a Client Component. */
let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _client = new Stripe(key);
  }
  return _client;
}

/** Whether billing is configured enough to show checkout/portal actions. */
export function isBillingConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_ANNUAL,
  );
}

export const BILLING_TRIAL_DAYS = 7;

export type BillingPlan = "monthly" | "annual";

export function priceIdForPlan(plan: BillingPlan): string {
  const priceId =
    plan === "annual"
      ? process.env.STRIPE_PRICE_ANNUAL
      : process.env.STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} is not set`);
  }
  return priceId;
}
