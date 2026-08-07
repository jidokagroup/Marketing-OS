export type MarketingIntegrationStatus =
  | "live"
  | "api_setup"
  | "planned"
  | "manual";

export interface MarketingIntegration {
  key: string;
  name: string;
  category: string;
  status: MarketingIntegrationStatus;
  summary: string;
}

export const MARKETING_INTEGRATIONS: MarketingIntegration[] = [
  {
    key: "instagram",
    name: "Instagram",
    category: "Social publishing",
    status: "live",
    summary: "Meta OAuth, account status, scheduler planning, analytics, and comment-to-DM workflows.",
  },
  {
    key: "facebook",
    name: "Facebook",
    category: "Social publishing",
    status: "live",
    summary: "Meta OAuth, page selection, scheduler planning, account status, and analytics.",
  },
  {
    key: "youtube",
    name: "YouTube",
    category: "Social publishing",
    status: "live",
    summary: "Google OAuth, video-only scheduling support, channel connection, and analytics backfill.",
  },
  {
    key: "x",
    name: "X",
    category: "Social publishing",
    status: "live",
    summary: "OAuth setup, profile connection, image-only planning, and analytics where the app has API access.",
  },
  {
    key: "tiktok",
    name: "TikTok",
    category: "Social publishing",
    status: "api_setup",
    summary: "Prepared for Content Posting API approval and account connection once app review is complete.",
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    category: "Social publishing",
    status: "planned",
    summary: "Planned for company page publishing, lead-gen content, and analytics.",
  },
  {
    key: "pinterest",
    name: "Pinterest",
    category: "Social publishing",
    status: "planned",
    summary: "Planned for pin scheduling, board tracking, and creative performance.",
  },
  {
    key: "mailchimp",
    name: "Mailchimp",
    category: "Email and SMS",
    status: "live",
    summary: "Selectable email provider with OAuth connection, audience/campaign performance, and email campaign draft planning.",
  },
  {
    key: "google-workspace",
    name: "Google Workspace / Gmail",
    category: "Email and SMS",
    status: "api_setup",
    summary: "Provider option for one-to-one outreach, warm follow-ups, drafts, and Gmail-based sending.",
  },
  {
    key: "resend",
    name: "Resend",
    category: "Email and SMS",
    status: "api_setup",
    summary: "Provider option for transactional email, simple broadcasts, and Jidoka-owned domain sending.",
  },
  {
    key: "custom-smtp",
    name: "PrivateEmail / custom SMTP",
    category: "Email and SMS",
    status: "manual",
    summary: "Provider option for send-only custom mailbox setup through SMTP credentials.",
  },
  {
    key: "klaviyo",
    name: "Klaviyo",
    category: "Email and SMS",
    status: "api_setup",
    summary: "API-key setup for ecommerce email/SMS audiences, flows, campaigns, and revenue reporting.",
  },
  {
    key: "activecampaign",
    name: "ActiveCampaign",
    category: "Email and SMS",
    status: "api_setup",
    summary: "API setup for contacts, automations, campaigns, and CRM activity.",
  },
  {
    key: "constant-contact",
    name: "Constant Contact",
    category: "Email and SMS",
    status: "planned",
    summary: "Planned for campaign drafts, contact lists, and email performance.",
  },
  {
    key: "custom-email-api",
    name: "Other / custom API",
    category: "Email and SMS",
    status: "planned",
    summary: "Placeholder for client-requested email providers that need a custom connector.",
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "CRM and leads",
    status: "api_setup",
    summary: "OAuth/API setup for contacts, companies, deals, forms, lists, emails, and attribution.",
  },
  {
    key: "salesforce",
    name: "Salesforce",
    category: "CRM and leads",
    status: "api_setup",
    summary: "API setup for lead, contact, account, and campaign sync.",
  },
  {
    key: "marketo",
    name: "Marketo",
    category: "CRM and leads",
    status: "planned",
    summary: "Planned for enterprise campaign, list, and lead program data.",
  },
  {
    key: "meta-ads",
    name: "Meta Ads",
    category: "Ads",
    status: "api_setup",
    summary: "Prepared for ad account reporting, creative insights, campaign status, and spend tracking.",
  },
  {
    key: "google-ads",
    name: "Google Ads",
    category: "Ads",
    status: "api_setup",
    summary: "API setup for campaign reporting, keywords, spend, conversions, and search trend signals.",
  },
  {
    key: "tiktok-ads",
    name: "TikTok Ads",
    category: "Ads",
    status: "planned",
    summary: "Planned for campaign performance, creative insights, and spend reporting.",
  },
  {
    key: "linkedin-ads",
    name: "LinkedIn Ads",
    category: "Ads",
    status: "planned",
    summary: "Planned for B2B campaign reporting and lead-gen form performance.",
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    category: "Analytics",
    status: "api_setup",
    summary: "API setup for web traffic, conversions, campaign attribution, and audience insights.",
  },
  {
    key: "search-console",
    name: "Google Search Console",
    category: "Analytics",
    status: "api_setup",
    summary: "API setup for SEO queries, pages, impressions, clicks, and content opportunities.",
  },
  {
    key: "looker-studio",
    name: "Looker Studio",
    category: "Analytics",
    status: "manual",
    summary: "Can be supported through reports, exports, or connected source data.",
  },
  {
    key: "segment",
    name: "Segment",
    category: "Analytics",
    status: "planned",
    summary: "Planned for event routing and unified customer activity data.",
  },
  {
    key: "shopify",
    name: "Shopify",
    category: "Commerce",
    status: "api_setup",
    summary: "API setup for products, collections, orders, customer segments, and campaign revenue.",
  },
  {
    key: "woocommerce",
    name: "WooCommerce",
    category: "Commerce",
    status: "api_setup",
    summary: "API setup for product, order, customer, and revenue performance data.",
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "Commerce",
    status: "api_setup",
    summary: "API setup for payments, subscriptions, customers, and revenue reporting.",
  },
  {
    key: "zapier",
    name: "Zapier",
    category: "Workflow",
    status: "manual",
    summary: "Useful for no-code handoffs until a direct integration is built.",
  },
  {
    key: "make",
    name: "Make",
    category: "Workflow",
    status: "manual",
    summary: "Useful for visual automations, webhooks, and interim API connections.",
  },
  {
    key: "airtable",
    name: "Airtable",
    category: "Workflow",
    status: "api_setup",
    summary: "API setup for content calendars, approval trackers, campaign data, and client records.",
  },
  {
    key: "notion",
    name: "Notion",
    category: "Workflow",
    status: "api_setup",
    summary: "API setup for docs, content boards, client notes, and SOP libraries.",
  },
  {
    key: "slack",
    name: "Slack",
    category: "Workflow",
    status: "api_setup",
    summary: "API setup for approval alerts, disconnected-account notices, and workflow updates.",
  },
];

export const MARKETING_INTEGRATION_CATEGORIES = Array.from(
  new Set(MARKETING_INTEGRATIONS.map((item) => item.category)),
);
