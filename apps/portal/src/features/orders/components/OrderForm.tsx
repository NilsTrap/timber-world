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
import { createOrder, updateOrder, getCustomerOptions } from "../actions";
import type { Order } from "../types";

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
  projectNumber: z
    .string()
    .max(200, "Project number must be 200 characters or less")
    .trim(),
  customerOrganisationId: z.string().min(1, "Customer is required"),
  dateReceived: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  dateLoaded: z.string(),
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
  const defaultOrgId = order?.customerOrganisationId ?? (canSelectCustomer ? "" : (userOrganisationId ?? ""));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: order?.name ?? "",
      projectNumber: order?.projectNumber ?? "",
      customerOrganisationId: defaultOrgId,
      dateReceived: order?.dateReceived ?? new Date().toISOString().split("T")[0],
      dateLoaded: order?.dateLoaded ?? "",
    },
  });

  // Load organisations on open (only for users who can select customer)
  useEffect(() => {
    if (open && canSelectCustomer) {
      setIsLoadingOrgs(true);
      getCustomerOptions().then((result) => {
        if (result.success) {
          setOrganisations(result.data ?? []);
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
        projectNumber: order?.projectNumber ?? "",
        customerOrganisationId: order?.customerOrganisationId ?? (canSelectCustomer ? "" : (userOrganisationId ?? "")),
        dateReceived: order?.dateReceived ?? new Date().toISOString().split("T")[0],
        dateLoaded: order?.dateLoaded ?? "",
      });
    }
  }, [open, order, reset, canSelectCustomer, userOrganisationId]);

  const onSubmit = async (data: FormInput) => {
    setIsSubmitting(true);

    try {
      if (isEditing) {
        const result = await updateOrder(order.id, {
          name: data.name,
          projectNumber: data.projectNumber || null,
          customerOrganisationId: data.customerOrganisationId,
          dateReceived: data.dateReceived,
          dateLoaded: data.dateLoaded || null,
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
          projectNumber: data.projectNumber || null,
          customerOrganisationId: data.customerOrganisationId,
          dateReceived: data.dateReceived,
          dateLoaded: data.dateLoaded || null,
        });
        if (result.success) {
          toast.success("Order created");
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
          {canSelectCustomer ? (
            <div className="space-y-2">
              <Label htmlFor="customerOrganisationId">
                Customer <span className="text-destructive">*</span>
              </Label>
              <select
                id="customerOrganisationId"
                {...register("customerOrganisationId")}
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
              {errors.customerOrganisationId && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.customerOrganisationId.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Customer</Label>
              <p className="text-sm py-2">{userOrganisationName || "Your organisation"}</p>
              <input type="hidden" {...register("customerOrganisationId")} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Purchase Order Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Enter purchase order number"
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

          <div className="space-y-2">
            <Label htmlFor="projectNumber">Project Number</Label>
            <Input
              id="projectNumber"
              placeholder="Enter project number"
              {...register("projectNumber")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateReceived">
              Date Received <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dateReceived"
              type="date"
              {...register("dateReceived")}
              aria-invalid={!!errors.dateReceived}
            />
            {errors.dateReceived && (
              <p className="text-sm text-destructive" role="alert">
                {errors.dateReceived.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateLoaded">Date Loaded</Label>
            <Input
              id="dateLoaded"
              type="date"
              {...register("dateLoaded")}
            />
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
