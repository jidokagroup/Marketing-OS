import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Shared Anthropic (Claude) client + a structured-output helper.
 *
 * Claude powers Voice DNA analysis, content generation, and QC scoring.
 * We use the Messages API structured-output feature (`output_config.format`)
 * with a hand-written JSON Schema, then validate the result against a zod
 * schema for type-safety at the boundary.
 */

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic();
  }
  return _client;
}

/** Default model. Override with ANTHROPIC_MODEL. */
export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";

type JsonSchema = Record<string, unknown>;

interface StructuredOptions<T> {
  system: string;
  prompt: string;
  /** JSON Schema for the structured response (object, additionalProperties:false). */
  jsonSchema: JsonSchema;
  /** zod schema validated against the parsed JSON. */
  validator: z.ZodType<T>;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Run a single structured-extraction call and return the validated object.
 * Throws if Claude refuses, output is truncated, or validation fails.
 */
export async function generateStructured<T>(
  opts: StructuredOptions<T>,
): Promise<T> {
  const client = getAnthropic();

  const response = await client.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 6000,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
      output_config: {
        format: {
          type: "json_schema",
          schema: opts.jsonSchema,
        },
      },
    },
    { timeout: opts.timeoutMs ?? 90_000, maxRetries: opts.maxRetries ?? 1 },
  );

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to process this content.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude response was truncated (increase max_tokens).");
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Claude returned invalid JSON.");
  }

  return opts.validator.parse(parsed);
}

/** Plain text generation (used for content generation). */
export async function generateText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<string> {
  const client = getAnthropic();
  const response = await client.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 6000,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    },
    { timeout: opts.timeoutMs ?? 90_000, maxRetries: opts.maxRetries ?? 1 },
  );

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to process this content.");
  }

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
