"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@timber/ui";
import type { ProjectLegOption } from "../types";

export function ProjectLegSelector({ currentProjectId, options }: { currentProjectId: string; options: ProjectLegOption[] }) {
  const router = useRouter();
  if (options.length < 2) return null;
  return <div className="max-w-md space-y-1.5"><label className="text-sm font-medium" htmlFor="project-leg-selector">Project leg</label><Select value={currentProjectId} onValueChange={(id) => router.push(`/projects/${id}`)}><SelectTrigger id="project-leg-selector" aria-label="Project leg" className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{options.map((leg) => <SelectItem key={leg.id} value={leg.id}>{leg.reference}</SelectItem>)}</SelectContent></Select></div>;
}
