import { z } from "zod";

/**
 * Reference Option Schema
 *
 * Validates input for creating/updating reference options.
 */
export const referenceOptionSchema = z.object({
  value: z
    .string()
    .min(1, "Value is required")
    .max(100, "Value must be 100 characters or less")
    .trim(),
  code: z
    .string()
    .min(1, "Code is required")
    .max(10, "Code must be 10 characters or less")
    .regex(/^[A-Z0-9]+$/, "Code must be uppercase letters/numbers only")
    .optional(),
  workUnit: z
    .string()
    .max(10, "Work unit must be 10 characters or less")
    .optional(),
  workFormula: z
    .string()
    .optional()
    .transform((v) => (!v || v === "") ? undefined : v),
  price: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      // Handle European format (comma as decimal separator)
      const num = typeof v === "string" ? parseFloat(v.replace(',', '.')) : v;
      return isNaN(num) ? null : num;
    }),
});

export type ReferenceOptionInput = z.infer<typeof referenceOptionSchema>;

/**
 * Reorder Options Schema
 *
 * Validates input for reordering options.
 */
export const reorderOptionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid("Invalid option ID"),
      sortOrder: z.number().int().min(0, "Sort order must be non-negative"),
    })
  ),
});

export type ReorderOptionsInput = z.infer<typeof reorderOptionsSchema>;
