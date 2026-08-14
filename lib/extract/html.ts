/**
 * Lightweight web-page text extraction.
 *
 * Deliberately dependency-free: unlike `lib/extract/index.ts` (which lazily
 * requires pdf-parse/mammoth for uploaded assets) this module only ever touches
 * `fetch` and string methods. That keeps it safe to bundle into a standalone
 * Netlify function, where dynamic `require` of optional native deps breaks.
 */

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch a public page and return its readable text. Aborts the underlying
 * request on timeout so a hanging competitor site cannot keep a socket open
 * after we have stopped waiting for it.
 */
export async function fetchPageText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { "user-agent": "JidokaOSBot/1.0 (+content-ingest)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch URL (${res.status})`);
    }
    const body = await res.text();
    return htmlToText(body);
  } finally {
    clearTimeout(timer);
  }
}
