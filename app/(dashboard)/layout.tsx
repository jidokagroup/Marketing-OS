import { LogOut } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { LOGIN_DISABLED } from "@/lib/auth-mode";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { HelpChatbot } from "@/components/help-chatbot";
import { MobileNav } from "@/components/mobile-nav";
import { SeatSwitcher } from "@/components/seat-switcher";
import { seatFromCookie } from "@/lib/seat";
import { TimeZoneSync } from "@/components/time-zone-sync";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, supabase } = await requireUser();
  const { data: accounts } = await supabase
    .from("marketing_os_social_accounts")
    .select("platform, status");
  const { data: agents } = await supabase
    .from("marketing_os_writing_agents")
    .select("id, name, client_id, clients:marketing_os_clients(name)")
    .order("updated_at", { ascending: false })
    .limit(50);
  const activeAgents = (agents ?? []).map((agent) => {
    const client = agent.clients as unknown as { name?: string } | { name?: string }[] | null;
    const clientName = Array.isArray(client) ? client[0]?.name : client?.name;
    return {
      id: agent.id,
      name: agent.name,
      clientId: agent.client_id,
      clientName: clientName ?? null,
    };
  });
  const latestAgent = activeAgents[0];
  // Pages reached without seat params in the URL — filter submits, action
  // redirects, detail pages addressed by id — would otherwise show the first
  // seat in this list while rendering another client's records.
  const remembered = await seatFromCookie();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
          <MobileNav />
          <div className="min-w-0 flex-1">
            <SeatSwitcher seats={activeAgents} remembered={remembered.agentId} />
          </div>
          {!LOGIN_DISABLED && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="mr-1 h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
      <HelpChatbot accounts={accounts ?? []} primaryAgentId={latestAgent?.id} />
      <TimeZoneSync />
    </div>
  );
}
