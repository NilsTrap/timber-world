"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import type { Process } from "../types";

interface ProcessesTabProps {
  processes: Process[];
}

/**
 * ProcessesTab
 *
 * Displays all available production processes with their codes.
 */
export function ProcessesTab({ processes }: ProcessesTabProps) {
  if (processes.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">No processes available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Code</TableHead>
            <TableHead>Process Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processes.map((process) => (
            <TableRow key={process.id}>
              <TableCell className="font-mono font-medium">
                {process.code}
              </TableCell>
              <TableCell>{process.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
