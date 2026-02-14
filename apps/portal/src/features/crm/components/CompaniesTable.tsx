"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
} from "@timber/ui";
import { ExternalLink, Trash2, Users } from "lucide-react";
import type { CrmCompany, CompanyStatus } from "../types";
import { updateCompanyStatus, deleteCompany } from "../actions";

interface CompaniesTableProps {
  companies: CrmCompany[];
}

const STATUS_COLORS: Record<CompanyStatus, "default" | "success" | "warning" | "secondary"> = {
  new: "warning",
  researching: "secondary",
  contacted: "secondary",
  customer: "success",
  rejected: "default",
  archived: "default",
};

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

export function CompaniesTable({ companies }: CompaniesTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Founded</TableHead>
            <TableHead>Employees</TableHead>
            <TableHead>Turnover</TableHead>
            <TableHead>Contacts</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id}>
              <TableCell>
                <div className="min-w-[200px]">
                  <Link
                    href={`/admin/crm/${company.id}`}
                    className="font-medium hover:underline"
                  >
                    {company.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    {company.website && (
                      <a
                        href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Website
                      </a>
                    )}
                    {company.registration_number && (
                      <span className="text-xs text-muted-foreground">
                        Reg: {company.registration_number}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span>{company.city || "—"}</span>
                {company.country && (
                  <span className="text-muted-foreground">, {company.country}</span>
                )}
              </TableCell>
              <TableCell className="max-w-[200px]">
                <span className="line-clamp-2 text-sm">
                  {company.industry || company.industry_codes?.join(", ") || "—"}
                </span>
              </TableCell>
              <TableCell>{company.founded_year || "—"}</TableCell>
              <TableCell>{formatNumber(company.employees)}</TableCell>
              <TableCell>{formatCurrency(company.turnover_eur)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span>{company.contacts_count || 0}</span>
                </div>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
