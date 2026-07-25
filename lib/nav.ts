import {
  BarChart3,
  Inbox,
  LayoutDashboard,
  Settings,
  Sparkles,
  Target,
  Users,
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
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
