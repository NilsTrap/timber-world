import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveProjectsActor, resolveProjectsViewer } from "@/features/projects/access";
import { ProjectCreateView } from "@/features/projects/components/ProjectCreateView";

export const metadata: Metadata = { title: "New project | Timber World" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const actor = await resolveProjectsActor();
  if (!actor.ok) {
    if (actor.deny === "login") redirect("/login");
    notFound();
  }
  const viewer = await resolveProjectsViewer(actor);
  if (!viewer.canCreateProject) notFound();
  return <ProjectCreateView viewer={viewer} />;
}
