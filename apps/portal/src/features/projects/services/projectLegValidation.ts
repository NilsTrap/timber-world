import { z } from "zod";

const uuid = z.string().uuid();
const createSchema = z.object({
  sourceProjectId: uuid,
  buyerOrganisationId: uuid.nullable(),
  sellerOrganisationId: uuid.nullable(),
  workPackages: z.array(z.object({ originLineItemId: uuid, quantity: z.coerce.number().positive() })).min(1),
}).refine((value) => value.buyerOrganisationId || value.sellerOrganisationId, "At least one party is required")
  .refine((value) => !value.buyerOrganisationId || !value.sellerOrganisationId || value.buyerOrganisationId !== value.sellerOrganisationId, "Buyer and seller must differ");

export function parseCreateProjectLegInput(raw: unknown) {
  const parsed = createSchema.safeParse(raw);
  if (parsed.success) return parsed;
  const issue = parsed.error.issues[0];
  return {
    success: false as const,
    error: issue?.path[0] === "workPackages"
      ? "Select at least one available work package with a valid positive quantity"
      : issue?.message ?? "Invalid project leg",
    code: "VALIDATION_ERROR" as const,
  };
}
