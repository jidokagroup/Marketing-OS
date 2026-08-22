"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { TIME_ZONE_COOKIE } from "@/lib/time-format";

function currentCookie() {
  return (
    document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.split("=")[1] ?? ""
  );
}

/**
 * Tells the server which timezone this browser is in.
 *
 * Server rendering otherwise formats every scheduled time in the host's zone —
 * UTC on Netlify — so the Scheduler and the Calendar showed the same post at
 * two different times, and a time typed into a form was read as UTC. The zone
 * goes in a cookie so it is available on the very next server render, and the
 * first page after it changes is refreshed so times stop reading as UTC.
 */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      return;
    }
    if (!zone) return;

    const encoded = encodeURIComponent(zone);
    if (currentCookie() === encoded) return;

    document.cookie = `${TIME_ZONE_COOKIE}=${encoded}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
