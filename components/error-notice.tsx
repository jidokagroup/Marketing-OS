import { AlertTriangle, Info, Lock, PlugZap, WifiOff } from "lucide-react";

import { toCustomerError, type CustomerError, type ErrorCategory } from "@/lib/errors";
import { cn } from "@/lib/utils";

const ICONS: Record<ErrorCategory, typeof AlertTriangle> = {
  temporary_service: WifiOff,
  connection_required: PlugZap,
  permission_required: Lock,
  setup_incomplete: Info,
  provider_unavailable: WifiOff,
  invalid_input: AlertTriangle,
  partial_completion: Info,
  unknown: AlertTriangle,
};

/** Setup and partial states are informational; the rest are problems. */
const CALM: ErrorCategory[] = ["setup_incomplete", "partial_completion", "connection_required"];

/**
 * The one way this app tells someone something went wrong.
 *
 * Takes either a classified error or a raw one — passing the raw one is the
 * point, because the classification is what keeps a Postgres code or a
 * migration filename off the screen.
 */
export function ErrorNotice({
  error,
  action,
  category,
  children,
  className,
}: {
  /** The raw failure. Classified here rather than by the caller. */
  error?: unknown;
  /** What the user was trying to do, e.g. "load Pipeline". */
  action?: string;
  /** Overrides classification where the caller genuinely knows better. */
  category?: ErrorCategory;
  /** A retry button or a link to the page that fixes it. */
  children?: React.ReactNode;
  className?: string;
}) {
  const shown: CustomerError = toCustomerError(error, { action, category });
  const Icon = ICONS[shown.category];
  const calm = CALM.includes(shown.category);

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-sm",
        calm
          ? "border-amber-300 bg-amber-50/60 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-destructive/30 bg-destructive/5 text-destructive",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{shown.headline}</p>
        <p className={calm ? "text-amber-900/90 dark:text-amber-200/80" : "text-destructive/90"}>
          {shown.explanation}
        </p>
        <p className={calm ? "text-amber-900/90 dark:text-amber-200/80" : "text-destructive/90"}>
          {shown.nextAction}
        </p>
        {children && <div className="pt-1">{children}</div>}
      </div>
    </div>
  );
}
