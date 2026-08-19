import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { createCheckoutUrl } from "@/lib/billing/checkout";
import { getSiteOrigin } from "@/lib/site-url";
import { isBillingConfigured, type BillingPlan } from "@/lib/stripe";

/**
 * Public "join the cohort" entry point.
 *
 * One stable URL that the marketing page and the shareable demo can both link
 * to, so neither has to know how checkout is wired. A visitor with a session
 * goes straight to Stripe; one without is sent to sign up and carried back
 * here afterwards via `?next`, which keeps the intent through auth.
 *
 * Checkout must be opened server-side rather than linked to directly: the
 * session has to carry `owner_id` so the webhook can attach the resulting
 * subscription to an account.
 */
export async function GET(request: NextRequest) {
  const origin = getSiteOrigin(request);
  const plan: BillingPlan =
    request.nextUrl.searchParams.get("plan") === "annual" ? "annual" : "monthly";
  const self = `/join${plan === "annual" ? "?plan=annual" : ""}`;

  const context = await getAuthContext();
  if (!context) {
    return NextResponse.redirect(
      new URL(`/signup?next=${encodeURIComponent(self)}`, origin),
    );
  }

  // Without Stripe keys there is nothing to redirect to, and a raw error page
  // is a bad landing spot for someone who just clicked "Join the cohort".
  // Billing settings at least tells them where they stand.
  if (!isBillingConfigured()) {
    return NextResponse.redirect(new URL("/settings?tab=billing", origin));
  }

  try {
    const url = await createCheckoutUrl({
      supabase: context.supabase,
      user: context.user,
      plan,
      origin,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Join checkout failed:", error);
    return NextResponse.redirect(
      new URL("/settings?tab=billing&checkout=error", origin),
    );
  }
}
