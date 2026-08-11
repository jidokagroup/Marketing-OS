export async function readJsonResponse<T extends Record<string, unknown>>(
  response: Response,
): Promise<T & { error?: string }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string };

  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    const clean = text.replace(/\s+/g, " ").trim();
    const lower = clean.toLowerCase();
    let error = clean || "Server returned an unreadable response.";

    if (lower.startsWith("<!doctype") || lower.startsWith("<html")) {
      error = [502, 504].includes(response.status)
        ? "The server timed out while generating content. Try fewer channels or shorter notes, then generate again."
        : "The site returned a web page instead of app data. Refresh the page and try again after the latest deploy finishes.";
    } else if (response.status === 413 || lower.includes("request entity too large")) {
      error =
        "The file is too large for this upload path. Try a smaller file or split it into smaller pieces.";
    }

    return { error } as T & { error?: string };
  }
}
