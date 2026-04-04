"use client";

import { useState } from "react";
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

/**
 * Users Page Tabs
 *
 * Client component that renders the Organisations/People tabs
 * with the Add Organisation button next to the tab list.
 */
export function UsersPageTabs() {
  const [activeTab, setActiveTab] = useState("organisations");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="organisations">Organisations</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>
          {activeTab === "organisations" && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Organisation
            </Button>
          )}
        </div>

        <TabsContent value="organisations" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <OrganisationsTable hideAddButton key={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="people" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <PeopleTable />
            </CardContent>
          </Card>
        </TabsContent>
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
