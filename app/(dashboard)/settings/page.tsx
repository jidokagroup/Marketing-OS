import Link from "next/link";
import {
  Bot,
  ChevronRight,
  CreditCard,
  FileText,
  Mail,
  Plug,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  EMAIL_PROVIDER_DEFINITIONS,
  emailProviderStatusLabel,
  getEmailProviderDefinition,
  normalizeEmailProvider,
} from "@/lib/email-providers";
import {
  PLATFORM_DEFINITIONS,
  connectionLabel,
} from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

// Platform credentials and OAuth for these move to Convia's distribution
// layer under the collaboration — Jidoka's settings page no longer initiates
// the connection for them, it just reflects that they're handled elsewhere.
const CONVIA_MANAGED_PLATFORMS = new Set([
  "instagram",
  "facebook",
  "youtube",
  "x",
  "tiktok",
  "linkedin",
]);
import {
  asRow,
  asRows,
  currentWeekStart,
  formatDate,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
} from "@/lib/marketing-os/operations";
import { saveEmailProviderSettingsAction } from "@/app/(dashboard)/settings/actions";
import {
  manageBillingAction,
  startCheckoutAction,
} from "@/app/(dashboard)/settings/billing-actions";
import { createPlaybookAction, updatePlaybookAction } from "@/app/(dashboard)/playbooks/actions";
import { saveTeamCapacityAction } from "@/app/(dashboard)/team/actions";
import { isBillingConfigured } from "@/lib/stripe";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { UntrainedAgentNotice } from "@/components/untrained-agent-notice";
import { setModeratorSettingAction } from "./moderator-actions";
import { trainedAgentIds } from "@/lib/agent-readiness";
import { PageHeader } from "@/components/page-header";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PlaybookUploadForm } from "@/components/playbook-upload-form";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "Settings · Jidoka Marketing Team OS" };

type AccountRow = {
  id: string;
  agent_id: string | null;
  platform: string;
  username: string | null;
  status: string;
};

type CapacityRow = {
  id: string;
  member_id: string | null;
  member_name: string;
  email: string | null;
  role: string;
  week_start: string;
  planned_hours: number;
  allocated_hours: number;
  status: string;
  notes: string | null;
};

type PlaybookRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  summary: string | null;
  steps: unknown;
  owner_name: string | null;
  last_reviewed_at: string | null;
};

type EmailProviderSettingsRow = {
  id: string;
  provider: string;
  provider_label: string | null;
  status: string;
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  custom_provider_name: string | null;
  notes: string | null;
};

type SubscriptionRow = {
  plan: "monthly" | "annual" | null;
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
};

function readSteps(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (item && typeof item === "object" && "body" in item) {
        return String(item.body);
      }
      return String(item);
    })
    .join("\n");
}

function playbookCategoryOptions() {
  return [
    "strategy",
    "campaign",
    "content",
    "publishing",
    "analytics",
    "client_ops",
    "sales",
    "agency_ops",
  ];
}

/**
 * Tabs that ?tab= may select. Stripe's return, success and cancel URLs all
 * point at ?tab=billing, as does /join when billing is unconfigured, so
 * ignoring the parameter dropped everyone finishing checkout on Connections.
 */
