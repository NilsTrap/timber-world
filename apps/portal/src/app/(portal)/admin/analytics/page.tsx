import { redirect } from "next/navigation";

/**
 * Website Analytics Page - Redirect
 *
 * Analytics is now part of the CMS page.
 * Redirect to /admin/marketing with analytics tab.
 */
export default function AnalyticsPage() {
  redirect("/admin/marketing?tab=analytics");
}
