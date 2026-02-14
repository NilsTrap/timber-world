"use client";

import { useState } from "react";
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
import { Mail, Phone, Linkedin, Trash2, UserX, Shield } from "lucide-react";
import type { CrmContact, ConsentStatus } from "../types";
import { deleteContact, unsubscribeContact, requestContactDeletion } from "../actions";

interface ContactsTableProps {
  contacts: CrmContact[];
}

const CONSENT_COLORS: Record<ConsentStatus, "default" | "success" | "warning" | "secondary"> = {
  pending: "secondary",
  subscribed: "success",
  unsubscribed: "default",
};

export function ContactsTable({ contacts }: ContactsTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }
    setIsDeleting(id);
    await deleteContact(id);
    setIsDeleting(null);
  };

  const handleUnsubscribe = async (id: string) => {
    if (!confirm("Mark this contact as unsubscribed? They will not receive any communications.")) {
      return;
    }
    await unsubscribeContact(id, "Manual unsubscribe by admin");
  };

  const handleGdprDelete = async (id: string) => {
    if (!confirm("Mark this contact for GDPR deletion? This flags them for data removal.")) {
      return;
    }
    await requestContactDeletion(id);
  };

  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No contacts for this company yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add contacts manually or they will be imported from company registries.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>GDPR Status</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
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
                  {contact.deletion_requested && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Deletion Requested
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{contact.position || "—"}</TableCell>
              <TableCell>
                <div className="flex gap-2">
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
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Linkedin className="h-3 w-3" />
                    </a>
                  )}
                  {!contact.email && !contact.phone && "—"}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={CONSENT_COLORS[contact.consent_status]}>
                  {contact.consent_status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {!contact.do_not_contact && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleUnsubscribe(contact.id)}
                      title="Mark Unsubscribed"
                    >
                      <UserX className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {!contact.deletion_requested && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGdprDelete(contact.id)}
                      title="GDPR Deletion Request"
                    >
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(contact.id)}
                    disabled={isDeleting === contact.id}
                    title="Delete Contact"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
