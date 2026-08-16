import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";

/**
 * Web-search research pass.
 *
 * Used for platforms with no usable API. TikTok is the case that matters: its
 * Research API is restricted to academic institutions and explicitly excludes
 * commercial use, so there is no official way to read a competitor's TikTok
 * data. Individual TikTok video pages are indexed by search engines and
 * viewable without logging in, so search results carry real signal -- captions,
 * rough engagement numbers, which videos rank.
 *
 * This runs as its own call and returns plain text. It is deliberately NOT
 * folded into the structured scan: that call uses output_config.format, and
 * mixing a server-side search tool into a structured-output request is not a
 * supported combination. The text this returns is appended to the scan's
 * research material instead, which keeps the structured call unchanged.
 *
 * The result is explicitly lower-confidence than API data: search ranking is
 * relevance, not view count, and snippet engagement numbers can be stale. The
 * prompt says so, and the scan is told to label it as such.
 */

// Kept tight on purpose: this runs before the report call inside a Netlify
// background function that the platform kills at ~15 minutes, and a killed
// worker strands its row at `running`. Worst case here is 2 minutes.
const RESEARCH_TIMEOUT_MS = 60_000;
const MAX_SEARCHES = 6;
// Server-side tool loops can pause at ~10 iterations with stop_reason
// "pause_turn"; resume once rather than hanging. Research is supporting
// context, so a partial answer is far better than blowing the time budget.
const MAX_CONTINUATIONS = 1;

type TextBlock = { type: string; text?: string };

export async function researchTikTokAccounts(
  handles: string[],
  clientContext: string,
): Promise<string> {
  if (!handles.length) return "";

  const client = getAnthropic();
  const prompt = [
    clientContext,
    "",
    `Research these TikTok accounts using web search: ${handles
      .map((handle) => `@${handle}`)
      .join(", ")}`,
    "",
    "For each account, search for its top/most-viewed videos and report only what the",
    "search results actually show:",
    "- Which content formats appear to perform best (talking head, voiceover-over-b-roll,",
    "  text-on-screen, skits, tutorials, day-in-the-life)",
    "- Any engagement numbers visible in results, marked as approximate",
    "- Recurring topics, hooks, or series",
    "- Any trending audio the results mention by name",
    "",
    "Rules: report only what you actually find. If searches return nothing usable for an",
    "account, say so plainly for that account -- do not infer or invent execution details.",
    "Never present a guess as an observation. Keep it under 400 words total.",
  ].join("\n");

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: prompt },
  ];

  try {
    let response = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system:
          "You are a competitor research analyst. You report only what your searches " +
          "actually surface, and you state plainly when a search returns nothing useful. " +
          "You never fabricate engagement numbers, audio names, or content details.",
        messages: messages as never,
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES },
        ] as never,
      },
      { timeout: RESEARCH_TIMEOUT_MS, maxRetries: 0 },
    );

    // A paused turn means the server-side search loop hit its iteration cap.
    // Re-send with the assistant turn appended to let it continue.
    for (let i = 0; i < MAX_CONTINUATIONS && response.stop_reason === "pause_turn"; i += 1) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create(
        {
          model: CLAUDE_MODEL,
          max_tokens: 2000,
          messages: messages as never,
          tools: [
            { type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES },
          ] as never,
        },
        { timeout: RESEARCH_TIMEOUT_MS, maxRetries: 0 },
      );
    }

    const text = (response.content as TextBlock[])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!text) return "";

    return (
      "\nTIKTOK WEB-SEARCH FINDINGS (lower confidence than platform API data — " +
      "search ranking reflects relevance, not view count, and any engagement figures " +
      "here are approximate):\n" +
      text
    );
  } catch (error) {
    console.warn(
      "TikTok web research skipped:",
      error instanceof Error ? error.message : error,
    );
    return "";
  }
}
