import { z } from "zod";

/**
 * Organisation Code Schema
 *
 * Validates that code is exactly 3 uppercase characters.
 * First character must be a letter (A-Z), remaining can be letters or numbers.
 */
export const orgCodeSchema = z
  .string()
  .length(3, "Code must be exactly 3 characters")
  .refine((val) => /^[A-Z]/.test(val.toUpperCase()), {
    message: "First character must be a letter (A-Z), not a number",
  })
  .refine((val) => /^[A-Z][A-Z0-9]{2}$/.test(val.toUpperCase()), {
    message: "Code must be a letter followed by 2 letters or numbers",
  })
  .transform((val) => val.toUpperCase());

/**
 * Create Organisation Schema
 *
 * Validates input for creating a new organisation.
 */
export const createOrgSchema = z.object({
  code: orgCodeSchema,
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

/**
 * Update Organisation Schema
 *
 * Validates input for updating an organisation name and optionally code.
 */
export const updateOrgSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  code: orgCodeSchema.optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
