import {
  BarChart3,
  BriefcaseBusiness,
  Handshake,
  LineChart,
  Network,
  type LucideIcon,
} from "lucide-react";

export type CoreAgentKey =
  | "orchestrator"
  | "growth-revenue"
  | "client-delivery"
  | "success-intelligence"
  | "business-operations";

export type CoreAgentDefinition = {
  key: CoreAgentKey;
  label: string;
  segment: string;
  href: string;
  summary: string;
  systems: string[];
  trainingFields: {
    key: string;
    label: string;
    placeholder: string;
  }[];
  icon: LucideIcon;
};

export const ORCHESTRATOR_AGENT: CoreAgentDefinition = {
  key: "orchestrator",
  label: "Orchestrator",
  segment: "Command Agent",
  href: "/core/orchestrator",
  summary:
    "Routes questions, searches Core memory, creates handoffs, and escalates refinement requests when the OS needs help.",
  systems: ["Routing", "Memory", "Handoffs", "Escalations"],
  icon: Network,
  trainingFields: [
    {
      key: "answer_style",
      label: "Answer style",
      placeholder:
        "How the orchestrator should explain things, how direct it should be, and what tone users should feel.",
    },
    {
      key: "routing_rules",
      label: "Routing rules",
      placeholder:
        "Which questions should go to Growth, Client Delivery, Success & Intelligence, Business Operations, or a specific page.",
    },
    {
      key: "memory_rules",
      label: "Memory rules",
      placeholder:
        "What the orchestrator should remember, ignore, verify, summarize, or route into agent-specific memory.",
    },
    {
      key: "escalation_rules",
      label: "Escalation rules",
      placeholder:
        "When it should create a developer/refinement request, ask for human approval, or avoid taking action.",
    },
  ],
};

export const CORE_AGENTS: CoreAgentDefinition[] = [
  {
    key: "growth-revenue",
    label: "Growth & Revenue",
    segment: "Win Customers",
    href: "/core/growth-revenue",
    summary:
      "Builds the agency's own client-acquisition system: leads, nurture, sales, closing, and intake.",
    systems: ["01 Lead Generation", "02 Lead Nurture", "03 Sales & Closing", "04 Client Intake"],
    icon: LineChart,
    trainingFields: [
      {
        key: "ideal_clients",
        label: "Ideal clients",
        placeholder: "Who the agency wants to attract, avoid, prioritize, and qualify.",
      },
      {
        key: "offers",
        label: "Offers and sales logic",
        placeholder: "Core offers, pricing rules, proof, guarantees, objections, and close criteria.",
      },
      {
        key: "funnels",
        label: "Funnels and CRM stages",
        placeholder: "Lead sources, nurture steps, handoff points, lifecycle stages, and follow-up rules.",
      },
      {
        key: "market_intelligence",
        label: "Market intelligence",
        placeholder: "Competitors, positioning gaps, buyer triggers, channel notes, and sales hypotheses.",
      },
    ],
  },
  {
    key: "client-delivery",
    label: "Client Delivery",
    segment: "Serve Clients",
    href: "/core/client-delivery",
    summary:
      "Turns closed work into a consistent client experience across onboarding, delivery, quality, and support.",
    systems: ["05 Onboarding", "06 Service Delivery", "07 Quality Control", "08 Client Support"],
    icon: Handshake,
    trainingFields: [
      {
        key: "onboarding",
        label: "Onboarding standards",
        placeholder: "Kickoff requirements, access, assets, timelines, communication rhythm, and first-value steps.",
      },
      {
        key: "delivery_scope",
        label: "Delivery scope",
        placeholder: "What is included, out of scope, dependencies, milestones, and acceptance criteria.",
      },
      {
        key: "quality_rules",
        label: "Quality rules",
        placeholder: "Review standards, approval requirements, release checks, and escalation rules.",
      },
      {
        key: "support_patterns",
        label: "Support patterns",
        placeholder: "Common client questions, risk signals, severity levels, and support playbooks.",
      },
    ],
  },
  {
    key: "success-intelligence",
    label: "Success & Intelligence",
    segment: "Retain & Grow",
    href: "/core/success-intelligence",
    summary:
      "Monitors value, reporting, knowledge, SOPs, planning, and improvement so customers stay and grow.",
    systems: ["09 Retention", "10 Data & Reporting", "11 Knowledge & SOPs", "12 Planning & Improvement"],
    icon: BarChart3,
    trainingFields: [
      {
        key: "health_signals",
        label: "Customer health signals",
        placeholder: "Adoption, satisfaction, renewal risk, support patterns, value proof, and expansion cues.",
      },
      {
        key: "reporting_rules",
        label: "Reporting rules",
        placeholder: "KPIs, dashboards, attribution rules, reporting cadence, targets, and decision thresholds.",
      },
      {
        key: "knowledge_sops",
        label: "Knowledge and SOPs",
        placeholder: "Reusable processes, approved playbooks, lessons learned, and review cycles.",
      },
      {
        key: "improvement_loop",
        label: "Improvement loop",
        placeholder: "Experiments, retrospectives, bottlenecks, opportunities, owners, and monitoring rules.",
      },
    ],
  },
  {
    key: "business-operations",
    label: "Business Operations",
    segment: "Run Business",
    href: "/core/business-operations",
    summary:
      "Protects the internal operating layer: finance, people, administration, legal coordination, vendors, and supply.",
    systems: ["13 Finance & Cash", "14 People & HR", "15 Administration & Legal", "16 Inventory & Supply"],
    icon: BriefcaseBusiness,
    trainingFields: [
      {
        key: "financial_controls",
        label: "Financial controls",
        placeholder: "Budgets, billing, margins, payment status, cash rules, and approval thresholds.",
      },
      {
        key: "people_capacity",
        label: "People and capacity",
        placeholder: "Roles, weekly capacity, hiring needs, training requirements, and offboarding controls.",
      },
      {
        key: "admin_legal",
        label: "Admin and legal coordination",
        placeholder: "Contracts, policies, access reviews, compliance calendars, and legal-review triggers.",
      },
      {
        key: "vendors_supply",
        label: "Vendors and supply",
        placeholder: "Vendors, subscriptions, procurement, equipment, inventory, and business continuity risks.",
      },
    ],
  },
];

export const CORE_AGENT_BY_KEY = new Map(
  [ORCHESTRATOR_AGENT, ...CORE_AGENTS].map((agent) => [agent.key, agent]),
);

export const INBOX_PLATFORM_OPTIONS = [
  { key: "all", label: "All platforms" },
  { key: "tiktok", label: "TikTok" },
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
];

export const CONTENT_CHANNEL_OPTIONS = INBOX_PLATFORM_OPTIONS.filter(
  (platform) => platform.key !== "all",
).concat([
  { key: "email", label: "Email" },
  { key: "blog_post", label: "Blog post" },
]);

export const CONTENT_CHANNEL_LABELS = Object.fromEntries(
  CONTENT_CHANNEL_OPTIONS.map((channel) => [channel.key, channel.label]),
) as Record<string, string>;
