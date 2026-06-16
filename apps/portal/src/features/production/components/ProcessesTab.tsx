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
  Input,
  Textarea,
} from "@timber/ui";
import { Pencil, Check, X } from "lucide-react";
import { saveProcessNote, saveProcessPalletPrice } from "../actions";
import { PrintProcessesButton } from "./PrintProcessesButton";
import { getFormulaDescription } from "../utils/calculateWorkAmount";
import type { ProcessWithNotes } from "../types";

interface ProcessesTabProps {
  processes: ProcessWithNotes[];
  organizationName?: string;
  organizationId?: string;
  /** Show pallet price as a read-only value for non-admins. Only platform admins
   *  may edit it (server action enforces this too). */
  canEditPalletPrice?: boolean;
}

/**
 * ProcessesTab
 *
 * Displays all available production processes with their codes and
 * organization-specific notes. Users can edit notes inline.
 */
export function ProcessesTab({ processes: initialProcesses, organizationName, organizationId, canEditPalletPrice = false }: ProcessesTabProps) {
  const [processes, setProcesses] = useState(initialProcesses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inline edit state for pallet price (Packing only).
  const [editingPalletPriceId, setEditingPalletPriceId] = useState<string | null>(null);
  const [palletPriceDraft, setPalletPriceDraft] = useState("");
  const [isSavingPalletPrice, setIsSavingPalletPrice] = useState(false);

  const handlePalletPriceSave = useCallback(async (process: ProcessWithNotes) => {
    setIsSavingPalletPrice(true);
    const trimmed = palletPriceDraft.trim().replace(",", ".");
    const numeric = trimmed === "" ? null : parseFloat(trimmed);
    if (numeric !== null && (isNaN(numeric) || numeric < 0)) {
      toast.error("Pallet price must be a non-negative number");
      setIsSavingPalletPrice(false);
      return;
    }
    const result = await saveProcessPalletPrice({
      processId: process.id,
      palletPrice: numeric,
    });
    if (result.success) {
      setProcesses((prev) =>
        prev.map((p) => (p.id === process.id ? { ...p, palletPrice: numeric } : p))
      );
      setEditingPalletPriceId(null);
      setPalletPriceDraft("");
      toast.success("Pallet price saved");
    } else {
      toast.error(result.error);
    }
    setIsSavingPalletPrice(false);
  }, [palletPriceDraft]);

  // Focus textarea when editing notes
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editValue.length, editValue.length);
    }
  }, [editingId]);

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

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent, processId: string) => {
    if (e.key === "Escape") {
      handleCancelEdit();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave(processId);
    }
  }, [handleCancelEdit, handleSave]);

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
        <Table dense>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead className="w-40">Process Name</TableHead>
              <TableHead className="w-24">Work Unit</TableHead>
              <TableHead className="w-56">Formula</TableHead>
              <TableHead className="w-28">Price</TableHead>
              <TableHead className="w-32">Pallet Price</TableHead>
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
                <TableCell className="align-top text-sm">
                  {process.workUnit || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="align-top text-xs text-muted-foreground">
                  {process.workFormula ? getFormulaDescription(process.workFormula) : (
                    <span>—</span>
                  )}
                </TableCell>
                <TableCell className="align-top text-sm">
                  {process.price != null ? (
                    <span>
                      {process.price.toFixed(2).replace('.', ',')}
                      {process.workUnit && <span className="text-muted-foreground text-xs ml-1">/ {process.workUnit}</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="align-top text-sm">
                  {process.code === "PC" ? (
                    canEditPalletPrice ? (
                      editingPalletPriceId === process.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={palletPriceDraft}
                            onChange={(e) => setPalletPriceDraft(e.target.value)}
                            onBlur={() => handlePalletPriceSave(process)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handlePalletPriceSave(process);
                              if (e.key === "Escape") { setEditingPalletPriceId(null); setPalletPriceDraft(""); }
                            }}
                            disabled={isSavingPalletPrice}
                            className="h-7 w-20 text-sm"
                            placeholder="0,00"
                          />
                          <span className="text-muted-foreground text-xs">/ pallet</span>
                        </div>
                      ) : (
                        <button
                          className="text-left hover:bg-muted/60 rounded px-1 py-0.5 -mx-1 transition-colors w-full"
                          onClick={() => {
                            setEditingPalletPriceId(process.id);
                            setPalletPriceDraft(process.palletPrice != null ? process.palletPrice.toFixed(2).replace(".", ",") : "");
                          }}
                          title="Click to edit pallet price"
                        >
                          {process.palletPrice != null ? (
                            <span>
                              {process.palletPrice.toFixed(2).replace('.', ',')}
                              <span className="text-muted-foreground text-xs ml-1">/ pallet</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">— (click to set)</span>
                          )}
                        </button>
                      )
                    ) : process.palletPrice != null ? (
                      <span>
                        {process.palletPrice.toFixed(2).replace('.', ',')}
                        <span className="text-muted-foreground text-xs ml-1">/ pallet</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
