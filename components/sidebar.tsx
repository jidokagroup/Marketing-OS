"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/lib/nav";
import { useSeatScopedHref } from "@/components/seat-context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const pathname = usePathname();
  const scopedHref = useSeatScopedHref();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="text-lg font-bold tracking-tight">Jidoka Marketing Team OS</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item, index) => {
          const showSection =
            item.section && item.section !== NAV_ITEMS[index - 1]?.section;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {showSection && (
                <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.section}
                </div>
              )}
              <Link
                href={scopedHref(item.href)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  item.section && "ml-2",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.soon && (
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[9px] uppercase"
                  >
                    Soon
                  </Badge>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
