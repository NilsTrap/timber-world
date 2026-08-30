import Link from "next/link";
import { cn } from "@timber/ui";
import type { ProjectLegOption } from "../types";

export function ProjectLegSelector({ currentProjectId, options }: { currentProjectId: string; options: ProjectLegOption[] }) {
  if (options.length < 2) return null;
  return <nav aria-label="Project legs" className="flex flex-wrap gap-2">{options.map((leg) => { const active = leg.id === currentProjectId; return <Link key={leg.id} href={`/projects/${leg.id}`} aria-current={active ? "page" : undefined} className={cn("rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground", active && "border-primary bg-primary/10 text-primary shadow-sm")}>{leg.reference}</Link>; })}</nav>;
}
