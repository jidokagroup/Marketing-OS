export type EmailProviderStatus = "live" | "api_setup" | "planned" | "custom";

export type EmailProviderKey =
  | "mailchimp"
  | "google_workspace"
  | "resend"
  | "custom_smtp"
  | "hubspot"
  | "klaviyo"
  | "activecampaign"
  | "constant_contact"
  | "custom_api";

export interface EmailProviderDefinition {
  key: EmailProviderKey;
  label: string;
  status: EmailProviderStatus;
  connection: string;
  bestFor: string;
  note: string;
}

export const DEFAULT_EMAIL_PROVIDER: EmailProviderKey = "resend";

export const EMAIL_PROVIDER_DEFINITIONS: EmailProviderDefinition[] = [
  {
    key: "mailchimp",
    label: "Mailchimp",
    status: "live",
    connection: "OAuth",
    bestFor: "Newsletter lists, campaigns, and campaign analytics.",
    note: "Use this when a client already runs campaigns from Mailchimp.",
  },
  {
    key: "google_workspace",
    label: "Google Workspace / Gmail",
    status: "api_setup",
    connection: "Google OAuth",
    bestFor: "One-to-one outreach, warm follow-ups, and relationship-based email.",
    note: "Best for lower-volume outreach. Bulk campaigns still need unsubscribe and compliance handling.",
  },
  {
    key: "resend",
    label: "Resend",
    status: "api_setup",
    connection: "API key",
    bestFor: "Transactional emails, simple broadcast sends, and platform-owned sending.",
    note: "Recommended for Jidoka system emails and simple owned-domain sending.",
  },
  {
    key: "custom_smtp",
    label: "PrivateEmail / custom SMTP",
    status: "custom",
    connection: "SMTP credentials",
    bestFor: "Basic send-only email from a custom mailbox.",
    note: "Good for simple sends. Campaign metrics, bounces, and unsubscribes need extra setup.",
  },
  {
    key: "hubspot",
    label: "HubSpot",
    status: "api_setup",
    connection: "OAuth / private app token",
    bestFor: "CRM-linked campaigns, lifecycle emails, forms, and attribution.",
    note: "Best when marketing and sales data already live in HubSpot.",
  },
  {
    key: "klaviyo",
    label: "Klaviyo",
    status: "api_setup",
    connection: "API key / OAuth",
    bestFor: "Ecommerce email, SMS, flows, segments, and revenue attribution.",
    note: "Best for brands that need purchase and flow performance inside Marketing OS.",
  },
  {
    key: "activecampaign",
    label: "ActiveCampaign",
    status: "api_setup",
    connection: "API URL and key",
    bestFor: "Automations, CRM-lite workflows, email campaigns, and lead nurturing.",
    note: "Best for service businesses with automation-heavy follow-up.",
  },
  {
    key: "constant_contact",
    label: "Constant Contact",
    status: "planned",
    connection: "OAuth",
    bestFor: "Newsletter campaigns, contact lists, and small-business email reporting.",
    note: "Prepared as a future provider option.",
  },
  {
    key: "custom_api",
    label: "Other / custom API",
    status: "planned",
    connection: "Custom API",
    bestFor: "Any email platform a client already uses.",
    note: "Use this to document a requested provider before a dedicated connector exists.",
  },
];

export function getEmailProviderDefinition(provider: string | null | undefined) {
  return (
    EMAIL_PROVIDER_DEFINITIONS.find((item) => item.key === provider) ??
    EMAIL_PROVIDER_DEFINITIONS.find((item) => item.key === DEFAULT_EMAIL_PROVIDER)!
  );
}

export function normalizeEmailProvider(provider: string | null | undefined) {
  const value = String(provider ?? "").trim().toLowerCase();
  return getEmailProviderDefinition(value).key;
}

export function emailProviderStatusLabel(status: EmailProviderStatus) {
  switch (status) {
    case "live":
      return "Live connector";
    case "api_setup":
      return "API setup";
    case "custom":
      return "Custom setup";
    case "planned":
      return "Planned";
  }
}
