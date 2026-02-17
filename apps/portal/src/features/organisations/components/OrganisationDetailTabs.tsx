"use client";

import { useState } from "react";
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
  Checkbox,
  Label,
} from "@timber/ui";
import { toast } from "sonner";
import { Building2, Users, Settings2, Handshake } from "lucide-react";
import type { Organisation } from "../types";
import { OrganisationUsersTable } from "./OrganisationUsersTable";
import { OrganisationFeaturesTab } from "./OrganisationFeaturesTab";
import { OrganisationTypesSection } from "./OrganisationTypesSection";
import { TradingPartnersTab } from "./TradingPartnersTab";
import { toggleOrganisationExternal } from "../actions";

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
  const [isExternal, setIsExternal] = useState(organisation.isExternal);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleExternalToggle = async (checked: boolean) => {
    setIsUpdating(true);
    const result = await toggleOrganisationExternal(organisation.id, checked);
    if (result.success) {
      setIsExternal(result.data.isExternal);
      toast.success(checked ? "Marked as external organisation" : "Marked as internal organisation");
    } else {
      toast.error(result.error);
    }
    setIsUpdating(false);
  };

  const getDefaultTab = () => {
    if (defaultTab === "users") return "users";
    if (defaultTab === "features") return "features";
    if (defaultTab === "partners") return "partners";
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
        <TabsTrigger value="partners">
          <Handshake className="h-4 w-4 mr-2" />
          Trading Partners
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
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
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Type
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={isExternal ? "warning" : "default"}>
                    {isExternal ? "External" : "Internal"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="external-toggle"
                checked={isExternal}
                onCheckedChange={handleExternalToggle}
                disabled={isUpdating}
              />
              <div className="space-y-0.5">
                <Label htmlFor="external-toggle" className="text-base cursor-pointer">
                  External Organisation
                </Label>
                <p className="text-sm text-muted-foreground">
                  External organisations are suppliers or customers that don&apos;t use the platform.
                  They can only be sources for incoming shipments.
                </p>
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

      <TabsContent value="partners">
        <Card>
          <CardHeader>
            <CardTitle>Trading Partners</CardTitle>
          </CardHeader>
          <CardContent>
            <TradingPartnersTab organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