const SETTINGS_TABS = [
  "connections",
  "billing",
  "team",
  "playbooks",
  "automations",
  "account",
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    moderator?: string;
    capacity?: string;
    reason?: string;
  }>;
}) {
  const { tab, moderator, capacity, reason } = await searchParams;
  const activeTab = (SETTINGS_TABS as readonly string[]).includes(tab ?? "")
    ? (tab as string)
    : "connections";
  const { user, supabase } = await requireUser();
  const weekStart = currentWeekStart();
  const [
    { data: accounts },
    { data: latestAgent },
    emailProviderResult,
    capacityResult,
    playbooksResult,
    billingResult,
  ] = await Promise.all([
    supabase
      .from("marketing_os_social_accounts")
      .select("id, agent_id, platform, username, status")
      .eq("owner_id", user.id),
    supabase
      .from("marketing_os_writing_agents")
      .select("id")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    opsTable(supabase, "marketing_os_email_provider_settings")
      .select("id, provider, provider_label, status, from_name, from_email, reply_to_email, custom_provider_name, notes")
      .eq("owner_id", user.id)
      .maybeSingle(),
    opsTable(supabase, "marketing_os_team_capacity")
      .select("id, member_id, member_name, email, role, week_start, planned_hours, allocated_hours, status, notes")
      .eq("owner_id", user.id)
      .eq("week_start", weekStart)
      .order("member_name"),
    opsTable(supabase, "marketing_os_playbooks")
      .select("id, title, category, status, summary, steps, owner_name, last_reviewed_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
    opsTable(supabase, "marketing_os_billing_subscriptions")
      .select("plan, status, current_period_end, trial_end, cancel_at_period_end")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const emailProviderSchemaMissing = isOpsSchemaMissing(emailProviderResult.error);
  const schemaMissing =
    isOpsSchemaMissing(capacityResult.error) ||
    isOpsSchemaMissing(playbooksResult.error);
  const billingSchemaMissing = isOpsSchemaMissing(billingResult.error);
  const subscription = billingSchemaMissing
    ? null
    : asRow<SubscriptionRow>(billingResult.data);
  const billingConfigured = isBillingConfigured();
  const emailProviderSettings = emailProviderSchemaMissing
    ? null
    : asRow<EmailProviderSettingsRow>(emailProviderResult.data);
  const selectedEmailProvider = normalizeEmailProvider(
    emailProviderSettings?.provider,
  );
  const selectedEmailProviderDefinition =
    getEmailProviderDefinition(selectedEmailProvider);
  const selectedEmailProviderLabel =
    emailProviderSettings?.provider_label ??
    selectedEmailProviderDefinition.label;
  const accountList = (accounts ?? []) as AccountRow[];
  const capacityRows = schemaMissing
    ? []
    : asRows<CapacityRow>(capacityResult.data);
  const playbooks = schemaMissing
    ? []
    : asRows<PlaybookRow>(playbooksResult.data);
  const accountByPlatform = new Map(
    accountList.map((account) => [account.platform, account]),
  );

  const { data: moderatorAgentRows } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name, client_id, clients:marketing_os_clients(name)")
    .order("created_at", { ascending: false });
  const moderatorAgents = (moderatorAgentRows ?? []).map((agent) => {
    const client = agent.clients as unknown as { name?: string } | { name?: string }[] | null;
    const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
    return { id: agent.id, name: agent.name, seatName: clientName ?? agent.name };
  });
  const moderatorSettingsResult = await opsTable(
    supabase,
    "marketing_os_inbox_moderator_settings",
  )
    .select("agent_id, enabled, auto_approve_low_risk")
    .eq("owner_id", user.id);
  // Falling back to [] silently was the whole problem: a missing table
  // rendered every seat as switched off, and the save that followed failed
  // just as quietly. The tab now says the table is missing instead.
  const moderatorSchemaMissing = isOpsSchemaMissing(moderatorSettingsResult.error);
  const moderatorSettings = moderatorSchemaMissing
    ? []
    : asRows<{ agent_id: string; enabled: boolean; auto_approve_low_risk: boolean }>(
        moderatorSettingsResult.data,
      );
  const moderatorByAgent = new Map(moderatorSettings.map((row) => [row.agent_id, row]));
  const trainedSeats = await trainedAgentIds(
    supabase,
    moderatorAgents.map((agent) => agent.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Connections, billing, team, playbooks, and account — grouped by tab."
      />

      {schemaMissing && <OpsSchemaNotice />}

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          {!schemaMissing && <TabsTrigger value="team">Team</TabsTrigger>}
          {!schemaMissing && <TabsTrigger value="playbooks">Playbooks</TabsTrigger>}
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Social and marketing accounts available to the scheduler, inbox,
            analytics, and Intelligence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLATFORM_DEFINITIONS.map((platform) => {
            const account = accountByPlatform.get(platform.key);
            const connected = account?.status === "active";
            const isEmailCampaign = platform.key === "mailchimp";
            const isConviaManaged = CONVIA_MANAGED_PLATFORMS.has(platform.key);
            const canConnect =
              !isConviaManaged &&
              platform.connectable &&
              !platform.disabled &&
              latestAgent?.id &&
              (!isEmailCampaign || selectedEmailProvider === "mailchimp");
            const label = isEmailCampaign
              ? "Email Campaign"
              : platform.label;
            return (
              <div
                key={platform.key}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between",
                  isConviaManaged && "opacity-60",
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{label}</p>
                    <Badge
                      variant={
                        isConviaManaged
                          ? "outline"
                          : isEmailCampaign && selectedEmailProvider !== "mailchimp"
                          ? emailProviderSettings?.status === "connected"
                            ? "default"
                            : "outline"
                          : platform.disabled
                          ? "outline"
                          : connected
                            ? "default"
                            : "destructive"
                      }
                    >
                      {isConviaManaged
                        ? connected
                          ? "Connected"
                          : "Not connected"
                        : isEmailCampaign && selectedEmailProvider !== "mailchimp"
                        ? selectedEmailProviderLabel
                        : platform.disabled
                        ? "API setup"
                        : connected
                          ? "Connected"
                          : "Not connected"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isConviaManaged
                      ? "Distribution and OAuth for this platform run through Convia."
                      : isEmailCampaign && selectedEmailProvider !== "mailchimp"
                      ? `${selectedEmailProviderDefinition.connection}. ${selectedEmailProviderDefinition.bestFor}`
                      : account?.username ??
                      platform.disabledReason ??
                      connectionLabel(platform.key, connected)}
                  </p>
                </div>
                {isConviaManaged ? (
                  <span className="text-sm text-muted-foreground">
                    Connect through Convia
                  </span>
                ) : canConnect ? (
                  <a
                    href={`/api/social/connect?agent_id=${latestAgent.id}&platform=${platform.key}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {connected ? "Reconnect" : "Connect"}
                  </a>
                ) : platform.disabled ? (
                  <span className="text-sm text-muted-foreground">Pending API access</span>
                ) : isEmailCampaign && selectedEmailProvider !== "mailchimp" ? (
                  <span className="text-sm text-muted-foreground">
                    Configure below
                  </span>
                ) : !latestAgent?.id ? (
                  <ButtonLink href="/agents" variant="outline" size="sm">
                    Create agent first
                  </ButtonLink>
                ) : (
                  <span className="text-sm text-muted-foreground">Setup needed</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Client Email Provider
          </CardTitle>
          <CardDescription>
            Choose which provider Marketing OS uses for user/client marketing
            emails. Platform emails like signup, billing, and alerts can still
            run through Jidoka&apos;s own Resend setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {emailProviderSchemaMissing && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {/* "the latest migration" was not enough to act on — the table
                  this needs comes from a specific pair of migrations. */}
              This needs the email provider table. Apply{" "}
              <span className="font-mono">
                supabase/migrations/0018_marketing_os_email_provider_settings.sql
              </span>{" "}
              and{" "}
              <span className="font-mono">
                supabase/migrations/0024_marketing_os_email_provider_instantly.sql
              </span>{" "}
              in Supabase, then reload this page.
            </div>
          )}
          <form
            action={saveEmailProviderSettingsAction}
            className="grid gap-4 rounded-lg border p-4 lg:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                name="provider"
                defaultValue={selectedEmailProvider}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EMAIL_PROVIDER_DEFINITIONS.map((provider) => (
                  <option key={provider.key} value={provider.key}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={emailProviderSettings?.status ?? "needs_setup"}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="needs_setup">Needs setup</option>
                <option value="connected">Connected</option>
                <option value="not_connected">Not connected</option>
                <option value="planned">Planned</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from_name">From name</Label>
              <Input
                id="from_name"
                name="from_name"
                defaultValue={emailProviderSettings?.from_name ?? ""}
                placeholder="Jidoka Group"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from_email">From email</Label>
              <Input
                id="from_email"
                name="from_email"
                type="email"
                defaultValue={emailProviderSettings?.from_email ?? ""}
                placeholder="hello@jidokagroup.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply_to_email">Reply-to email</Label>
              <Input
                id="reply_to_email"
                name="reply_to_email"
                type="email"
                defaultValue={emailProviderSettings?.reply_to_email ?? ""}
                placeholder="team@jidokagroup.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom_provider_name">Other provider name</Label>
              <Input
                id="custom_provider_name"
                name="custom_provider_name"
                defaultValue={emailProviderSettings?.custom_provider_name ?? ""}
                placeholder="Only needed for Other / custom API"
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="notes">Setup notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={emailProviderSettings?.notes ?? ""}
                placeholder="API key location, list/audience name, SMTP host, or anything your team needs to finish setup."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
              <p className="text-sm text-muted-foreground">
                Current email campaign provider:{" "}
                <span className="font-medium text-foreground">
                  {selectedEmailProviderLabel}
                </span>
              </p>
              <Button type="submit" disabled={emailProviderSchemaMissing}>
                Save provider
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              All providers
            </p>
            <div className="divide-y rounded-lg border">
              {EMAIL_PROVIDER_DEFINITIONS.map((provider) => (
                <div
                  key={provider.key}
                  className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex shrink-0 items-center gap-2 sm:w-44">
                    <p className="font-medium">{provider.label}</p>
                    <Badge
                      variant={provider.status === "live" ? "default" : "outline"}
                      className="shrink-0"
                    >
                      {emailProviderStatusLabel(provider.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground sm:flex-1">
                    {provider.bestFor}
                  </p>
                  <p className="text-xs text-muted-foreground sm:w-36 sm:shrink-0 sm:text-right">
                    {provider.connection}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
      {billingSchemaMissing && (
        <OpsSchemaNotice title="Billing needs migration 0023" />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </CardTitle>
          <CardDescription>
            Subscription details for Jidoka Marketing Team OS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!billingConfigured ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Stripe checkout pending. Set STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY,
              STRIPE_PRICE_ANNUAL, and STRIPE_WEBHOOK_SECRET to turn on checkout
              and the customer billing portal.
            </div>
          ) : subscription && subscription.status !== "none" ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Plan</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscription.plan === "annual"
                      ? "Annual · $3,267/yr"
                      : "Monthly · $297/mo"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Status</p>
                  <Badge
                    className="mt-1"
                    variant={
                      subscription.status === "active" ||
                      subscription.status === "trialing"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {titleCase(subscription.status)}
                  </Badge>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">
                    {subscription.status === "trialing"
                      ? "Trial ends"
                      : subscription.cancel_at_period_end
                        ? "Cancels"
                        : "Renews"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(
                      subscription.status === "trialing"
                        ? subscription.trial_end
                        : subscription.current_period_end,
                    )}
                  </p>
                </div>
              </div>
              <form action={manageBillingAction}>
                <PendingSubmitButton pendingLabel="Opening billing portal…">
                  Manage billing
                </PendingSubmitButton>
              </form>
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <form
                action={startCheckoutAction}
                className="space-y-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">Monthly</p>
                  <p className="text-sm text-muted-foreground">
                    $297/month, 7-day free trial
                  </p>
                </div>
                <input type="hidden" name="plan" value="monthly" />
                <PendingSubmitButton pendingLabel="Redirecting to Stripe…">
                  Start free trial
                </PendingSubmitButton>
              </form>
              <form
                action={startCheckoutAction}
                className="space-y-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">Annual</p>
                  <p className="text-sm text-muted-foreground">
                    $3,267/year — 1 month free, 7-day free trial
                  </p>
                </div>
                <input type="hidden" name="plan" value="annual" />
                <PendingSubmitButton pendingLabel="Redirecting to Stripe…">
                  Start free trial
                </PendingSubmitButton>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

      {!schemaMissing && (
        <TabsContent value="team" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Team
            </CardTitle>
            <CardDescription>
              Edit weekly workload, owner capacity, and delivery risk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {capacity === "saved" && (
              <p className="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                Capacity saved.
              </p>
            )}
            {capacity === "error" && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Could not save capacity: {reason ?? "unknown error"}
              </p>
            )}
            <form
              action={saveTeamCapacityAction}
              className="grid gap-3 rounded-lg border p-4 lg:grid-cols-6"
            >
              <input type="hidden" name="return_to" value="/settings?tab=team" />
              <Input name="member_name" placeholder="Name" required />
              <Input name="email" type="email" placeholder="Email" />
              <Input name="role" placeholder="Role" defaultValue="strategist" />
              <Input name="week_start" type="date" defaultValue={weekStart} />
              <Input
                name="planned_hours"
                type="number"
                min="0"
                step="0.25"
                defaultValue={40}
                placeholder="Planned"
              />
              <Button type="submit">Add capacity</Button>
              <Textarea
                name="notes"
                placeholder="Notes"
                className="lg:col-span-6"
              />
            </form>

            {capacityRows.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No team capacity entered for this week.
              </p>
            ) : (
              <div className="space-y-3">
                {capacityRows.map((row) => (
                  <form
                    key={row.id}
                    action={saveTeamCapacityAction}
                    className="grid gap-3 rounded-lg border p-4 lg:grid-cols-6"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input
                      type="hidden"
                      name="return_to"
                      value="/settings?tab=team"
                    />
                    <input
                      type="hidden"
                      name="member_id"
                      value={row.member_id ?? ""}
                    />
                    <Input
                      name="member_name"
                      defaultValue={row.member_name}
                      required
                    />
                    <Input
                      name="email"
                      type="email"
                      defaultValue={row.email ?? ""}
                    />
                    <Input name="role" defaultValue={row.role} />
                    <Input
                      name="week_start"
                      type="date"
                      defaultValue={row.week_start}
                    />
                    <Input
                      name="planned_hours"
                      type="number"
                      min="0"
                      step="0.25"
                      defaultValue={row.planned_hours}
                    />
                    <Input
                      name="allocated_hours"
                      type="number"
                      min="0"
                      step="0.25"
                      defaultValue={row.allocated_hours}
                    />
                    <Textarea
                      name="notes"
                      defaultValue={row.notes ?? ""}
                      className="lg:col-span-5"
                    />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{titleCase(row.status)}</Badge>
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      )}

      {!schemaMissing && (
        <TabsContent value="playbooks" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Playbooks</CardTitle>
            <CardDescription>
              Upload, scan, or manually edit SOPs and operating playbooks for
              the marketing team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlaybookUploadForm />

            <form
              action={createPlaybookAction}
              className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_180px_160px_auto]"
            >
              <Input name="title" placeholder="Playbook title" required />
              <select
                name="category"
                className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                {playbookCategoryOptions().map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </select>
              <Input name="owner_name" placeholder="Owner" />
              <Button type="submit">Add playbook</Button>
              <Textarea name="summary" placeholder="Summary" className="lg:col-span-2" />
              <Textarea name="steps" placeholder="Steps, one per line" className="lg:col-span-2" />
            </form>

            {playbooks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No playbooks yet.
              </p>
            ) : (
              <div className="space-y-3">
                {playbooks.map((playbook) => (
                  <form
                    key={playbook.id}
                    action={updatePlaybookAction}
                    className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_180px_160px_140px_auto]"
                  >
                    <input type="hidden" name="id" value={playbook.id} />
                    <Input name="title" defaultValue={playbook.title} required />
                    <select
                      name="category"
                      defaultValue={playbook.category}
                      className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      {playbookCategoryOptions().map((item) => (
                        <option key={item} value={item}>
                          {titleCase(item)}
                        </option>
                      ))}
                    </select>
                    <Input
                      name="owner_name"
                      defaultValue={playbook.owner_name ?? ""}
                      placeholder="Owner"
                    />
                    <select
                      name="status"
                      defaultValue={playbook.status}
                      className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      {["draft", "active", "archived"].map((status) => (
                        <option key={status} value={status}>
                          {titleCase(status)}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="outline">
                      Save
                    </Button>
                    <Textarea
                      name="summary"
                      defaultValue={playbook.summary ?? ""}
                      className="lg:col-span-2"
                    />
                    <Textarea
                      name="steps"
                      defaultValue={readSteps(playbook.steps)}
                      className="lg:col-span-3"
                    />
                    <div className="space-y-2">
                      <Label>Review date</Label>
                      <Input
                        name="last_reviewed_at"
                        type="date"
                        defaultValue={
                          playbook.last_reviewed_at
                            ? playbook.last_reviewed_at.slice(0, 10)
                            : ""
                        }
                      />
                    </div>
                  </form>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>
      )}

        <TabsContent value="automations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Inbox Moderator
              </CardTitle>
              <CardDescription>
                Drafts a reply in the client&rsquo;s voice for every open thread and flags the ones a
                person should read. Nothing is ever sent to a platform automatically &mdash; sending
                still happens from the Inbox.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {moderatorSchemaMissing && (
                <OpsSchemaNotice
                  title="Inbox Moderator settings table is missing"
                  migrationPath="supabase/migrations/0031_marketing_os_performance_intelligence_and_moderator.sql"
                />
              )}
              {moderator === "saved" && (
                <p className="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                  Saved.
                </p>
              )}
              {moderator === "error" && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Could not save: {reason ?? "unknown error"}
                </p>
              )}
              {moderatorSchemaMissing ? null : moderatorAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No seats yet. Add a client and train its agent first.
                </p>
              ) : (
                moderatorAgents.map((agent) => {
                  const setting = moderatorByAgent.get(agent.id);
                  if (!trainedSeats.has(agent.id)) {
                    return (
                      <div key={agent.id} className="space-y-2">
                        <p className="text-sm font-medium">{agent.seatName}</p>
                        <UntrainedAgentNotice
                          agentId={agent.id}
                          what="Every reply the moderator drafts"
                        />
                      </div>
                    );
                  }
                  return (
                    <form
                      key={agent.id}
                      action={setModeratorSettingAction}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <input type="hidden" name="agent_id" value={agent.id} />
                      <span className="text-sm font-medium">{agent.seatName}</span>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            name="enabled"
                            defaultChecked={setting?.enabled ?? false}
                            className="h-4 w-4"
                          />
                          On
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            name="auto_approve_low_risk"
                            defaultChecked={setting?.auto_approve_low_risk ?? false}
                            className="h-4 w-4"
                          />
                          Auto-approve low-risk drafts
                        </label>
                        <Button type="submit" size="sm" variant="outline">
                          Save
                        </Button>
                      </div>
                    </form>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in to your agency workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email ?? ""} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={user.user_metadata?.full_name ?? "-"}
              readOnly
              disabled
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
          <CardDescription>
            Policies for Jidoka Group and Jidoka Marketing Team OS.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y rounded-lg border p-0">
          <Link
            href="/privacy"
            className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 font-medium">Privacy Policy</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/terms"
            className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 font-medium">Terms and Conditions</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
