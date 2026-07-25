import Link from "next/link";
import {
  ChevronRight,
  CreditCard,
  FileText,
  Plug,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  PLATFORM_DEFINITIONS,
  connectionLabel,
} from "@/lib/social/platforms";
import {
  asRows,
  currentWeekStart,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
} from "@/lib/marketing-os/operations";
import { createPlaybookAction, updatePlaybookAction } from "@/app/(dashboard)/playbooks/actions";
import { saveTeamCapacityAction } from "@/app/(dashboard)/team/actions";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
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

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();
  const weekStart = currentWeekStart();
  const [
    { data: accounts },
    { data: latestAgent },
    capacityResult,
    playbooksResult,
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
    opsTable(supabase, "marketing_os_team_capacity")
      .select("id, member_id, member_name, email, role, week_start, planned_hours, allocated_hours, status, notes")
      .eq("owner_id", user.id)
      .eq("week_start", weekStart)
      .order("member_name"),
    opsTable(supabase, "marketing_os_playbooks")
      .select("id, title, category, status, summary, steps, owner_name, last_reviewed_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  const schemaMissing =
    isOpsSchemaMissing(capacityResult.error) ||
    isOpsSchemaMissing(playbooksResult.error);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace connections, billing, team capacity, playbooks, and account details."
      />

      {schemaMissing && <OpsSchemaNotice />}

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
            const canConnect = platform.connectable && !platform.disabled && latestAgent?.id;
            return (
              <div
                key={platform.key}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{platform.label}</p>
                    <Badge
                      variant={
                        platform.disabled
                          ? "outline"
                          : connected
                            ? "default"
                            : "destructive"
                      }
                    >
                      {platform.disabled
                        ? "API setup"
                        : connected
                          ? "Connected"
                          : "Not connected"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {account?.username ??
                      platform.disabledReason ??
                      connectionLabel(platform.key, connected)}
                  </p>
                </div>
                {canConnect ? (
                  <a
                    href={`/api/social/connect?agent_id=${latestAgent.id}&platform=${platform.key}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {connected ? "Reconnect" : "Connect"}
                  </a>
                ) : platform.disabled ? (
                  <span className="text-sm text-muted-foreground">Pending API access</span>
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
            <CreditCard className="h-4 w-4" />
            Billing
          </CardTitle>
          <CardDescription>
            Subscription details for Jidoka Marketing Team OS.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Plan</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Marketing Team OS
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Status</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stripe checkout pending
            </p>
          </div>
        </CardContent>
      </Card>

      {!schemaMissing && (
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
            <form
              action={saveTeamCapacityAction}
              className="grid gap-3 rounded-lg border p-4 lg:grid-cols-6"
            >
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
      )}

      {!schemaMissing && (
        <Card>
          <CardHeader>
            <CardTitle>Playbooks</CardTitle>
            <CardDescription>
              Editable SOPs and operating playbooks for the marketing team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
      )}

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
    </div>
  );
}
