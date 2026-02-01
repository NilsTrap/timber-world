import { redirect } from "next/navigation";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getRoles, getFeaturesByCategory } from "@/features/roles/actions";
import { RolesTable } from "@/features/roles/components";

export const metadata = {
  title: "Role Management | Timber World Platform",
};

export default async function RolesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Only platform admins can access role management
  if (!isSuperAdmin(session)) {
    redirect("/dashboard");
  }

  const [rolesResult, featuresResult] = await Promise.all([
    getRoles(),
    getFeaturesByCategory(),
  ]);

  if (!rolesResult.success || !featuresResult.success) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Role Management</h1>
        <div className="text-destructive">
          Failed to load data. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Role Management</h1>
        <p className="text-muted-foreground">
          Manage roles and their permissions. System roles cannot be deleted.
        </p>
      </div>

      <RolesTable
        roles={rolesResult.data || []}
        featuresByCategory={featuresResult.data || {}}
      />
    </div>
  );
}
