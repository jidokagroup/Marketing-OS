import {
  BarChart3,
  Bot,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  MessagesSquare,
  Network,
  PackageOpen,
  Plug,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type CoreFoundationLayer =
  | "identity_access"
  | "operating_graph"
  | "commercial_engine"
  | "agent_memory"
  | "execution_layer"
  | "measurement_governance";

export type CoreModule = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  foundationLayer: CoreFoundationLayer;
  summary: string;
  capability: string;
  marketingSurface: string;
  dataObjects: string[];
  status: "live" | "mapped" | "needs_api" | "planned";
};

export const FOUNDATION_LAYERS: {
  id: CoreFoundationLayer;
  label: string;
  description: string;
}[] = [
  {
    id: "identity_access",
    label: "Identity & Access",
    description: "Users, workspace access, permissions, and audit boundaries.",
  },
  {
    id: "operating_graph",
    label: "Operating Graph",
    description: "Clients, projects, tasks, documents, and how work connects.",
  },
  {
    id: "commercial_engine",
    label: "Commercial Engine",
    description: "Offers, pipeline, money, and communication records.",
  },
  {
    id: "agent_memory",
    label: "Agent Memory",
    description: "Agents, source files, knowledge, Brand Brain, and artifacts.",
  },
  {
    id: "execution_layer",
    label: "Execution Layer",
    description: "Automations, scheduling, publishing, approvals, and integrations.",
  },
  {
    id: "measurement_governance",
    label: "Measurement & Governance",
    description: "Analytics, diagnostics, reporting, and improvement loops.",
  },
];

