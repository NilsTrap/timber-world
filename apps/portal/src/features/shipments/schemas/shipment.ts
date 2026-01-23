import { z } from "zod";

/** Schema for a single package row submission */
export const packageInputSchema = z.object({
  productNameId: z.string().uuid().nullable(),
  woodSpeciesId: z.string().uuid().nullable(),
  humidityId: z.string().uuid().nullable(),
  typeId: z.string().uuid().nullable(),
  processingId: z.string().uuid().nullable(),
  fscId: z.string().uuid().nullable(),
  qualityId: z.string().uuid().nullable(),
  thickness: z.string(),
  width: z.string(),
  length: z.string(),
  pieces: z.string(),
  volumeM3: z.number().nullable(),
  volumeIsCalculated: z.boolean(),
});

/** Schema for creating a shipment with packages */
export const createShipmentSchema = z.object({
  fromPartyId: z.string().uuid("Invalid From Organisation"),
  toPartyId: z.string().uuid("Invalid To Organisation"),
  shipmentDate: z.string().min(1, "Date is required"),
  transportCostEur: z.number().nonnegative().nullable(),
  packages: z
    .array(packageInputSchema)
    .min(1, "At least one package is required"),
}).refine((data) => data.fromPartyId !== data.toPartyId, {
  message: "From and To organisations must be different",
  path: ["toPartyId"],
});

export type CreateShipmentFormData = z.infer<typeof createShipmentSchema>;
export type PackageInputData = z.infer<typeof packageInputSchema>;
