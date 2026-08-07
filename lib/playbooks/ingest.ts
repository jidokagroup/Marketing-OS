import { CORE_AGENTS } from "@/lib/core-agents";

export type PlaybookCategory =
  | "strategy"
  | "campaign"
  | "content"
  | "publishing"
  | "analytics"
  | "client_ops"
  | "sales"
  | "agency_ops";

export type PlaybookStep = {
  order: number;
  body: string;
};

export type PlaybookScan = {
  title: string;
  category: PlaybookCategory;
  summary: string;
  steps: PlaybookStep[];
  memoryOwner: string;
  affectedSystems: string[];
  memoryInformation: string;
};

const CATEGORY_KEYWORDS: Record<PlaybookCategory, string[]> = {
  sales: ["sales", "close", "proposal", "lead", "prospect", "discovery", "qualification"],
  campaign: ["campaign", "launch", "offer", "funnel", "nurture", "sequence"],
  strategy: ["strategy", "positioning", "market", "audience", "icp", "persona", "planning"],
  content: ["content", "script", "caption", "creative", "copy", "post", "newsletter"],
  publishing: ["publish", "scheduler", "calendar", "approval", "social", "posting"],
  analytics: ["analytics", "report", "kpi", "metric", "dashboard", "retention", "insight"],
  client_ops: ["client", "onboarding", "delivery", "support", "handoff", "kickoff"],
  agency_ops: ["operations", "finance", "billing", "legal", "team", "capacity", "vendor"],
};

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function baseName(filename: string) {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLines(text: string) {
  return text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function inferTitle(lines: string[], fallback: string) {
  const first = lines.find((line) => line.length >= 4 && line.length <= 120);
  return first ?? baseName(fallback) ?? "Uploaded playbook";
}

function inferCategory(text: string): PlaybookCategory {
  const lower = text.toLowerCase();
  let winner: PlaybookCategory = "agency_ops";
  let score = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const categoryScore = keywords.reduce(
      (total, keyword) => total + (lower.includes(keyword) ? 1 : 0),
      0,
    );
    if (categoryScore > score) {
      winner = category as PlaybookCategory;
      score = categoryScore;
    }
  }

  return winner;
}

function buildSummary(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 30);
  return truncate(paragraphs.slice(0, 2).join(" "), 700);
}

function extractSteps(lines: string[], text: string): PlaybookStep[] {
  const stepLines = lines.filter((line) =>
    /^((step\s*)?\d{1,2}[\).:-]|\-|\*|•|→)/i.test(line),
  );
  const candidates = stepLines.length >= 3
    ? stepLines
    : text
        .split(/\n{2,}/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter((part) => part.length > 25);

  return candidates.slice(0, 14).map((body, index) => ({
    order: index + 1,
    body: truncate(body.replace(/^((step\s*)?\d{1,2}[\).:-]|\-|\*|•|→)\s*/i, ""), 500),
  }));
}

function coreRouting(category: PlaybookCategory) {
  const byLabel = new Map(CORE_AGENTS.map((agent) => [agent.label, agent]));
  const growth = byLabel.get("Growth & Revenue")!;
  const delivery = byLabel.get("Client Delivery")!;
  const intelligence = byLabel.get("Success & Intelligence")!;
  const operations = byLabel.get("Business Operations")!;

  if (category === "sales" || category === "campaign" || category === "strategy") {
    return {
      memoryOwner: growth.label,
      affectedSystems: [...growth.systems, ...intelligence.systems.slice(2)],
    };
  }
  if (category === "client_ops") {
    return {
      memoryOwner: delivery.label,
      affectedSystems: delivery.systems,
    };
  }
  if (category === "analytics" || category === "content" || category === "publishing") {
    return {
      memoryOwner: intelligence.label,
      affectedSystems: intelligence.systems,
    };
  }
  return {
    memoryOwner: operations.label,
    affectedSystems: operations.systems,
  };
}

export function scanPlaybookText(text: string, filename: string): PlaybookScan {
  const lines = cleanLines(text);
  const title = inferTitle(lines, filename);
  const category = inferCategory(text);
  const summary = buildSummary(text) || `Uploaded playbook extracted from ${filename}.`;
  const steps = extractSteps(lines, text);
  const routing = coreRouting(category);
  const stepText = steps.length
    ? steps.map((step) => `${step.order}. ${step.body}`).join("\n")
    : "No numbered steps were detected. Use the full extracted text as the source of truth.";

  return {
    title,
    category,
    summary,
    steps,
    memoryOwner: routing.memoryOwner,
    affectedSystems: [...new Set(routing.affectedSystems)],
    memoryInformation: [
      `Summary: ${summary}`,
      "",
      "Detected operating steps:",
      stepText,
      "",
      "Full extracted playbook text is stored on the linked playbook record. Use this memory to route work, explain SOPs, and brief Core agents before they act.",
      "",
      `Extract preview:\n${truncate(text, 24_000)}`,
    ].join("\n"),
  };
}