export const CORE_MODULES: CoreModule[] = [
  {
    id: "dashboard",
    label: "Core Command",
    href: "/dashboard",
    icon: LayoutDashboard,
    foundationLayer: "measurement_governance",
    summary: "Executive command for the four Jidoka Core agents.",
    capability: "Shows agent readiness, operating counts, review needs, and next work.",
    marketingSurface: "Dashboard",
    dataObjects: ["marketing_os_core_agent_training", "marketing_os_memory_records"],
    status: "live",
  },
  {
    id: "inbox",
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
    foundationLayer: "execution_layer",
    summary: "Human review queue for comments, DMs, and support handoffs.",
    capability: "Keeps risky replies, comment-to-DM flows, and review decisions in one place.",
    marketingSurface: "Inbox and client cards",
    dataObjects: ["marketing_os_inbox_threads", "marketing_os_inbox_messages"],
    status: "live",
  },
  {
    id: "crm",
    label: "Clients",
    href: "/clients",
    icon: Users,
    foundationLayer: "operating_graph",
    summary: "Client records, agents, Brand Brain, inbox, and account context.",
    capability: "Keeps each client isolated so content, calendar, and agent memory do not bleed across accounts.",
    marketingSurface: "Clients",
    dataObjects: ["marketing_os_clients", "marketing_os_writing_agents"],
    status: "live",
  },
  {
    id: "offers",
    label: "Offers",
    href: "/offers",
    icon: Tag,
    foundationLayer: "commercial_engine",
    summary: "The catalog of offers, packages, services, and CTAs each agent should understand.",
    capability: "Makes sales logic reusable across Brand Brain, campaigns, content, and email.",
    marketingSurface: "Brand Brain and campaign briefs",
    dataObjects: ["marketing_os_brand_brains", "marketing_os_campaign_briefs"],
    status: "mapped",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/pipeline",
    icon: TrendingUp,
    foundationLayer: "commercial_engine",
    summary: "Lead and opportunity movement from first touch to won or lost.",
    capability: "Connects paid campaigns, comments, email, and generated content to revenue progress.",
    marketingSurface: "Analytics attribution and paid campaigns",
    dataObjects: ["marketing_os_leads", "marketing_os_revenue_events"],
    status: "live",
  },
  {
    id: "money",
    label: "Money",
    href: "/money",
    icon: Wallet,
    foundationLayer: "commercial_engine",
    summary: "Budget, spend, expected revenue, attributed revenue, and ROI signals.",
    capability: "Shows whether marketing activity is creating measurable business value.",
    marketingSurface: "Paid campaigns and Analytics",
    dataObjects: ["marketing_os_campaigns", "marketing_os_revenue_events"],
    status: "live",
  },
  {
    id: "communications",
    label: "Communications",
    href: "/communications",
    icon: MessagesSquare,
    foundationLayer: "commercial_engine",
    summary: "A communication record across email, comments, DMs, client notes, and review threads.",
    capability: "Keeps message history and handoffs visible to the orchestrator.",
    marketingSurface: "Inbox, Scheduler, Email provider settings",
    dataObjects: ["marketing_os_inbox_messages", "marketing_os_core_chat_messages"],
    status: "live",
  },
  {
    id: "ai-agents",
    label: "Client Agents",
    href: "/agents",
    icon: Bot,
    foundationLayer: "agent_memory",
    summary: "Client-specific agents that learn voice, knowledge, rules, and connected accounts.",
    capability: "Analyze uploads, fill Brand Brain, generate content, and route work per client.",
    marketingSurface: "Writing Agents",
    dataObjects: ["marketing_os_writing_agents", "marketing_os_voice_dna_profiles"],
    status: "live",
  },
  {
    id: "projects",
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    foundationLayer: "operating_graph",
    summary: "Outcome containers for campaigns, launches, filming sessions, and improvement work.",
    capability: "Groups tasks, content, assets, analytics, and client outcomes around one goal.",
    marketingSurface: "Paid campaigns",
    dataObjects: ["marketing_os_campaigns", "marketing_os_work_items"],
    status: "live",
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/tasks",
    icon: ClipboardCheck,
    foundationLayer: "execution_layer",
    summary: "Operational work queue for strategy, content, publishing, analytics, and client communication.",
    capability: "Tracks owners, due dates, blockers, reviews, and delivery handoffs.",
    marketingSurface: "Work",
    dataObjects: ["marketing_os_work_items"],
    status: "live",
  },
  {
    id: "documents",
    label: "Documents",
    href: "/documents",
    icon: FileText,
    foundationLayer: "agent_memory",
    summary: "Source files, playbooks, generated assets, scripts, and durable deliverables.",
    capability: "Feeds source material into Brand Brain, knowledge, content generation, and orchestrator memory.",
    marketingSurface: "Assets, Playbooks, Generated Content",
    dataObjects: ["marketing_os_uploaded_assets", "marketing_os_playbooks"],
    status: "live",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    href: "/knowledge",
    icon: Sparkles,
    foundationLayer: "agent_memory",
    summary: "Structured memory about audience, proof, objections, offers, process, and decisions.",
    capability: "Turns uploads and playbooks into reusable agent context.",
    marketingSurface: "Knowledge Base, Brand Brain, Playbooks",
    dataObjects: ["marketing_os_knowledge_graphs", "marketing_os_memory_records"],
    status: "live",
  },
  {
    id: "automations",
    label: "Automations",
    href: "/automations",
    icon: CalendarCheck,
    foundationLayer: "execution_layer",
    summary: "Repeatable workflows for scans, scheduling, publishing, analytics, and inbox review.",
    capability: "Shows which recurring agent actions are active and which require API setup.",
    marketingSurface: "Scheduler, Intelligence, Analytics, Cron routes",
    dataObjects: ["marketing_os_scheduled_posts", "marketing_os_social_intelligence_reports"],
    status: "live",
  },
  {
    id: "integrations",
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
    foundationLayer: "execution_layer",
    summary: "External APIs, OAuth accounts, email providers, ad platforms, and data sources.",
    capability: "Shows what can connect, what is connected, and what needs API configuration.",
    marketingSurface: "Integrations and Settings",
    dataObjects: ["marketing_os_social_accounts", "marketing_os_email_provider_settings"],
    status: "needs_api",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    foundationLayer: "measurement_governance",
    summary: "Performance, attribution, content results, posting windows, and improvement signals.",
    capability: "Feeds timing and performance recommendations back into scheduler and strategy.",
    marketingSurface: "Analytics",
    dataObjects: ["marketing_os_platform_analytics", "marketing_os_performance_metrics"],
    status: "live",
  },
  {
    id: "permissions",
    label: "Permissions",
    href: "/permissions",
    icon: LockKeyhole,
    foundationLayer: "identity_access",
    summary: "Access boundaries for owners, team members, clients, reviewers, and connected accounts.",
    capability: "Keeps collaboration and account access controlled before sensitive actions run.",
    marketingSurface: "Team and Supabase RLS",
    dataObjects: ["marketing_os_workspace_members", "marketing_os_activity_events"],
    status: "mapped",
  },
  {
    id: "blueprint-diagnostic",
    label: "Blueprint Diagnostic",
    href: "/blueprint-diagnostic",
    icon: Network,
    foundationLayer: "measurement_governance",
    summary: "Guided intake that maps a company into the right operating-system setup.",
    capability: "Identifies missing infrastructure, active modules, and the next automations to configure.",
    marketingSurface: "Core Command and Playbooks",
    dataObjects: ["marketing_os_memory_records", "marketing_os_core_agent_training"],
    status: "mapped",
  },
  {
    id: "paid-campaigns",
    label: "Paid Campaigns",
    href: "/campaigns",
    icon: Target,
    foundationLayer: "commercial_engine",
    summary: "The Marketing OS-specific campaign execution layer.",
    capability: "Plans paid acquisition with budget, channels, work, leads, revenue, and insights connected.",
    marketingSurface: "Paid Ad Campaigns",
    dataObjects: ["marketing_os_campaigns", "marketing_os_campaign_briefs"],
    status: "live",
  },
];

export const PACKAGE_LAYER_STATUS = {
  label: "Package Layers",
  href: "/packages",
  icon: PackageOpen,
  phase: "Deferred",
  summary:
    "Industry packages should configure the shared Core foundation instead of changing the foundation itself.",
};

export const CORE_MODULE_BY_ID = new Map(
  CORE_MODULES.map((module) => [module.id, module]),
);
