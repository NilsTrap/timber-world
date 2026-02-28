"use client";

import { useState, useMemo } from "react";
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
import { Mail, Phone, Linkedin, Trash2, Building2 } from "lucide-react";
import type { CrmContact, CrmCompany, ConsentStatus } from "../types";
import { deleteContact } from "../actions";

type ContactWithCompany = CrmContact & {
  company: Pick<CrmCompany, "id" | "name" | "country"> | null;
};

interface AllContactsTableProps {
  contacts: ContactWithCompany[];
  searchQuery?: string;
}

const CONSENT_COLORS: Record<ConsentStatus, "default" | "success" | "warning" | "secondary"> = {
  pending: "secondary",
  subscribed: "success",
  unsubscribed: "default",
};

export function AllContactsTable({ contacts, searchQuery = "" }: AllContactsTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const searchableText = [
        contact.first_name,
        contact.last_name,
        contact.email,
        contact.phone,
        contact.position,
        contact.company?.name,
        contact.consent_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(query);
    });
  }, [contacts, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }
    setIsDeleting(id);
    await deleteContact(id);
    setIsDeleting(null);
  };

  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">No contacts yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Import companies to add their contacts, or add contacts manually from company pages.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-auto max-h-[calc(100vh-220px)] [&_[data-slot=table-container]]:overflow-visible">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="bg-card">Name</TableHead>
            <TableHead className="bg-card">Company</TableHead>
            <TableHead className="bg-card">Position</TableHead>
            <TableHead className="bg-card">Contact</TableHead>
            <TableHead className="bg-card">GDPR Status</TableHead>
            <TableHead className="w-[50px] bg-card"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredContacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No contacts match your search criteria
              </TableCell>
            </TableRow>
          ) : filteredContacts.map((contact) => (
            <TableRow
              key={contact.id}
              className={contact.do_not_contact ? "opacity-50" : ""}
            >
              <TableCell>
                <div>
                  <span className="font-medium">
                    {contact.first_name} {contact.last_name}
                  </span>
                  {contact.do_not_contact && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Do Not Contact
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {contact.company ? (
                  <Link
                    href={`/admin/crm/${contact.company.id}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    {contact.company.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{contact.position || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Linkedin className="h-3 w-3" />
                      LinkedIn
                    </a>
                  )}
                  {!contact.email && !contact.phone && !contact.linkedin_url && "—"}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={CONSENT_COLORS[contact.consent_status]}>
                  {contact.consent_status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(contact.id)}
                  disabled={isDeleting === contact.id}
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
