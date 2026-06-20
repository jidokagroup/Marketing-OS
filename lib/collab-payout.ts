/**
 * Collaborator payout estimation: a percentage of each ACTIVE referred user's
 * monthly subscription. The commission rate is set via COLLAB_COMMISSION_PERCENT
 * (defaults to 20%). Plan prices mirror the pricing page; adjust if they change.
 */

export const COMMISSION_PERCENT = Number(process.env.COLLAB_COMMISSION_PERCENT ?? 20)

// Monthly USD price per plan (from app/pricing/page.tsx). Unknown tiers default
// to 0 so they simply don't contribute until a price is set here.
export const PLAN_PRICES: Record<string, number> = {
  starter: 29,
  growth: 79,
  scale: 199,
  agency_starter: 149,
  agency_growth: 299,
  agency_pro: 599,
}

export interface PayoutSummary {
  activeReferrals: number
  estMonthlyPayout: number
  estWeeklyPayout: number
}

/**
 * For a referral code: count active referred subscriptions and estimate the
 * collaborator's recurring payout (commission % of those subscriptions).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computePayout(svc: any, referralCode: string | null): Promise<PayoutSummary> {
  const empty = { activeReferrals: 0, estMonthlyPayout: 0, estWeeklyPayout: 0 }
  if (!referralCode) return empty

  const { data: refs } = await svc
    .from('collab_referrals')
    .select('referred_user_id')
    .eq('referral_code', referralCode)
  const userIds = (refs ?? []).map((r: { referred_user_id: string | null }) => r.referred_user_id).filter(Boolean)
  if (!userIds.length) return empty

  const { data: subs } = await svc
    .from('subscriptions')
    .select('user_id, plan, status')
    .in('user_id', userIds)
    .in('status', ['active', 'trialing'])

  let monthly = 0
  for (const s of subs ?? []) {
    const price = PLAN_PRICES[s.plan as string] ?? 0
    monthly += price * (COMMISSION_PERCENT / 100)
  }

  return {
    activeReferrals: (subs ?? []).length,
    estMonthlyPayout: Math.round(monthly * 100) / 100,
    estWeeklyPayout: Math.round((monthly / 4.345) * 100) / 100,
  }
}
