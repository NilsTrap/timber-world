import { notFound, redirect } from "next/navigation";
import { getSession, isPlatformAdmin } from "@/lib/auth";
import { getPlatformSetting } from "@/features/access/actions/platformSettings";
import { FileCleanupSettings, type FileCleanupPolicy } from "@/features/projects/components/FileCleanupSettings";

export const dynamic = "force-dynamic";
const fallback: FileCleanupPolicy = { llmEnabled: false, prompt: "Find names, company names, customer names, project names, email addresses, phone numbers, domains, and other text that could identify the original document owner. Return only a JSON array of exact strings found in the document.", extraTerms: [] };

export default async function FileCleanupSettingsPage() {
  const session = await getSession(); if (!session) redirect("/login"); if (!isPlatformAdmin(session)) notFound();
  const setting = await getPlatformSetting("project_file_cleanup");
  const initial = setting.success && setting.data.value && typeof setting.data.value === "object" ? { ...fallback, ...(setting.data.value as Partial<FileCleanupPolicy>) } : fallback;
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">File cleanup</h1><p className="text-muted-foreground">Adjust the prototype detector. Changes apply to future cleanup runs.</p></div><FileCleanupSettings initial={initial} /></div>;
}
