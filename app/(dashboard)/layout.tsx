"use client";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Sidebar, TopNav } from "@/components/layout";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  // Pick up ig_business_id stored during OAuth redirect if user wasn't logged in yet
  useEffect(() => {
    const pending = localStorage.getItem("pending_ig_business_id");
    if (!pending || loading) return;
    localStorage.removeItem("pending_ig_business_id");
    fetch("/api/social/mark-connected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ig_business_id: pending }),
    }).catch(() => {});
  }, [loading]);

  // Attribute a collaborator referral captured at signup (?ref=CODE), once the
  // new account has a session. Fire once, then clear regardless of outcome.
  useEffect(() => {
    if (loading || !user) return;
    const ref = localStorage.getItem("collab_ref");
    if (!ref) return;
    localStorage.removeItem("collab_ref");
    fetch("/api/collab/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {});
  }, [loading, user]);

  const derivedUser = {
    name: loading
      ? ""
      : user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Account",
    email: loading ? "" : user?.email || "",
  };

  return (
    <div className="flex h-[100dvh] bg-bg overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} user={derivedUser} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-4 overscroll-y-contain">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
