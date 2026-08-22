"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { NAV_ITEMS } from "@/lib/nav";
import { useSeatScopedHref } from "@/components/seat-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MobileNav() {
  const pathname = usePathname();
  const scopedHref = useSeatScopedHref();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open navigation</span>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Jidoka Marketing Team OS</DialogTitle>
        </DialogHeader>
        <nav className="space-y-1">
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
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                    item.section && "ml-2",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
