import { DatabaseZap } from "lucide-react";

import { OPS_MIGRATION_PATH } from "@/lib/marketing-os/operations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OpsSchemaNotice({
  title = "Marketing OS operations tables are not live yet",
  migrationPath = OPS_MIGRATION_PATH,
}: {
  title?: string;
  migrationPath?: string;
}) {
  return (
    <Card className="border-amber-300 bg-amber-50/60 text-amber-950">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <DatabaseZap className="mt-1 h-5 w-5 shrink-0" />
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-amber-900/80">
            Apply migration <span className="font-mono">{migrationPath}</span>{" "}
            in Supabase to turn on campaigns, work, leads, revenue, playbooks,
            team capacity, and intelligence actions.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-amber-900">
        Existing clients, writing agents, generated content, film sessions,
        scheduler, analytics, inbox, and integrations remain available.
      </CardContent>
    </Card>
  );
}
