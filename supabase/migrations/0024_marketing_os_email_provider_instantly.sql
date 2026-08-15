-- Adds Instantly as a selectable client email provider (cold outbound
-- sequences, inbox warm-up), alongside the existing options from 0018.

alter table if exists public.marketing_os_email_provider_settings
  drop constraint if exists marketing_os_email_provider_settings_provider_check;

alter table if exists public.marketing_os_email_provider_settings
  add constraint marketing_os_email_provider_settings_provider_check
  check (provider in (
    'mailchimp',
    'google_workspace',
    'resend',
    'custom_smtp',
    'hubspot',
    'klaviyo',
    'activecampaign',
    'constant_contact',
    'instantly',
    'custom_api'
  ));
