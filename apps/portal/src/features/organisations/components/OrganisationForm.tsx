"use client";

import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { createOrganisation, updateOrganisation } from "../actions";
import type { Organisation } from "../types";

interface OrganisationFormProps {
  organisation?: Organisation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Company-card fields shared by create + edit (all optional). These feed the
// generated documents' party cards and the Oscar CRM write-through (E4).
const companyCardShape = {
  legalAddress: z.string().max(300).optional(),
  vatNumber: z.string().max(50).optional(),
  registrationNumber: z.string().max(50).optional(),
  country: z.string().max(60).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(150).optional(),
  website: z.string().max(200).optional(),
  bankName: z.string().max(150).optional(),
  bankAccountNumber: z.string().max(80).optional(),
  bankSwiftCode: z.string().max(20).optional(),
};

const createFormSchema = z.object({
  code: z
    .string()
    .length(3, "Code must be exactly 3 characters")
    .refine((val) => /^[A-Z]/.test(val.toUpperCase()), {
      message: "First character must be a letter (A-Z), not a number",
    })
    .refine((val) => /^[A-Z][A-Z0-9]{2}$/.test(val.toUpperCase()), {
      message: "Code must be a letter followed by 2 letters or numbers",
    })
    .transform((val) => val.toUpperCase()),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").trim(),
  ...companyCardShape,
});

const editFormSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").trim(),
  ...companyCardShape,
});

type FormInput = z.infer<typeof createFormSchema>;

/** The optional company-card text fields, in display order (label + placeholder). */
const CARD_FIELDS: { key: keyof typeof companyCardShape; label: string; placeholder?: string }[] = [
  { key: "legalAddress", label: "Legal address", placeholder: "Street, city, postcode" },
  { key: "country", label: "Country (ISO-2)", placeholder: "LV" },
  { key: "vatNumber", label: "VAT number", placeholder: "LV40000000000" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "bankName", label: "Bank name" },
  { key: "bankAccountNumber", label: "Bank account / IBAN" },
  { key: "bankSwiftCode", label: "SWIFT / BIC" },
];

/**
 * Organisation Form
 *
 * Dialog form for adding or editing an organisation + its company card.
 * When editing, the code field is disabled (immutable).
 */
export function OrganisationForm({ organisation, open, onOpenChange, onSuccess }: OrganisationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!organisation;
  const formSchema = isEditing ? editFormSchema : createFormSchema;

  const cardDefaults = (org?: Organisation | null) => ({
    legalAddress: org?.legalAddress ?? "",
    vatNumber: org?.vatNumber ?? "",
    registrationNumber: org?.registrationNumber ?? "",
    country: org?.country ?? "",
    phone: org?.phone ?? "",
    email: org?.email ?? "",
    website: org?.website ?? "",
    bankName: org?.bankName ?? "",
    bankAccountNumber: org?.bankAccountNumber ?? "",
    bankSwiftCode: org?.bankSwiftCode ?? "",
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormInput>({
    // create/edit schemas differ only in whether `code` is required, so cast the
    // conditionally-chosen resolver to the (superset) create-shaped FormInput.
    resolver: zodResolver(formSchema) as Resolver<FormInput>,
    defaultValues: { code: organisation?.code ?? "", name: organisation?.name ?? "", ...cardDefaults(organisation) },
  });

  useEffect(() => {
    if (open) reset({ code: organisation?.code ?? "", name: organisation?.name ?? "", ...cardDefaults(organisation) });
  }, [open, organisation, reset]);

  // Auto-uppercase the code field (create only)
  const codeValue = watch("code");
  useEffect(() => {
    if (codeValue && !isEditing) {
      const uppercased = codeValue.toUpperCase().slice(0, 3);
      if (uppercased !== codeValue) setValue("code", uppercased);
    }
  }, [codeValue, isEditing, setValue]);

  const onSubmit = async (data: FormInput) => {
    setIsSubmitting(true);
    try {
      const card = {
        legalAddress: data.legalAddress,
        vatNumber: data.vatNumber,
        registrationNumber: data.registrationNumber,
        country: data.country,
        phone: data.phone,
        email: data.email,
        website: data.website,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankSwiftCode: data.bankSwiftCode,
      };
      const result = isEditing
        ? await updateOrganisation(organisation.id, { name: data.name, ...card })
        : await createOrganisation({ code: data.code, name: data.name, ...card });
      if (result.success) {
        toast.success(isEditing ? "Organisation updated" : "Organisation created");
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
    if (!newOpen) reset();
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Organisation" : "Add Organisation"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              {isEditing && <p className="text-xs text-muted-foreground">Code cannot be changed after creation</p>}
              {errors.code && <p className="text-sm text-destructive" role="alert">{errors.code.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" placeholder="Organisation name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name.message}</p>}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Company card <span className="font-normal normal-case">(optional — used on documents &amp; CRM)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CARD_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
                  <Input id={f.key} placeholder={f.placeholder} {...register(f.key)} />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
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
