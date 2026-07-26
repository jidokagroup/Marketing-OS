import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { AgentForm } from "@/components/agent-form";
import { WizardSteps } from "@/components/wizard-steps";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export const metadata = { title: "New Agent · Jidoka Marketing Team OS" };

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { supabase } = await requireUser();
  const { client_id: defaultClientId = "" } = await searchParams;

  const { data: clients } = await supabase
    .from("marketing_os_clients")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New Client Content Agent"
        description="Step 1 of 3 — choose the client this agent belongs to. You'll add assets and run analysis next."
      />
      <WizardSteps current={1} />
      {!clients || clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Create a client first"
          description="Each Client Content Agent belongs to one client so its uploaded files, voice, and knowledge stay separate."
          actionLabel="Create client"
          actionHref="/clients/new"
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <AgentForm clients={clients} defaultClientId={defaultClientId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
