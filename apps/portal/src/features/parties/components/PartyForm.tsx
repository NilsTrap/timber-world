"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
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
import { createPartySchema, updatePartySchema } from "../schemas";
import { createParty, updateParty } from "../actions";
import type { Party } from "../types";

interface PartyFormProps {
  party?: Party | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Combined schema for form validation
const formSchema = z.object({
  code: z
    .string()
    .length(3, "Code must be exactly 3 characters")
    .refine((val) => !val || /^[A-Z]/.test(val.toUpperCase()), {
      message: "First character must be a letter (A-Z), not a number",
    })
    .refine((val) => !val || /^[A-Z][A-Z0-9]{2}$/.test(val.toUpperCase()), {
      message: "Code must be a letter followed by 2 letters or numbers",
    })
    .optional()
    .or(z.literal("")),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
});

type FormInput = z.infer<typeof formSchema>;

/**
 * Party Form
 *
 * Dialog form for adding or editing a party.
 * When editing, the code field is disabled (immutable).
 */
export function PartyForm({
  party,
  open,
  onOpenChange,
  onSuccess,
}: PartyFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!party;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(isEditing ? updatePartySchema : createPartySchema),
    defaultValues: {
      code: party?.code ?? "",
      name: party?.name ?? "",
    },
  });

  // Reset form when party changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({
        code: party?.code ?? "",
        name: party?.name ?? "",
      });
    }
  }, [open, party, reset]);

  // Auto-uppercase the code field
  const codeValue = watch("code");
  useEffect(() => {
    if (codeValue && !isEditing) {
      const uppercased = codeValue.toUpperCase().slice(0, 3);
      if (uppercased !== codeValue) {
        setValue("code", uppercased);
      }
    }
  }, [codeValue, isEditing, setValue]);

  const onSubmit = async (data: FormInput) => {
    setIsSubmitting(true);

    try {
      if (isEditing) {
        const result = await updateParty(party.id, { name: data.name });
        if (result.success) {
          toast.success("Party updated");
          reset();
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(result.error);
        }
      } else {
        if (!data.code) {
          toast.error("Code is required");
          setIsSubmitting(false);
          return;
        }
        const result = await createParty({ code: data.code, name: data.name });
        if (result.success) {
          toast.success("Party created");
          reset();
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(result.error);
        }
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
          <DialogTitle>{isEditing ? "Edit Party" : "Add Party"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              placeholder="ABC"
              maxLength={3}
              {...register("code")}
              disabled={isEditing}
              aria-invalid={!!errors.code}
              className={isEditing ? "bg-muted" : ""}
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Code cannot be changed after creation
              </p>
            )}
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Enter party name"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

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
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
