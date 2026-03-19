"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  ColumnHeaderMenu,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ColumnSortState,
} from "@timber/ui";
import { ExternalLink, Trash2, Users, X } from "lucide-react";
import type { CrmCompany, CrmKeyword, CompanyStatus } from "../types";
import type { CompanyWithKeywords } from "../actions/getCompanies";
import { updateCompanyStatus, deleteCompany } from "../actions";

interface CompaniesTableProps {
  companies: CompanyWithKeywords[];
  searchQuery?: string;
}

type ColumnKey = "name" | "website" | "phone" | "email" | "location" | "industry" | "founded_year" | "registration_number" | "account_type" | "employees" | "turnover_eur" | "contacts_count" | "keywords" | "status";

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "—";
  if (value >= 1000000) {
    return `€${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `€${(value / 1000).toFixed(0)}K`;
  }
  return `€${value}`;
}

function formatNumber(value: number | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleString();
}

function getColumnValue(company: CompanyWithKeywords, key: ColumnKey): string {
  switch (key) {
    case "name":
      return company.name || "";
    case "website":
      return company.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";
    case "phone":
      return company.phone || "";
    case "email":
      return company.email || "";
    case "location":
      return [company.city, company.country].filter(Boolean).join(", ");
    case "industry":
      return company.industry || company.industry_codes?.join(", ") || "";
    case "founded_year":
      return company.founded_year?.toString() || "";
    case "registration_number":
      return company.registration_number || "";
    case "account_type":
      return company.account_type || "";
    case "employees":
      return company.employees?.toString() || "";
    case "turnover_eur":
      return company.turnover_eur?.toString() || "";
    case "contacts_count":
      return (company.contacts_count || 0).toString();
    case "keywords":
      return company.keywords?.map((k) => k.name).join(", ") || "";
    case "status":
      return company.status || "";
    default:
      return "";
  }
}

export function CompaniesTable({ companies, searchQuery = "" }: CompaniesTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<ColumnSortState | null>({ column: "name", direction: "asc" });
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

  // Get unique values for each column (cascading: filtered by all OTHER active filters)
  const uniqueValues = useMemo(() => {
    const allKeys: ColumnKey[] = [
      "name", "website", "phone", "email", "location", "industry",
      "founded_year", "registration_number", "account_type", "employees",
      "turnover_eur", "contacts_count", "keywords", "status",
    ];

    const values: Record<ColumnKey, string[]> = {} as Record<ColumnKey, string[]>;

    for (const key of allKeys) {
      // Apply all filters EXCEPT the current column
      let filtered = companies;
      for (const otherKey of allKeys) {
        if (otherKey === key) continue;
        const filterSet = columnFilters[otherKey];
        if (!filterSet || filterSet.size === 0) continue;
        if (otherKey === "keywords") {
          filtered = filtered.filter((company) =>
            company.keywords?.some((k) => filterSet.has(k.name)) || false
          );
        } else {
          filtered = filtered.filter((company) => {
            const val = getColumnValue(company, otherKey);
            return filterSet.has(val);
          });
        }
      }

      const set = new Set<string>();
      if (key === "keywords") {
        filtered.forEach((company) => {
          company.keywords?.forEach((k) => {
            if (k.name) set.add(k.name);
          });
        });
      } else {
        filtered.forEach((company) => {
          const val = getColumnValue(company, key);
          if (val) set.add(val);
        });
      }
      values[key] = Array.from(set);
    }

    return values;
  }, [companies, columnFilters]);

  // Filter and sort companies
  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((company) => {
        const searchableText = [
          company.name,
          company.website,
          company.city,
          company.country,
          company.industry,
          company.registration_number,
          company.status,
          company.founded_year?.toString(),
          company.employees?.toString(),
          ...(company.keywords?.map((k) => k.name) || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
    }

    // Apply column filters
    (Object.keys(columnFilters) as ColumnKey[]).forEach((key) => {
      const filterSet = columnFilters[key];
      if (filterSet && filterSet.size > 0) {
        if (key === "keywords") {
          // Special handling for keywords - match if any keyword is in filter
          result = result.filter((company) => {
            return company.keywords?.some((k) => filterSet.has(k.name)) || false;
          });
        } else {
          result = result.filter((company) => {
            const val = getColumnValue(company, key);
            return filterSet.has(val);
          });
        }
      }
    });

    // Apply sorting
    if (activeSort) {
      const { column, direction } = activeSort;
      result.sort((a, b) => {
        const aVal = getColumnValue(a, column as ColumnKey);
        const bVal = getColumnValue(b, column as ColumnKey);

        // Try numeric comparison for numeric columns
        const numericColumns = ["founded_year", "employees", "turnover_eur", "contacts_count"];
        if (numericColumns.includes(column)) {
          const aNum = parseFloat(aVal) || 0;
          const bNum = parseFloat(bVal) || 0;
          return direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        const cmp = aVal.localeCompare(bVal);
        return direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [companies, searchQuery, activeSort, columnFilters]);

  const handleFilterChange = useCallback((columnKey: string, values: Set<string>) => {
    setColumnFilters((prev) => ({
      ...prev,
      [columnKey]: values,
    }));
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Object.values(columnFilters).some((set) => set.size > 0) || activeSort !== null;
  }, [columnFilters, activeSort]);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setActiveSort(null);
  }, []);

  const handleStatusChange = async (id: string, status: CompanyStatus) => {
    await updateCompanyStatus(id, status);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company and all its contacts?")) {
      return;
    }
    setIsDeleting(id);
    await deleteCompany(id);
    setIsDeleting(null);
  };

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">No companies yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Use the &quot;Discover Companies&quot; button to search and import companies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter status bar */}
      {hasActiveFilters && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear filters
          </Button>
          <div className="text-sm text-muted-foreground">
            {filteredCompanies.length} of {companies.length} companies
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-auto max-h-[calc(100vh-220px)] [&_[data-slot=table-container]]:overflow-visible">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Company
                  <ColumnHeaderMenu
                    columnKey="name"
                    uniqueValues={uniqueValues.name}
                    activeSort={activeSort}
                    activeFilter={columnFilters.name || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Website
                  <ColumnHeaderMenu
                    columnKey="website"
                    uniqueValues={uniqueValues.website}
                    activeSort={activeSort}
                    activeFilter={columnFilters.website || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Phone
                  <ColumnHeaderMenu
                    columnKey="phone"
                    uniqueValues={uniqueValues.phone}
                    activeSort={activeSort}
                    activeFilter={columnFilters.phone || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Email
                  <ColumnHeaderMenu
                    columnKey="email"
                    uniqueValues={uniqueValues.email}
                    activeSort={activeSort}
                    activeFilter={columnFilters.email || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Location
                  <ColumnHeaderMenu
                    columnKey="location"
                    uniqueValues={uniqueValues.location}
                    activeSort={activeSort}
                    activeFilter={columnFilters.location || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Industry
                  <ColumnHeaderMenu
                    columnKey="industry"
                    uniqueValues={uniqueValues.industry}
                    activeSort={activeSort}
                    activeFilter={columnFilters.industry || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Founded
                  <ColumnHeaderMenu
                    columnKey="founded_year"
                    isNumeric
                    uniqueValues={uniqueValues.founded_year}
                    activeSort={activeSort}
                    activeFilter={columnFilters.founded_year || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  <span className="whitespace-nowrap">Reg. No.</span>
                  <ColumnHeaderMenu
                    columnKey="registration_number"
                    uniqueValues={uniqueValues.registration_number}
                    activeSort={activeSort}
                    activeFilter={columnFilters.registration_number || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  <span className="whitespace-nowrap">Account Type</span>
                  <ColumnHeaderMenu
                    columnKey="account_type"
                    uniqueValues={uniqueValues.account_type}
                    activeSort={activeSort}
                    activeFilter={columnFilters.account_type || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Employees
                  <ColumnHeaderMenu
                    columnKey="employees"
                    isNumeric
                    uniqueValues={uniqueValues.employees}
                    activeSort={activeSort}
                    activeFilter={columnFilters.employees || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Turnover
                  <ColumnHeaderMenu
                    columnKey="turnover_eur"
                    isNumeric
                    uniqueValues={uniqueValues.turnover_eur}
                    activeSort={activeSort}
                    activeFilter={columnFilters.turnover_eur || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Contacts
                  <ColumnHeaderMenu
                    columnKey="contacts_count"
                    isNumeric
                    uniqueValues={uniqueValues.contacts_count}
                    activeSort={activeSort}
                    activeFilter={columnFilters.contacts_count || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Keywords
                  <ColumnHeaderMenu
                    columnKey="keywords"
                    uniqueValues={uniqueValues.keywords}
                    activeSort={activeSort}
                    activeFilter={columnFilters.keywords || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="bg-card">
                <div className="flex items-center gap-1">
                  Status
                  <ColumnHeaderMenu
                    columnKey="status"
                    uniqueValues={uniqueValues.status}
                    activeSort={activeSort}
                    activeFilter={columnFilters.status || new Set()}
                    onSortChange={setActiveSort}
                    onFilterChange={handleFilterChange}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[50px] bg-card"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                  No companies match your search criteria
                </TableCell>
              </TableRow>
            ) : (
              filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[150px] overflow-hidden">
                            <Link
                              href={`/admin/crm/${company.id}`}
                              className="font-medium hover:underline whitespace-nowrap"
                            >
                              {company.name}
                            </Link>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{company.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {company.website ? (
                      <a
                        href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="max-w-[150px] truncate">
                          {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm whitespace-nowrap">
                      {company.phone || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {company.email ? (
                      <a
                        href={`mailto:${company.email}`}
                        className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
                      >
                        {company.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span>{company.city || "—"}</span>
                    {company.country && (
                      <span className="text-muted-foreground">, {company.country}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[150px] overflow-hidden">
                            <span className="text-sm whitespace-nowrap">
                              {company.industry || company.industry_codes?.join(", ") || "—"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        {(company.industry || company.industry_codes?.length) && (
                          <TooltipContent>
                            <p className="max-w-[300px]">{company.industry || company.industry_codes?.join(", ")}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>{company.founded_year || "—"}</TableCell>
                  <TableCell>{company.registration_number || "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs whitespace-nowrap">
                      {company.account_type || "—"}
                    </span>
                  </TableCell>
                  <TableCell>{formatNumber(company.employees)}</TableCell>
                  <TableCell>{formatCurrency(company.turnover_eur)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{company.contacts_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[120px] overflow-hidden">
                            <div className="flex gap-1 whitespace-nowrap">
                              {company.keywords?.length > 0 ? (
                                company.keywords.map((keyword) => (
                                  <span
                                    key={keyword.id}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted"
                                  >
                                    {keyword.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        {company.keywords?.length > 0 && (
                          <TooltipContent>
                            <p>{company.keywords.map((k) => k.name).join(", ")}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <select
                      value={company.status}
                      onChange={(e) => handleStatusChange(company.id, e.target.value as CompanyStatus)}
                      className="text-xs border rounded px-2 py-1 bg-background"
                    >
                      <option value="new">New</option>
                      <option value="researching">Researching</option>
                      <option value="contacted">Contacted</option>
                      <option value="customer">Customer</option>
                      <option value="rejected">Rejected</option>
                      <option value="archived">Archived</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(company.id)}
                      disabled={isDeleting === company.id}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
