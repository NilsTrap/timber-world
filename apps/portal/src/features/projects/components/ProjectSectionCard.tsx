import { cn } from "@timber/ui";

export function ProjectSectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-lg border bg-card", className)}>{children}</section>;
}

export function ProjectSectionHeader({ title, subtitle, actions, reserveDisclosureSpace = false, className }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; reserveDisclosureSpace?: boolean; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-3 p-4", reserveDisclosureSpace && "sm:pr-[3.75rem]", className)}><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold leading-6">{title}</h2>{subtitle !== undefined && subtitle !== null ? <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div> : null}</div>{actions ? <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:max-w-[60%] sm:justify-end">{actions}</div> : null}</div>;
}

export function ProjectSectionBody({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return <div id={id} className={cn("border-t p-4", className)}>{children}</div>;
}
