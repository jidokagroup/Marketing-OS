"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

export function AgentDetailTabs({
  activeTab,
  children,
}: {
  activeTab: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleValueChange(nextValue: string | number) {
    const nextTab = String(nextValue);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    params.delete("connect");
    params.delete("reason");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange}>
      {children}
    </Tabs>
  );
}
