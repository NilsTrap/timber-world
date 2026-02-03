import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "../utils";

/* =============================================================================
 * PageHeader
 *
 * Standard page header with back link, title, subtitle, and actions area.
 * Use this at the top of every detail/edit page.
 *
 * @example
 * <PageHeader
 *   backHref="/shipments"
 *   backLabel="Back"
 *   title="INE-TWP-001"
 *   subtitle="To: Timber World"
 *   actions={<Button>Submit</Button>}
 *   badge={<StatusBadge status="draft" />}
 * />
 * ============================================================================= */

interface PageHeaderProps {
  /** URL for the back link */
  backHref: string;
  /** Label for the back link (default: "Back") */
  backLabel?: string;
  /** Page title (h1) */
  title: string;
  /** Subtitle text below title */
  subtitle?: string;
  /** Additional content below subtitle (e.g., correction link) */
  extraInfo?: React.ReactNode;
  /** Action buttons (rendered on the right) */
  actions?: React.ReactNode;
  /** Status badge (rendered after actions) */
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  backHref,
  backLabel = "Back",
  title,
  subtitle,
  extraInfo,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          {extraInfo}
        </div>
        {(actions || badge) && (
          <div className="flex items-center gap-3">
            {actions}
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
 * StatusBadge
 *
 * Consistent status badge styling. Pass variant for predefined colors.
 *
 * @example
 * <StatusBadge variant="draft">Draft</StatusBadge>
 * <StatusBadge variant="success">Validated</StatusBadge>
 * ============================================================================= */

type StatusVariant = "draft" | "pending" | "success" | "error" | "info" | "warning";

const statusVariantClasses: Record<StatusVariant, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  pending: "bg-orange-100 text-orange-800",
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  warning: "bg-amber-100 text-amber-800",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs px-2.5 py-1 rounded-full font-medium",
        statusVariantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/* =============================================================================
 * SummaryGrid
 *
 * Grid of summary cards (2-4 columns). Use for key metrics at top of page.
 *
 * @example
 * <SummaryGrid>
 *   <SummaryCard label="Input m³" value="12,345" />
 *   <SummaryCard label="Output m³" value="10,234" />
 * </SummaryGrid>
 * ============================================================================= */

interface SummaryGridProps {
  children: React.ReactNode;
  /** Number of columns on desktop (default: 4) */
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClasses = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

export function SummaryGrid({ children, columns = 4, className }: SummaryGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", columnClasses[columns], className)}>
      {children}
    </div>
  );
}

/* =============================================================================
 * SummaryCard
 *
 * Single summary card with label and value. Use inside SummaryGrid.
 *
 * @example
 * <SummaryCard label="Total Volume" value="12,345 m³" />
 * <SummaryCard label="Outcome %" value="85,2%" valueClassName="text-green-600" />
 * ============================================================================= */

interface SummaryCardProps {
  /** Small label text */
  label: string;
  /** Large value text */
  value: string;
  /** Optional className for the value (e.g., for color) */
  valueClassName?: string;
  className?: string;
}

export function SummaryCard({ label, value, valueClassName, className }: SummaryCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold truncate", valueClassName)}>{value}</p>
    </div>
  );
}

/* =============================================================================
 * SectionHeader
 *
 * Section header with title, optional subtitle, and action button.
 * Use above tables or content sections.
 *
 * @example
 * <SectionHeader
 *   title="Packages"
 *   subtitle="Total: 12,345 m³"
 *   action={<Button variant="outline" size="sm">Add Package</Button>}
 * />
 * ============================================================================= */

interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional subtitle (e.g., totals) */
  subtitle?: string;
  /** Action button or buttons */
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* =============================================================================
 * EmptyState
 *
 * Empty state card with message. Optionally clickable.
 *
 * @example
 * <EmptyState message="No packages added yet." />
 * <EmptyState
 *   message="No packages added yet. Click here to add."
 *   onClick={() => setOpen(true)}
 * />
 * ============================================================================= */

interface EmptyStateProps {
  /** Message to display */
  message: string;
  /** If provided, card becomes clickable */
  onClick?: () => void;
  className?: string;
}

export function EmptyState({ message, onClick, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 text-center",
        onClick && "cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/* =============================================================================
 * ListCard
 *
 * Card-based list item with icon, content, badge, and optional action.
 * Use for draft entries lists.
 *
 * @example
 * <ListCard
 *   href="/production/123"
 *   icon={<FileText className="h-5 w-5" />}
 *   title="Sawing"
 *   subtitle="2026-01-15 · Created 14:30"
 *   badge={<StatusBadge variant="draft">Draft</StatusBadge>}
 *   action={<DeleteButton />}
 * />
 * ============================================================================= */

interface ListCardProps {
  /** Link destination */
  href: string;
  /** Icon to display on the left */
  icon: React.ReactNode;
  /** Main title text */
  title: string;
  /** Subtitle text */
  subtitle?: string;
  /** Badge element (e.g., StatusBadge) */
  badge?: React.ReactNode;
  /** Action element (e.g., delete button) */
  action?: React.ReactNode;
  className?: string;
}

export function ListCard({
  href,
  icon,
  title,
  subtitle,
  badge,
  action,
  className,
}: ListCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm",
        className
      )}
    >
      <Link
        href={href}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-70 transition-opacity"
      >
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </Link>
      {badge}
      {action}
    </div>
  );
}
