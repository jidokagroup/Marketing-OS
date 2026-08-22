/**
 * Reads a platform's analytics export into rows this app can store.
 *
 * Not every platform hands its history over an API — TikTok and LinkedIn have
 * no importer here at all, a YouTube project can have the Data API switched
 * off, and older posts fall outside what the APIs will return anyway. Every
 * one of those leaves a seat permanently "awaiting analytics", which in turn
 * blocks best-time guidance and Performance Intelligence. A CSV export is the
 * one route out that does not depend on anyone's API access.
 *
 * Exports are messy in predictable ways, so this is deliberately forgiving
 * about column names and strict about what it will store: a row without a
 * usable date, or with no metric at all, is reported rather than saved as
 * zeroes that would quietly drag every average down.
 */

export type ParsedAnalyticsRow = {
  /** 1-based line in the file, so an error can name where to look. */
  line: number;
  postedAt: string;
  postId: string | null;
  caption: string | null;
  mediaType: string | null;
  views: number;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

export type AnalyticsCsvError = { line: number; reason: string };

export type AnalyticsCsvResult = {
  headers: string[];
  rows: ParsedAnalyticsRow[];
  errors: AnalyticsCsvError[];
  /** Header names that were present but not understood. */
  ignoredColumns: string[];
};

/**
 * Header aliases, lowercased with punctuation and spacing stripped. Drawn from
 * what Instagram, TikTok, YouTube Studio, X and LinkedIn actually export, so a
 * user can upload the file as downloaded rather than reformatting it first.
 */
type ColumnField =
  | "postedAt"
  | "postId"
  | "caption"
  | "mediaType"
  | (typeof METRIC_FIELDS)[number];

const COLUMN_ALIASES: Record<ColumnField, string[]> = {
  postedAt: [
    "date",
    "time",
    "posted",
    "postedat",
    "posttime",
    "publishtime",
    "publishdate",
    "datepublished",
    "dateposted",
    "createdat",
    "videopublishtime",
  ],
  postId: ["postid", "id", "permalink", "url", "link", "postlink", "videolink", "content"],
  caption: ["caption", "title", "description", "posttitle", "videotitle", "text", "posttext"],
  mediaType: ["mediatype", "type", "format", "posttype", "contenttype"],
  views: ["views", "videoviews", "plays", "videoplays", "watches"],
  impressions: ["impressions", "postimpressions"],
  reach: ["reach", "accountsreached", "uniqueviewers", "uniqueviews"],
  likes: ["likes", "reactions", "totalreactions", "favorites", "hearts", "likesadded"],
  comments: ["comments", "replies", "totalcomments", "commentsadded"],
  shares: ["shares", "reposts", "retweets", "sends", "sharesadded"],
  saves: ["saves", "bookmarks", "saved"],
};

const METRIC_FIELDS = [
  "views",
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
] as const;

/** Strips everything that varies between exports of the same column. */
function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * A real CSV reader rather than `split(",")`: captions contain commas,
 * quotes and newlines, and splitting on commas turns one post into six
 * unusable rows.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Strip a BOM, which Excel writes and which otherwise corrupts the first
  // header name so no column matches.
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Treat \r\n as one break rather than an empty row between every line.
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

function toNumber(value: string | undefined): number {
  if (value === undefined) return 0;
  // Exports carry thousands separators, currency-style spacing, and "1.2K".
  const clean = value.trim().replace(/[,\s]/g, "");
  if (!clean) return 0;

  const scaled = clean.match(/^([\d.]+)([km])$/i);
  if (scaled) {
    const base = Number(scaled[1]);
    if (!Number.isFinite(base)) return 0;
    return Math.round(base * (scaled[2].toLowerCase() === "k" ? 1_000 : 1_000_000));
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

/**
 * Accepts what exports actually write. `DD/MM/YYYY` is deliberately not
 * guessed at: it is indistinguishable from `MM/DD/YYYY` for the first twelve
 * days of a month, and silently importing half a year of posts against the
 * wrong dates is worse than refusing the row.
 */
function toDate(value: string | undefined): string | null {
  const clean = (value ?? "").trim();
  if (!clean) return null;

  // ISO-ish: 2026-08-22, 2026-08-22 14:00, 2026-08-22T14:00:00Z
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = iso;
    const date = new Date(
      Date.UTC(+year, +month - 1, +day, +hour, +minute, +second),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // US style, which is what most consumer exports use.
  const us = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (us) {
    const [, month, day, year, hour = "0", minute = "0"] = us;
    if (+month > 12) return null;
    const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

export function parseAnalyticsCsv(text: string): AnalyticsCsvResult {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { headers: [], rows: [], errors: [{ line: 1, reason: "The file is empty." }], ignoredColumns: [] };
  }

  const headers = table[0].map((header) => header.trim());
  const index: Partial<Record<keyof typeof COLUMN_ALIASES, number>> = {};
  const matched = new Set<number>();

  headers.forEach((header, column) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      const key = field as keyof typeof COLUMN_ALIASES;
      if (index[key] !== undefined) continue;
      if (aliases.includes(normalized)) {
        index[key] = column;
        matched.add(column);
        return;
      }
    }
  });

  const ignoredColumns = headers.filter(
    (header, column) => header.length > 0 && !matched.has(column),
  );

  if (index.postedAt === undefined) {
    return {
      headers,
      rows: [],
      errors: [
        {
          line: 1,
          reason: `No date column found. One of these is needed: ${COLUMN_ALIASES.postedAt.slice(0, 4).join(", ")}.`,
        },
      ],
      ignoredColumns,
    };
  }

  const rows: ParsedAnalyticsRow[] = [];
  const errors: AnalyticsCsvError[] = [];

  for (let i = 1; i < table.length; i += 1) {
    const line = i + 1;
    const cells = table[i];
    const cell = (field: keyof typeof COLUMN_ALIASES) => {
      const column = index[field];
      return column === undefined ? undefined : cells[column];
    };

    const postedAt = toDate(cell("postedAt"));
    if (!postedAt) {
      errors.push({
        line,
        reason: `Could not read a date from "${(cell("postedAt") ?? "").trim() || "(blank)"}". Use YYYY-MM-DD or MM/DD/YYYY.`,
      });
      continue;
    }

    const metrics = Object.fromEntries(
      METRIC_FIELDS.map((field) => [field, toNumber(cell(field))]),
    ) as Record<(typeof METRIC_FIELDS)[number], number>;

    if (METRIC_FIELDS.every((field) => metrics[field] === 0)) {
      errors.push({
        line,
        reason: "Every metric on this row is zero or missing, so there is nothing to import.",
      });
      continue;
    }

    rows.push({
      line,
      postedAt,
      postId: (cell("postId") ?? "").trim() || null,
      caption: (cell("caption") ?? "").trim() || null,
      mediaType: (cell("mediaType") ?? "").trim() || null,
      ...metrics,
    });
  }

  return { headers, rows, errors, ignoredColumns };
}

/**
 * A stable id for a row the export did not identify.
 *
 * Without one, re-importing a corrected file would insert a second copy of
 * every post rather than updating it — the unique key treats NULL post ids as
 * distinct. Derived from the content so the same row always lands on the same
 * id, and prefixed so an imported row is recognisable as one later.
 */
export function syntheticPostId(
  row: Pick<ParsedAnalyticsRow, "postedAt" | "caption" | "views" | "likes">,
): string {
  const seed = [row.postedAt, row.caption ?? "", row.views, row.likes].join("|");
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `csv:${row.postedAt.slice(0, 10)}:${(hash >>> 0).toString(36)}`;
}
