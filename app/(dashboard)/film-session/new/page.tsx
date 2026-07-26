import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilmSessionBuilder } from "@/components/film-session-builder";
import { Clapperboard } from "lucide-react";

export const metadata = { title: "New Film Scripts · Jidoka Marketing Team OS" };

export default async function NewFilmSessionPage() {
  const { supabase } = await requireUser();
  const { data: agents } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New Film Scripts"
        description="Batch-generate up to 50 filming scripts across formats, laid out like your reference sessions."
      />
      {!agents || agents.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No agents yet"
          description="Create and analyze a Client Content Agent first so scripts match its voice."
          actionLabel="Go to agents"
          actionHref="/agents"
        />
      ) : (
        <FilmSessionBuilder agents={agents} />
      )}
    </div>
  );
}
