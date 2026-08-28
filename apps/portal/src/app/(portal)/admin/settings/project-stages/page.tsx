import { notFound, redirect } from "next/navigation";
import { getSession, isPlatformAdmin } from "@/lib/auth";
import { listProjectStages } from "@/features/project-stages/actions";
import { ProjectStagesSettings } from "@/features/project-stages/components/ProjectStagesSettings";

export const dynamic = "force-dynamic";
export default async function ProjectStagesSettingsPage(){const session=await getSession();if(!session)redirect("/login");if(!isPlatformAdmin(session))notFound();const result=await listProjectStages();if(!result.success)throw new Error("Project stages unavailable");return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">Project Stages</h1><p className="text-muted-foreground">Configure lifecycle labels, colours, order, active state, and role availability.</p></div><ProjectStagesSettings initialStages={result.data}/></div>}
