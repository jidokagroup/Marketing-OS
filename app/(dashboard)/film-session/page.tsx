import Link from "next/link";
import { Clapperboard, Plus, ArrowRight } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Film Scripts · Jidoka Marketing Team OS" };

export default async function FilmSessionsPage() {
  const { supabase } = await requireUser();
  const { data: sessions } = await supabase
    .from("marketing_os_film_sessions")
    .select("id, title, client_name, script_count, created_at, marketing_os_writing_agents(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = sessions ?? [];

  return (
    <div>
      <PageHeader
        title="Film Scripts"
        description="Batch script docs — up to 50 scripts across formats, ready to film and export."
      >
        <ButtonLink href="/film-session/new">
          <Plus className="mr-1 h-4 w-4" /> New Session
        </ButtonLink>
      </PageHeader>

      {list.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No film sessions yet"
          description="Generate a batch of filming scripts across formats, laid out like your reference sessions, and export to Word."
          actionLabel="Create your first session"
          actionHref="/film-session/new"
        />
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const agent = s.marketing_os_writing_agents as unknown as { name: string } | null;
            return (
              <Link key={s.id} href={`/film-session/${s.id}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {agent?.name ?? "—"}
                        {s.client_name ? ` · ${s.client_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{s.script_count} scripts</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
