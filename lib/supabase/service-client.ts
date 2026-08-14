import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import ws from "ws";

import type { Database } from "./types";

/**
 * Service-role Supabase client for standalone Netlify functions.
 *
 * `createClient` builds a Realtime client eagerly, and since supabase-js v2.10x
 * that constructor throws outright when it cannot find a WebSocket:
 *
 *   "Node.js 20 detected without native WebSocket support."
 *
 * Netlify pins the functions runtime independently of the build, so we cannot
 * rely on it being new enough to provide a global `WebSocket`. Passing `ws`
 * explicitly makes the client work on any Node version — the transport is never
 * actually used here, since these functions only issue REST queries.
 *
 * SERVER-ONLY. Uses the service-role key, so it BYPASSES Row Level Security;
 * callers must scope their own queries (see AGENTS.md).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service-role credentials are not configured");
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as WebSocketLikeConstructor },
  });
}
