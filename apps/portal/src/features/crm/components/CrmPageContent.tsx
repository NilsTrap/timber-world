"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, Input } from "@timber/ui";
import { Search } from "lucide-react";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { CompaniesTable } from "./CompaniesTable";
import { AllContactsTable } from "./AllContactsTable";
import { DiscoverTab } from "./DiscoverTab";
import { KeywordsTab } from "./KeywordsTab";
import { IndustriesTab } from "./IndustriesTab";
import { CompanyTypesTab } from "./CompanyTypesTab";
import type { CrmCompany, CrmContact, CrmKeyword, CrmIndustry, CrmCompanyType } from "../types";
import type { CompanyWithKeywords } from "../actions/getCompanies";

type ContactWithCompany = CrmContact & {
  company: Pick<CrmCompany, "id" | "name" | "country"> | null;
};

interface CrmPageContentProps {
  companies: CompanyWithKeywords[];
  contacts: ContactWithCompany[];
  keywords: CrmKeyword[];
  industries: CrmIndustry[];
  companyTypes: CrmCompanyType[];
}

export function CrmPageContent({ companies, contacts, keywords, industries, companyTypes }: CrmPageContentProps) {
  const [activeTab, setActiveTab] = usePersistedTab("crm-tab", "companies");
  const [searchQuery, setSearchQuery] = useState("");

  // Page-level scroll persistence (works across all tabs)
  useEffect(() => {
    const scrollKey = "crm-page-scroll";
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      const y = parseInt(saved, 10);
      if (!isNaN(y)) requestAnimationFrame(() => window.scrollTo(0, y));
      sessionStorage.removeItem(scrollKey);
    }

    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      }, 150);
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
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
          <TabsTrigger value="industries">
            Industry ({industries.length})
          </TabsTrigger>
          <TabsTrigger value="companyTypes">
            Type ({companyTypes.length})
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

      <TabsContent value="industries" className="mt-4">
        <IndustriesTab industries={industries} />
      </TabsContent>

      <TabsContent value="companyTypes" className="mt-4">
        <CompanyTypesTab companyTypes={companyTypes} />
      </TabsContent>

      <TabsContent value="discover" className="mt-4">
        <DiscoverTab />
      </TabsContent>
    </Tabs>
  );
}
