"use client";

import { useEffect, useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  Button,
} from "@timber/ui";
import { Plus } from "lucide-react";
import { OrganisationsTable } from "./OrganisationsTable";
import { PeopleTable } from "./PeopleTable";
import { OrganisationForm } from "./OrganisationForm";

interface UsersPageTabsProps {
  /** K2 · the person-centric People directory is cross-org, so it is admin-only.
   *  When false the People tab is hidden (a scoped viewer only sees Organisations). */
  canManagePeople: boolean;
  defaultTab?: "companies" | "people";
}

/**
 * Users Page Tabs
 *
 * Client component that renders the Organisations/People tabs
 * with the Add Organisation button next to the tab list.
 */
export function UsersPageTabs({ canManagePeople, defaultTab = "companies" }: UsersPageTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => setActiveTab(defaultTab), [defaultTab]);

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === "people" ? "people" : "companies")}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="companies">All companies</TabsTrigger>
            {canManagePeople && <TabsTrigger value="people">People</TabsTrigger>}
          </TabsList>
          {activeTab === "companies" && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Add company
            </Button>
          )}
        </div>

        <TabsContent value="companies" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <OrganisationsTable hideAddButton key={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        {canManagePeople && (
          <TabsContent value="people" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <PeopleTable />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <OrganisationForm
        organisation={null}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
