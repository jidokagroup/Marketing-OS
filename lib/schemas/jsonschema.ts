/**
 * Tiny JSON Schema builders for Claude structured outputs.
 *
 * Structured outputs require: object `additionalProperties: false`, and we list
 * every property in `required` (the API supports a fixed shape best). We avoid
 * unsupported constraints (minLength/maximum/etc.) — ranges are described in the
 * prompt instead and enforced by the zod validator after parsing.
 */

type Schema = Record<string, unknown>;

export const str = (description?: string): Schema => ({
  type: "string",
  ...(description ? { description } : {}),
});

/**
 * A string restricted to a fixed set of values.
 *
 * Worth preferring over `str("One of: a, b, c.")` wherever a zod `z.enum`
 * validates the same field: describing the options in prose leaves the model
 * free to answer "Low" or "moderate", which the API happily returns and the
 * zod validator then rejects -- turning a cosmetic drift into a thrown
 * request. Declaring the enum makes the API constrain the output instead.
 */
export const enumStr = (values: readonly string[], description?: string): Schema => ({
  type: "string",
  enum: [...values],
  ...(description ? { description } : {}),
});

export const num = (description?: string): Schema => ({
  type: "number",
  ...(description ? { description } : {}),
});

export const bool = (description?: string): Schema => ({
  type: "boolean",
  ...(description ? { description } : {}),
});

export const arr = (items: Schema, description?: string): Schema => ({
  type: "array",
  items,
  ...(description ? { description } : {}),
});

export const strArr = (description?: string): Schema => arr(str(), description);

/** Object with all properties required and additionalProperties disabled. */
export const obj = (properties: Record<string, Schema>): Schema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
