"use client";

import { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@timber/ui";
import { toast } from "sonner";
import { Building2, Users, Settings2, Handshake, Database, Pencil, Check, X } from "lucide-react";
import type { Organisation } from "../types";
import { OrganisationUsersTable } from "./OrganisationUsersTable";
import { OrganisationFeaturesTab } from "./OrganisationFeaturesTab";
import { TradingPartnersTab } from "./TradingPartnersTab";
import { ReferenceDataManager } from "@/features/reference-data";
import { toggleOrganisationExternal, updateOrganisation } from "../actions";

interface OrganisationDetailTabsProps {
  organisation: Organisation;
  defaultTab?: string;
}

/**
 * Organisation Detail Tabs
 *
 * Displays organisation details in a tabbed interface.
 */
export function OrganisationDetailTabs({
  organisation,
  defaultTab,
}: OrganisationDetailTabsProps) {
  const [isExternal, setIsExternal] = useState(organisation.isExternal);
  const [isTogglingExternal, setIsTogglingExternal] = useState(false);

  // Editable fields
  const [name, setName] = useState(organisation.name);
  const [code, setCode] = useState(organisation.code);
  const [editingField, setEditingField] = useState<"name" | "code" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleExternalToggle = async () => {
    setIsTogglingExternal(true);
    const newValue = !isExternal;
    const result = await toggleOrganisationExternal(organisation.id, newValue);
    if (result.success) {
      setIsExternal(result.data.isExternal);
      toast.success(newValue ? "Marked as external" : "Marked as internal");
    } else {
      toast.error(result.error);
    }
    setIsTogglingExternal(false);
  };

  const startEditing = (field: "name" | "code") => {
    setEditingField(field);
    setEditValue(field === "name" ? name : code);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveField = async () => {
    if (!editingField) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error(`${editingField === "name" ? "Name" : "Code"} cannot be empty`);
      return;
    }

    // Skip if unchanged
    if (
      (editingField === "name" && trimmed === name) ||
      (editingField === "code" && trimmed.toUpperCase() === code)
    ) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    const input =
      editingField === "name"
        ? { name: trimmed }
        : { name, code: trimmed };

    const result = await updateOrganisation(organisation.id, input);
    if (result.success) {
      if (editingField === "name") {
        setName(result.data.name);
      } else {
        setCode(result.data.code);
      }
      toast.success(`${editingField === "name" ? "Name" : "Code"} updated`);
      cancelEditing();
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveField();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const getDefaultTab = () => {
    if (defaultTab === "users") return "users";
    if (defaultTab === "features") return "features";
    if (defaultTab === "reference") return "reference";
    if (defaultTab === "partners") return "partners";
    return "details";
  };

  return (
    <Tabs defaultValue={getDefaultTab()}>
      <TabsList>
        <TabsTrigger value="details">
          <Building2 className="h-4 w-4" />
          Details
        </TabsTrigger>
        <TabsTrigger value="users">
          <Users className="h-4 w-4" />
          Users ({organisation.userCount ?? 0})
        </TabsTrigger>
        <TabsTrigger value="features">
          <Settings2 className="h-4 w-4" />
          Modules
        </TabsTrigger>
        <TabsTrigger value="reference">
          <Database className="h-4 w-4" />
          Reference Data
        </TabsTrigger>
        <TabsTrigger value="partners">
          <Handshake className="h-4 w-4" />
          Trading Partners
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Organisation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Code
                </label>
                {editingField === "code" ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      className="h-8 w-24 font-mono uppercase"
                      maxLength={3}
                      autoFocus
                      disabled={isSaving}
                    />
                    <Button variant="ghost" size="icon-sm" onClick={saveField} disabled={isSaving}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={cancelEditing} disabled={isSaving}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="font-mono text-lg font-semibold">{code}</p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing("code")}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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
                <div className="mt-1 flex items-center gap-1">
                  <Button
                    variant={!isExternal ? "default" : "outline"}
                    size="sm"
                    onClick={() => !isExternal ? null : handleExternalToggle()}
                    disabled={isTogglingExternal}
                    className="rounded-r-none"
                  >
                    Internal
                  </Button>
                  <Button
                    variant={isExternal ? "default" : "outline"}
                    size="sm"
                    onClick={() => isExternal ? null : handleExternalToggle()}
                    disabled={isTogglingExternal}
                    className="rounded-l-none"
                  >
                    External
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Name
              </label>
              {editingField === "name" ? (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="h-8 max-w-md"
                    maxLength={100}
                    autoFocus
                    disabled={isSaving}
                  />
                  <Button variant="ghost" size="icon-sm" onClick={saveField} disabled={isSaving}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={cancelEditing} disabled={isSaving}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <p className="text-lg">{name}</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startEditing("name")}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
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
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganisationFeaturesTab organisationId={organisation.id} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="reference">
        <Card>
          <CardHeader>
            <CardTitle>Reference Data</CardTitle>
          </CardHeader>
          <CardContent>
            <ReferenceDataManager canDelete organisationId={organisation.id} />
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
