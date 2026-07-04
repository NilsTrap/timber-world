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
  DialogDescription,
  DialogFooter,
} from "@timber/ui";
import { updateOrganisationUser } from "../actions";

/** Minimal person shape this dialog edits (works for both the table row and detail). */
export interface EditablePerson {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Advisory org context for the update action (the person's primary org). */
  primaryOrgId: string | null;
}

interface PersonEditDialogProps {
  person: EditablePerson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").trim(),
  email: z.string().email("Invalid email address").max(255).trim(),
  phone: z.string().max(40, "Phone must be 40 characters or less").trim(),
});

type EditInput = z.infer<typeof editSchema>;

/**
 * Q4 · Edit a person's profile (name / email / phone). Shared by the People
 * directory row action and the person detail. Persists via updateOrganisationUser
 * (which checks email uniqueness). Email edits update portal_users only, not the
 * Supabase auth login email.
 */
export function PersonEditDialog({ person, open, onOpenChange, onSuccess }: PersonEditDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditInput>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  useEffect(() => {
    if (open && person) {
      reset({ name: person.name, email: person.email, phone: person.phone ?? "" });
    }
  }, [open, person, reset]);

  const onSubmit = async (data: EditInput) => {
    if (!person) return;
    setIsSubmitting(true);
    const result = await updateOrganisationUser(person.id, person.primaryOrgId ?? "", {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
    });
    setIsSubmitting(false);
    if (result.success) {
      toast.success("Profile updated");
      onOpenChange(false);
      onSuccess();
    } else if (result.code === "DUPLICATE_EMAIL") {
      toast.error("Email already registered to another person");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update the person&apos;s name, email and phone.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="person-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="person-name" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="person-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input id="person-email" type="email" {...register("email")} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            <p className="text-xs text-muted-foreground">
              Changes the portal email only — not the login email used at sign-in.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="person-phone">Phone</Label>
            <Input id="person-phone" {...register("phone")} placeholder="Optional" aria-invalid={!!errors.phone} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
