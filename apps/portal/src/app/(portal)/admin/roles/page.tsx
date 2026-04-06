import { redirect } from "next/navigation";

export const metadata = {
  title: "Role Management | Timber World Platform",
};

/**
 * Roles page — deprecated.
 * User permissions are now managed via per-user modules on the organization detail page.
 */
export default function RolesPage() {
  redirect("/admin/organisations");
}
