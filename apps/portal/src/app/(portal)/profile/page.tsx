import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { getSession } from "@/lib/auth";
import { ProfileForm, ChangePasswordForm } from "@/features/profile/components";

export const metadata: Metadata = {
  title: "Profile",
};

/**
 * Profile Page
 *
 * User profile management page.
 * Displays current user info and allows name editing.
 *
 * TODO [i18n]: Replace hardcoded text with useTranslations()
 */
export default async function ProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {/* User Avatar and Read-Only Info */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{session.name}</h2>
            <p className="text-sm text-muted-foreground">{session.email}</p>
            <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded capitalize">
              {session.role}
            </span>
          </div>
        </div>

        {/* Editable Profile Form */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4">Edit Profile</h3>
          <ProfileForm initialName={session.name} />
        </div>

        {/* Change Password Section */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-medium mb-4">Change Password</h3>
          <ChangePasswordForm />
        </div>

        {/* Read-Only Information Section */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-medium mb-4">Account Information</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 text-sm">{session.email}</dd>
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Role
              </dt>
              <dd className="mt-1 text-sm capitalize">{session.role}</dd>
              <p className="text-xs text-muted-foreground mt-1">
                Role is assigned by administrator
              </p>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
