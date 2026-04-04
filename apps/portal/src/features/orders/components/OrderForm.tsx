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
  Textarea,
} from "@timber/ui";
import { createOrder, updateOrder } from "../actions";
import { getActiveOrganisations } from "@/features/shipments/actions";
import type { Order } from "../types";
import { CURRENCIES } from "../types";

interface OrganisationOption {
  id: string;
  code: string;
  name: string;
}

interface OrderFormProps {
  order?: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isAdmin: boolean;
  /** Whether user can pick which customer the order is for (salesperson/admin) */
  canSelectCustomer: boolean;
  /** For users who can't select customer: their organisation ID (auto-filled) */
  userOrganisationId?: string | null;
  userOrganisationName?: string | null;
}

// Form schema
const formSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or less")
    .trim(),
  organisationId: z.string().min(1, "Customer is required"),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  volumeM3: z.string().optional(),
  valueCents: z.string().optional(),
  currency: z.enum(["EUR", "GBP", "USD"]),
  notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
});

type FormInput = z.infer<typeof formSchema>;

/**
 * Order Form
 *
 * Dialog form for adding or editing an order.
 */
export function OrderForm({
  order,
  open,
  onOpenChange,
  onSuccess,
  isAdmin,
  canSelectCustomer,
  userOrganisationId,
  userOrganisationName,
}: OrderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const isEditing = !!order;

  // For users who can't select customer, default org to their own
  const defaultOrgId = order?.organisationId ?? (canSelectCustomer ? "" : (userOrganisationId ?? ""));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: order?.name ?? "",
      organisationId: defaultOrgId,
      orderDate: order?.orderDate ?? new Date().toISOString().split("T")[0],
      volumeM3: order?.volumeM3?.toString() ?? "",
      valueCents: order?.valueCents ? (order.valueCents / 100).toString() : "",
      currency: order?.currency ?? "EUR",
      notes: order?.notes ?? "",
    },
  });

  // Load organisations on open (only for users who can select customer)
  useEffect(() => {
    if (open && canSelectCustomer) {
      setIsLoadingOrgs(true);
      getActiveOrganisations().then((result) => {
        if (result.success) {
          setOrganisations(result.data);
        } else {
          toast.error(result.error);
        }
        setIsLoadingOrgs(false);
      });
    }
  }, [open, canSelectCustomer]);

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({
        name: order?.name ?? "",
        organisationId: order?.organisationId ?? (canSelectCustomer ? "" : (userOrganisationId ?? "")),
        orderDate: order?.orderDate ?? new Date().toISOString().split("T")[0],
        volumeM3: order?.volumeM3?.toString() ?? "",
        valueCents: order?.valueCents ? (order.valueCents / 100).toString() : "",
        currency: order?.currency ?? "EUR",
        notes: order?.notes ?? "",
      });
    }
  }, [open, order, reset, canSelectCustomer, userOrganisationId]);

  const onSubmit = async (data: FormInput) => {
    setIsSubmitting(true);

    try {
      // Convert form strings to proper types
      const volumeM3 = data.volumeM3 ? parseFloat(data.volumeM3) : null;
      const valueCents = data.valueCents ? Math.round(parseFloat(data.valueCents) * 100) : null;

      if (isEditing) {
        const result = await updateOrder(order.id, {
          name: data.name,
          organisationId: data.organisationId,
          orderDate: data.orderDate,
          volumeM3,
          valueCents,
          currency: data.currency,
          notes: data.notes || null,
        });
        if (result.success) {
          toast.success("Order updated");
          reset();
          onOpenChange(false);
          onSuccess();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createOrder({
          name: data.name,
          organisationId: data.organisationId,
          orderDate: data.orderDate,
          volumeM3,
          valueCents,
          currency: data.currency,
          notes: data.notes || null,
        });
        if (result.success) {
          toast.success(`Order ${result.data.code} created`);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Order" : "Add Order"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Enter order name/description"
              {...register("name")}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-sm text-destructive" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          {canSelectCustomer ? (
            <div className="space-y-2">
              <Label htmlFor="organisationId">
                Customer <span className="text-destructive">*</span>
              </Label>
              <select
                id="organisationId"
                {...register("organisationId")}
                disabled={isLoadingOrgs}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{isLoadingOrgs ? "Loading..." : "Select customer..."}</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.code} - {org.name}
                  </option>
                ))}
              </select>
              {errors.organisationId && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.organisationId.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Customer</Label>
              <p className="text-sm py-2">{userOrganisationName || "Your organisation"}</p>
              <input type="hidden" {...register("organisationId")} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="orderDate">
              Order Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="orderDate"
              type="date"
              {...register("orderDate")}
              aria-invalid={!!errors.orderDate}
            />
            {errors.orderDate && (
              <p className="text-sm text-destructive" role="alert">
                {errors.orderDate.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="volumeM3">Volume (m³)</Label>
              <Input
                id="volumeM3"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                {...register("volumeM3")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valueCents">Value</Label>
              <div className="flex gap-2">
                <select
                  {...register("currency")}
                  className="flex h-9 w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <Input
                  id="valueCents"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="flex-1"
                  {...register("valueCents")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              rows={3}
              {...register("notes")}
              aria-invalid={!!errors.notes}
            />
            {errors.notes && (
              <p className="text-sm text-destructive" role="alert">
                {errors.notes.message}
              </p>
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
            <Button type="submit" disabled={isSubmitting || isLoadingOrgs}>
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
