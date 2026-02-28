"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, Input } from "@timber/ui";
import { Search } from "lucide-react";
import { CompaniesTable } from "./CompaniesTable";
import { AllContactsTable } from "./AllContactsTable";
import { DiscoverTab } from "./DiscoverTab";
import { KeywordsTab } from "./KeywordsTab";
import type { CrmCompany, CrmContact, CrmKeyword } from "../types";
import type { CompanyWithKeywords } from "../actions/getCompanies";

type ContactWithCompany = CrmContact & {
  company: Pick<CrmCompany, "id" | "name" | "country"> | null;
};

interface CrmPageContentProps {
  companies: CompanyWithKeywords[];
  contacts: ContactWithCompany[];
  keywords: CrmKeyword[];
}

export function CrmPageContent({ companies, contacts, keywords }: CrmPageContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <Tabs defaultValue="companies">
      <div className="flex items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="companies">
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="keywords">
            Keywords ({keywords.length})
          </TabsTrigger>
          <TabsTrigger value="discover">
            Discover
          </TabsTrigger>
        </TabsList>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <TabsContent value="companies" className="mt-4">
        <CompaniesTable companies={companies} searchQuery={searchQuery} />
      </TabsContent>

      <TabsContent value="contacts" className="mt-4">
        <AllContactsTable contacts={contacts} searchQuery={searchQuery} />
      </TabsContent>

      <TabsContent value="keywords" className="mt-4">
        <KeywordsTab keywords={keywords} />
      </TabsContent>

      <TabsContent value="discover" className="mt-4">
        <DiscoverTab />
      </TabsContent>
    </Tabs>
  );
}
