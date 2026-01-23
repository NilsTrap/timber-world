import { z } from "zod";

/**
 * Party Code Schema
 *
 * Validates that code is exactly 3 uppercase characters.
 * First character must be a letter (A-Z), remaining can be letters or numbers.
 */
export const partyCodeSchema = z
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
 * Create Party Schema
 *
 * Validates input for creating a new party.
 */
export const createPartySchema = z.object({
  code: partyCodeSchema,
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
});

export type CreatePartyInput = z.infer<typeof createPartySchema>;

/**
 * Update Party Schema
 *
 * Validates input for updating a party (name only, code is immutable).
 */
export const updatePartySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
});

export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
