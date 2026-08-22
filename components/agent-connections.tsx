import { Plug, Trash2 } from "lucide-react";

import { disconnectSocialAction } from "@/app/(dashboard)/agents/[id]/social-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  PLATFORM_DEFINITIONS,
  type PlatformDefinition,
} from "@/lib/social/platforms";
import {
  MARKETING_INTEGRATION_CATEGORIES,
  MARKETING_INTEGRATIONS,
  type MarketingIntegrationStatus,
} from "@/lib/marketing-integrations";
import type { SocialAccount } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function accountFor(
  platform: PlatformDefinition,
  accounts: Pick<SocialAccount, "id" | "platform" | "username" | "status">[],
) {
  return (
    accounts.find(
      (account) => account.platform === platform.key && account.status === "active",
    ) ??
    accounts.find((account) => account.platform === platform.key) ??
    null
  );
}

function setupState(
  platform: PlatformDefinition,
  connected: boolean,
  emailProviderLabel: string,
) {
  if (connected) {
    return {
      label: "Connected now",
      variant: "default" as const,
      description: "Ready for scheduler matching and publishing support.",
    };
  }
  if (platform.key === "tiktok") {
    return {
      label: "API setup",
      variant: "outline" as const,
      description:
        platform.disabledReason ??
        "TikTok uploading and account connection are paused while the API is being set up.",
    };
  }
  if (platform.key === "youtube") {
    return {
      label: "Video-only planning",
      variant: "outline" as const,
      description:
        "Plan YouTube videos only. Shorts can be up to 3 minutes. Long-form defaults to 15 minutes; verified accounts can upload up to 12 hours or 256 GB.",
    };
  }
  if (platform.key === "x") {
    return {
      label: "Image-only planning",
      variant: "outline" as const,
      description: "Jidoka Marketing Team OS keeps X posts image-only until publishing is wired.",
    };
  }
  if (platform.key === "mailchimp") {
    return {
      label: "Email provider",
      variant: "outline" as const,
      description:
        `Email campaigns use ${emailProviderLabel}. Change the provider from Settings when a client uses a different email platform.`,
    };
  }
  if (platform.connectable) {
    return {
      label: "Setup available",
      variant: "outline" as const,
      description: "Connect now from Jidoka Marketing Team OS.",
    };
  }
  return {
    label: "Coming soon",
    variant: "outline" as const,
    description: "Use Jidoka Marketing Team OS for planning until this integration is connected.",
  };
}

function integrationStatusLabel(status: MarketingIntegrationStatus) {
  switch (status) {
    case "live":
      return "Live";
    case "api_setup":
      return "API setup";
    case "manual":
      return "Manual option";
    case "planned":
      return "Planned";
  }
}

function integrationStatusVariant(status: MarketingIntegrationStatus) {
  return status === "live" ? "default" : "outline";
}

export function AgentConnections({
  agentId,
  accounts,
  emailProvider = "resend",
  emailProviderLabel = "Resend",
  emailProviderStatus = "needs_setup",
}: {
  agentId: string;
  accounts: Pick<
    SocialAccount,
    "id" | "platform" | "username" | "status"
  >[];
  emailProvider?: string;
  emailProviderLabel?: string;
  emailProviderStatus?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <h2 className="font-semibold">Connections</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected accounts show a green indicator and are automatically linked
          to Smart Scheduler posts for the same platform. Red means the account
          still needs to be connected before publishing can run.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Connected now", "Setup available", "API setup", "Coming soon"].map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PLATFORM_DEFINITIONS.filter((platform) => platform.scheduler).map((platform) => {
          const account = accountFor(platform, accounts);
          const Icon = platform.icon ?? Plug;
          const isEmailCampaign = platform.key === "mailchimp";
          const emailProviderReady =
            isEmailCampaign &&
            emailProvider !== "mailchimp" &&
            emailProviderStatus === "connected";
          const connected = account?.status === "active" || emailProviderReady;
          const canConnectNow =
            platform.connectable && (!isEmailCampaign || emailProvider === "mailchimp");
          const disabled = Boolean(platform.disabled);
          const state = setupState(platform, connected, emailProviderLabel);

          return (
            <Card key={platform.key} className={disabled ? "opacity-60" : undefined}>
              <CardContent className="space-y-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium">{platform.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account?.username ? `@${account.username}` : platform.note}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      disabled
                        ? "bg-muted-foreground/50"
                        : connected
                          ? "bg-emerald-500"
                          : "bg-red-500"
                    }`}
                    title={disabled ? "API setup" : connected ? "Connected" : "Not connected"}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={disabled ? "outline" : connected ? "default" : "destructive"}
                  >
                    {disabled ? "API setup" : connected ? "Connected" : "Not connected"}
                  </Badge>
                  <Badge variant={state.variant}>{state.label}</Badge>
                  {platform.key === "x" && (
                    <Badge variant="outline">Image-only uploads</Badge>
                  )}
                  {platform.key === "youtube" && (
                    <Badge variant="outline">Video-only uploads</Badge>
                  )}
                  {platform.key === "tiktok" && (
                    <Badge variant="outline">API setup in progress</Badge>
                  )}
                  {isEmailCampaign && (
                    <Badge variant="outline">{emailProviderLabel}</Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{state.description}</p>

                <div className="flex items-center gap-2">
                  {connected && account ? (
                    <form action={disconnectSocialAction}>
                      <input type="hidden" name="id" value={account.id} />
                      <input type="hidden" name="agent_id" value={agentId} />
                      <ConfirmSubmitButton
                        title={`Disconnect ${platform.label}?`}
                        confirmLabel="Disconnect"
                        message={`${platform.label} is unlinked from this agent. Every scheduled post for this account stops publishing until it is reconnected, and analytics for it stop importing.`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Disconnect
                      </ConfirmSubmitButton>
                    </form>
                  ) : canConnectNow && !disabled ? (
                    <a
                      href={`/api/social/connect?agent_id=${agentId}&platform=${platform.key}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <Plug className="mr-1 h-3.5 w-3.5" />
                      Connect
                    </a>
                  ) : isEmailCampaign ? (
                    <ButtonLink href="/settings" variant="outline" size="sm">
                      <Plug className="mr-1 h-3.5 w-3.5" />
                      Edit provider
                    </ButtonLink>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <Plug className="mr-1 h-3.5 w-3.5" />
                      {disabled ? "API setup" : "Setup needed"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Marketing stack integrations</h2>
          <p className="text-sm text-muted-foreground">
            Keep the main scheduler simple, then connect the rest of the
            marketing stack as each API is approved and configured.
          </p>
        </div>

        <div className="mt-4 space-y-5">
          {MARKETING_INTEGRATION_CATEGORIES.map((category) => (
            <section key={category} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {category}
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {MARKETING_INTEGRATIONS.filter(
                  (integration) => integration.category === category,
                ).map((integration) => (
                  <div
                    key={integration.key}
                    className="rounded-md border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{integration.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {integration.summary}
                        </p>
                      </div>
                      <Badge
                        variant={integrationStatusVariant(integration.status)}
                        className="shrink-0"
                      >
                        {integrationStatusLabel(integration.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
