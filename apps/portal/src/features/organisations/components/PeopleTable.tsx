"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from "@timber/ui";
import { Loader2 } from "lucide-react";
import { getAllPeople, type Person } from "../actions/getAllPeople";

/**
 * People Table
 *
 * Displays all portal users across all organisations.
 */
export function PeopleTable() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPeople() {
      setLoading(true);
      const result = await getAllPeople();
      if (result.success) {
        setPeople(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    loadPeople();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="rounded-md border bg-muted/50 p-8 text-center text-muted-foreground">
        No people found
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Organisation</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <TableRow key={person.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/admin/people/${person.id}`}
                  className="text-primary hover:underline"
                >
                  {person.name}
                </Link>
              </TableCell>
              <TableCell>{person.email}</TableCell>
              <TableCell>
                <Link
                  href={`/admin/organisations/${person.organisationId}`}
                  className="text-primary hover:underline"
                >
                  {person.organisationName}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={person.role === "admin" ? "default" : "secondary"}>
                  {person.role === "admin" ? "Super Admin" : "User"}
                </Badge>
              </TableCell>
              <TableCell>
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
                  <Badge variant="destructive" className="ml-2">
                    Inactive
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
