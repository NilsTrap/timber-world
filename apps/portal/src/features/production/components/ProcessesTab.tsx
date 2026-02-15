"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Textarea,
  Input,
} from "@timber/ui";
import { Pencil, Check, X } from "lucide-react";
import { saveProcessNote, saveProcessWorkUnit } from "../actions";
import { PrintProcessesButton } from "./PrintProcessesButton";
import type { ProcessWithNotes } from "../types";

interface ProcessesTabProps {
  processes: ProcessWithNotes[];
  organizationName?: string;
  organizationId?: string;
}

/**
 * ProcessesTab
 *
 * Displays all available production processes with their codes and
 * organization-specific notes. Users can edit notes inline.
 */
export function ProcessesTab({ processes: initialProcesses, organizationName, organizationId }: ProcessesTabProps) {
  const [processes, setProcesses] = useState(initialProcesses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingWorkUnitId, setEditingWorkUnitId] = useState<string | null>(null);
  const [editWorkUnitValue, setEditWorkUnitValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const workUnitInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea when editing notes
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editValue.length, editValue.length);
    }
  }, [editingId]);

  // Focus input when editing work unit
  useEffect(() => {
    if (editingWorkUnitId && workUnitInputRef.current) {
      workUnitInputRef.current.focus();
      workUnitInputRef.current.select();
    }
  }, [editingWorkUnitId]);

  const handleStartEdit = useCallback((process: ProcessWithNotes) => {
    setEditingId(process.id);
    setEditValue(process.notes);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  const handleSave = useCallback((processId: string) => {
    startTransition(async () => {
      const result = await saveProcessNote({
        processId,
        notes: editValue,
        organizationId,
      });

      if (result.success) {
        // Update local state
        setProcesses((prev) =>
          prev.map((p) =>
            p.id === processId
              ? { ...p, notes: editValue, noteId: result.data.id }
              : p
          )
        );
        setEditingId(null);
        setEditValue("");
        toast.success("Note saved");
      } else {
        toast.error(result.error);
      }
    });
  }, [editValue, organizationId]);

  // Work Unit editing
  const handleStartEditWorkUnit = useCallback((process: ProcessWithNotes) => {
    setEditingWorkUnitId(process.id);
    setEditWorkUnitValue(process.workUnit || "");
  }, []);

  const handleCancelEditWorkUnit = useCallback(() => {
    setEditingWorkUnitId(null);
    setEditWorkUnitValue("");
  }, []);

  const handleSaveWorkUnit = useCallback((processId: string) => {
    startTransition(async () => {
      const result = await saveProcessWorkUnit({
        processId,
        workUnit: editWorkUnitValue,
      });

      if (result.success) {
        setProcesses((prev) =>
          prev.map((p) =>
            p.id === processId
              ? { ...p, workUnit: editWorkUnitValue || null }
              : p
          )
        );
        setEditingWorkUnitId(null);
        setEditWorkUnitValue("");
        toast.success("Work unit saved");
      } else {
        toast.error(result.error);
      }
    });
  }, [editWorkUnitValue]);

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent, processId: string) => {
    if (e.key === "Escape") {
      handleCancelEdit();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave(processId);
    }
  }, [handleCancelEdit, handleSave]);

  // Handle keyboard shortcuts for work unit
  const handleWorkUnitKeyDown = useCallback((e: React.KeyboardEvent, processId: string) => {
    if (e.key === "Escape") {
      handleCancelEditWorkUnit();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSaveWorkUnit(processId);
    }
  }, [handleCancelEditWorkUnit, handleSaveWorkUnit]);

  if (processes.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">No processes available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Add descriptions for each process. These notes are specific to your organization.
          </p>
        </div>
        <PrintProcessesButton processes={processes} organizationName={organizationName} />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead className="w-40">Process Name</TableHead>
              <TableHead className="w-24">Work Unit</TableHead>
              <TableHead>Description / Notes</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.map((process) => (
              <TableRow key={process.id}>
                <TableCell className="font-mono font-medium align-top">
                  {process.code}
                </TableCell>
                <TableCell className="align-top">{process.value}</TableCell>
                <TableCell className="align-top">
                  {editingWorkUnitId === process.id ? (
                    <div className="flex gap-1 items-center">
                      <Input
                        ref={workUnitInputRef}
                        value={editWorkUnitValue}
                        onChange={(e) => setEditWorkUnitValue(e.target.value)}
                        onKeyDown={(e) => handleWorkUnitKeyDown(e, process.id)}
                        placeholder="m, m², m³..."
                        className="h-7 w-16 text-sm"
                        disabled={isPending}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveWorkUnit(process.id)}
                        disabled={isPending}
                        className="h-7 w-7 p-0"
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEditWorkUnit}
                        disabled={isPending}
                        className="h-7 w-7 p-0"
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="text-sm cursor-pointer hover:text-primary"
                      onClick={() => handleStartEditWorkUnit(process)}
                      title="Click to edit"
                    >
                      {process.workUnit || (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {editingId === process.id ? (
                    <Textarea
                      ref={textareaRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, process.id)}
                      placeholder="Add description or notes..."
                      className="min-h-[80px] text-sm"
                      disabled={isPending}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">
                      {process.notes || (
                        <span className="text-muted-foreground italic">
                          Click edit to add notes...
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {editingId === process.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(process.id)}
                        disabled={isPending}
                        title="Save (Ctrl+Enter)"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={isPending}
                        title="Cancel (Escape)"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(process)}
                      title="Edit notes"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Press Ctrl+Enter to save, Escape to cancel
      </p>
    </div>
  );
}
