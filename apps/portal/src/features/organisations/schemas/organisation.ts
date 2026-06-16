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
 * Company-card fields (the "company card" captured for documents + CRM sync).
 * All optional — empty strings are normalised to null by the actions. `country`
 * is best given as an ISO-3166 alpha-2 code (e.g. LV, GB) so VAT rules resolve.
 */
const companyCardFields = {
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

/**
 * Create Organisation Schema
 *
 * Validates input for creating a new organisation (code + name + company card).
 */
export const createOrgSchema = z.object({
  code: orgCodeSchema,
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  ...companyCardFields,
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

/**
 * Update Organisation Schema
 *
 * Validates input for updating an organisation name, optional code + company card.
 */
export const updateOrgSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  code: orgCodeSchema.optional(),
  ...companyCardFields,
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
