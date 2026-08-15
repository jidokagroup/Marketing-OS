import { headers } from "next/headers";

function cleanOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function configuredOrigin() {
  const jidokaUrl = process.env.JIDOKA_SITE_URL?.trim();
  if (jidokaUrl) return cleanOrigin(jidokaUrl);

  const legacyUrl = process.env.BRKFREE_SITE_URL?.trim();
  if (legacyUrl) return cleanOrigin(legacyUrl);

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return cleanOrigin(configured);

  return null;
}

export function getSiteOrigin(request: Request) {
  return configuredOrigin() ?? cleanOrigin(new URL(request.url).origin);
}

/**
 * Same as getSiteOrigin, for contexts with no Request object (Server
 * Actions). Falls back to the incoming request's own headers.
 */
export async function getSiteOriginFromHeaders() {
  const configured = configuredOrigin();
  if (configured) return configured;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  if (!host) {
    throw new Error("Could not determine site origin: no host header and no JIDOKA_SITE_URL/NEXT_PUBLIC_SITE_URL set");
  }
  return cleanOrigin(`${proto}://${host}`);
}
