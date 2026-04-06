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
  projectNumber: z
    .string()
    .max(200, "Project number must be 200 characters or less")
    .trim()
    .nullable()
    .optional()
    .transform((val) => val || null),
  customerOrganisationId: z.string().uuid("Invalid organisation").nullable().optional().transform((val) => val || null),
  dateReceived: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  dateLoaded: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
    .nullable()
    .optional()
    .transform((val) => val || null),
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
    projectNumber: z
      .string()
      .max(200, "Project number must be 200 characters or less")
      .trim()
      .nullable()
      .optional(),
    customerOrganisationId: z.string().uuid("Invalid organisation").optional(),
    sellerOrganisationId: z.string().uuid("Invalid organisation").nullable().optional(),
    producerOrganisationId: z.string().uuid("Invalid organisation").nullable().optional(),
    plannedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
      .nullable()
      .optional(),
    dateReceived: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
      .optional(),
    dateLoaded: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
      .nullable()
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
    treadLength: z
      .string()
      .max(50, "Tread length must be 50 characters or less")
      .nullable()
      .optional(),
    advanceInvoiceNumber: z
      .string()
      .max(100, "Advance invoice number must be 100 characters or less")
      .nullable()
      .optional(),
    invoiceNumber: z
      .string()
      .max(100, "Invoice number must be 100 characters or less")
      .nullable()
      .optional(),
    packageNumber: z
      .string()
      .max(100, "Package number must be 100 characters or less")
      .nullable()
      .optional(),
    transportInvoiceNumber: z
      .string()
      .max(100, "Transport invoice number must be 100 characters or less")
      .nullable()
      .optional(),
    transportPrice: z
      .string()
      .max(50, "Transport price must be 50 characters or less")
      .nullable()
      .optional(),
    treadM3: z.number().min(0).nullable().optional(),
    winderM3: z.number().min(0).nullable().optional(),
    quarterM3: z.number().min(0).nullable().optional(),
    usedMaterialM3: z.number().min(0).nullable().optional(),
    productionMaterial: z.number().min(0).nullable().optional(),
    productionWork: z.number().min(0).nullable().optional(),
    productionFinishing: z.number().min(0).nullable().optional(),
    productionInvoiceNumber: z.string().max(100).nullable().optional(),
    productionPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").nullable().optional(),
    woodArt: z.number().min(0).nullable().optional(),
    glowing: z.number().min(0).nullable().optional(),
    woodArtCnc: z.number().min(0).nullable().optional(),
    woodArtInvoiceNumber: z.string().max(100).nullable().optional(),
    woodArtPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").nullable().optional(),
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
    "confirmed",
    "loaded",
  ]),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
