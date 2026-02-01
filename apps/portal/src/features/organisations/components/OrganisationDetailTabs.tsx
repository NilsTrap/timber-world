"use client";

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
import { Building2, Users, Settings2 } from "lucide-react";
import type { Organisation } from "../types";
import { OrganisationUsersTable } from "./OrganisationUsersTable";
import { OrganisationFeaturesTab } from "./OrganisationFeaturesTab";
import { OrganisationTypesSection } from "./OrganisationTypesSection";

interface OrganisationDetailTabsProps {
  organisation: Organisation;
  defaultTab?: string;
}

/**
 * Organisation Detail Tabs
 *
 * Displays organisation details in a tabbed interface.
 * - Details tab: organisation information (code, name, status)
 * - Users tab: placeholder for user management (Story 7.2)
 */
export function OrganisationDetailTabs({
  organisation,
  defaultTab,
}: OrganisationDetailTabsProps) {
  const getDefaultTab = () => {
    if (defaultTab === "users") return "users";
    if (defaultTab === "features") return "features";
    return "details";
  };

  return (
    <Tabs defaultValue={getDefaultTab()}>
      <TabsList>
        <TabsTrigger value="details">
          <Building2 className="h-4 w-4 mr-2" />
          Details
        </TabsTrigger>
        <TabsTrigger value="users">
          <Users className="h-4 w-4 mr-2" />
          Users ({organisation.userCount ?? 0})
        </TabsTrigger>
        <TabsTrigger value="features">
          <Settings2 className="h-4 w-4 mr-2" />
          Features
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Code
                </label>
                <p className="font-mono text-lg font-semibold">
                  {organisation.code}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="mt-1">
                  <Badge
                    variant={organisation.isActive ? "success" : "secondary"}
                  >
                    {organisation.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              <p className="text-lg">{organisation.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created
                </label>
                <p className="text-sm">
                  {new Date(organisation.createdAt).toLocaleDateString("en-GB", {
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
                  {new Date(organisation.updatedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <OrganisationTypesSection organisationId={organisation.id} />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="users">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganisationUsersTable organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="features">
        <Card>
          <CardHeader>
            <CardTitle>Feature Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganisationFeaturesTab organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
