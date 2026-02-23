import { z } from "zod";

/**
 * Create Order Schema
 *
 * Validates input for creating a new order.
 */
export const createOrderSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or less")
    .trim(),
  organisationId: z.string().uuid("Invalid organisation"),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  volumeM3: z
    .number()
    .positive("Volume must be positive")
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  valueCents: z
    .number()
    .int("Value must be a whole number")
    .min(0, "Value cannot be negative")
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  currency: z.enum(["EUR", "GBP", "USD"]).default("EUR"),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or less")
    .nullable()
    .optional()
    .transform((val) => val ?? null),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Update Order Schema
 *
 * Validates input for updating an order.
 * All fields optional except we need at least one field.
 */
export const updateOrderSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(200, "Name must be 200 characters or less")
      .trim()
      .optional(),
    organisationId: z.string().uuid("Invalid organisation").optional(),
    orderDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
      .optional(),
    volumeM3: z
      .number()
      .positive("Volume must be positive")
      .nullable()
      .optional(),
    valueCents: z
      .number()
      .int("Value must be a whole number")
      .min(0, "Value cannot be negative")
      .nullable()
      .optional(),
    currency: z.enum(["EUR", "GBP", "USD"]).optional(),
    notes: z
      .string()
      .max(1000, "Notes must be 1000 characters or less")
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

/**
 * Update Order Status Schema
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "draft",
    "pending",
    "confirmed",
    "in_progress",
    "shipped",
    "completed",
  ]),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
