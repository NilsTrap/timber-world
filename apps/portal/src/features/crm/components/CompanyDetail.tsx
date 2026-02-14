"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
} from "@timber/ui";
import { PageHeader, SummaryGrid, SummaryCard, SectionHeader } from "@timber/ui";
import { ExternalLink, Save, Loader2 } from "lucide-react";
import type { CrmCompany, CrmContact, CompanyStatus } from "../types";
import { updateCompany, updateCompanyStatus } from "../actions";
import { ContactsTable } from "./ContactsTable";
import { AddContactModal } from "./AddContactModal";

interface CompanyDetailProps {
  company: CrmCompany & { contacts: CrmContact[] };
}

const STATUS_COLORS: Record<CompanyStatus, "default" | "success" | "warning" | "secondary"> = {
  new: "warning",
  researching: "secondary",
  contacted: "secondary",
  customer: "success",
  rejected: "default",
  archived: "default",
};

export function CompanyDetail({ company }: CompanyDetailProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<CompanyStatus>(company.status);
  const [formData, setFormData] = useState({
    name: company.name || "",
    website: company.website || "",
    email: company.email || "",
    phone: company.phone || "",
    address: company.address || "",
    city: company.city || "",
    postal_code: company.postal_code || "",
    country: company.country || "",
    industry: company.industry || "",
    employees: company.employees?.toString() || "",
    turnover_eur: company.turnover_eur?.toString() || "",
    notes: company.notes || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateCompany(company.id, {
      ...formData,
      employees: formData.employees ? parseInt(formData.employees, 10) : null,
      turnover_eur: formData.turnover_eur ? parseInt(formData.turnover_eur, 10) : null,
    });
    setIsSaving(false);
  };

  const handleStatusChange = async (status: CompanyStatus) => {
    setCurrentStatus(status);
    await updateCompanyStatus(company.id, status);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        backHref="/admin/crm"
        backLabel="Back to CRM"
        title={company.name}
        subtitle={
          company.registration_number
            ? `Registration: ${company.registration_number}`
            : undefined
        }
        badge={
          <Badge variant={STATUS_COLORS[currentStatus]}>
            {currentStatus}
          </Badge>
        }
        actions={
          <div className="flex gap-2">
            <select
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value as CompanyStatus)}
              className="text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="new">New</option>
              <option value="researching">Researching</option>
              <option value="contacted">Contacted</option>
              <option value="customer">Customer</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
            {company.source_url && (
              <Button variant="outline" asChild>
                <a href={company.source_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Source
                </a>
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <SummaryGrid columns={4}>
        <SummaryCard
          label="Location"
          value={[company.city, company.country].filter(Boolean).join(", ") || "—"}
        />
        <SummaryCard
          label="Founded"
          value={company.founded_year?.toString() || "—"}
        />
        <SummaryCard
          label="Employees"
          value={company.employees?.toLocaleString() || "—"}
        />
        <SummaryCard
          label="Contacts"
          value={company.contacts.length.toString()}
        />
      </SummaryGrid>

      {/* Company Details Form */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Company Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Company Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              value={formData.postal_code}
              onChange={(e) => handleChange("postal_code", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleChange("country", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={formData.industry}
              onChange={(e) => handleChange("industry", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="employees">Employees</Label>
            <Input
              id="employees"
              type="number"
              value={formData.employees}
              onChange={(e) => handleChange("employees", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="turnover_eur">Annual Turnover (EUR)</Label>
            <Input
              id="turnover_eur"
              type="number"
              value={formData.turnover_eur}
              onChange={(e) => handleChange("turnover_eur", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Contacts Section */}
      <div className="space-y-3">
        <SectionHeader
          title="Contacts"
          subtitle={`${company.contacts.length} contact${company.contacts.length !== 1 ? "s" : ""}`}
          action={<AddContactModal companyId={company.id} />}
        />
        <ContactsTable contacts={company.contacts} />
      </div>
    </div>
  );
}
