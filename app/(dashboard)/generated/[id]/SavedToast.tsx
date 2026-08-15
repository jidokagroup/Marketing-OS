"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const VARIANT_LABELS: Record<string, string> = {
  primary: "Short form script",
  long: "Blog post",
  sales: "Email",
};

/** Fires a confirmation toast after a per-tab save, then clears the ?saved= param. */
export function SavedToast({ variant }: { variant?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!variant) return;
    toast.success(`${VARIANT_LABELS[variant] ?? "Content"} saved`);
    router.replace(pathname);
  }, [variant, pathname, router]);

  return null;
}
