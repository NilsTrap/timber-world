"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@timber/ui";
import { User } from "lucide-react";
import type { PersonDetail } from "../actions/getPersonById";

interface PersonDetailTabsProps {
  person: PersonDetail;
  defaultTab?: string;
}

export function PersonDetailTabs({
  person,
}: PersonDetailTabsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Person Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p className="text-lg">{person.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-lg">{person.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Role
            </label>
            <div className="mt-1">
              <Badge variant={person.role === "admin" ? "default" : "secondary"}>
                {person.role === "admin" ? "Super Admin" : "User"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Organisation
            </label>
            <div className="mt-1">
              {person.organisationId ? (
                <Link
                  href={`/admin/organisations/${person.organisationId}`}
                  className="text-primary hover:underline"
                >
                  {person.organisationName} ({person.organisationCode})
                </Link>
              ) : (
                <p className="text-muted-foreground">No organisation</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Status
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant={
                  person.status === "active"
                    ? "default"
                    : person.status === "invited"
                    ? "secondary"
                    : "outline"
                }
              >
                {person.status}
              </Badge>
              {!person.isActive && (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Last Login
            </label>
            <p className="text-sm mt-1">
              {person.lastLoginAt
                ? new Date(person.lastLoginAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Created
            </label>
            <p className="text-sm">
              {new Date(person.createdAt).toLocaleDateString("en-GB", {
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
              {new Date(person.updatedAt).toLocaleDateString("en-GB", {
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
  );
}
