/**
 * Guards a caller-supplied `?next=` path before it is handed to `redirect()`.
 *
 * Anything that could leave this origin is rejected: absolute URLs, and
 * protocol-relative paths like `//evil.com` which a browser resolves as a host
 * rather than a path. Only same-origin paths survive, so a link such as
 * `/login?next=/join` can carry intent through auth without becoming an open
 * redirect.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const path = value.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;

  return path;
}
