import { UserCog } from "lucide-react";

import { requireUser } from "@/lib/auth";
import {
  asRows,
  currentWeekStart,
  isOpsSchemaMissing,
  opsTable,
  titleCase,
} from "@/lib/marketing-os/operations";
import { EmptyState } from "@/components/empty-state";
import { OpsSchemaNotice } from "@/components/ops-schema-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveTeamCapacityAction } from "./actions";

export const metadata = { title: "Team · Jidoka Marketing Team OS" };

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

type MemberRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ capacity?: string; reason?: string }>;
}) {
  const { capacity, reason } = await searchParams;
  const { user, supabase } = await requireUser();
  const weekStart = currentWeekStart();
  const [capacityResult, membersResult] = await Promise.all([
    opsTable(supabase, "marketing_os_team_capacity")
      .select("id, member_id, member_name, email, role, week_start, planned_hours, allocated_hours, status, notes")
      .eq("owner_id", user.id)
      .eq("week_start", weekStart)
      .order("member_name"),
    opsTable(supabase, "marketing_os_workspace_members")
      .select("id, email, display_name, role, status")
      .eq("owner_id", user.id)
      .order("display_name"),
  ]);

  const schemaMissing = isOpsSchemaMissing(capacityResult.error);
  const capacityRows = schemaMissing
    ? []
    : asRows<CapacityRow>(capacityResult.data);
  const members = asRows<MemberRow>(membersResult.data);
  const planned = capacityRows.reduce(
    (sum, item) => sum + Number(item.planned_hours ?? 0),
    0,
  );
  const allocated = capacityRows.reduce(
    (sum, item) => sum + Number(item.allocated_hours ?? 0),
    0,
  );
  const utilization = planned ? Math.round((allocated / planned) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Track workload, weekly capacity, ownership, and delivery risk for the marketing team."
      />

      {schemaMissing && <OpsSchemaNotice />}

      {!schemaMissing && (
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader>
              <CardTitle>Capacity entry</CardTitle>
              <CardDescription>
                Save planned and allocated hours for the current week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {capacity === "saved" && (
                <p className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                  Capacity saved.
                </p>
              )}
              {capacity === "error" && (
                <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Could not save capacity: {reason ?? "unknown error"}
                </p>
              )}
              <form action={saveTeamCapacityAction} className="space-y-3">
                <input type="hidden" name="return_to" value="/team" />
                <select
                  name="member_id"
                  defaultValue=""
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">New or unlisted team member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name ?? member.email} · {titleCase(member.role)}
                    </option>
                  ))}
                </select>
                <Input name="member_name" placeholder="Name" required />
                <Input name="email" type="email" placeholder="Email" />
                <Input name="role" placeholder="Role" defaultValue="strategist" />
                <Input name="week_start" type="date" defaultValue={weekStart} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    name="planned_hours"
                    type="number"
                    min="0"
                    step="0.25"
                    defaultValue={40}
                    placeholder="Planned hours"
                  />
                  <Input
                    name="allocated_hours"
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="Allocated hours"
                  />
                </div>
                <Textarea name="notes" placeholder="Notes" />
                <Button type="submit" className="w-full">
                  Save capacity
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Metric label="Planned hours" value={planned} />
            <Metric label="Allocated hours" value={allocated} />
            <Metric label="Utilization" value={`${utilization}%`} />
          </div>
        </div>
      )}

      {!schemaMissing && capacityRows.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No capacity entered"
          description="Add weekly capacity for the people doing campaign and content work."
        />
      ) : (
        !schemaMissing && (
          <div className="grid gap-4 lg:grid-cols-2">
            {capacityRows.map((row) => {
              const percent = row.planned_hours
                ? Math.min(
                    140,
                    Math.round((row.allocated_hours / row.planned_hours) * 100),
                  )
                : 0;
              return (
                <Card key={row.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{row.member_name}</CardTitle>
                        <CardDescription>
                          {row.email ?? "No email"} · {titleCase(row.role)}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          row.status === "over_capacity"
                            ? "destructive"
                            : row.status === "near_capacity"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {titleCase(row.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span>{row.allocated_hours} allocated</span>
                      <span>{row.planned_hours} planned</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                    {row.notes && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {row.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}
