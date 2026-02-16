"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@timber/ui";
import { referenceOptionSchema } from "../schemas";
import { createReferenceOption, updateReferenceOption } from "../actions";
import type { ReferenceTableName, ReferenceOption } from "../types";

interface ReferenceOptionFormProps {
  tableName: ReferenceTableName;
  option?: ReferenceOption | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Reference Option Form
 *
 * Dialog form for adding or editing a reference option.
 */
export function ReferenceOptionForm({
  tableName,
  option,
  open,
  onOpenChange,
  onSuccess,
}: ReferenceOptionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!option;
  const isProcesses = tableName === "ref_processes";

  // Form values before schema transformation
  type FormValues = {
    value: string;
    code?: string;
    workUnit?: string;
    workFormula?: string;
    price?: string;
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(referenceOptionSchema) as any,
    defaultValues: {
      value: option?.value ?? "",
      ...(isProcesses ? {
        code: option?.code ?? "",
        workUnit: option?.workUnit ?? "",
        workFormula: option?.workFormula ?? "",
        price: option?.price != null ? String(option.price).replace('.', ',') : "",
      } : {}),
    },
  });

  // Reset form when option changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({
        value: option?.value ?? "",
        ...(isProcesses ? {
          code: option?.code ?? "",
          workUnit: option?.workUnit ?? "",
          workFormula: option?.workFormula ?? "",
          price: option?.price != null ? String(option.price).replace('.', ',') : "",
        } : {}),
      });
    }
  }, [open, option, reset, isProcesses]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    // Convert price from string (with comma) to number | null for server action
    // Note: zod might have already transformed price to number, so handle both cases
    let priceValue: number | null = null;
    if (data.price != null && data.price !== "") {
      if (typeof data.price === "number") {
        priceValue = data.price;
      } else {
        priceValue = parseFloat(String(data.price).replace(',', '.'));
      }
      if (isNaN(priceValue)) priceValue = null;
    }
    const payload = {
      ...data,
      price: priceValue,
    };

    try {
      const result = isEditing
        ? await updateReferenceOption(tableName, option.id, payload)
        : await createReferenceOption(tableName, payload);

      if (result.success) {
        toast.success(isEditing ? "Option updated" : "Option added");
        reset();
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Option" : "Add Option"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              placeholder="Enter option value"
              {...register("value")}
              aria-invalid={!!errors.value}
            />
            {errors.value && (
              <p className="text-sm text-destructive">{errors.value.message}</p>
            )}
          </div>

          {isProcesses && (
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="e.g. PL, MS, OC"
                className="uppercase"
                maxLength={10}
                {...register("code", {
                  setValueAs: (v: string) => v?.toUpperCase(),
                })}
                aria-invalid={!!errors.code}
              />
              <p className="text-xs text-muted-foreground">
                Short code used for output package numbering (e.g. PL-001)
              </p>
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>
          )}

          {isProcesses && (
            <div className="space-y-2">
              <Label htmlFor="workUnit">Work Unit</Label>
              <Input
                id="workUnit"
                placeholder="e.g. m, m², m³, pkg, h"
                maxLength={10}
                {...register("workUnit")}
                aria-invalid={!!errors.workUnit}
              />
              <p className="text-xs text-muted-foreground">
                Unit of measurement for work done (m = meters, m² = square meters, m³ = cubic meters, pkg = packages, h = hours)
              </p>
              {errors.workUnit && (
                <p className="text-sm text-destructive">{errors.workUnit.message}</p>
              )}
            </div>
          )}

          {isProcesses && (
            <div className="space-y-2">
              <Label htmlFor="workFormula">Work Formula</Label>
              <select
                id="workFormula"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("workFormula")}
              >
                <option value="">No formula (manual entry)</option>
                <option value="length_x_pieces">Length × Pieces (meters)</option>
                <option value="area">Length × Width × Pieces (m²)</option>
                <option value="volume">Total Volume (m³)</option>
                <option value="pieces">Total Pieces (input)</option>
                <option value="output_packages">Output Packages (count)</option>
                <option value="hours">Manual Hours</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Formula used to auto-calculate planned work from inputs/outputs
              </p>
            </div>
          )}

          {isProcesses && (
            <div className="space-y-2">
              <Label htmlFor="price">Price per Unit</Label>
              <Input
                id="price"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 15,00"
                {...register("price")}
                aria-invalid={!!errors.price}
              />
              <p className="text-xs text-muted-foreground">
                Price per work unit (shown as read-only in production view)
              </p>
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price.message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
