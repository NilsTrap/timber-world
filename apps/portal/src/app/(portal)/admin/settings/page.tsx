import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Settings landing → first sub-page. The sidebar exposes Fields / Packaging /
// Pricing Units directly; this just gives the parent "Settings" link a target.
export default function SettingsIndexPage() {
  redirect("/admin/settings/fields");
}
