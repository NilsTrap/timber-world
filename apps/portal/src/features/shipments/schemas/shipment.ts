import { z } from "zod";

/** Dimension field: number, range (e.g. "40-50"), or empty */
const dimensionField = z.string().max(20).regex(
  /^$|^[\d.,]+(-[\d.,]+)?$/,
  "Must be a number or range (e.g. 40 or 40-50)"
);

/** Pieces field: number, "-" (uncountable), or empty */
const piecesField = z.string().max(20).regex(
  /^$|^-$|^[\d]+$/,
  "Must be a number or '-' for uncountable"
);

/** Schema for a single package row submission */
export const packageInputSchema = z.object({
  productNameId: z.string().uuid().nullable(),
  woodSpeciesId: z.string().uuid().nullable(),
  humidityId: z.string().uuid().nullable(),
  typeId: z.string().uuid().nullable(),
  processingId: z.string().uuid().nullable(),
  fscId: z.string().uuid().nullable(),
  qualityId: z.string().uuid().nullable(),
  thickness: dimensionField,
  width: dimensionField,
  length: dimensionField,
  pieces: piecesField,
  volumeM3: z.number().nullable(),
  volumeIsCalculated: z.boolean(),
});

/** Schema for creating a shipment with packages */
export const createShipmentSchema = z.object({
  fromOrganisationId: z.string().uuid("Invalid From Organisation"),
  toOrganisationId: z.string().uuid("Invalid To Organisation"),
  shipmentDate: z.string().min(1, "Date is required"),
  transportCostEur: z.number().nonnegative().nullable(),
  packages: z
    .array(packageInputSchema)
    .min(1, "At least one package is required"),
}).refine((data) => data.fromOrganisationId !== data.toOrganisationId, {
  message: "From and To organisations must be different",
  path: ["toOrganisationId"],
});

export type CreateShipmentFormData = z.infer<typeof createShipmentSchema>;
export type PackageInputData = z.infer<typeof packageInputSchema>;
