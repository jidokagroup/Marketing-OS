import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Radar,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
  /** Deferred-phase feature shown but marked "soon". */
  soon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Core Command", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Paid Ad Campaigns", href: "/campaigns", icon: Target },
  { label: "Content", href: "/content", icon: Sparkles },
  { label: "Market Intelligence", href: "/intelligence", icon: Radar },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Performance Intelligence", href: "/performance", icon: LineChart, section: "Add-ons" },
  { label: "Paid Ads Generator", href: "/paid-ads", icon: Megaphone, section: "Add-ons" },
  { label: "Pipeline", href: "/pipeline", icon: TrendingUp, section: "Add-ons" },
  { label: "Money", href: "/money", icon: Wallet, section: "Add-ons" },
  { label: "Settings", href: "/settings", icon: Settings },
];
