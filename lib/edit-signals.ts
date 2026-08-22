/**
 * Reading a person's edit for what it says about the client's voice.
 *
 * The most reliable signal in the product is somebody deleting a sentence the
 * agent wrote. It happens dozens of times a week and, until now, told the
 * system nothing — the same phrase came back in the next draft and got struck
 * out again.
 *
 * What this deliberately does not do is infer the rule. Guessing "they hate
 * questions" from one edit and writing that into the Brand Brain would put a
 * fabricated preference in front of a client under the system's name. It
 * reports what observably changed — words that were there and now are not —
 * and a person decides whether that is a preference worth keeping.
 */

/** Words too common to be a preference. Removing "the" says nothing. */
const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","been","but","by","can","did","do","does",
  "for","from","get","got","had","has","have","he","her","here","him","his","how",
  "i","if","in","into","is","it","its","just","me","more","most","my","no","not",
  "of","on","one","or","our","out","over","own","she","so","some","such","than",
  "that","the","their","them","then","there","these","they","this","those","to",
  "too","up","us","very","was","we","were","what","when","where","which","while",
  "who","why","will","with","you","your","yours","am","being","because","about",
  "after","again","all","also","any","before","below","between","both","during",
  "each","few","further","once","only","other","same","should","through","under",
  "until","would","could","its","dont","doesnt",
]);

/** An edit smaller than this is a typo fix, not a preference. */
const MIN_CHANGED_CHARS = 40;
const MIN_CHANGED_RATIO = 0.08;

function terms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^['-]+|['-]+$/g, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function countTerms(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const term of terms(text)) counts.set(term, (counts.get(term) ?? 0) + 1);
  return counts;
}

/**
 * Rough size of the change.
 *
 * A character-level diff would be more precise and is not worth it: the only
 * question being asked is "is this a rewrite or a typo", and length plus
 * vocabulary turnover answers that well enough to decide whether to interrupt
 * somebody with a question.
 */
function changedChars(before: string, after: string): number {
  const a = before.trim();
  const b = after.trim();
  if (a === b) return 0;

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return Math.max(a.length, b.length) - prefix - suffix;
}

export type EditSignal = {
  meaningful: boolean;
  /** Words the writer used that the person took out entirely. */
  removedTerms: string[];
  /** Words the person put in that the writer had not used. */
  addedTerms: string[];
  changedChars: number;
};

export function describeEdit(before: string, after: string, limit = 5): EditSignal {
  const changed = changedChars(before, after);
  const scale = Math.max(before.trim().length, 1);
  const meaningful = changed >= MIN_CHANGED_CHARS || changed / scale >= MIN_CHANGED_RATIO;

  const beforeCounts = countTerms(before);
  const afterCounts = countTerms(after);

  const rank = (source: Map<string, number>, other: Map<string, number>) =>
    [...source.entries()]
      .filter(([term]) => !other.has(term))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term]) => term);

  return {
    meaningful: meaningful && changed > 0,
    removedTerms: rank(beforeCounts, afterCounts),
    addedTerms: rank(afterCounts, beforeCounts),
    changedChars: changed,
  };
}

/** The statement offered for the person to accept, reject or rewrite. */
export function suggestedStatement(signal: EditSignal): string | null {
  if (signal.removedTerms.length === 0) return null;
  const list = signal.removedTerms.slice(0, 4);
  const readable =
    list.length === 1
      ? `"${list[0]}"`
      : `${list.slice(0, -1).map((term) => `"${term}"`).join(", ")} or "${list[list.length - 1]}"`;
  return `Do not use ${readable}.`;
}

/**
 * Packs the signal into a redirect so the prompt survives the round trip.
 *
 * Kept in the URL rather than a table because it is a question, not a record:
 * if the person navigates away without answering, the right outcome is that it
 * is gone.
 */
export function encodeEditSignal(signal: EditSignal): string {
  return signal.removedTerms.join(",");
}

export function decodeEditSignal(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((term) => term.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5);
}
