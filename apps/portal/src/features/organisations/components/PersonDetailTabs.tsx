"use client";

import Link from "next/link";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@timber/ui";
import { User, Shield, Info } from "lucide-react";
import type { PersonDetail } from "../actions/getPersonById";
import type { Role, FeaturesByCategory } from "@/features/roles/actions";
import { RolesTable } from "@/features/roles/components";

interface PersonDetailTabsProps {
  person: PersonDetail;
  roles: Role[];
  featuresByCategory: FeaturesByCategory;
  defaultTab?: string;
}

export function PersonDetailTabs({
  person,
  roles,
  featuresByCategory,
  defaultTab,
}: PersonDetailTabsProps) {
  const getDefaultTab = () => {
    if (defaultTab === "roles") return "roles";
    return "details";
  };

  return (
    <Tabs defaultValue={getDefaultTab()}>
      <TabsList>
        <TabsTrigger value="details">
          <User className="h-4 w-4 mr-2" />
          Details
        </TabsTrigger>
        <TabsTrigger value="roles">
          <Shield className="h-4 w-4 mr-2" />
          Roles
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Person Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                <p className="text-lg">{person.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <p className="text-lg">{person.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Role
                </label>
                <div className="mt-1">
                  <Badge variant={person.role === "admin" ? "default" : "secondary"}>
                    {person.role === "admin" ? "Super Admin" : "User"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Organisation
                </label>
                <div className="mt-1">
                  {person.organisationId ? (
                    <Link
                      href={`/admin/organisations/${person.organisationId}`}
                      className="text-primary hover:underline"
                    >
                      {person.organisationName} ({person.organisationCode})
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">No organisation</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant={
                      person.status === "active"
                        ? "default"
                        : person.status === "invited"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {person.status}
                  </Badge>
                  {!person.isActive && (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Last Login
                </label>
                <p className="text-sm mt-1">
                  {person.lastLoginAt
                    ? new Date(person.lastLoginAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created
                </label>
                <p className="text-sm">
                  {new Date(person.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </label>
                <p className="text-sm">
                  {new Date(person.updatedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="roles">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Role-based permissions are not yet active</p>
                <p className="mt-1 text-yellow-700">
                  All users currently have full access within their organisation. Roles defined here will take effect once permission enforcement is enabled.
                </p>
              </div>
            </div>
            <RolesTable roles={roles} featuresByCategory={featuresByCategory} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
