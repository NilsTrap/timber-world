import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { listProjects } from "@/features/projects/actions/getProjects";
import { ProjectsListView } from "@/features/projects/components/ProjectsListView";
import { EMPTY_PROJECT_FILTERS, filterProjectGroups, projectFilterOptions } from "@/features/projects/projectListFilters";
import type { ProjectListFilters } from "@/features/projects/types";

export const metadata: Metadata = {
  title: "Projects | Nilitto",
};

/** Session and row visibility are per-request facts; nothing here may be cached. */
export const dynamic = "force-dynamic";

/**
 * Projects list.
 *
 * The loader performs the authenticated Projects gate and returns only rows
 * visible to the current organisation through RLS.
 */
function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const res = await listProjects();
  if (!res.ok) {
    if (res.deny === "login") redirect("/login");
    notFound();
  }
  const params = await searchParams;
  const filters: ProjectListFilters = {
    ...EMPTY_PROJECT_FILTERS,
    search: first(params.q),
    customer: first(params.customer),
    trader: first(params.trader),
    supplier: first(params.supplier),
    stage: first(params.stage),
  };
  return <ProjectsListView items={filterProjectGroups(res.items, filters)} allItems={res.items} viewer={res.viewer} filters={filters} filterOptions={projectFilterOptions(res.items)} />;
}
