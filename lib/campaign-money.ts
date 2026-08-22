/**
 * What a campaign has earned, and what it has only hoped to earn.
 *
 * These are three different numbers that were being mixed. Pipeline is the
 * value of leads that have not closed. Attributed revenue is money the user
 * has recorded against the campaign. Realised revenue is the sum of logged
 * revenue events. A campaign header once showed the first under the heading
 * "Revenue" whenever the third was zero, which reported money that did not
 * exist and disagreed with the Money page for the same campaign.
 *
 * Every surface reads them from here so they cannot drift again.
 */

export type RevenueEventLike = {
  campaign_id?: string | null;
  amount?: number | string | null;
  event_type?: string | null;
};

export type LeadLike = {
  estimated_value?: number | string | null;
  actual_value?: number | string | null;
};

export type CampaignMoneyLike = {
  id: string;
  budget?: number | string | null;
  actual_spend?: number | string | null;
  attributed_revenue?: number | string | null;
};

const REFUND_TYPES = new Set(["refund", "chargeback"]);

function amount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Revenue actually recorded against a campaign: what the user marked as
 * attributed, plus logged events, minus refunds. Never lead estimates.
 */
export function campaignRevenue(
  campaign: CampaignMoneyLike,
  events: RevenueEventLike[],
): number {
  const forCampaign = events.filter(
    (event) => event.campaign_id === campaign.id,
  );
  const earned = forCampaign
    .filter((event) => !REFUND_TYPES.has(event.event_type ?? ""))
    .reduce((sum, event) => sum + amount(event.amount), 0);
  const refunded = forCampaign
    .filter((event) => REFUND_TYPES.has(event.event_type ?? ""))
    .reduce((sum, event) => sum + amount(event.amount), 0);

  return amount(campaign.attributed_revenue) + earned - refunded;
}

/**
 * Open pipeline: what the leads on a campaign are estimated to be worth. A
 * lead's actual value takes over once it has one, because at that point the
 * estimate is superseded rather than additional.
 */
export function campaignPipeline(leads: LeadLike[]): number {
  return leads.reduce(
    (sum, lead) =>
      sum + (amount(lead.actual_value) || amount(lead.estimated_value)),
    0,
  );
}

/** Return on spend. Undefined where there is no spend to divide by. */
export function campaignRoi(
  campaign: CampaignMoneyLike,
  revenue: number,
): number | null {
  const spend = amount(campaign.actual_spend);
  return spend > 0 ? revenue / spend : null;
}

export function formatRoi(roi: number | null): string {
  return roi === null ? "—" : `${roi.toFixed(1)}×`;
}
